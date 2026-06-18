const http = require('http');
const fs = require('fs');
const path = require('path');
const { mockCompile } = require('./mockCompiler');
const { runLumenWorkflow } = require('./workflow');
const { seedMapFromQuestion, reviseMapWithPrompt } = require('./workflow/mapSeeder');
const { validateCompileResult } = require('./schema');
const {
  readRuns,
  saveCompileRun,
  findRun,
  readState,
  updateState,
  readAiSettings,
  writeAiSettings,
  readKnowledgeDb,
  saveKnowledgeRecords,
} = require('./store');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_AUTO_PORT_ATTEMPTS = 10;

function sendJson(res, status, payload) {
  res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sourceTint(type) {
  return {
    link: 'teal',
    paper: 'blue',
    video: 'coral',
    image: 'violet',
    chat: 'amber',
    voice: 'amber',
    note: 'blue',
  }[type] || 'blue';
}

function shortTitle(text, fallback) {
  const clean = String(text || '').replace(/<[^>]+>/g, '').trim();
  if (!clean) return fallback;
  return clean.length > 34 ? clean.slice(0, 32) + '…' : clean;
}

function suggestForInbox(item) {
  return { maps: [], entries: [], concepts: [] };
}

function applyMapUpdates(litByMap, mapId, updates, boosts) {
  const next = { ...(litByMap || {}) };
  const current = { ...(next[mapId] || {}) };
  const fromUpdates = Array.isArray(updates) ? updates : [];
  fromUpdates.forEach((update) => {
    if (update && update.nodeId) {
      current[update.nodeId] = Math.max(current[update.nodeId] || 0, Number(update.delta) || 0.32);
    }
  });
  Object.entries(boosts || {}).forEach(([nodeId, value]) => {
    current[nodeId] = Math.max(current[nodeId] || 0, Number(value) || 0.32);
  });
  next[mapId] = current;
  return next;
}

function sourceFromRun(run, mapId, result, boosts) {
  const source = (run && run.source) || {};
  const mapUpdates = Array.isArray(result && result.mapUpdates) ? result.mapUpdates : [];
  const nodes = mapUpdates.map((update) => update.nodeId).filter(Boolean);
  Object.keys(boosts || {}).forEach((nodeId) => {
    if (!nodes.includes(nodeId)) nodes.push(nodeId);
  });
  const entryIds = Array.isArray(result && result.wikiPatches)
    ? result.wikiPatches.map((patch) => patch.entryId).filter(Boolean)
    : [];
  return {
    id: source.id || ('source-' + Date.now()),
    n: Date.now(),
    type: source.type || 'note',
    title: source.title || 'Compiled source',
    meta: 'AI workflow compile · ' + ((run && run.engine) || 'local'),
    tint: sourceTint(source.type),
    added: 'just now',
    contributedTo: entryIds,
    illuminated: [{ map: mapId, nodes }],
  };
}

function knowledgeRecordsFromRun(run, source, result) {
  const artifacts = run && run.artifacts;
  if (artifacts && artifacts.source) {
    return {
      source: { ...artifacts.source, id: source.id },
      chunks: Array.isArray(artifacts.chunks) ? artifacts.chunks : [],
      result,
    };
  }
  const raw = (run && run.source) || {};
  return {
    source: {
      id: source.id,
      title: source.title || raw.title || 'Compiled source',
      type: source.type || raw.type || 'note',
      kind: raw.type || 'note',
      metadata: {
        title: source.title || raw.title || 'Compiled source',
        type: source.type || raw.type || 'note',
      },
    },
    chunks: [],
    result,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function hasLlmApiKey(settings) {
  return Boolean(process.env.OPENAI_API_KEY || process.env.LUMEN_LLM_API_KEY || (settings && settings.apiKey));
}

function hasSuccessfulLlmStage(result) {
  const stages = result && result._pipeline && result._pipeline.stages;
  return Object.values(stages || {}).some((stage) => stage && stage.ok);
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
}

async function handleCompile(req, res) {
  const body = await readBody(req);
  const source = body.source || {};
  const map = body.map || {};
  const boosts = body.boosts || {};
  const aiSettings = readAiSettings();
  const forceMock = body.engine === 'mock' || process.env.LUMEN_AI_ENGINE === 'mock' || aiSettings.mode === 'mock';

  if (!source.text && !source.title) {
    sendJson(res, 400, { error: 'source.text or source.title is required' });
    return;
  }

  if (!forceMock && !hasLlmApiKey(aiSettings)) {
    sendJson(res, 400, {
      error: 'LLM API key is required. Configure OPENAI_API_KEY on the server or save an API key in Settings.',
      code: 'llm_not_configured',
    });
    return;
  }

  let result;
  let artifacts = null;
  let engine = 'lumen-workflow';
  try {
    if (forceMock) {
      result = mockCompile({ source, map, boosts });
      engine = 'mock';
    } else {
      result = await runLumenWorkflow({ source, map, boosts });
      artifacts = result && result._proposalArtifacts;
    }
  } catch (error) {
    if (!forceMock) {
      sendJson(res, 502, { error: error.message || String(error), code: 'llm_workflow_failed' });
      return;
    }
    result = mockCompile({ source, map, boosts });
    engine = 'mock';
  }

  if (!forceMock && !hasSuccessfulLlmStage(result)) {
    sendJson(res, 502, {
      error: 'No LLM stage completed successfully. Check API key, endpoint, and selected models.',
      code: 'llm_stages_failed',
      stages: result && result._pipeline && result._pipeline.stages,
    });
    return;
  }

  const validation = validateCompileResult(result);
  if (!validation.ok) {
    sendJson(res, 500, { error: 'compile result failed validation', validation });
    return;
  }

  const run = saveCompileRun({
    engine,
    source: { id: source.id, title: source.title, type: source.type, text: source.text },
    map: { id: map.id, title: map.title },
    boosts,
    result,
    artifacts,
  });
  sendJson(res, 200, { runId: run.id, engine, result });
}

async function handleCreateMap(req, res) {
  const body = await readBody(req);
  const question = String(body.question || '').trim();
  if (!question) {
    sendJson(res, 400, { error: 'question is required' });
    return;
  }
  const aiSettings = readAiSettings();
  if (!hasLlmApiKey(aiSettings)) {
    sendJson(res, 400, {
      error: 'LLM API key is required to create a knowledge map from a question.',
      code: 'llm_not_configured',
    });
    return;
  }

  let map;
  try {
    map = await seedMapFromQuestion(question);
  } catch (error) {
    sendJson(res, 502, { error: error.message || String(error), code: 'map_seed_failed' });
    return;
  }
  const state = updateState((current) => ({
    ...current,
    extraMaps: [map, ...(current.extraMaps || [])],
  }));
  sendJson(res, 200, { map, state });
}

async function handleReviseMap(req, res, mapId) {
  const body = await readBody(req);
  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    sendJson(res, 400, { error: 'prompt is required' });
    return;
  }
  const aiSettings = readAiSettings();
  if (!hasLlmApiKey(aiSettings)) {
    sendJson(res, 400, {
      error: 'LLM API key is required to revise a knowledge map.',
      code: 'llm_not_configured',
    });
    return;
  }

  const currentState = readState();
  const currentMap = (currentState.extraMaps || []).find((map) => map.id === mapId);
  if (!currentMap) {
    sendJson(res, 404, { error: 'created map not found' });
    return;
  }

  let revised;
  try {
    revised = await reviseMapWithPrompt(currentMap, prompt);
  } catch (error) {
    sendJson(res, 502, { error: error.message || String(error), code: 'map_revision_failed' });
    return;
  }

  const revisedNodeIds = new Set((revised.nodes || []).map((node) => node.id));
  const state = updateState((current) => {
    const litByMap = { ...(current.litByMap || {}) };
    if (litByMap[mapId]) {
      litByMap[mapId] = Object.fromEntries(
        Object.entries(litByMap[mapId]).filter(([nodeId]) => revisedNodeIds.has(nodeId))
      );
    }
    return {
      ...current,
      extraMaps: (current.extraMaps || []).map((map) => map.id === mapId ? revised : map),
      litByMap,
    };
  });
  sendJson(res, 200, { map: revised, state });
}

async function handleRenameMap(req, res, mapId) {
  const body = await readBody(req);
  const title = shortTitle(body.title, '').trim();
  if (!title) {
    sendJson(res, 400, { error: 'title is required' });
    return;
  }
  let renamed = null;
  const state = updateState((current) => ({
    ...current,
    extraMaps: (current.extraMaps || []).map((map) => {
      if (map.id !== mapId) return map;
      renamed = { ...map, title, updated: 'just now' };
      return renamed;
    }),
  }));
  if (!renamed) {
    sendJson(res, 404, { error: 'created map not found' });
    return;
  }
  sendJson(res, 200, { map: renamed, state });
}

async function handleDeleteMap(req, res, mapId) {
  let deleted = null;
  const state = updateState((current) => {
    const extraMaps = current.extraMaps || [];
    deleted = extraMaps.find((map) => map.id === mapId) || null;
    if (!deleted) return current;
    const litByMap = { ...(current.litByMap || {}) };
    delete litByMap[mapId];
    return {
      ...current,
      extraMaps: extraMaps.filter((map) => map.id !== mapId),
      litByMap,
      sources: (current.sources || []).map((source) => ({
        ...source,
        illuminated: (source.illuminated || []).filter((item) => item.map !== mapId),
      })),
    };
  });
  if (!deleted) {
    sendJson(res, 404, { error: 'created map not found' });
    return;
  }
  sendJson(res, 200, { deletedMapId: mapId, state });
}

async function handleCaptureInbox(req, res) {
  const body = await readBody(req);
  const item = body.item || {};
  const next = {
    ...item,
    id: item.id || ('i' + Date.now()),
    type: item.type || 'note',
    tint: item.tint || sourceTint(item.type),
    title: item.title || 'Untitled capture',
    meta: item.meta || 'Quick capture',
    captured: item.captured || 'just now',
    pending: false,
    suggest: item.suggest || suggestForInbox(item),
  };
  const state = updateState((current) => ({
    ...current,
    inbox: [next, ...(current.inbox || [])],
  }));
  sendJson(res, 200, { item: next, state });
}

async function handleDigestInbox(req, res, itemId) {
  const body = await readBody(req);
  if (!body.mapId) {
    sendJson(res, 400, { error: 'mapId is required to digest an inbox item' });
    return;
  }
  let digested = null;
  const state = updateState((current) => {
    const inbox = current.inbox || [];
    const item = inbox.find((candidate) => candidate.id === itemId);
    if (!item) return current;
    const mapId = body.mapId;
    const concepts = ((item.suggest && item.suggest.concepts) || []).filter((concept) => concept.map === mapId);
    const boosts = {};
    concepts.forEach((concept, index) => {
      boosts[concept.node] = index === 0 ? 0.5 : 0.34;
    });
    const source = {
      id: 'source-' + Date.now(),
      n: 100 + (current.sources || []).length + 1,
      type: item.type || 'note',
      title: item.title || 'Inbox capture',
      meta: item.meta || 'Quick capture',
      tint: item.tint || sourceTint(item.type),
      added: 'just now',
      contributedTo: ((item.suggest && item.suggest.entries) || []),
      illuminated: [{ map: mapId, nodes: concepts.map((concept) => concept.node) }],
    };
    digested = { item, source, mapId, boosts };
    return {
      ...current,
      inbox: inbox.filter((candidate) => candidate.id !== itemId),
      sources: [source, ...(current.sources || [])],
      litByMap: applyMapUpdates(current.litByMap, mapId, [], boosts),
    };
  });
  if (!digested) {
    sendJson(res, 404, { error: 'inbox item not found' });
    return;
  }
  sendJson(res, 200, { ...digested, state });
}

async function handleDismissInbox(req, res, itemId) {
  const state = updateState((current) => ({
    ...current,
    inbox: (current.inbox || []).filter((item) => item.id !== itemId),
  }));
  sendJson(res, 200, { state });
}

async function handleApplyReview(req, res, runId) {
  const body = await readBody(req);
  const run = findRun(runId);
  if (!run) {
    sendJson(res, 404, { error: 'compile run not found' });
    return;
  }
  const result = body.result || run.result;
  const validation = validateCompileResult(result);
  if (!validation.ok) {
    sendJson(res, 400, { error: 'compile result failed validation', validation });
    return;
  }
  if (result.feedback && result.feedback.recommendation === 'reject') {
    sendJson(res, 409, {
      error: 'AI reviewer rejected this proposal. Revise or rerun the source compile before applying.',
      code: 'review_rejected',
    });
    return;
  }
  const mapId = body.mapId || (run.map && run.map.id);
  if (!mapId) {
    sendJson(res, 400, { error: 'mapId is required to apply a review' });
    return;
  }
  let source = sourceFromRun(run, mapId, result, body.boosts || run.boosts);
  let knowledge = null;
  try {
    knowledge = saveKnowledgeRecords(knowledgeRecordsFromRun(run, source, result));
  } catch (error) {
    sendJson(res, 500, { error: 'failed to apply proposal to knowledge database', detail: error.message || String(error) });
    return;
  }
  const state = updateState((current) => ({
    ...current,
    sources: [{ ...source, n: 100 + (current.sources || []).length + 1 }, ...(current.sources || []).filter((candidate) => candidate.id !== source.id)],
    litByMap: applyMapUpdates(current.litByMap, mapId, result.mapUpdates, body.boosts || run.boosts),
    appliedReviews: [{
      id: 'review-' + Date.now(),
      runId,
      mapId,
      sourceId: source.id,
      appliedAt: new Date().toISOString(),
    }, ...(current.appliedReviews || [])].slice(0, 50),
  }));
  source = (state.sources || []).find((candidate) => candidate.id === source.id) || source;
  sendJson(res, 200, { source, state, knowledgeRevision: knowledge && knowledge.revision });
}

async function handleSaveAiSettings(req, res) {
  const body = await readBody(req);
  const settings = writeAiSettings({
    mode: body.mode,
    provider: body.provider,
    modelPreset: body.modelPreset,
    model: body.model,
    stages: body.stages,
    endpoint: body.endpoint,
    apiKey: body.apiKey,
  });
  sendJson(res, 200, { settings });
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/workspace') {
      sendJson(res, 200, { state: readState() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/compile') {
      await handleCompile(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/compile-runs') {
      sendJson(res, 200, { runs: readRuns() });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/knowledge') {
      sendJson(res, 200, { database: readKnowledgeDb() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/maps') {
      await handleCreateMap(req, res);
      return;
    }

    const mapRevision = url.pathname.match(/^\/api\/maps\/([^/]+)\/revise$/);
    if (req.method === 'POST' && mapRevision) {
      await handleReviseMap(req, res, decodeURIComponent(mapRevision[1]));
      return;
    }

    const mapItem = url.pathname.match(/^\/api\/maps\/([^/]+)$/);
    if (req.method === 'PATCH' && mapItem) {
      await handleRenameMap(req, res, decodeURIComponent(mapItem[1]));
      return;
    }

    if (req.method === 'DELETE' && mapItem) {
      await handleDeleteMap(req, res, decodeURIComponent(mapItem[1]));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/inbox') {
      await handleCaptureInbox(req, res);
      return;
    }

    const inboxDigest = url.pathname.match(/^\/api\/inbox\/([^/]+)\/digest$/);
    if (req.method === 'POST' && inboxDigest) {
      await handleDigestInbox(req, res, decodeURIComponent(inboxDigest[1]));
      return;
    }

    const inboxItem = url.pathname.match(/^\/api\/inbox\/([^/]+)$/);
    if (req.method === 'DELETE' && inboxItem) {
      await handleDismissInbox(req, res, decodeURIComponent(inboxItem[1]));
      return;
    }

    const reviewApply = url.pathname.match(/^\/api\/reviews\/([^/]+)\/apply$/);
    if (req.method === 'POST' && reviewApply) {
      await handleApplyReview(req, res, decodeURIComponent(reviewApply[1]));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/settings/ai') {
      sendJson(res, 200, { settings: readAiSettings() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/settings/ai') {
      await handleSaveAiSettings(req, res);
      return;
    }

    if (req.method === 'GET') {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error) });
  }
}

function listen(port, attempt) {
  const server = http.createServer(route);
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && !process.env.PORT && attempt < MAX_AUTO_PORT_ATTEMPTS) {
      console.warn('Port ' + port + ' is already in use; trying ' + (port + 1) + '...');
      listen(port + 1, attempt + 1);
      return;
    }
    if (error.code === 'EADDRINUSE') {
      console.error('Port ' + port + ' is already in use. Open the existing server, stop that process, or run with PORT=' + (port + 1) + '.');
      process.exitCode = 1;
      return;
    }
    if (error.code === 'EPERM') {
      console.error('Cannot listen on ' + HOST + ':' + port + '. Try running from your normal Terminal, or set another port with PORT=' + (port + 1) + '.');
      process.exitCode = 1;
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(port, HOST, () => {
    console.log('Lumen MVP server running at http://' + HOST + ':' + port);
  });
}

listen(PORT, 0);
