const { runLlmStage } = require('../llm/stageRunner');

function localGenerateKnowledgeGraph({ extraction }) {
  const concepts = extraction.concepts || [];
  const relations = [];
  for (let index = 0; index < concepts.length - 1; index += 1) {
    relations.push({
      id: 'rel-' + concepts[index].mapNodeId + '-' + concepts[index + 1].mapNodeId,
      fromNodeId: concepts[index].mapNodeId,
      toNodeId: concepts[index + 1].mapNodeId,
      type: 'related',
      label: 'related',
      directionality: 'undirected',
      evidenceClaimIds: extraction.claims.slice(index, index + 2).map((claim) => claim.id),
      confidence: 'low',
      rationale: 'These concepts co-occur in adjacent extracted claims from the same source.',
    });
  }
  return { relations };
}

const GRAPH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    relations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fromNodeId: { type: 'string' },
          toNodeId: { type: 'string' },
          type: { type: 'string' },
          label: { type: 'string' },
          directionality: { type: 'string', enum: ['directed', 'undirected'] },
          evidenceClaimIds: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          rationale: { type: 'string' },
        },
        required: ['fromNodeId', 'toNodeId', 'type', 'label', 'directionality', 'evidenceClaimIds', 'confidence', 'rationale'],
      },
    },
  },
  required: ['relations'],
};

async function generateKnowledgeGraph({ extraction, parsed, chunks, map }) {
  const fallback = localGenerateKnowledgeGraph({ extraction });
  const nodeIds = new Set((extraction.concepts || []).map((concept) => concept.mapNodeId));
  const claimIds = new Set((extraction.claims || []).map((claim) => claim.id));
  const llm = await runLlmStage({
    stage: 'knowledgeGraph',
    schemaName: 'lumen_knowledge_graph',
    schema: GRAPH_SCHEMA,
    parsed,
    chunks,
    system: [
      'You are Lumen knowledge graph builder.',
      'You create only relations that are supported by extracted claims.',
      'The graph should help users see structure, not decorate every pair of concepts.',
    ].join(' '),
    user: JSON.stringify({
      activeMap: map && { id: map.id, title: map.title },
      concepts: extraction.concepts,
      claims: extraction.claims,
      relationTypes: ['supports', 'contrasts', 'causes', 'constrains', 'example_of', 'prerequisite', 'part_of', 'updates', 'related'],
      hardRules: [
        'Only connect node ids that appear in concepts.',
        'Only cite claim ids that appear in claims.',
        'Return 0-6 relations; 0 is valid if the source does not justify a relation.',
        'Avoid generic related unless no stronger relation is justified.',
        'Use directed for asymmetric relations such as causes, prerequisite, example_of, updates, constrains.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output || !Array.isArray(llm.output.relations)) return { ...fallback, llmStage: llm };
  const relations = llm.output.relations
    .filter((relation) => nodeIds.has(relation.fromNodeId) && nodeIds.has(relation.toNodeId) && relation.fromNodeId !== relation.toNodeId)
    .slice(0, 8)
    .map((relation, index) => ({
      id: 'rel-' + relation.fromNodeId + '-' + relation.toNodeId + '-' + index,
      fromNodeId: relation.fromNodeId,
      toNodeId: relation.toNodeId,
      type: relation.type || 'related',
      label: relation.label || relation.type || 'related',
      directionality: relation.directionality || 'undirected',
      evidenceClaimIds: Array.isArray(relation.evidenceClaimIds) ? relation.evidenceClaimIds.filter((id) => claimIds.has(id)) : [],
      confidence: ['high', 'medium', 'low'].includes(relation.confidence) ? relation.confidence : 'medium',
      rationale: relation.rationale || '',
    }));
  return { relations: relations.length ? relations : fallback.relations, llmStage: llm };
}

module.exports = {
  generateKnowledgeGraph,
  localGenerateKnowledgeGraph,
};
