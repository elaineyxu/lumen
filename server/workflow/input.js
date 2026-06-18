function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return '';
  return messages
    .map((message) => {
      if (!message) return '';
      const role = message.role || message.author || 'speaker';
      const text = message.content || message.text || '';
      return role + ': ' + text;
    })
    .filter(Boolean)
    .join('\n');
}

function inferInputKind(source) {
  const type = String(source.type || '').toLowerCase();
  if (type === 'paper' || type === 'pdf') return 'pdf';
  if (type === 'link' || source.url) return 'webpage';
  if (type === 'chat' || Array.isArray(source.messages)) return 'chat';
  return 'note';
}

function normalizeInput(source) {
  const raw = source || {};
  const kind = inferInputKind(raw);
  const text = raw.text || raw.content || normalizeMessages(raw.messages) || raw.note || raw.title || '';
  const metadata = {
    sourceId: raw.id || 'source-' + Date.now(),
    title: raw.title || raw.url || 'Untitled source',
    type: raw.type || kind,
    kind,
    url: raw.url || '',
    author: raw.author || '',
    capturedAt: raw.capturedAt || new Date().toISOString(),
  };

  return {
    id: metadata.sourceId,
    text: String(text || ''),
    metadata,
    original: raw,
  };
}

module.exports = {
  normalizeInput,
};
