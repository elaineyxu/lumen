const { runLlmStage } = require('../llm/stageRunner');

const MAP_UPDATE_POLICY = {
  maxUpdates: 6,
  minDelta: 0.08,
  maxDelta: 0.55,
  coverageDelta: {
    seed: [0.08, 0.22],
    partial: [0.18, 0.4],
    strong: [0.32, 0.55],
  },
};

function clampDelta(delta, coverage) {
  const bounds = MAP_UPDATE_POLICY.coverageDelta[coverage] || [MAP_UPDATE_POLICY.minDelta, MAP_UPDATE_POLICY.maxDelta];
  return Math.max(bounds[0], Math.min(bounds[1], Number(delta) || bounds[0]));
}

function localUpdateMap({ extraction, boosts }) {
  const boostMap = boosts || {};
  const claimIdsForConcept = (concept) => {
    const conceptChunks = new Set(concept.chunkIds || []);
    const direct = extraction.claims.filter((claim) => (
      claim.targetEntryId === 'entry-' + concept.mapNodeId ||
      (claim.chunkIds || []).some((chunkId) => conceptChunks.has(chunkId))
    ));
    const claims = direct.length ? direct : extraction.claims;
    return claims.map((claim) => claim.id).filter(Boolean).slice(0, 2);
  };
  return extraction.concepts.map((concept) => ({
    nodeId: concept.mapNodeId,
    delta: clampDelta(boostMap[concept.mapNodeId] || Math.max(0.18, Math.min(0.4, concept.relevance - 0.25)), 'partial'),
    reason: '来源触及「' + concept.label + '」，并提供了可回溯证据。',
    coverage: 'partial',
    nextGap: '继续补充反例、定义边界或更强证据。',
    updateRule: 'new_node_evidence',
    evidenceClaimIds: claimIdsForConcept(concept),
  }));
}

const MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mapUpdates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          nodeId: { type: 'string' },
          delta: { type: 'number' },
          reason: { type: 'string' },
          coverage: { type: 'string', enum: ['seed', 'partial', 'strong'] },
          nextGap: { type: 'string' },
          updateRule: { type: 'string', enum: ['new_node_evidence', 'stronger_coverage', 'bridge_to_gap', 'no_update'] },
          evidenceClaimIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['nodeId', 'delta', 'reason', 'coverage', 'nextGap', 'updateRule', 'evidenceClaimIds'],
      },
    },
  },
  required: ['mapUpdates'],
};

async function updateMap({ extraction, boosts, map, parsed, chunks, locale }) {
  const fallback = localUpdateMap({ extraction, boosts });
  const validNodeIds = new Set(extraction.concepts.map((concept) => concept.mapNodeId));
  const llm = await runLlmStage({
    stage: 'mapUpdater',
    schemaName: 'lumen_map_updater',
    schema: MAP_SCHEMA,
    parsed,
    chunks,
    locale,
    system: [
      'You are Lumen understanding-map updater.',
      'You decide how much a new source should brighten existing concept nodes.',
      'Be conservative: map updates represent user understanding, not source hype.',
    ].join(' '),
    user: JSON.stringify({
      activeMap: map && { id: map.id, title: map.title },
      concepts: extraction.concepts,
      claims: extraction.claims,
      userBoosts: boosts || {},
      fieldDefinitions: {
        delta: '0.12-0.65 brightness increase. Use high values only for central, well-supported source contributions.',
        reason: 'User-facing explanation for why this node brightened.',
        coverage: 'seed for first exposure, partial for useful but incomplete, strong for high-quality coverage.',
        nextGap: 'What is still missing for understanding this node.',
        updateRule: 'new_node_evidence, stronger_coverage, bridge_to_gap, or no_update.',
        evidenceClaimIds: 'Claim ids that justify this map update.',
      },
      updatePolicy: {
        brighten: 'Brighten only when a claim materially improves understanding of the node.',
        noUpdate: 'Do not update if the source merely mentions the node, duplicates known context, or has no supporting claim.',
        delta: 'seed 0.08-0.22, partial 0.18-0.40, strong 0.32-0.55.',
      },
      hardRules: [
        'Only update node ids present in concepts.',
        'Every update must include at least one evidenceClaimId.',
        'Do not brighten a node because it is merely mentioned.',
        'Use userBoosts as a hint, not an override.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output || !Array.isArray(llm.output.mapUpdates)) return { mapUpdates: fallback, llmStage: llm };
  const updates = llm.output.mapUpdates
    .filter((update) => validNodeIds.has(update.nodeId))
    .filter((update) => update.updateRule !== 'no_update')
    .filter((update) => Array.isArray(update.evidenceClaimIds) && update.evidenceClaimIds.length > 0)
    .slice(0, MAP_UPDATE_POLICY.maxUpdates)
    .map((update) => ({
      nodeId: update.nodeId,
      delta: clampDelta(update.delta, update.coverage || 'partial'),
      reason: update.reason || '来源为这个节点提供了新的证据。',
      coverage: update.coverage || 'partial',
      nextGap: update.nextGap || '',
      updateRule: update.updateRule || 'new_node_evidence',
      evidenceClaimIds: update.evidenceClaimIds,
    }));
  return { mapUpdates: updates.length ? updates : fallback, llmStage: llm };
}

module.exports = {
  updateMap,
  localUpdateMap,
  MAP_UPDATE_POLICY,
};
