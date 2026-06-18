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

  function quoteFrom(text, fallback, needle) {
    const parts = String(text || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const hit = parts.find((p) => p.toLowerCase().includes(String(needle || '').toLowerCase()));
    return (hit || fallback).slice(0, 280);
  }

  function nodeLabel(map, id) {
    const n = (map.nodes || []).find((x) => x.id === id);
    return n ? n.label : id;
  }

  function mockCompile(source, map, boosts) {
    const litIds = Object.keys(boosts || {});
    const primary = litIds[0] || ((map.nodes || [])[0] && map.nodes[0].id) || 'unknown';
    const secondary = litIds[1] || primary;
    const third = litIds[2] || secondary;
    const targetEntryId = 'entry-' + primary;

    return {
      schemaVersion: SCHEMA_VERSION,
      sourceSummary: 'Lumen 将这条资料编纂为可审阅的论点、概念节点、Wiki 更新与开放问题；每个判断都保留来源线索。',
      claims: [
        {
          id: 'claim-' + Date.now() + '-1',
          text: '这条来源强化了「' + nodeLabel(map, primary) + '」在当前问题中的重要性。',
          confidence: 'high',
          citationIds: ['cite-1'],
          targetEntryId,
        },
        {
          id: 'claim-' + Date.now() + '-2',
          text: '它同时把「' + nodeLabel(map, secondary) + '」与可回溯证据连接起来，因此适合先进入审阅队列。',
          confidence: 'medium',
          citationIds: ['cite-2'],
          targetEntryId,
        },
      ],
      concepts: litIds.map((id) => ({
        id: 'concept-' + id,
        label: nodeLabel(map, id),
        mapNodeId: id,
        relevance: Math.round(((boosts[id] || 0.3) + 0.45) * 100) / 100,
      })),
      wikiPatches: [
        {
          entryId: targetEntryId,
          operation: 'append_section',
          heading: '新来源带来的判断更新',
          body: '这条来源不是被保存为孤立摘要，而是被拆解为 claim、citation、concept 与 map update。用户审阅后，它会点亮理解地图，并扩充相关 Wiki 词条。',
        },
      ],
      mapUpdates: litIds.map((id) => ({
        nodeId: id,
        delta: boosts[id],
        reason: '来源触及「' + nodeLabel(map, id) + '」',
      })),
      openQuestions: [
        {
          id: 'oq-' + Date.now(),
          text: '这条来源是否足以改变当前词条的立场，还是只应作为一个待验证证据？',
          targetEntryId,
        },
      ],
      citations: [
        {
          id: 'cite-1',
          sourceId: source.id,
          quote: quoteFrom(source.text, source.title || '用户添加的资料', nodeLabel(map, primary).split(' ')[0]),
          locator: 'source excerpt',
        },
        {
          id: 'cite-2',
          sourceId: source.id,
          quote: quoteFrom(source.text, source.text || source.title || '用户添加的资料', nodeLabel(map, third).split(' ')[0]),
          locator: 'source excerpt',
        },
      ],
    };
  }

  async function compileSource({ source, map, boosts }) {
    const config = readConfig();
    if (config.mode === 'mock') {
      return mockCompile(source, map, boosts);
    }

    if (config.mode === 'backend' || config.mode === 'workflow') {
      try {
        const response = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine: 'auto',
            source,
            map,
            boosts,
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
      } catch (error) {
        if (window.location.protocol !== 'file:') throw error;
        return mockCompile(source, map, boosts);
      }
    }

    return mockCompile(source, map, boosts);
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
