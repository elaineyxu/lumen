const { runLlmStage } = require('../llm/stageRunner');

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceSummary: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          claimType: { type: 'string', enum: ['definition', 'mechanism', 'comparison', 'causal', 'evidence', 'recommendation', 'open_issue', 'other'] },
          stance: { type: 'string', enum: ['supports', 'complicates', 'contradicts', 'frames', 'unknown'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          targetEntryId: { type: 'string' },
          chunkIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'claimType', 'stance', 'confidence', 'targetEntryId', 'chunkIds'],
      },
    },
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          mapNodeId: { type: 'string' },
          relevance: { type: 'number' },
          mergeHint: { type: 'string' },
          chunkIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['label', 'mapNodeId', 'relevance', 'mergeHint', 'chunkIds'],
      },
    },
  },
  required: ['sourceSummary', 'claims', 'concepts'],
};

function nodeLabel(map, nodeId) {
  const node = ((map && map.nodes) || []).find((item) => item.id === nodeId);
  return node ? node.label : nodeId;
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreChunkForNode(chunk, node) {
  const text = String(chunk.text || '').toLowerCase();
  const tokens = tokenize(node.label);
  return tokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
}

function chooseChunks(chunks, node) {
  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunkForNode(chunk, node) }))
    .sort((a, b) => b.score - a.score);
  return ranked.filter((item) => item.score > 0).map((item) => item.chunk).slice(0, 2);
}

