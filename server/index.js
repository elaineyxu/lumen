const http = require('http');
const fs = require('fs');
const path = require('path');
const { mockCompile } = require('./mockCompiler');
const { runLumenWorkflow } = require('./workflow');
const { ingestSource } = require('./workflow/ingestion');
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
  evidenceForClaims,
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
    webpage: 'teal',
    paper: 'blue',
    pdf: 'blue',
    video: 'coral',
    image: 'violet',
    chat: 'amber',
    transcript: 'amber',
    voice: 'amber',
    note: 'blue',
  }[type] || 'blue';
}

function sourceUiType(type, fallback) {
  const raw = String(type || fallback || 'note').toLowerCase();
  if (raw === 'webpage' || raw === 'url') return 'link';
  if (raw === 'pdf' || raw === 'paper') return 'paper';
  if (raw === 'transcript') return 'chat';
  if (['link', 'video', 'image', 'chat', 'voice', 'note'].includes(raw)) return raw;
  return fallback && ['link', 'paper', 'video', 'image', 'chat', 'voice', 'note'].includes(fallback) ? fallback : 'note';
}

function shortTitle(text, fallback) {
  const clean = String(text || '').replace(/<[^>]+>/g, '').trim();
  if (!clean) return fallback;
  return clean.length > 34 ? clean.slice(0, 32) + '…' : clean;
}

