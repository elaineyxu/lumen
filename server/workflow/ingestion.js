const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { runLlmImageStage, runWhisperStage } = require('../llm/stageRunner');

const MAX_FETCH_BYTES = Number(process.env.LUMEN_SOURCE_FETCH_MAX_BYTES || 8_000_000);
const FETCH_TIMEOUT_MS = Number(process.env.LUMEN_SOURCE_FETCH_TIMEOUT_MS || 25000);
const URL_PATTERN = /^https?:\/\/[^\s<>"']+$/i;
const IMAGE_OCR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ocrText: { type: 'string' },
    visualSummary: { type: 'string' },
    labels: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['ocrText', 'visualSummary', 'labels', 'warnings'],
};

function isUrl(value) {
  return URL_PATTERN.test(String(value || '').trim());
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

function decodeEntities(input) {
  return String(input || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

function normalizeWhitespace(input) {
  return String(input || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metaContent(html, names) {
  for (const name of names) {
    const re = new RegExp("<meta[^>]+(?:name|property)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']*)[\"']", 'i');
    const match = String(html || '').match(re);
    if (match && match[1]) return decodeEntities(match[1]).trim();
  }
  return '';
}

function titleFromHtml(html) {
  const og = metaContent(html, ['og:title', 'twitter:title']);
  if (og) return og;
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(decodeEntities(stripHtml(match[1]))) : '';
}

function extractReadableHtml(html) {
  const source = String(html || '');
  const article = source.match(/<article[\s\S]*?<\/article>/i);
  const main = source.match(/<main[\s\S]*?<\/main>/i);
  const body = source.match(/<body[\s\S]*?<\/body>/i);
  const chosen = article ? article[0] : main ? main[0] : body ? body[0] : source;
  return normalizeWhitespace(decodeEntities(stripHtml(chosen)));
}

function decodeResponseBuffer(buffer, encoding) {
  const enc = String(encoding || '').toLowerCase();
  if (enc.includes('gzip')) return zlib.gunzipSync(buffer);
  if (enc.includes('deflate')) return zlib.inflateSync(buffer);
  if (enc.includes('br')) return zlib.brotliDecompressSync(buffer);
  return buffer;
}

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 4) {
      reject(new Error('Too many redirects while fetching source URL.'));
      return;
    }
    const target = new URL(url);
    const client = target.protocol === 'http:' ? http : https;
    const req = client.request({
      method: 'GET',
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      path: target.pathname + target.search,
      headers: {
        'User-Agent': 'LumenSourceIngest/1.0 (+local knowledge workflow)',
        Accept: 'text/html,application/xhtml+xml,application/pdf,text/plain,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }, (res) => {
      const location = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && location) {
        res.resume();
        resolve(fetchUrl(new URL(location, target).href, redirects + 1));
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error('Source URL returned HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_FETCH_BYTES) {
          req.destroy(new Error('Source URL is larger than ' + MAX_FETCH_BYTES + ' bytes.'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          const buffer = decodeResponseBuffer(Buffer.concat(chunks), res.headers['content-encoding']);
          resolve({
            url: target.href,
            contentType: String(res.headers['content-type'] || ''),
            buffer,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy(new Error('Timed out while fetching source URL.')));
    req.on('error', reject);
    req.end();
  });
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function extractTextFromPdfBuffer(buffer) {
  const raw = buffer.toString('latin1');
  const parts = [];
  const literalRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
  let match;
  while ((match = literalRe.exec(raw))) {
    parts.push(match[1].replace(/\\([nrtbf()\\])/g, '$1'));
  }
  const arrayRe = /\[((?:\([^()\\]*(?:\\.[^()\\]*)*\)\s*)+)\]\s*TJ/g;
  while ((match = arrayRe.exec(raw))) {
    const text = [];
    const itemRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
    let item;
    while ((item = itemRe.exec(match[1]))) text.push(item[1].replace(/\\([nrtbf()\\])/g, '$1'));
    if (text.length) parts.push(text.join(''));
  }
  return normalizeWhitespace(parts.join('\n'));
}

function inflateZipEntry(buffer, localHeaderOffset) {
  // Local file header: sig(4) ver(2) flags(2) method(2) time(2) date(2) crc(4)
  // compSize(4) uncompSize(4) nameLen(2) extraLen(2) then name + extra + data.
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
  const method = buffer.readUInt16LE(localHeaderOffset + 8);
  const compSize = buffer.readUInt32LE(localHeaderOffset + 18);
  const nameLen = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLen = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLen + extraLen;
  const data = buffer.slice(dataStart, dataStart + compSize);
  if (method === 0) return data;
  if (method === 8) {
    try {
      return zlib.inflateRawSync(data);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function readZipEntry(buffer, entryName) {
  // Walk the central directory from the End Of Central Directory record.
  const eocdSig = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 22 - 65536; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSig) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  let offset = buffer.readUInt32LE(eocd + 16);
  const count = buffer.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + nameLen).toString('utf8');
    if (name === entryName) return inflateZipEntry(buffer, localOffset);
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function extractTextFromDocxBuffer(buffer) {
  const xmlBuffer = readZipEntry(buffer, 'word/document.xml');
  if (!xmlBuffer) return '';
  const xml = xmlBuffer.toString('utf8');
  const text = xml
    .replace(/<w:p[ >][\s\S]*?(?=<\/w:p>)/gi, (m) => m + '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<w:tab\b[^>]*\/?>/gi, '\t')
    .replace(/<w:br\b[^>]*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return normalizeWhitespace(decodeEntities(text));
}

function isDocx(mime, name) {
  return String(mime || '').includes('officedocument.wordprocessingml')
    || /\.docx(?:$|[?#])/i.test(String(name || ''));
}

async function transcribeAudioAttachment(attachment, buffer, mime, name) {
  const llm = await runWhisperStage({
    buffer,
    filename: name || attachment.name || attachment.filename || 'audio',
    contentType: mime || 'application/octet-stream',
    prompt: attachment.description || attachment.title || '',
  });
  if (!llm.ok || !llm.text) {
    return {
      text: '',
      warnings: ['Audio transcription unavailable: ' + (llm.error || llm.reason || 'unknown')],
      stage: llm,
    };
  }
  return { text: normalizeWhitespace(llm.text), warnings: [], stage: llm };
}

async function ocrImageAttachment(attachment, decoded, mime) {
  const imageUrl = attachment.dataUrl || (
    decoded && decoded.buffer ? 'data:' + (mime || decoded.mimeType || 'image/png') + ';base64,' + decoded.buffer.toString('base64') : ''
  );
  if (!imageUrl) return { text: '', warnings: ['Image OCR skipped because no image payload was available.'], stage: null };
  const llm = await runLlmImageStage({
    stage: 'imageOcr',
    schemaName: 'lumen_image_ocr',
    schema: IMAGE_OCR_SCHEMA,
    imageUrl,
    mimeType: mime,
    system: [
      'You are Lumen image ingestion.',
      'Extract visible text faithfully and describe only what is visible in the image.',
      'Do not infer hidden context. Keep OCR text separate from visual summary.',
    ].join(' '),
    prompt: JSON.stringify({
      task: 'Read this source image before it enters a personal wiki workflow.',
      file: {
        name: attachment.name || attachment.filename || '',
        mimeType: mime || '',
        userDescription: attachment.description || '',
        userOcrText: attachment.ocrText || '',
      },
      fieldDefinitions: {
        ocrText: 'All readable text visible in the image. Preserve line breaks when helpful.',
        visualSummary: 'Concise description of the visible image content, chart, diagram, screenshot, or document layout.',
        labels: 'Short retrieval labels such as screenshot, chart, handwritten_note, slide, document_scan.',
        warnings: 'Uncertainty, unreadable areas, low resolution, cropped content, or possible OCR errors.',
      },
      hardRules: [
        'If no text is visible, return an empty ocrText and describe the image.',
        'Do not translate unless the source mixes languages and translation is needed for clarity.',
        'Do not invent author, date, source, or claims beyond what is visible.',
      ],
    }, null, 2),
  });
  if (!llm.ok || !llm.output) {
    return {
      text: '',
      warnings: ['Image OCR unavailable: ' + (llm.error || llm.reason || 'unknown')],
      stage: llm,
    };
  }
  const parts = [
    llm.output.ocrText ? 'OCR text:\n' + llm.output.ocrText : '',
    llm.output.visualSummary ? 'Visual summary:\n' + llm.output.visualSummary : '',
    Array.isArray(llm.output.labels) && llm.output.labels.length ? 'Image labels: ' + llm.output.labels.join(', ') : '',
  ].filter(Boolean);
  return {
    text: parts.join('\n\n'),
    warnings: Array.isArray(llm.output.warnings) ? llm.output.warnings : [],
    stage: llm,
  };
}

async function attachmentText(attachment, options) {
  if (!attachment || typeof attachment !== 'object') return { text: '', warnings: [] };
  const warnings = [];
  if (attachment.text) return { text: String(attachment.text), warnings };
  const mime = String(attachment.mimeType || attachment.type || '').toLowerCase();
  const name = attachment.name || attachment.filename || 'uploaded file';
  const payload = attachment.dataUrl || attachment.base64 || '';
  const decoded = payload ? dataUrlToBuffer(payload) : null;
  if (decoded && (mime.includes('pdf') || decoded.mimeType.includes('pdf'))) {
    const text = extractTextFromPdfBuffer(decoded.buffer);
    if (text) return { text, warnings };
    warnings.push('PDF text extraction found no selectable text. Scanned PDFs need OCR text or an image/OCR model.');
  }
  if (decoded && isDocx(mime || decoded.mimeType, name)) {
    const text = extractTextFromDocxBuffer(decoded.buffer);
    if (text) return { text, warnings };
    warnings.push('Opened the Word document, but no readable paragraph text was found.');
  }
  if (decoded && (mime.startsWith('audio/') || decoded.mimeType.startsWith('audio/'))) {
    const userText = [
      attachment.transcript ? 'User transcript: ' + attachment.transcript : '',
      attachment.description ? 'User description: ' + attachment.description : '',
    ].filter(Boolean).join('\n');
    if (options && options.allowAi === false) {
      warnings.push('Audio transcription skipped in mock/local mode.');
      return {
        text: normalizeWhitespace([userText, 'Uploaded audio: ' + name].filter(Boolean).join('\n')),
        warnings,
      };
    }
    const transcription = await transcribeAudioAttachment(attachment, decoded.buffer, mime || decoded.mimeType, name);
    warnings.push(...transcription.warnings);
    return {
      text: normalizeWhitespace([transcription.text, userText].filter(Boolean).join('\n\n')),
      warnings,
      audioStage: transcription.stage,
    };
  }
  if (decoded && (mime.startsWith('image/') || decoded.mimeType.startsWith('image/'))) {
    if (options && options.allowAi === false) {
      warnings.push('Image OCR skipped in mock/local mode.');
      return {
        text: normalizeWhitespace([
          attachment.description ? 'User description: ' + attachment.description : '',
          attachment.ocrText ? 'User OCR text: ' + attachment.ocrText : '',
          'Uploaded image: ' + name,
        ].filter(Boolean).join('\n')),
        warnings,
      };
    }
    const ocr = await ocrImageAttachment(attachment, decoded, mime || decoded.mimeType);
    warnings.push(...ocr.warnings);
    const userText = [
      attachment.description ? 'User description: ' + attachment.description : '',
      attachment.ocrText ? 'User OCR text: ' + attachment.ocrText : '',
    ].filter(Boolean).join('\n');
    return {
      text: normalizeWhitespace([ocr.text, userText].filter(Boolean).join('\n\n')),
      warnings,
      llmStage: ocr.stage,
    };
  }
  if (decoded && (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('html'))) {
    return { text: decoded.buffer.toString('utf8'), warnings };
  }
  warnings.push('Stored file metadata for ' + name + ', but no readable text was embedded in the upload.');
  return {
    text: [
      'Uploaded file: ' + name,
      'MIME type: ' + (mime || (decoded && decoded.mimeType) || 'unknown'),
      attachment.size ? 'Size: ' + attachment.size + ' bytes' : '',
      attachment.description ? 'User description: ' + attachment.description : '',
      attachment.transcript ? 'Transcript: ' + attachment.transcript : '',
      attachment.ocrText ? 'OCR text: ' + attachment.ocrText : '',
    ].filter(Boolean).join('\n'),
    warnings,
  };
}

function collectAttachments(raw) {
  const items = [];
  if (raw.file) items.push(raw.file);
  if (raw.attachment) items.push(raw.attachment);
  if (Array.isArray(raw.files)) items.push(...raw.files);
  if (Array.isArray(raw.attachments)) items.push(...raw.attachments);
  return items;
}

function inferUrl(raw) {
  if (raw.url) return String(raw.url).trim();
  const text = String(raw.text || raw.content || '').trim();
  return isUrl(text) ? text : '';
}

async function ingestSource(rawSource, options) {
  const raw = rawSource || {};
  const warnings = [];
  const ingested = {
    ...raw,
    ingestion: {
      method: 'direct',
      fetchedUrl: '',
      contentType: '',
      warnings,
    },
  };
  if (!ingested.text && (raw.transcript || raw.ocrText || raw.description)) {
    ingested.text = [
      raw.transcript ? 'Transcript: ' + raw.transcript : '',
      raw.ocrText ? 'OCR text: ' + raw.ocrText : '',
      raw.description ? 'Description: ' + raw.description : '',
    ].filter(Boolean).join('\n\n');
  }

  const url = inferUrl(raw);
  if (url) {
    ingested.url = url;
    try {
      const fetched = await fetchUrl(url);
      ingested.ingestion.method = 'url_fetch';
      ingested.ingestion.fetchedUrl = fetched.url;
      ingested.ingestion.contentType = fetched.contentType;
      const audioUrl = fetched.contentType.includes('audio/') || /\.(mp3|m4a|wav|webm|ogg|flac|aac)(?:$|[?#])/i.test(url);
      const imageUrl = fetched.contentType.includes('image/') || /\.(png|jpe?g|gif|webp|bmp|tiff?)(?:$|[?#])/i.test(url);
      if (fetched.contentType.includes('pdf') || /\.pdf(?:$|[?#])/i.test(url)) {
        const pdfText = extractTextFromPdfBuffer(fetched.buffer);
        if (pdfText) ingested.text = pdfText;
        else warnings.push('Fetched PDF, but no selectable text could be extracted.');
      } else if (isDocx(fetched.contentType, url)) {
        const docxText = extractTextFromDocxBuffer(fetched.buffer);
        if (docxText) ingested.text = docxText;
        else warnings.push('Fetched the Word document, but no readable text could be extracted.');
      } else if (audioUrl) {
        if (options && options.allowAi === false) {
          warnings.push('Audio transcription skipped in mock/local mode.');
        } else {
          const transcription = await runWhisperStage({
            buffer: fetched.buffer,
            filename: url.split('/').pop() || 'audio',
            contentType: fetched.contentType || 'audio/mpeg',
          });
          ingested.ingestion.audioTranscription = {
            ok: Boolean(transcription.ok),
            skipped: Boolean(transcription.skipped),
            model: transcription.model || null,
            reason: transcription.reason || null,
            error: transcription.error || null,
          };
          if (transcription.ok && transcription.text) ingested.text = normalizeWhitespace(transcription.text);
          else warnings.push('Fetched audio, but transcription failed: ' + (transcription.error || transcription.reason || 'unknown'));
        }
      } else if (imageUrl) {
        if (options && options.allowAi === false) {
          warnings.push('Image OCR skipped in mock/local mode.');
        } else {
          const mime = (fetched.contentType.split(';')[0] || 'image/png').trim();
          const dataUrl = 'data:' + mime + ';base64,' + fetched.buffer.toString('base64');
          const ocr = await ocrImageAttachment(
            { name: url.split('/').pop() || 'image', dataUrl, description: raw.description || '' },
            { buffer: fetched.buffer, mimeType: mime },
            mime
          );
          warnings.push(...ocr.warnings);
          if (ocr.stage) ingested.ingestion.imageOcr = {
            ok: Boolean(ocr.stage.ok),
            skipped: Boolean(ocr.stage.skipped),
            model: ocr.stage.model || null,
            reason: ocr.stage.reason || null,
            error: ocr.stage.error || null,
          };
          if (ocr.text) ingested.text = normalizeWhitespace(ocr.text);
        }
      } else {
        const html = fetched.buffer.toString('utf8');
        const readable = fetched.contentType.includes('html') ? extractReadableHtml(html) : normalizeWhitespace(html);
        ingested.text = readable || String(raw.text || raw.content || '');
        ingested.title = raw.title || titleFromHtml(html) || raw.title || url;
        const description = metaContent(html, ['description', 'og:description', 'twitter:description']);
        if (description) ingested.abstract = description;
      }
      if (!ingested.text || ingested.text.length < 80) warnings.push('Fetched URL, but extracted text was very short.');
    } catch (error) {
      ingested.ingestion.method = 'url_fetch_failed';
      warnings.push(error.message || String(error));
      ingested.text = String(raw.text || raw.content || raw.title || url);
    }
  }

  const attachments = collectAttachments(raw);
  if (attachments.length) {
    const texts = [];
    for (const attachment of attachments) {
      const extracted = await attachmentText(attachment, options);
      if (extracted.text) texts.push(extracted.text);
      warnings.push(...extracted.warnings);
      if (extracted.llmStage) {
        ingested.ingestion.imageOcr = {
          ok: Boolean(extracted.llmStage.ok),
          skipped: Boolean(extracted.llmStage.skipped),
          model: extracted.llmStage.model || null,
          reason: extracted.llmStage.reason || null,
          error: extracted.llmStage.error || null,
        };
      }
      if (extracted.audioStage) {
        ingested.ingestion.audioTranscription = {
          ok: Boolean(extracted.audioStage.ok),
          skipped: Boolean(extracted.audioStage.skipped),
          model: extracted.audioStage.model || null,
          reason: extracted.audioStage.reason || null,
          error: extracted.audioStage.error || null,
        };
      }
    }
    if (texts.length) {
      ingested.ingestion.method = ingested.ingestion.method === 'direct' ? 'file_read' : ingested.ingestion.method + '+file_read';
      ingested.text = normalizeWhitespace([ingested.text, ...texts].filter(Boolean).join('\n\n'));
      ingested.title = raw.title || attachments[0].name || ingested.title;
    }
  }

  return ingested;
}

module.exports = {
  ingestSource,
  isUrl,
  extractReadableHtml,
  extractTextFromPdfBuffer,
  extractTextFromDocxBuffer,
};
