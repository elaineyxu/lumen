const { runLlmStage } = require('../llm/stageRunner');
const { spreadMapNodes } = require('./mapLayout');
const { normalizeMapOverview } = require('./mapSummary');

const HUES = ['blue', 'teal', 'amber', 'coral', 'violet'];
const MAP_LIMITS = {
  minClusters: 3,
  maxClusters: 5,
  minNodes: 7,
  maxNodes: 10,
  maxNodesPerCluster: 3,
  maxLinks: 14,
  maxLabelChars: 34,
};
const ALLOWED_NODE_KINDS = ['core_concept', 'sub_question', 'mechanism', 'theory', 'evidence_type', 'debate', 'knowledge_gap'];
const DISALLOWED_LABELS = new Set([
  'overview',
  'introduction',
  'background',
  'benefits',
  'challenges',
  'future',
  'misc',
  'other',
  'general',
  'summary',
]);

function slugify(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return slug || fallback;
}

function shortTitle(text, fallback) {
  const clean = String(text || '').replace(/<[^>]+>/g, '').trim();
  if (!clean) return fallback;
  return clean.length > MAP_LIMITS.maxLabelChars ? clean.slice(0, MAP_LIMITS.maxLabelChars - 2) + '...' : clean;
}

function shortReason(text, fallback) {
  const clean = String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 130 ? clean.slice(0, 128) + '...' : clean;
}

function isAllowedMapLabel(label) {
  const clean = String(label || '').trim().toLowerCase();
  if (!clean) return false;
  if (DISALLOWED_LABELS.has(clean)) return false;
  if (clean.split(/\s+/).length > 7) return false;
  return true;
}

const MAP_SEED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    domain: { type: 'string' },
    question: { type: 'string' },
    layoutReason: { type: 'string' },
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          note: { type: 'string' },
          hue: { type: 'string', enum: HUES },
        },
        required: ['id', 'label', 'note', 'hue'],
      },
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          cluster: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          size: { type: 'number' },
          hue: { type: 'string', enum: HUES },
          kind: { type: 'string', enum: ALLOWED_NODE_KINDS },
          why: { type: 'string' },
          startingQuestion: { type: 'string' },
        },
        required: ['id', 'label', 'cluster', 'x', 'y', 'size', 'hue', 'kind', 'why', 'startingQuestion'],
      },
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          type: { type: 'string', enum: ['solid', 'dash'] },
          label: { type: 'string' },
        },
        required: ['from', 'to', 'type', 'label'],
      },
    },
  },
  required: ['title', 'domain', 'question', 'layoutReason', 'clusters', 'nodes', 'links'],
};

