const { SCHEMA_VERSION } = require('../../server/schema');

function compileProposal({ source, map, boosts, targetEntryId }) {
  const nodeId = Object.keys(boosts || {})[0] || map.nodes[0].id;
  const target = targetEntryId || ('entry-' + nodeId);
  const chunkId = source.id + '-chunk-1';
  const firstClaimId = 'claim-' + source.id + '-1';
  const secondClaimId = 'claim-' + source.id + '-2';
  const result = {
    schemaVersion: SCHEMA_VERSION,
    sourceSummary: 'Deterministic compile proposal for review tests.',
    claims: [
      { id: firstClaimId, text: 'A source-grounded conclusion.', confidence: 'high', citationIds: ['cite-1'], targetEntryId: target },
      { id: secondClaimId, text: 'A second reviewable conclusion.', confidence: 'medium', citationIds: ['cite-2'], targetEntryId: target },
    ],
    concepts: [{ id: 'concept-' + nodeId, label: map.nodes[0].label, mapNodeId: nodeId, relevance: 0.8 }],
    relations: [],
    wikiPatches: [{
      entryId: target,
      operation: 'append_section',
      heading: 'New source evidence',
      body: 'The accepted proposal adds source-grounded evidence to this entry.',
      evidenceClaimIds: [firstClaimId, secondClaimId],
    }],
    mapUpdates: [{ nodeId, delta: boosts[nodeId], reason: 'The source covers this node.', evidenceClaimIds: [firstClaimId] }],
    openQuestions: [],
    citations: [
      { id: 'cite-1', sourceId: source.id, chunkId, quote: source.text, locator: 'chunk 1' },
      { id: 'cite-2', sourceId: source.id, chunkId, quote: source.text, locator: 'chunk 1' },
    ],
  };
  return {
    engine: 'test-fixture',
    source,
    map: { id: map.id, title: map.title },
    boosts,
    targetEntryId: target,
    result,
    artifacts: {
      source: { ...source, metadata: { title: source.title, type: source.type, kind: source.type } },
      chunks: [{ id: chunkId, sourceId: source.id, text: source.text, start: 0, end: source.text.length }],
    },
  };
}

module.exports = { compileProposal };