function strongestSentence(chunk) {
  const sentences = String(chunk && chunk.text || '')
    .split(/(?<=[。！？.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (sentences.sort((a, b) => b.length - a.length)[0] || String(chunk && chunk.text || '')).slice(0, 320);
}

function summarize(parsed, chunks) {
  const first = strongestSentence(chunks[0] || { text: parsed.text });
  if (!first) return 'Lumen 已接收这条来源，正在把它整理成可审阅的知识结构。';
  return '这条来源的核心线索是：' + first;
}

function heuristicExtractKnowledge({ parsed, chunks, map, boosts, targetEntryId }) {
  const boostMap = boosts || {};
  const boostedIds = Object.keys(boostMap);
  const nodes = (map && map.nodes) || [];
  const selectedNodes = boostedIds.length
    ? boostedIds.map((id) => nodes.find((node) => node.id === id) || { id, label: id })
    : nodes
      .map((node) => ({ node, hits: chunks.reduce((total, chunk) => total + scoreChunkForNode(chunk, node), 0) }))
      .sort((a, b) => b.hits - a.hits)
      .filter((item, index) => item.hits > 0 || index < 2)
      .slice(0, 3)
      .map((item) => item.node);

  const targets = selectedNodes.length ? selectedNodes : [{ id: 'unknown', label: 'New idea' }];
  const claims = targets.slice(0, 3).map((node, index) => {
    const evidenceChunks = chooseChunks(chunks, node);
    const chunk = evidenceChunks[0] || chunks[index] || chunks[0] || { id: parsed.sourceId + ':chunk-1', text: parsed.text };
    return {
      id: 'claim-' + Date.now() + '-' + (index + 1),
      text: '这条来源补强了「' + nodeLabel(map, node.id) + '」：' + strongestSentence(chunk),
      claimType: 'evidence',
      stance: 'supports',
      confidence: index === 0 ? 'high' : 'medium',
      targetEntryId: targetEntryId || ('entry-' + node.id),
      chunkIds: [chunk.id],
    };
  });

  return {
    sourceSummary: summarize(parsed, chunks),
    claims,
    concepts: targets.map((node, index) => ({
      id: 'concept-' + node.id,
      label: nodeLabel(map, node.id),
      mapNodeId: node.id,
      relevance: Math.min(0.95, Math.round(((boostMap[node.id] || 0.36) + 0.42 - index * 0.04) * 100) / 100),
      mergeHint: nodeLabel(map, node.id),
      chunkIds: chooseChunks(chunks, node).map((chunk) => chunk.id),
    })),
  };
}

function buildLlmPrompt({ parsed, chunks, map, boosts, targetEntryId }) {
  const candidateNodes = ((map && map.nodes) || []).map((node) => ({
    id: node.id,
    label: node.label,
    cluster: node.cluster,
  }));
  return JSON.stringify({
    task: 'Compile one user source into Lumen knowledge artifacts. Return JSON only.',
    source: {
      id: parsed.sourceId,
      title: parsed.metadata && parsed.metadata.title,
      type: parsed.metadata && parsed.metadata.type,
      metadata: parsed.metadata,
    },
    activeMap: {
      id: map && map.id,
      title: map && map.title,
      candidateNodes,
    },
    targetWikiEntryId: targetEntryId || '',
    userBoosts: boosts || {},
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      summary: chunk.summary,
      role: chunk.role,
      tags: chunk.tags,
      text: chunk.text,
      locator: 'chars ' + chunk.start + '-' + chunk.end,
    })),
    outputShape: {
      sourceSummary: 'string',
      claims: [
        {
          text: 'source-grounded claim',
          claimType: 'definition|mechanism|comparison|causal|evidence|recommendation|open_issue|other',
          stance: 'supports|complicates|contradicts|frames|unknown',
          confidence: 'high|medium|low',
          targetEntryId: targetEntryId || ('entry-' + (candidateNodes[0] && candidateNodes[0].id || 'node-id')),
          chunkIds: ['must reference chunk ids from chunks'],
        },
      ],
      concepts: [
        {
          label: 'concept label',
          mapNodeId: 'must be one candidate node id',
          relevance: 0.7,
          mergeHint: 'existing concept label or alias this should merge with',
          chunkIds: ['must reference chunk ids from chunks'],
        },
      ],
    },
    fieldDefinitions: {
      sourceSummary: 'One concise synthesis of what this source contributes to the user knowledge base.',
      claims: '2-5 source-grounded assertions worth reviewing.',
      claimType: 'The functional type of the claim.',
      stance: 'How the source positions the claim relative to current understanding.',
      targetEntryId: 'Use targetWikiEntryId when supplied; otherwise use entry- plus the selected mapNodeId.',
      concepts: 'Trackable concepts/entities that can merge into wiki/map structure.',
      mergeHint: 'Alias, existing label, or canonical name for concept merge/update.',
      chunkIds: 'Evidence chunk ids from the provided chunks.',
    },
    hardRules: [
      'Use only the supplied chunks as evidence.',
      'Every claim must be a reviewable, source-grounded assertion with at least one chunk id.',
      'Prefer existing candidate node ids over inventing new ids.',
      'If targetWikiEntryId is supplied, attach claims to that wiki entry unless the source is clearly unrelated.',
      'Create 2-5 claims; avoid generic summaries.',
      'Choose claimType and stance based on what the source actually says.',
      'Concepts should be entities/ideas the wiki or map can track over time.',
      'Do not include citations; the source linker will create citations from chunk ids.',
    ],
  }, null, 2);
}