function normalizeMapSeed(output, question) {
  const mapId = 'map-' + Date.now();
  const clusters = {};
  const clusterItems = Array.isArray(output.clusters) && output.clusters.length ? output.clusters.slice(0, MAP_LIMITS.maxClusters) : [];
  clusterItems.forEach((cluster, index) => {
    const id = slugify(cluster.id || cluster.label, 'cluster-' + index);
    if (!isAllowedMapLabel(cluster.label)) return;
    clusters[id] = {
      label: shortTitle(cluster.label || 'Cluster ' + (index + 1), 'Cluster ' + (index + 1)),
      hue: HUES.includes(cluster.hue) ? cluster.hue : HUES[index % HUES.length],
      note: cluster.note || '',
    };
  });
  if (!Object.keys(clusters).length) {
    throw new Error('Map seed did not include valid learning clusters');
  }

  const clusterIds = Object.keys(clusters);
  const nodeIds = new Set();
  const clusterCounts = {};
  const nodes = (Array.isArray(output.nodes) ? output.nodes : [])
    .filter((node) => isAllowedMapLabel(node.label))
    .filter((node) => ALLOWED_NODE_KINDS.includes(node.kind))
    .slice(0, MAP_LIMITS.maxNodes)
    .map((node, index) => {
    const cluster = clusterIds.includes(node.cluster) ? node.cluster : clusterIds[index % clusterIds.length];
    if ((clusterCounts[cluster] || 0) >= MAP_LIMITS.maxNodesPerCluster && index > 0) return null;
    clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
    const id = slugify(node.id || node.label, 'node-' + index);
    nodeIds.add(id);
    return {
      id,
      label: shortTitle(node.label || 'Node ' + (index + 1), 'Node ' + (index + 1)),
      cluster,
      x: Math.max(8, Math.min(92, Number(node.x) || (20 + (index * 17) % 68))),
      y: Math.max(10, Math.min(90, Number(node.y) || (24 + (index * 23) % 60))),
      size: Math.max(44, Math.min(120, Number(node.size) || (index === 0 ? 108 : 66))),
      hue: HUES.includes(node.hue) ? node.hue : clusters[cluster].hue,
      kind: node.kind,
      explored: 0,
      sources: 0,
      hub: index === 0,
      why: node.why || '',
      startingQuestion: node.startingQuestion || '',
    };
  }).filter(Boolean);

  if (nodes.length < MAP_LIMITS.minNodes) {
    throw new Error('Map seed did not meet minimum node count after filtering');
  }
  const spreadNodes = spreadMapNodes(nodes);

  const links = (Array.isArray(output.links) ? output.links : [])
    .filter((link) => nodeIds.has(slugify(link.from, '')) && nodeIds.has(slugify(link.to, '')))
    .filter((link) => slugify(link.from, '') !== slugify(link.to, ''))
    .slice(0, MAP_LIMITS.maxLinks)
    .map((link) => [slugify(link.from, ''), slugify(link.to, ''), link.type === 'solid' ? 'solid' : 'dash']);

  return {
    id: mapId,
    title: shortTitle(output.title || question, 'New map'),
    question: output.question || question,
    domain: output.domain || 'New field',
    layoutReason: normalizeMapOverview(output.layoutReason, {
      title: output.title || question,
      question: output.question || question,
      domain: output.domain,
      clusters,
    }),
    accentHue: spreadNodes[0].hue || 'blue',
    created: 'just now',
    updated: 'just now',
    clusters,
    nodes: spreadNodes,
    links: links.length ? links : spreadNodes.slice(1, 4).map((node) => [spreadNodes[0].id, node.id, 'dash']),
    seedMeta: {
      generatedBy: 'mapSeeder',
      promptVersion: 'lumen.map.seed.v1',
    },
  };
}

