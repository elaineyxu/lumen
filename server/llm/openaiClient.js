const http = require('http');
const https = require('https');
const tls = require('tls');
const crypto = require('crypto');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = Number(process.env.LUMEN_WHISPER_TIMEOUT_MS || 120000);

const DEFAULT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {},
};
const DEFAULT_TIMEOUT_MS = Number(process.env.LUMEN_LLM_TIMEOUT_MS || 45000);

function describeFetchError(error, endpoint) {
  if (error && (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT')) {
    return 'OpenAI request timed out after ' + Math.round(DEFAULT_TIMEOUT_MS / 1000) + 's. Check the server network or proxy configuration.';
  }
  if (error && error.name === 'AbortError') {
    return 'OpenAI request was aborted after ' + Math.round(DEFAULT_TIMEOUT_MS / 1000) + 's. Check the server network or proxy configuration.';
  }
  const cause = error && error.cause;
  const detail = cause && (cause.code || cause.message) ? ' (' + (cause.code || cause.message) + ')' : '';
  return 'Could not reach OpenAI Responses API at ' + endpoint + detail + '. Check the server network, proxy, or VPN configuration.';
}

function proxyUrl() {
  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';
}

function proxyAuthHeader(proxy) {
  if (!proxy.username && !proxy.password) return null;
  return 'Basic ' + Buffer.from(decodeURIComponent(proxy.username) + ':' + decodeURIComponent(proxy.password)).toString('base64');
}

function requestDirect(url, body, headers, timeoutMs) {
  const target = new URL(url);
  const client = target.protocol === 'http:' ? http : https;
  const timeout = timeoutMs || DEFAULT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const req = client.request({
      method: 'POST',
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      path: target.pathname + target.search,
      headers,
    }, (res) => collectResponse(res, resolve, reject));
    req.setTimeout(timeout, () => req.destroy(Object.assign(new Error('request timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end(body);
  });
}

function requestViaProxy(url, body, headers, proxyValue, timeoutMs) {
  const timeout = timeoutMs || DEFAULT_TIMEOUT_MS;
  const target = new URL(url);
  const proxy = new URL(proxyValue);
  const auth = proxyAuthHeader(proxy);
  if (target.protocol === 'http:') {
    return new Promise((resolve, reject) => {
      const reqHeaders = { ...headers, Host: target.host };
      if (auth) reqHeaders['Proxy-Authorization'] = auth;
      const req = http.request({
        method: 'POST',
        hostname: proxy.hostname,
        port: proxy.port || 8080,
        path: target.href,
        headers: reqHeaders,
      }, (res) => collectResponse(res, resolve, reject));
      req.setTimeout(timeout, () => req.destroy(Object.assign(new Error('proxy request timed out'), { code: 'ETIMEDOUT' })));
      req.on('error', reject);
      req.end(body);
    });
  }

  return new Promise((resolve, reject) => {
    const connectHeaders = { Host: target.host };
    if (auth) connectHeaders['Proxy-Authorization'] = auth;
    const connect = http.request({
      method: 'CONNECT',
      hostname: proxy.hostname,
      port: proxy.port || 8080,
      path: target.hostname + ':' + (target.port || 443),
      headers: connectHeaders,
    });
    connect.setTimeout(timeout, () => connect.destroy(Object.assign(new Error('proxy tunnel timed out'), { code: 'ETIMEDOUT' })));
    connect.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error('proxy CONNECT failed: HTTP ' + res.statusCode));
        return;
      }
      const secureSocket = tls.connect({ socket, servername: target.hostname });
      secureSocket.on('secureConnect', () => {
        const req = https.request({
          method: 'POST',
          host: target.hostname,
          port: target.port || 443,
          path: target.pathname + target.search,
          headers,
          createConnection: () => secureSocket,
        }, (response) => collectResponse(response, resolve, reject));
        req.setTimeout(timeout, () => req.destroy(Object.assign(new Error('proxied request timed out'), { code: 'ETIMEDOUT' })));
        req.on('error', reject);
        req.end(body);
      });
      secureSocket.on('error', reject);
    });
    connect.on('error', reject);
    connect.end();
  });
}

