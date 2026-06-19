const DEFAULT_LIMITS = {
  minClusters: 3,
  maxClusters: 5,
  minNodes: 7,
  maxNodes: 10,
  maxNodesPerCluster: 3,
  maxLinks: 14,
  maxLabelChars: 34,
};

const GENERIC_LABELS = new Set([
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
  'impact',
  'implications',
  'opportunities',
  'risks',
  'methods',
  'approach',
  'context',
  'key concepts',
  'main ideas',
  '核心概念',
  '背景',
  '概述',
  '影响',
  '挑战',
  '未来',
  '方法',
  '风险',
  '机会',
  '总结',
]);

const REQUIRED_KIND_GROUPS = [
  {
    code: 'missing_mechanism_or_evidence',
    kinds: ['mechanism', 'evidence_type'],
    message: 'Add at least one mechanism or evidence node so sources can land on the map.',
    penalty: 10,
  },
  {
    code: 'missing_debate_or_gap',
    kinds: ['debate', 'knowledge_gap'],
    message: 'Add at least one debate or knowledge-gap node to make the map explorable.',
    penalty: 10,
  },
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function wordSet(value) {
  return new Set(normalizeText(value).split(/\s+/).filter(Boolean));
}

function overlapScore(a, b) {
  const aWords = wordSet(a);
  const bWords = wordSet(b);
  if (!aWords.size || !bWords.size) return 0;
  let shared = 0;
  aWords.forEach((word) => {
    if (bWords.has(word)) shared += 1;
  });
  return shared / Math.min(aWords.size, bWords.size);
}

function textLength(value) {
  return Array.from(String(value || '').trim()).length;
}

function looksLikeQuestion(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[?？]$/.test(text)) return true;
  return /^(how|why|what|when|where|which|who|can|should|does|do|is|are|will|could|如何|为什么|什么|哪些|是否|能否|怎样)/i.test(text);
}

function addIssue(issues, issue) {
  issues.push({
    severity: issue.severity || 'medium',
    penalty: issue.penalty || 6,
    code: issue.code,
    message: issue.message,
    nodeIds: issue.nodeIds || [],
  });
}

