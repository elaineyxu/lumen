/* ============================================================
   LUMEN — AI workflow adapter
   Keeps the original UI as the product shell while the local
   backend owns the parser -> chunker -> extractor pipeline.
   ============================================================ */
(function () {
  const STORAGE_KEY = 'lumen.workflow.config.v1';
  const SCHEMA_VERSION = 'lumen.compile.v1';

  const DEFAULT_CONFIG = {
    mode: 'backend',
    provider: 'openai',
    modelPreset: 'balanced',
    model: 'auto',
    stages: {
      sourceParser: { mode:'auto', preset:'economy', model:'auto' },
      chunking: { mode:'auto', preset:'economy', model:'auto' },
      imageOcr: { mode:'auto', preset:'economy', model:'auto' },
      audioTranscription: { mode:'auto', preset:'economy', model:'auto' },
      extraction: { mode:'auto', preset:'balanced', model:'auto' },
      wiki: { mode:'auto', preset:'balanced', model:'auto' },
      knowledgeGraph: { mode:'auto', preset:'balanced', model:'auto' },
      sourceLinker: { mode:'auto', preset:'economy', model:'auto' },
      mapUpdater: { mode:'auto', preset:'fast', model:'auto' },
      feedback: { mode:'auto', preset:'economy', model:'auto' },
    },
    endpoint: '',
    apiKey: '',
  };

  function normalizeConfig(config) {
    const next = { ...DEFAULT_CONFIG, ...(config || {}) };
    next.stages = { ...DEFAULT_CONFIG.stages };
    Object.keys(DEFAULT_CONFIG.stages).forEach((stage) => {
      next.stages[stage] = { ...DEFAULT_CONFIG.stages[stage] };
      next.stages[stage].mode = 'auto';
      next.stages[stage].model = 'auto';
    });
    next.mode = 'backend';
    next.provider = 'openai';
    next.modelPreset = 'balanced';
    next.model = 'auto';
    return next;
  }

  function readConfig() {
    try {
      return normalizeConfig(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(config) {
    const next = normalizeConfig(config);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
    if (window.LumenApi && window.location.protocol !== 'file:') {
      window.LumenApi.saveAiSettings(next).catch(() => {});
    }
    return next;
  }

  function validate(result) {
    const errors = [];
    if (!result || typeof result !== 'object') errors.push('result must be an object');
    if (result && result.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion must be ' + SCHEMA_VERSION);
    ['sourceSummary', 'claims', 'concepts', 'wikiPatches', 'mapUpdates', 'openQuestions', 'citations'].forEach((key) => {
      if (!(key in (result || {}))) errors.push('missing ' + key);
    });
    ['claims', 'concepts', 'wikiPatches', 'mapUpdates', 'openQuestions', 'citations'].forEach((key) => {
      if (result && !Array.isArray(result[key])) errors.push(key + ' must be an array');
    });
    if (result && Array.isArray(result.claims)) {
      result.claims.forEach((claim, i) => {
        if (!claim.text) errors.push('claims[' + i + '].text is required');
        if (!claim.citationIds || !claim.citationIds.length) errors.push('claims[' + i + '] needs citationIds');
        (claim.citationIds || []).forEach((id) => {
          const exists = result.citations && result.citations.some((c) => c.id === id);
          if (!exists) errors.push('claims[' + i + '] references missing citation ' + id);
        });
      });
    }
    return { ok: errors.length === 0, errors };
  }

  function normalizeWorkflowResponse(payload) {
    const outputs = payload && payload.data && payload.data.outputs ? payload.data.outputs : payload;
    let candidate = outputs.compile_result || outputs.result || outputs.answer || outputs;
    if (typeof candidate === 'string') {
      candidate = JSON.parse(candidate);
    }
    const checked = validate(candidate);
    if (!checked.ok) throw new Error('Invalid compile result: ' + checked.errors.join('; '));
    return candidate;
  }

  async function compileSource({ source, map, boosts, targetEntryId }) {
    if (window.location.protocol === 'file:') {
      throw new Error('Lumen backend is required. Start it with `node server/index.js`.');
    }
    const response = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine: 'auto',
            source,
            map,
            boosts,
            targetEntryId,
            locale: (window.LANG === 'en' ? 'en' : 'zh'),
          }),
    });
    if (!response.ok) throw new Error('Backend compile failed: HTTP ' + response.status);
    const payload = await response.json();
    const result = payload.result || payload;
    const checked = validate(result);
    if (!checked.ok) throw new Error('Invalid backend compile result: ' + checked.errors.join('; '));
    result._runId = payload.runId;
    result._engine = payload.engine;
    return result;
  }

  const adapter = {
    schemaVersion: SCHEMA_VERSION,
    readConfig,
    saveConfig,
    validate,
    compileSource,
  };

  window.LumenWorkflow = adapter;
})();