function collectResponse(res, resolve, reject) {
  let raw = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    raw += chunk;
  });
  res.on('end', () => {
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (error) {
      reject(new Error('OpenAI returned non-JSON response: HTTP ' + res.statusCode));
      return;
    }
    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, payload });
  });
  res.on('error', reject);
}

function postJson(url, payload, headers) {
  const body = JSON.stringify(payload);
  const nextHeaders = {
    ...headers,
    'Content-Length': Buffer.byteLength(body),
  };
  const proxy = proxyUrl();
  return proxy ? requestViaProxy(url, body, nextHeaders, proxy) : requestDirect(url, body, nextHeaders);
}

function extractText(payload) {
  if (!payload) return '';
  if (typeof payload.output_text === 'string') return payload.output_text;
  const parts = [];
  (payload.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (typeof content.text === 'string') parts.push(content.text);
      if (typeof content.output_text === 'string') parts.push(content.output_text);
    });
  });
  return parts.join('\n').trim();
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('LLM returned empty output');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw error;
    return JSON.parse(match[0]);
  }
}

async function callOpenAiJsonInput({ apiKey, endpoint, model, input, schema, schemaName }) {
  const url = endpoint || OPENAI_RESPONSES_URL;
  let result;
  try {
    result = await postJson(url, {
      model,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName || 'lumen_stage_output',
          schema: schema || DEFAULT_JSON_SCHEMA,
          strict: true,
        },
      },
    }, {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
    });
  } catch (error) {
    throw new Error(describeFetchError(error, url));
  }

  const payload = result.payload || {};
  if (!result.ok) {
    const message = payload && payload.error && payload.error.message ? payload.error.message : 'HTTP ' + result.status;
    throw new Error('OpenAI Responses API failed: ' + message);
  }

  return parseJsonObject(extractText(payload));
}

async function callOpenAiJson({ apiKey, endpoint, model, system, user, schema, schemaName }) {
  return callOpenAiJsonInput({
    apiKey,
    endpoint,
    model,
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    schema,
    schemaName,
  });
}

function buildMultipart(fields, file) {
  const boundary = '----LumenForm' + crypto.randomBytes(16).toString('hex');
  const CRLF = '\r\n';
  const parts = [];
  Object.entries(fields).forEach(([name, value]) => {
    if (value === undefined || value === null || value === '') return;
    parts.push(Buffer.from('--' + boundary + CRLF + 'Content-Disposition: form-data; name="' + name + '"' + CRLF + CRLF + String(value) + CRLF));
  });
  parts.push(Buffer.from(
    '--' + boundary + CRLF +
    'Content-Disposition: form-data; name="file"; filename="' + (file.filename || 'audio') + '"' + CRLF +
    'Content-Type: ' + (file.contentType || 'application/octet-stream') + CRLF + CRLF
  ));
  parts.push(file.buffer);
  parts.push(Buffer.from(CRLF + '--' + boundary + '--' + CRLF));
  return { body: Buffer.concat(parts), boundary };
}

async function transcribeAudio({ apiKey, endpoint, model, buffer, filename, contentType, language, prompt }) {
  if (!buffer || !buffer.length) throw new Error('Audio transcription received an empty file.');
  const url = endpoint || OPENAI_TRANSCRIPTION_URL;
  const { body, boundary } = buildMultipart(
    { model: model || 'whisper-1', response_format: 'json', language: language || '', prompt: prompt || '' },
    { buffer, filename, contentType }
  );
  const headers = {
    Authorization: 'Bearer ' + apiKey,
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length,
  };
  let result;
  try {
    const proxy = proxyUrl();
    result = proxy
      ? await requestViaProxy(url, body, headers, proxy, DEFAULT_TRANSCRIPTION_TIMEOUT_MS)
      : await requestDirect(url, body, headers, DEFAULT_TRANSCRIPTION_TIMEOUT_MS);
  } catch (error) {
    throw new Error(describeFetchError(error, url));
  }

  const payload = result.payload || {};
  if (!result.ok) {
    const message = payload && payload.error && payload.error.message ? payload.error.message : 'HTTP ' + result.status;
    throw new Error('OpenAI transcription failed: ' + message);
  }
  return String(payload.text || '');
}

module.exports = {
  callOpenAiJson,
  callOpenAiJsonInput,
  transcribeAudio,
};