function assessMapQuality(map, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const clusters = map && map.clusters && typeof map.clusters === 'object' ? map.clusters : {};
  const clusterIds = Object.keys(clusters);
  const nodes = Array.isArray(map && map.nodes) ? map.nodes : [];
  const links = Array.isArray(map && map.links) ? map.links : [];
  const issues = [];

  if (clusterIds.length < limits.minClusters || clusterIds.length > limits.maxClusters) {
    addIssue(issues, {
      code: 'cluster_count',
      severity: 'high',
      penalty: 14,
      message: 'Map should have ' + limits.minClusters + '-' + limits.maxClusters + ' learning regions.',
    });
  }
  if (nodes.length < limits.minNodes || nodes.length > limits.maxNodes) {
    addIssue(issues, {
      code: 'node_count',
      severity: 'high',
      penalty: 16,
      message: 'Map should have ' + limits.minNodes + '-' + limits.maxNodes + ' nodes.',
    });
  }
  if (links.length > limits.maxLinks) {
    addIssue(issues, {
      code: 'too_many_links',
      severity: 'medium',
      penalty: 8,
      message: 'Map has too many links for a readable first pass.',
    });
  }

  const countsByCluster = {};
  const nodeIds = new Set();
  const duplicateIds = [];
  nodes.forEach((node) => {
    if (nodeIds.has(node.id)) duplicateIds.push(node.id);
    nodeIds.add(node.id);
    countsByCluster[node.cluster] = (countsByCluster[node.cluster] || 0) + 1;
  });
  if (duplicateIds.length) {
    addIssue(issues, {
      code: 'duplicate_node_ids',
      severity: 'high',
      penalty: 14,
      message: 'Some node ids are duplicated.',
      nodeIds: duplicateIds,
    });
  }
  Object.entries(countsByCluster).forEach(([clusterId, count]) => {
    if (!clusterIds.includes(clusterId)) {
      addIssue(issues, {
        code: 'unknown_cluster',
        severity: 'high',
        penalty: 12,
        message: 'A node points to a missing cluster.',
        nodeIds: nodes.filter((node) => node.cluster === clusterId).map((node) => node.id),
      });
    }
    if (count > limits.maxNodesPerCluster) {
      addIssue(issues, {
        code: 'cluster_overfull',
        severity: 'medium',
        penalty: 8,
        message: 'A cluster has more than ' + limits.maxNodesPerCluster + ' nodes.',
        nodeIds: nodes.filter((node) => node.cluster === clusterId).map((node) => node.id),
      });
    }
  });
  clusterIds.forEach((clusterId) => {
    if (!countsByCluster[clusterId]) {
      addIssue(issues, {
        code: 'empty_cluster',
        severity: 'medium',
        penalty: 6,
        message: 'A learning region has no nodes.',
      });
    }
  });

  const genericNodes = [];
  const longLabelNodes = [];
  const thinWhyNodes = [];
  const weakQuestionNodes = [];
  nodes.forEach((node) => {
    const label = normalizeText(node.label);
    const compact = compactText(node.label);
    if (GENERIC_LABELS.has(label) || GENERIC_LABELS.has(compact)) genericNodes.push(node.id);
    if (textLength(node.label) > limits.maxLabelChars) longLabelNodes.push(node.id);
    if (textLength(node.why) < 24 || compactText(node.why) === compact) thinWhyNodes.push(node.id);
    if (textLength(node.startingQuestion) < 10 || !looksLikeQuestion(node.startingQuestion) || compactText(node.startingQuestion) === compact) {
      weakQuestionNodes.push(node.id);
    }
  });
  if (genericNodes.length) {
    addIssue(issues, {
      code: 'generic_labels',
      severity: 'high',
      penalty: 12,
      message: genericNodes.length + ' node label' + (genericNodes.length === 1 ? ' is' : 's are') + ' too generic.',
      nodeIds: genericNodes,
    });
  }
  if (longLabelNodes.length) {
    addIssue(issues, {
      code: 'long_labels',
      severity: 'medium',
      penalty: 5,
      message: longLabelNodes.length + ' node label' + (longLabelNodes.length === 1 ? ' is' : 's are') + ' too long.',
      nodeIds: longLabelNodes,
    });
  }
  if (thinWhyNodes.length) {
    addIssue(issues, {
      code: 'thin_why',
      severity: 'medium',
      penalty: 8,
      message: thinWhyNodes.length + ' node' + (thinWhyNodes.length === 1 ? ' needs' : 's need') + ' a clearer reason for why it matters.',
      nodeIds: thinWhyNodes,
    });
  }
  if (weakQuestionNodes.length) {
    addIssue(issues, {
      code: 'weak_starting_questions',
      severity: 'medium',
      penalty: 8,
      message: weakQuestionNodes.length + ' node' + (weakQuestionNodes.length === 1 ? ' needs' : 's need') + ' a more concrete starting question.',
      nodeIds: weakQuestionNodes,
    });
  }

  const duplicateLabels = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = compactText(nodes[i].label);
      const b = compactText(nodes[j].label);
      if (!a || !b) continue;
      if (a === b || a.includes(b) || b.includes(a) || overlapScore(nodes[i].label, nodes[j].label) >= 0.82) {
        duplicateLabels.push(nodes[i].id, nodes[j].id);
      }
    }
  }
  if (duplicateLabels.length) {
    addIssue(issues, {
      code: 'duplicate_or_near_duplicate_labels',
      severity: 'high',
      penalty: 12,
      message: 'Some nodes appear to duplicate the same idea.',
      nodeIds: Array.from(new Set(duplicateLabels)),
    });
  }

  const kinds = new Set(nodes.map((node) => node.kind).filter(Boolean));
  REQUIRED_KIND_GROUPS.forEach((group) => {
    if (!group.kinds.some((kind) => kinds.has(kind))) {
      addIssue(issues, {
        code: group.code,
        severity: 'medium',
        penalty: group.penalty,
        message: group.message,
      });
    }
  });

  const degree = Object.fromEntries(nodes.map((node) => [node.id, 0]));
  let invalidLinks = 0;
  links.forEach((link) => {
    const from = Array.isArray(link) ? link[0] : link.from;
    const to = Array.isArray(link) ? link[1] : link.to;
    if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) {
      invalidLinks += 1;
      return;
    }
    degree[from] += 1;
    degree[to] += 1;
  });
  if (invalidLinks) {
    addIssue(issues, {
      code: 'invalid_links',
      severity: 'medium',
      penalty: 7,
      message: invalidLinks + ' link' + (invalidLinks === 1 ? ' points' : 's point') + ' to missing or invalid nodes.',
    });
  }
  const isolated = Object.entries(degree).filter(([, count]) => count === 0).map(([nodeId]) => nodeId);
  if (isolated.length > Math.max(1, Math.floor(nodes.length * 0.2))) {
    addIssue(issues, {
      code: 'too_many_isolated_nodes',
      severity: 'medium',
      penalty: 8,
      message: isolated.length + ' nodes are isolated from the map structure.',
      nodeIds: isolated,
    });
  }

  const penalty = issues.reduce((sum, issue) => sum + issue.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const confidence = score >= 84 ? 'high' : (score >= 68 ? 'medium' : 'low');
  return {
    confidence,
    score,
    shouldEvaluate: confidence === 'low',
    issues: issues.slice(0, 12).map(({ code, severity, message, nodeIds }) => ({ code, severity, message, nodeIds })),
    checkedAt: new Date().toISOString(),
    version: 'lumen.map.quality.v1',
  };
}

module.exports = {
  assessMapQuality,
  GENERIC_LABELS,
};
