const { SCHEMA_VERSION } = require('./schema');

function nodeLabel(map, nodeId) {
  const node = ((map && map.nodes) || []).find((item) => item.id === nodeId);
  return node ? node.label : nodeId;
}

function quoteFrom(text, fallback, needle) {
  const parts = String(text || '').split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const hit = parts.find((part) => part.toLowerCase().includes(String(needle || '').toLowerCase()));
  return String(hit || fallback || '用户添加的资料').slice(0, 280);
}

function mockCompile({ source, map, boosts, targetEntryId }) {
  const boostMap = boosts || {};
  const litIds = Object.keys(boostMap);
  const primary = litIds[0] || (((map && map.nodes) || [])[0] && map.nodes[0].id) || 'unknown';
  const secondary = litIds[1] || primary;
  const sourceId = source.id || 'source-local';
  const title = source.title || '新来源';
  const target = targetEntryId || ('entry-' + primary);

  return {
    schemaVersion: SCHEMA_VERSION,
    sourceSummary: 'Lumen 已把「' + title + '」编纂为可审阅的论点、概念节点、Wiki 更新与开放问题。当前结果来自后端 mock compiler。',
    claims: [
      {
        id: 'claim-' + Date.now() + '-1',
        text: '这条来源强化了「' + nodeLabel(map, primary) + '」在当前理解地图中的重要性。',
        confidence: 'high',
        citationIds: ['cite-1'],
        targetEntryId: target,
      },
      {
        id: 'claim-' + Date.now() + '-2',
        text: '它同时说明 Lumen 需要保留人类审阅环节，而不是直接把 AI 输出写入知识库。',
        confidence: 'medium',
        citationIds: ['cite-2'],
        targetEntryId: target,
      },
    ],
    concepts: litIds.map((nodeId) => ({
      id: 'concept-' + nodeId,
      label: nodeLabel(map, nodeId),
      mapNodeId: nodeId,
      relevance: Math.round(((boostMap[nodeId] || 0.3) + 0.45) * 100) / 100,
    })),
    wikiPatches: [
      {
        entryId: target,
        operation: 'append_section',
        heading: '新来源带来的判断更新',
        body: '这条来源被拆解为 claim、citation、concept 与 map update。用户审阅后，它才会点亮理解地图，并扩充相关 Wiki 词条。',
      },
    ],
    mapUpdates: litIds.map((nodeId) => ({
      nodeId,
      delta: boostMap[nodeId],
      reason: '来源触及「' + nodeLabel(map, nodeId) + '」',
    })),
    openQuestions: [
      {
        id: 'oq-' + Date.now(),
        text: '这条来源是否足以改变当前词条立场，还是只应作为待验证证据？',
        targetEntryId: target,
      },
    ],
    citations: [
      {
        id: 'cite-1',
        sourceId,
        quote: quoteFrom(source.text, title, nodeLabel(map, primary)),
        locator: 'source excerpt',
      },
      {
        id: 'cite-2',
        sourceId,
        quote: quoteFrom(source.text, source.text || title, nodeLabel(map, secondary)),
        locator: 'source excerpt',
      },
    ],
  };
}

module.exports = {
  mockCompile,
};
