const fs = require('fs');
const path = require('path');
const { normalizeStageSettings } = require('./llm/modelCatalog');
const { spreadMapNodes } = require('./workflow/mapLayout');
const { normalizeMapOverview } = require('./workflow/mapSummary');

const DATA_DIR = path.join(__dirname, '..', '.data');
const RUNS_FILE = path.join(DATA_DIR, 'compile-runs.json');
const STATE_FILE = path.join(DATA_DIR, 'app-state.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'ai-settings.json');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'knowledge-db.json');

const DEFAULT_STATE = {
  extraMaps: [],
  sources: [],
  inbox: [],
  litByMap: {},
  appliedReviews: [],
};

const DEFAULT_AI_SETTINGS = {
  mode: 'backend',
  provider: 'openai',
  modelPreset: 'balanced',
  model: 'auto',
  stages: normalizeStageSettings(),
  endpoint: '',
  apiKey: '',
};

const DEFAULT_KNOWLEDGE_DB = {
  revision: 0,
  sources: [],
  sourceChunks: [],
  wikiEntries: [],
  concepts: [],
  relations: [],
  citations: [],
  mapNodeEvidence: [],
  feedback: [],
};

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RUNS_FILE)) fs.writeFileSync(RUNS_FILE, '[]\n');
  if (!fs.existsSync(STATE_FILE)) writeState(DEFAULT_STATE);
  if (!fs.existsSync(SETTINGS_FILE)) writeAiSettings(DEFAULT_AI_SETTINGS);
  if (!fs.existsSync(KNOWLEDGE_FILE)) writeKnowledgeDb(DEFAULT_KNOWLEDGE_DB);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
}

function isLegacyLocalSeedMap(map) {
  const nodes = Array.isArray(map && map.nodes) ? map.nodes : [];
  const clusters = map && map.clusters && typeof map.clusters === 'object' ? map.clusters : {};
  const clusterKeys = Object.keys(clusters);
  const labels = new Set(nodes.map((node) => node && node.label).filter(Boolean));
  return Boolean(
    map &&
    !map.seedMeta &&
    map.domain === 'New field' &&
    nodes.length <= 3 &&
    clusterKeys.length === 1 &&
    clusterKeys[0] === 'seed' &&
    clusters.seed &&
    clusters.seed.label === 'Starting points' &&
    labels.has('First sub-question') &&
    labels.has('Second sub-question')
  );
}

function normalizeState(state) {
  const extraMaps = Array.isArray(state && state.extraMaps)
    ? state.extraMaps
      .filter((map) => !isLegacyLocalSeedMap(map))
      .map((map) => {
        if (!map || !map.seedMeta || map.seedMeta.generatedBy !== 'mapSeeder') return map;
        return {
          ...map,
          layoutReason: normalizeMapOverview(map.layoutReason, map),
          nodes: Array.isArray(map.nodes)
            ? spreadMapNodes(map.nodes.map((node) => ({ ...node, explored: 0, sources: Number(node.sources || 0) })))
            : [],
        };
      })
    : [];
  return {
    ...DEFAULT_STATE,
    ...(state || {}),
    extraMaps,
    sources: Array.isArray(state && state.sources) ? state.sources : [],
    inbox: Array.isArray(state && state.inbox) ? state.inbox : [],
    litByMap: state && state.litByMap && typeof state.litByMap === 'object' ? state.litByMap : {},
    appliedReviews: Array.isArray(state && state.appliedReviews) ? state.appliedReviews : [],
  };
}

function readRuns() {
  ensureStore();
  return readJson(RUNS_FILE, []);
}

function writeRuns(runs) {
  ensureStore();
  writeJson(RUNS_FILE, runs);
}

function saveCompileRun(run) {
  const runs = readRuns();
  const next = {
    id: 'run-' + Date.now(),
    createdAt: new Date().toISOString(),
    ...run,
  };
  runs.unshift(next);
  writeRuns(runs.slice(0, 50));
  return next;
}

function readState() {
  ensureStore();
  const raw = readJson(STATE_FILE, DEFAULT_STATE);
  const next = normalizeState(raw);
  if (JSON.stringify(raw) !== JSON.stringify(next)) {
    writeJson(STATE_FILE, next);
  }
  return next;
}

function writeState(state) {
  const next = normalizeState(state);
  writeJson(STATE_FILE, next);
  return next;
}

function updateState(mutator) {
  const current = readState();
  const next = mutator({ ...current });
  return writeState(next || current);
}

function readAiSettings() {
  ensureStore();
  return normalizeAiSettings(readJson(SETTINGS_FILE, DEFAULT_AI_SETTINGS));
}