function slugify(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function suggestForInbox(item) {
  return { maps: [], entries: [], concepts: [] };
}

function makeQuestionEntryForMap(map, question) {
  const firstNode = Array.isArray(map && map.nodes) ? map.nodes[0] : null;
  const entryId = 'question-' + slugify((map && map.id) || question, Date.now());
  const cleanQuestion = String(question || (map && map.title) || 'Open question').replace(/<[^>]+>/g, '').trim();
  const title = cleanQuestion || (map && map.title) || 'Open question';
  return {
    id: entryId,
    type: 'question',
    title,
    subtitle: 'A source-first research page. Add sources here, then use the map to check coverage.',
    category: 'questions',
    mapRefs: [{ map: map.id, node: firstNode && firstNode.id }],
    updated: 'Created just now · awaiting sources',
    updatedShort: 'just now',
    sourceNs: [],
    backlinks: [],
    lead: [
      'This question starts in the Wiki so sources can build durable understanding first. The map is the coverage check: it shows which concepts have evidence and which parts are still thin.',
    ],
    sections: [
      {
        id: 'evidence-needed',
        heading: 'Evidence to gather',
        blocks: [
          {
            type: 'open',
            items: [
              'Which sources directly answer or complicate this question?',
              'Which concepts on the map remain unsupported by evidence?',
              'What would change the current framing of this question?',
            ],
          },
        ],
      },
    ],
  };
}

function applyMapUpdates(litByMap, mapId, updates, boosts) {
  const next = { ...(litByMap || {}) };
  const current = { ...(next[mapId] || {}) };
  const deltas = {};
  (Array.isArray(updates) ? updates : []).forEach((update) => {
    if (update && update.nodeId) deltas[update.nodeId] = Math.max(deltas[update.nodeId] || 0, Number(update.delta) || 0.32);
  });
  Object.entries(boosts || {}).forEach(([nodeId, value]) => {
    deltas[nodeId] = Math.max(deltas[nodeId] || 0, Number(value) || 0.32);
  });
  Object.entries(deltas).forEach(([nodeId, delta]) => {
    current[nodeId] = Math.min(0.95, (Number(current[nodeId]) || 0) + delta);
  });
  next[mapId] = current;
  return next;
}

function applyNodeExploration(extraMaps, mapId, updates, boosts) {
  const deltas = {};
  (Array.isArray(updates) ? updates : []).forEach((update) => {
    if (update && update.nodeId) deltas[update.nodeId] = Math.max(deltas[update.nodeId] || 0, Number(update.delta) || 0.32);
  });
  Object.entries(boosts || {}).forEach(([nodeId, value]) => {
    deltas[nodeId] = Math.max(deltas[nodeId] || 0, Number(value) || 0.32);
  });
  if (!Object.keys(deltas).length) return extraMaps || [];
  return (extraMaps || []).map((map) => {
    if (!map || map.id !== mapId || !Array.isArray(map.nodes)) return map;
    return {
      ...map,
      updated: 'just now',
      nodes: map.nodes.map((node) => {
        const delta = deltas[node.id];
        if (!delta) return node;
        return {
          ...node,
          explored: Math.min(1, (Number(node.explored) || 0) + delta),
          sources: (Number(node.sources) || 0) + 1,
        };
      }),
    };
  });
}

function normalizeBlockText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function inferPatchMapRef(patch, result, mapId) {
  const entryId = String(patch && patch.entryId || '');
  const stub = entryId.match(/^stub:([^:]+):(.+)$/);
  if (stub) return { map: stub[1], node: stub[2] };
  const entryNode = entryId.match(/^entry-(.+)$/);
  if (entryNode) return { map: mapId, node: entryNode[1] };
  const concept = (result.concepts || []).find((item) => item && ('entry-' + item.mapNodeId === entryId || item.mapNodeId === entryId));
  return concept ? { map: mapId, node: concept.mapNodeId } : null;
}

function titleForPatch(patch, result, mapRef) {
  const concept = mapRef && (result.concepts || []).find((item) => item && item.mapNodeId === mapRef.node);
  if (concept && concept.label) return concept.label;
  return patch.heading || 'Untitled wiki entry';
}

function mergeWikiPatchIntoEntry(baseEntry, patch, result, source, mapId, sourceNumber, chunks) {
  const mapRef = inferPatchMapRef(patch, result, mapId);
  const now = 'Updated just now · synthesised from your sources';
  const entry = {
    id: patch.entryId,
    type: 'concept',
    title: titleForPatch(patch, result, mapRef),
    subtitle: result.sourceSummary || '',
    category: 'questions',
    mapRefs: mapRef ? [mapRef] : [],
    updated: now,
    updatedShort: 'just now',
    sourceNs: [],
    sourceIds: [],
    backlinks: [],
    lead: [result.sourceSummary || patch.body],
    sections: [],
    ...(baseEntry || {}),
  };
  entry.updated = now;
  entry.updatedShort = 'just now';
  entry.sourceNs = Array.from(new Set([...(entry.sourceNs || []), sourceNumber].filter(Boolean)));
  entry.sourceIds = Array.from(new Set([...(entry.sourceIds || []), source.id].filter(Boolean)));
  if (!Array.isArray(entry.mapRefs) || !entry.mapRefs.length) entry.mapRefs = mapRef ? [mapRef] : [];
  if (!Array.isArray(entry.lead) || !entry.lead.length) entry.lead = [result.sourceSummary || patch.body];
  if (!Array.isArray(entry.sections)) entry.sections = [];

  const sectionId = slugify(patch.heading, 'section-' + Date.now());
  const nextBlock = { type: 'p', text: normalizeBlockText(patch.body) };
  const existingIndex = entry.sections.findIndex((section) => (
    section && (section.id === sectionId || String(section.heading || '').toLowerCase() === String(patch.heading || '').toLowerCase())
  ));
  const shouldRevise = patch.operation === 'revise_section' || patch.status === 'revise' || patch.updateRule === 'changed_stance';
  const sourceLine = source.title ? 'Source: ' + source.title : '';
  const nextSection = {
    id: sectionId,
    heading: patch.heading || 'Source update',
    blocks: [nextBlock],
    sourceIds: [source.id],
    evidenceClaimIds: patch.evidenceClaimIds || [],
    evidence: evidenceForClaims(result, patch.evidenceClaimIds || [], source, chunks),
    updateRule: patch.updateRule || 'new_evidence',
    status: patch.status || 'append',
  };

  if (existingIndex >= 0) {
    const existing = entry.sections[existingIndex] || {};
    const blocks = Array.isArray(existing.blocks) ? existing.blocks : [];
    const mergedBlocks = shouldRevise
      ? [nextBlock]
      : [...blocks, ...(blocks.some((block) => normalizeBlockText(block.text) === nextBlock.text) ? [] : [nextBlock])];
    entry.sections = entry.sections.map((section, index) => index === existingIndex ? {
      ...existing,
      heading: existing.heading || nextSection.heading,
      blocks: mergedBlocks,
      sourceIds: Array.from(new Set([...(existing.sourceIds || []), source.id])),
      evidenceClaimIds: Array.from(new Set([...(existing.evidenceClaimIds || []), ...(patch.evidenceClaimIds || [])])),
      evidence: Array.from(new Map([...(existing.evidence || []), ...nextSection.evidence].map((item) => [item.id, item])).values()),
      updateRule: patch.updateRule || existing.updateRule || 'new_evidence',
      status: patch.status || existing.status || 'append',
    } : section);
  } else if (nextBlock.text) {
    entry.sections = [...entry.sections, nextSection];
  }

  if (sourceLine && !entry.lead.some((line) => String(line).includes(source.title))) {
    entry.lastSource = sourceLine;
  }
  return entry;
}

function materializeWikiEntries(current, run, result, source, mapId, body, sourceNumber) {
  const patches = Array.isArray(result && result.wikiPatches) ? result.wikiPatches : [];
  if (!patches.length) return current.extraEntries || [];
  const snapshots = body && body.entrySnapshots && typeof body.entrySnapshots === 'object' ? body.entrySnapshots : {};
  const byId = new Map((current.extraEntries || []).map((entry) => [entry.id, entry]));
  patches.forEach((patch) => {
    if (!patch || !patch.entryId || !patch.heading || !patch.body) return;
    const baseEntry = byId.get(patch.entryId) || snapshots[patch.entryId] || null;
    byId.set(patch.entryId, mergeWikiPatchIntoEntry(baseEntry, patch, result, source, mapId, sourceNumber, run.artifacts && run.artifacts.chunks));
  });
  return Array.from(byId.values());
}

function sourceFromRun(run, mapId, result, boosts) {
  const source = (run && run.source) || {};
  const artifactSource = run && run.artifacts && run.artifacts.source;
  const metadata = artifactSource && artifactSource.metadata ? artifactSource.metadata : {};
  const uiType = sourceUiType(metadata.type || (artifactSource && artifactSource.type), source.type);
  const mapUpdates = Array.isArray(result && result.mapUpdates) ? result.mapUpdates : [];
  const nodes = mapUpdates.map((update) => update.nodeId).filter(Boolean);
  Object.keys(boosts || {}).forEach((nodeId) => {
    if (!nodes.includes(nodeId)) nodes.push(nodeId);
  });
  const entryIds = Array.isArray(result && result.wikiPatches)
    ? result.wikiPatches.map((patch) => patch.entryId).filter(Boolean)
    : [];
  if (run && run.targetEntryId && !entryIds.includes(run.targetEntryId)) entryIds.unshift(run.targetEntryId);
  return {
    id: source.id || ('source-' + Date.now()),
    n: Date.now(),
    type: uiType,
    kind: metadata.kind || (artifactSource && artifactSource.kind) || source.type || 'note',
    title: metadata.title || source.title || 'Compiled source',
    url: metadata.url || source.url || '',
    citations: evidenceForClaims(result, (result.claims || []).map((claim) => claim.id),
      { id: source.id, title: metadata.title || source.title || 'Compiled source' }, run.artifacts && run.artifacts.chunks),
    meta: [
      'AI workflow compile',
      metadata.language && metadata.language !== 'unknown' ? metadata.language : '',
      metadata.parserSummary || ((run && run.engine) || 'local'),
    ].filter(Boolean).join(' · '),
    tint: sourceTint(uiType),
    added: 'just now',
    parser: {
      kind: metadata.kind || '',
      language: metadata.language || 'unknown',
      authorOrSpeaker: metadata.authorOrSpeaker || '',
      sourceDate: metadata.sourceDate || '',
      qualitySignals: metadata.qualitySignals || [],
      warnings: metadata.parserWarnings || [],
    },
    contributedTo: entryIds,
    illuminated: [{ map: mapId, nodes }],
  };
}

function knowledgeRecordsFromRun(run, source, result) {
  const artifacts = run && run.artifacts;
  if (artifacts && artifacts.source) {
    return {
      source: { ...artifacts.source, id: source.id },
      mapId: run.map && run.map.id,
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
    mapId: run.map && run.map.id,
    chunks: [],
    result,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) {
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

function hasSourcePayload(source) {
  return Boolean(
    source.text ||
    source.content ||
    source.title ||
    source.url ||
    source.file ||
    source.attachment ||
    (Array.isArray(source.files) && source.files.length) ||
    (Array.isArray(source.attachments) && source.attachments.length) ||
    (Array.isArray(source.messages) && source.messages.length)
  );
}

function sourceRunRecord(source) {
  const attachments = [
    source.file,
    source.attachment,
    ...(Array.isArray(source.files) ? source.files : []),
    ...(Array.isArray(source.attachments) ? source.attachments : []),
  ].filter(Boolean).map((file) => ({
    name: file.name || file.filename || '',
    mimeType: file.mimeType || file.type || '',
    size: file.size || 0,
  }));
  return {
    id: source.id || ('source-' + Date.now()),
    title: source.title,
    type: source.type,
    url: source.url || '',
    text: String(source.text || '').slice(0, 12000),
    ingestion: source.ingestion || null,
    attachments,
  };
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
  const targetEntryId = body.targetEntryId ? String(body.targetEntryId) : '';
  const locale = body.locale === 'en' ? 'en' : 'zh';
  const aiSettings = readAiSettings();
  const forceMock = body.engine === 'mock' || process.env.LUMEN_AI_ENGINE === 'mock' || aiSettings.mode === 'mock';

  if (!hasSourcePayload(source)) {
    sendJson(res, 400, { error: 'source text, url, messages, or file attachment is required' });
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
  let sourceForRun = source;
  try {
    if (forceMock) {
      sourceForRun = await ingestSource(source, { allowAi: false });
      result = mockCompile({ source: sourceForRun, map, boosts, targetEntryId });
      engine = 'mock';
    } else {
      result = await runLumenWorkflow({ source, map, boosts, targetEntryId, locale });
      artifacts = result && result._proposalArtifacts;
    }
  } catch (error) {
    if (!forceMock) {
      sendJson(res, 502, { error: error.message || String(error), code: 'llm_workflow_failed' });
      return;
    }
    sourceForRun = await ingestSource(source, { allowAi: false });
    result = mockCompile({ source: sourceForRun, map, boosts, targetEntryId });
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
    source: sourceRunRecord(sourceForRun),
    map: { id: map.id, title: map.title },
    boosts,
    targetEntryId,
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
  const entry = makeQuestionEntryForMap(map, question);
  const state = updateState((current) => ({
    ...current,
    extraMaps: [map, ...(current.extraMaps || [])],
    extraEntries: [entry, ...(current.extraEntries || []).filter((candidate) => candidate.id !== entry.id)],
  }));
  sendJson(res, 200, { map, entry, state });
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
      extraEntries: (current.extraEntries || []).filter((entry) => !(entry.mapRefs || []).some((ref) => ref.map === mapId)),
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
  const currentBeforeApply = readState();
  const alreadyApplied = (currentBeforeApply.appliedReviews || []).find((review) => review.runId === runId);
  if (alreadyApplied) {
    const existingSource = (currentBeforeApply.sources || []).find((candidate) => candidate.id === alreadyApplied.sourceId) || null;
    sendJson(res, 200, {
      source: existingSource,
      state: currentBeforeApply,
      knowledgeRevision: readKnowledgeDb().revision,
      alreadyApplied: true,
    });
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
  const sourceNumber = 100 + (currentBeforeApply.sources || []).filter((candidate) => candidate.id !== source.id).length + 1;
  source = { ...source, n: sourceNumber };
  let knowledge = null;
  try {
    knowledge = saveKnowledgeRecords(knowledgeRecordsFromRun(run, source, result));
  } catch (error) {
    sendJson(res, 500, { error: 'failed to apply proposal to knowledge database', detail: error.message || String(error) });
    return;
  }
  const state = updateState((current) => ({
    ...current,
    extraEntries: materializeWikiEntries(current, run, result, source, mapId, body, sourceNumber),
    sources: [source, ...(current.sources || []).filter((candidate) => candidate.id !== source.id)],
    extraMaps: applyNodeExploration(current.extraMaps, mapId, result.mapUpdates, body.boosts || run.boosts),
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

if (require.main === module) listen(PORT, 0);

module.exports = { route };
