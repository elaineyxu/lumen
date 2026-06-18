const { runLlmStage } = require('../llm/stageRunner');

function localGenerateFeedback({ extraction, linked, graph, wiki, mapResult }) {
  const concepts = extraction.concepts || [];
  const claims = (linked && linked.claims) || extraction.claims || [];
  const citations = (linked && linked.citations) || [];
  const wikiPatches = (wiki && wiki.wikiPatches) || [];
  const mapUpdates = (mapResult && mapResult.mapUpdates) || [];
  const hasCitations = citations.length > 0 && claims.every((claim) => Array.isArray(claim.citationIds) && claim.citationIds.length > 0);
  const hasWikiEvidence = wikiPatches.length > 0 && wikiPatches.every((patch) => Array.isArray(patch.evidenceClaimIds) && patch.evidenceClaimIds.length > 0);
  const hasMapEvidence = mapUpdates.length === 0 || mapUpdates.every((update) => Array.isArray(update.evidenceClaimIds) && update.evidenceClaimIds.length > 0);
  const riskFlags = [];
  if (!hasCitations) riskFlags.push('有 claim 缺少可回溯 citation，暂不应自动写入。');
  if (!hasWikiEvidence) riskFlags.push('Wiki proposal 需要绑定 evidenceClaimIds 后再写入。');
  if (!hasMapEvidence) riskFlags.push('Map update 需要说明具体 evidence claim，而不是只因为提到主题。');
  const recommendation = riskFlags.length ? 'reject' : 'review';
  return {
    recommendation,
    summary: riskFlags.length
      ? '这次 proposal 还不能安全写入；需要先补齐证据链。'
      : '这次编纂可以进入人工审阅；请重点确认 claim 是否足够改变 Wiki/Map。',
    reviewNotes: [
      '请确认这些 claim 是否真的改变了当前词条，而不是只作为旁证。',
      concepts[0] ? '下一步可以继续补「' + concepts[0].label + '」的反例或边界条件。' : '下一步可以添加一个更具体的来源来增强判断。',
    ],
    nextActions: [
      graph && graph.relations && graph.relations.length ? '检查新关系是否应该显示在理解地图中。' : '补一个能连接两个概念的来源。',
    ],
    checklist: [
      'Claims have source citations.',
      'Wiki patches are grounded in evidence claims.',
      'Map updates have conservative deltas.',
    ],
    wikiReview: '确认 wiki patch 是否应该 append、revise，还是只保留为 needs_review。',
    mapReview: '确认点亮节点是否真的提升理解，而不是只因为来源提到该主题。',
    riskFlags,
  };
}

const FEEDBACK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendation: { type: 'string', enum: ['accept', 'review', 'reject'] },
    summary: { type: 'string' },
    reviewNotes: { type: 'array', items: { type: 'string' } },
    nextActions: { type: 'array', items: { type: 'string' } },
    checklist: { type: 'array', items: { type: 'string' } },
    wikiReview: { type: 'string' },
    mapReview: { type: 'string' },
    riskFlags: { type: 'array', items: { type: 'string' } },
  },
  required: ['recommendation', 'summary', 'reviewNotes', 'nextActions', 'checklist', 'wikiReview', 'mapReview', 'riskFlags'],
};

async function generateFeedback({ extraction, linked, graph, wiki, mapResult, parsed, chunks }) {
  const fallback = localGenerateFeedback({ extraction, linked, graph, wiki, mapResult });
  const llm = await runLlmStage({
    stage: 'feedback',
    schemaName: 'lumen_feedback',
    schema: FEEDBACK_SCHEMA,
    parsed,
    chunks,
    system: [
      'You are Lumen AI reviewer.',
      'You review a source compile proposal before it is applied to the user wiki and understanding map.',
      'Be concise, concrete, and grounded in the generated artifacts.',
    ].join(' '),
    user: JSON.stringify({
      source: parsed && parsed.metadata,
      claims: ((linked && linked.claims) || extraction.claims || []).map((claim) => ({
        id: claim.id,
        text: claim.text,
        claimType: claim.claimType,
        stance: claim.stance,
        confidence: claim.confidence,
        citationIds: claim.citationIds || [],
        targetEntryId: claim.targetEntryId,
      })),
      citations: ((linked && linked.citations) || []).map((citation) => ({
        id: citation.id,
        locator: citation.locator,
        quote: String(citation.quote || '').slice(0, 360),
      })),
      concepts: extraction.concepts,
      relations: graph && graph.relations,
      wikiPatches: wiki && wiki.wikiPatches,
      mapUpdates: mapResult && mapResult.mapUpdates,
      fieldDefinitions: {
        recommendation: 'accept when proposal is well-grounded, review when useful but needs human judgment, reject when weak/unsupported.',
        summary: 'One sentence review verdict.',
        reviewNotes: '1-3 notes about what changed or needs human judgment.',
        nextActions: '1-3 concrete follow-up actions, sources to seek, or questions to ask.',
        checklist: '3-5 short audit checks the user can scan before applying.',
        wikiReview: 'Specific note about whether wiki patches should be accepted/revised.',
        mapReview: 'Specific note about whether map updates should brighten nodes.',
        riskFlags: 'Potential issues such as weak evidence, contradictory claims, too broad, source quality concerns.',
      },
      hardRules: [
        'Do not repeat every claim.',
        'Do not praise the system.',
        'Mention uncertainty when evidence is thin.',
        'Keep each item under 24 words.',
        'Reject if claims have no citations.',
        'Reject if wiki patches lack evidenceClaimIds.',
        'Reject if map deltas lack evidenceClaimIds or only reflect topic mention.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output) return { ...fallback, llmStage: llm };
  return {
    recommendation: ['accept', 'review', 'reject'].includes(llm.output.recommendation) ? llm.output.recommendation : fallback.recommendation,
    summary: llm.output.summary || fallback.summary,
    reviewNotes: Array.isArray(llm.output.reviewNotes) && llm.output.reviewNotes.length ? llm.output.reviewNotes.slice(0, 4) : fallback.reviewNotes,
    nextActions: Array.isArray(llm.output.nextActions) && llm.output.nextActions.length ? llm.output.nextActions.slice(0, 4) : fallback.nextActions,
    checklist: Array.isArray(llm.output.checklist) && llm.output.checklist.length ? llm.output.checklist.slice(0, 5) : fallback.checklist,
    wikiReview: llm.output.wikiReview || fallback.wikiReview,
    mapReview: llm.output.mapReview || fallback.mapReview,
    riskFlags: Array.isArray(llm.output.riskFlags) ? llm.output.riskFlags.slice(0, 4) : [],
    llmStage: llm,
  };
}

module.exports = {
  generateFeedback,
  localGenerateFeedback,
};