function normalizeAiSettings(settings) {
  const next = {
    ...DEFAULT_AI_SETTINGS,
    ...(settings || {}),
  };
  next.mode = 'backend';
  next.provider = 'openai';
  next.modelPreset = 'balanced';
  next.model = 'auto';
  next.stages = normalizeStageSettings();
  next.endpoint = '';
  return next;
}

function writeAiSettings(settings) {
  const next = normalizeAiSettings(settings);
  writeJson(SETTINGS_FILE, next);
  return next;
}

function findRun(runId) {
  return readRuns().find((run) => run.id === runId) || null;
}

function readKnowledgeDb() {
  ensureStore();
  return {
    ...DEFAULT_KNOWLEDGE_DB,
    ...readJson(KNOWLEDGE_FILE, DEFAULT_KNOWLEDGE_DB),
  };
}

function writeKnowledgeDb(db) {
  const next = {
    ...DEFAULT_KNOWLEDGE_DB,
    ...(db || {}),
    sources: Array.isArray(db && db.sources) ? db.sources : [],
    sourceChunks: Array.isArray(db && db.sourceChunks) ? db.sourceChunks : [],
    wikiEntries: Array.isArray(db && db.wikiEntries) ? db.wikiEntries : [],
    concepts: Array.isArray(db && db.concepts) ? db.concepts : [],
    relations: Array.isArray(db && db.relations) ? db.relations : [],
    citations: Array.isArray(db && db.citations) ? db.citations : [],
    mapNodeEvidence: Array.isArray(db && db.mapNodeEvidence) ? db.mapNodeEvidence : [],
    feedback: Array.isArray(db && db.feedback) ? db.feedback : [],
  };
  writeJson(KNOWLEDGE_FILE, next);
  return next;
}

function uniqueById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    if (!item || !item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function saveKnowledgeRecords(records) {
  const current = readKnowledgeDb();
  const result = records.result || {};
  const source = records.source || {};
  const chunks = records.chunks || [];
  const sourceId = source.id;
  const revision = Number(current.revision || 0) + 1;

  const wikiEntries = (result.wikiPatches || []).map((patch) => ({
    id: patch.entryId,
    sourceId,
    heading: patch.heading,
    body: patch.body,
    status: patch.status || 'append',
    updateRule: patch.updateRule || 'new_evidence',
    evidenceClaimIds: patch.evidenceClaimIds || [],
    updatedAt: new Date().toISOString(),
  }));
  const mapNodeEvidence = (result.mapUpdates || []).map((update) => ({
    id: sourceId + ':' + update.nodeId,
    sourceId,
    nodeId: update.nodeId,
    delta: update.delta,
    reason: update.reason,
    coverage: update.coverage || 'partial',
    nextGap: update.nextGap || '',
    updateRule: update.updateRule || 'new_node_evidence',
    evidenceClaimIds: update.evidenceClaimIds || [],
  }));
  const feedback = result.feedback ? [{
    id: sourceId + ':feedback',
    sourceId,
    recommendation: result.feedback.recommendation || 'review',
    summary: result.feedback.summary || '',
    reviewNotes: result.feedback.reviewNotes || [],
    nextActions: result.feedback.nextActions || [],
    checklist: result.feedback.checklist || [],
    wikiReview: result.feedback.wikiReview || '',
    mapReview: result.feedback.mapReview || '',
    riskFlags: result.feedback.riskFlags || [],
  }] : [];

  return writeKnowledgeDb({
    ...current,
    revision,
    sources: uniqueById([{ ...source, updatedAt: new Date().toISOString() }, ...(current.sources || [])]),
    sourceChunks: uniqueById([...chunks, ...(current.sourceChunks || [])]),
    wikiEntries: uniqueById([...wikiEntries, ...(current.wikiEntries || [])]),
    concepts: uniqueById([...(result.concepts || []), ...(current.concepts || [])]),
    relations: uniqueById([...(result.relations || []), ...(current.relations || [])]),
    citations: uniqueById([...(result.citations || []), ...(current.citations || [])]),
    mapNodeEvidence: uniqueById([...mapNodeEvidence, ...(current.mapNodeEvidence || [])]),
    feedback: uniqueById([...feedback, ...(current.feedback || [])]),
  });
}

module.exports = {
  readRuns,
  saveCompileRun,
  findRun,
  readState,
  writeState,
  updateState,
  readAiSettings,
  writeAiSettings,
  readKnowledgeDb,
  writeKnowledgeDb,
  saveKnowledgeRecords,
};
