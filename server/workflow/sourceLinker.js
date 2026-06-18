const { runLlmStage } = require('../llm/stageRunner');

function makeLocator(chunk, index) {
  return 'chunk ' + (index + 1) + ' · chars ' + chunk.start + '-' + chunk.end;
}

function localLinkSources({ extraction, chunks }) {
  const byId = Object.fromEntries((chunks || []).map((chunk, index) => [chunk.id, { chunk, index }]));
  const citations = [];

  extraction.claims.forEach((claim, claimIndex) => {
    const chunkIds = claim.chunkIds && claim.chunkIds.length ? claim.chunkIds : [chunks[claimIndex] && chunks[claimIndex].id].filter(Boolean);
    claim.citationIds = chunkIds.map((chunkId, index) => {
      const found = byId[chunkId] || { chunk: chunks[0] || { id: chunkId, sourceId: '', text: '', start: 0, end: 0 }, index };
      const citationId = 'cite-' + (citations.length + 1);
      citations.push({
        id: citationId,
        sourceId: found.chunk.sourceId,
        chunkId: found.chunk.id,
        quote: String(found.chunk.text || '').slice(0, 320),
        locator: makeLocator(found.chunk, found.index),
      });
      return citationId;
    });
    delete claim.chunkIds;
  });

  return {
    claims: extraction.claims,
    citations,
  };
}

const LINKER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claimId: { type: 'string' },
          chunkIds: { type: 'array', items: { type: 'string' } },
          supportLevel: { type: 'string', enum: ['direct', 'partial', 'context'] },
          rationale: { type: 'string' },
        },
        required: ['claimId', 'chunkIds', 'supportLevel', 'rationale'],
      },
    },
  },
  required: ['assignments'],
};

async function linkSources({ extraction, chunks, parsed }) {
  const chunkIds = new Set((chunks || []).map((chunk) => chunk.id));
  const llm = await runLlmStage({
    stage: 'sourceLinker',
    schemaName: 'lumen_source_linker',
    schema: LINKER_SCHEMA,
    parsed,
    chunks,
    system: [
      'You are Lumen source linker.',
      'You choose exact evidence chunks for each extracted claim.',
      'You do not create citations; code will create final citations from your chunk ids.',
    ].join(' '),
    user: JSON.stringify({
      claims: extraction.claims.map((claim) => ({
        id: claim.id,
        text: claim.text,
        claimType: claim.claimType,
        stance: claim.stance,
        currentChunkIds: claim.chunkIds || [],
      })),
      chunks: (chunks || []).map((chunk) => ({
        id: chunk.id,
        summary: chunk.summary,
        role: chunk.role,
        keyTerms: chunk.keyTerms,
        text: chunk.text.slice(0, 900),
      })),
      fieldDefinitions: {
        chunkIds: 'One or two chunks that directly support the claim.',
        supportLevel: 'direct if the claim is clearly in the chunk, partial if inferred across text, context if only background.',
        rationale: 'Short reason for the assignment; not shown as citation.',
      },
      hardRules: [
        'Only use supplied chunk ids.',
        'Prefer direct support over thematic similarity.',
        'If no chunk directly supports the claim, keep the current chunk id and mark partial/context.',
      ],
    }, null, 2),
  });

  if (llm.ok && llm.output && Array.isArray(llm.output.assignments)) {
    const byClaim = Object.fromEntries(llm.output.assignments.map((item) => [item.claimId, item]));
    extraction.claims.forEach((claim) => {
      const assignment = byClaim[claim.id];
      const ids = assignment && Array.isArray(assignment.chunkIds)
        ? assignment.chunkIds.filter((id) => chunkIds.has(id)).slice(0, 2)
        : [];
      if (ids.length) claim.chunkIds = ids;
    });
  }

  const linked = localLinkSources({ extraction, chunks });
  linked.llmStage = llm;
  return linked;
}

module.exports = {
  linkSources,
  localLinkSources,
};
