function stripText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ''));
}

function shortSentence(value, fallback) {
  const clean = stripText(value || fallback);
  if (!clean) return '';
  return clean.length > 130 ? clean.slice(0, 128) + '...' : clean;
}

function clusterLabels(map) {
  const clusters = map && map.clusters;
  const items = Array.isArray(clusters)
    ? clusters
    : (clusters && typeof clusters === 'object' ? Object.values(clusters) : []);
  return items
    .map((cluster) => stripText(cluster && cluster.label))
    .filter(Boolean)
    .slice(0, 3);
}

function topicName(map) {
  return stripText((map && (map.question || map.title || map.domain)) || '这张图谱')
    .replace(/[？?。.!！]+$/g, '');
}

function isArrangementExplanation(value) {
  const text = stripText(value).toLowerCase();
  if (!text) return false;
  return [
    '中心问题',
    '主轴',
    '分区',
    '围绕它展开',
    '逐步补证据',
    '节点',
    '放在中央',
    'core concepts sit',
    'near the center',
    'orbit',
    'arranged',
    'layout',
    'visual',
  ].some((needle) => text.includes(needle));
}

function fallbackMapOverview(map) {
  const topic = topicName(map);
  const domain = stripText(map && map.domain);
  const labels = clusterLabels(map);
  const zh = hasCjk(topic + domain + labels.join(''));
  const labelPhrase = labels.join(zh ? '、' : ', ');

  if (/有机化学/.test(topic)) {
    return '有机化学是研究碳基化合物结构、性质、反应与合成的化学分支。';
  }
  if (/记忆/.test(topic)) {
    return '记忆是信息被编码、巩固、储存并在需要时提取和重建的一组认知过程。';
  }

  if (zh) {
    if (/如何|为什么|什么|是否|怎样|究竟/.test(topic)) {
      return labelPhrase
        ? `“${topic}”是在追问${labelPhrase}如何共同解释这个问题。`
        : `“${topic}”是在追问一个现象背后的核心机制与证据。`;
    }
    if (domain && domain !== topic) {
      return labelPhrase
        ? `“${topic}”是${domain}中围绕${labelPhrase}展开的核心知识领域。`
        : `“${topic}”是${domain}中的一个核心知识领域。`;
    }
    return labelPhrase
      ? `“${topic}”是一个围绕${labelPhrase}展开的核心知识领域。`
      : `“${topic}”是一个需要用概念、机制和证据共同解释的知识领域。`;
  }

  if (labelPhrase) {
    return `${topic} is a field or question about how ${labelPhrase} fit together.`;
  }
  return `${topic} is a question best understood through its core concepts, mechanisms, and evidence.`;
}

function normalizeMapOverview(value, map) {
  if (!value || isArrangementExplanation(value)) {
    return shortSentence(fallbackMapOverview(map), fallbackMapOverview(map));
  }
  return shortSentence(value, fallbackMapOverview(map));
}

module.exports = {
  fallbackMapOverview,
  normalizeMapOverview,
  isArrangementExplanation,
};