function normalizeLlmExtraction(candidate, parsed, chunks, map, targetEntryId) {
  const fallback = heuristicExtractKnowledge({ parsed, chunks, map, boosts: {}, targetEntryId });
  const chunkIds = new Set(chunks.map((chunk) => chunk.id));
  const nodes = new Set(((map && map.nodes) || []).map((node) => node.id));
  const firstChunkId = chunks[0] && chunks[0].id;

  const concepts = Array.isArray(candidate && candidate.concepts) && candidate.concepts.length
    ? candidate.concepts
    : fallback.concepts;
  const normalizedConcepts = concepts.slice(0, 6).map((concept, index) => {
    const mapNodeId = nodes.has(concept.mapNodeId) ? concept.mapNodeId : (fallback.concepts[index] && fallback.concepts[index].mapNodeId) || 'unknown';
    const ids = Array.isArray(concept.chunkIds) ? concept.chunkIds.filter((id) => chunkIds.has(id)) : [];
    return {
      id: concept.id || 'concept-' + mapNodeId,
      label: concept.label || nodeLabel(map, mapNodeId),
      mapNodeId,
      relevance: Math.max(0.1, Math.min(0.98, Number(concept.relevance) || 0.66)),
      mergeHint: concept.mergeHint || concept.label || nodeLabel(map, mapNodeId),
      chunkIds: ids.length ? ids : [firstChunkId].filter(Boolean),
    };
  });

  const claims = Array.isArray(candidate && candidate.claims) && candidate.claims.length
    ? candidate.claims
    : fallback.claims;
  const normalizedClaims = claims.slice(0, 6).map((claim, index) => {
    const concept = normalizedConcepts[index] || normalizedConcepts[0] || { mapNodeId: 'unknown', chunkIds: [firstChunkId].filter(Boolean) };
    const ids = Array.isArray(claim.chunkIds) ? claim.chunkIds.filter((id) => chunkIds.has(id)) : [];
    return {
      id: claim.id || 'claim-' + Date.now() + '-' + (index + 1),
      text: claim.text || fallback.claims[index] && fallback.claims[index].text || '这条来源提供了一个可审阅的新判断。',
      claimType: ['definition', 'mechanism', 'comparison', 'causal', 'evidence', 'recommendation', 'open_issue', 'other'].includes(claim.claimType) ? claim.claimType : 'evidence',
      stance: ['supports', 'complicates', 'contradicts', 'frames', 'unknown'].includes(claim.stance) ? claim.stance : 'supports',
      confidence: ['high', 'medium', 'low'].includes(claim.confidence) ? claim.confidence : 'medium',
      targetEntryId: targetEntryId || claim.targetEntryId || 'entry-' + concept.mapNodeId,
      chunkIds: ids.length ? ids : concept.chunkIds,
    };
  });

  return {
    sourceSummary: candidate && candidate.sourceSummary || fallback.sourceSummary,
    claims: normalizedClaims,
    concepts: normalizedConcepts,
  };
}

async function llmExtractKnowledge({ parsed, chunks, map, boosts, targetEntryId, locale }) {
  const system = [
      'You are Lumen compiler.',
    'You transform sources into grounded knowledge artifacts for a personal wiki and understanding map.',
    'The output feeds human review, wiki writing, graph linking, and citation generation.',
    'Return compact JSON only. Do not invent evidence outside supplied chunks.',
  ].join(' ');
  const user = buildLlmPrompt({ parsed, chunks, map, boosts, targetEntryId });
  const llm = await runLlmStage({
    stage: 'extraction',
    schemaName: 'lumen_extraction',
    schema: EXTRACTION_SCHEMA,
    system,
    user,
    parsed,
    chunks,
    locale,
  });
  if (!llm.ok) {
    const error = new Error(llm.error || llm.reason || 'LLM extraction unavailable');
    error.llmStage = llm;
    throw error;
  }
  const extraction = normalizeLlmExtraction(llm.output, parsed, chunks, map, targetEntryId);
  extraction._extractor = 'openai:' + llm.model;
  extraction._llmStages = { extraction: llm };
  return extraction;
}

async function extractKnowledge({ parsed, chunks, map, boosts, targetEntryId, locale }) {
  try {
    return await llmExtractKnowledge({ parsed, chunks, map, boosts, targetEntryId, locale });
  } catch (error) {
    const fallback = heuristicExtractKnowledge({ parsed, chunks, map, boosts, targetEntryId });
    fallback._extractor = String(error.message || '').includes('missing-api-key') || String(error.message || '').includes('stage-disabled')
      ? 'local-heuristic'
      : 'local-heuristic-fallback';
    fallback._llmError = fallback._extractor === 'local-heuristic-fallback' ? error.message || String(error) : null;
    fallback._llmStages = { extraction: error.llmStage || null };
    return fallback;
  }
}

module.exports = {
  extractKnowledge,
  heuristicExtractKnowledge,
};