async function seedMapFromQuestion(question) {
  const llm = await runLlmStage({
    stage: 'mapSeeder',
    schemaName: 'lumen_map_seed',
    schema: MAP_SEED_SCHEMA,
    parsed: { metadata: { title: question, characterCount: String(question || '').length } },
    chunks: [],
    system: [
      'You are Lumen map seeder.',
      'A user gives a research question. Create an initial understanding map.',
      'The map should reveal concepts, gaps, relationships, and next exploration paths.',
      'Do not answer the question as an essay. Build a navigable knowledge graph seed.',
    ].join(' '),
    user: JSON.stringify({
      question,
      task: 'Generate a first-pass knowledge graph for this question.',
      fieldDefinitions: {
        title: 'Short map title, not the full question.',
        domain: 'Research domain or field.',
        layoutReason: 'One concise user-facing overview or definition of the subject/question. Define what the topic is; do not explain the visual layout.',
        clusters: '3-5 conceptual regions. Each region should be a learning section, not a vague category.',
        nodes: '7-10 concepts/questions. Include one central hub and 1-3 nodes per cluster.',
        kind: 'One of core_concept, sub_question, mechanism, theory, evidence_type, debate, knowledge_gap.',
        links: 'No more than 14 relationships. Use dash for tentative links, solid for strong structural links.',
        why: 'Why this node matters for the user question.',
        startingQuestion: 'A concrete question the user could ask next about this node.',
      },
      allowedOnMap: [
        'Core concepts required to understand the question.',
        'Sub-questions that decompose the user question.',
        'Mechanisms or causal processes.',
        'Theories/frameworks that organize the topic.',
        'Evidence types or methods the user should look for.',
        'Debates, tradeoffs, contradictions, or failure modes.',
        'Knowledge gaps or unknowns that guide exploration.',
      ],
      notAllowedOnMap: [
        'Generic buckets such as overview, background, benefits, challenges, future.',
        'Decorative or motivational labels.',
        'Long essay-like phrases.',
        'Things that are merely associated with the topic but do not help the user learn the question.',
      ],
      layoutRules: [
        'Use x percentages from 10-90 and y percentages from 12-84 so labels have room.',
        'Make the center/hub node near x=50,y=42.',
        'Place clusters in visually separate regions.',
        'Never stack nodes: any two node centers must be at least 12 percentage points apart.',
        'Avoid label overlap: if two nodes share a similar y, keep their x values at least 14-20 percentage points apart.',
        'Keep labels short: usually 2-5 words, max 34 characters.',
        'Include unknowns/gaps, not only known concepts.',
        'The map should be readable at a glance: no dense link hairball.',
      ],
      hardRules: [
        'Only return JSON matching the schema.',
        'Do not invent sources or citations.',
        'Create 3-5 clusters, 7-10 nodes, and at most 14 links.',
        'Do not put more than 3 nodes in one cluster.',
        'Make node ids stable slugs.',
        'Every node must have a kind and a startingQuestion.',
        'No overlapping node dots or labels.',
        'layoutReason must be one sentence and no more than 120 characters.',
        'layoutReason must not mention layout, center, axis, clusters, nodes, arrangement, or evidence placement.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output) {
    const error = new Error(llm.error || llm.reason || 'Map seeding LLM unavailable');
    error.llmStage = llm;
    throw error;
  }

  const map = normalizeMapSeed(llm.output, question);
  map.seedMeta = {
    ...map.seedMeta,
    model: llm.model,
    stage: llm.stage,
  };
  return map;
}

async function reviseMapWithPrompt(map, prompt) {
  const revisionPrompt = String(prompt || '').trim();
  if (!map || !map.id) throw new Error('Map is required for revision');
  if (!revisionPrompt) throw new Error('Revision prompt is required');

  const llm = await runLlmStage({
    stage: 'mapSeeder',
    schemaName: 'lumen_map_seed',
    schema: MAP_SEED_SCHEMA,
    parsed: { metadata: { title: map.title || map.question || 'Map revision', characterCount: revisionPrompt.length } },
    chunks: [],
    system: [
      'You are Lumen map editor.',
      'A user already has an understanding map and asks to revise it.',
      'Apply the requested change to the graph structure, labels, clusters, and layout.',
      'Do not answer the topic as an essay. Return a revised navigable knowledge graph seed.',
    ].join(' '),
    user: JSON.stringify({
      revisionPrompt,
      currentMap: {
        title: map.title,
        domain: map.domain,
        question: map.question,
        layoutReason: map.layoutReason || '',
        clusters: map.clusters || {},
        nodes: (map.nodes || []).map((node) => ({
          id: node.id,
          label: node.label,
          cluster: node.cluster,
          x: node.x,
          y: node.y,
          size: node.size,
          hue: node.hue,
          kind: node.kind || 'core_concept',
          why: node.why || '',
          startingQuestion: node.startingQuestion || '',
        })),
        links: (map.links || []).map((link) => ({
          from: link[0],
          to: link[1],
          type: link[2] === 'solid' ? 'solid' : 'dash',
        })),
      },
      fieldDefinitions: {
        layoutReason: 'One concise user-facing overview or definition of the revised subject/question. Define what the topic is; do not explain the visual layout.',
        clusters: '3-5 conceptual regions. Keep meaningful regions, not vague buckets.',
        nodes: '7-10 concepts/questions. Keep labels short and concrete.',
        links: 'No more than 14 relationships. Use dash for tentative links and solid for structural links.',
      },
      hardRules: [
        'Only return JSON matching the schema.',
        'Do not invent sources or citations.',
        'Respect the user revision prompt first.',
        'Keep the original guiding question unless the user explicitly asks to reframe it.',
        'Create 3-5 clusters, 7-10 nodes, and at most 14 links.',
        'Do not put more than 3 nodes in one cluster.',
        'No overlapping node dots or labels; keep close-y nodes separated horizontally.',
        'layoutReason must be one sentence and no more than 120 characters.',
        'layoutReason must not mention layout, center, axis, clusters, nodes, arrangement, or evidence placement.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output) {
    const error = new Error(llm.error || llm.reason || 'Map revision LLM unavailable');
    error.llmStage = llm;
    throw error;
  }

  const revised = normalizeMapSeed(llm.output, map.question || map.title || 'Map revision');
  revised.id = map.id;
  revised.created = map.created || revised.created;
  revised.updated = 'just now';
  revised.seedMeta = {
    ...(map.seedMeta || {}),
    ...revised.seedMeta,
    generatedBy: 'mapSeeder',
    model: llm.model,
    stage: llm.stage,
    revision: Number((map.seedMeta && map.seedMeta.revision) || 0) + 1,
    lastRevisionPrompt: shortReason(revisionPrompt, revisionPrompt),
  };
  return revised;
}

module.exports = {
  seedMapFromQuestion,
  reviseMapWithPrompt,
  normalizeMapSeed,
  MAP_SEED_SCHEMA,
  MAP_LIMITS,
};
