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
  const mime = String((source.file && source.file.mimeType) || (source.attachment && source.attachment.mimeType) || '').toLowerCase();
  if (type === 'paper' || type === 'pdf') return 'pdf';
  if (mime.includes('pdf')) return 'pdf';
  if (type === 'video') return 'transcript';
  if (type === 'voice' || mime.startsWith('audio/')) return 'transcript';
  if (type === 'image' || mime.startsWith('image/')) return 'image';
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
    abstract: raw.abstract || '',
    ingestion: raw.ingestion || null,
    ingestionWarnings: raw.ingestion && Array.isArray(raw.ingestion.warnings) ? raw.ingestion.warnings : [],
    fileNames: [
      raw.file && raw.file.name,
      raw.attachment && raw.attachment.name,
      ...(Array.isArray(raw.files) ? raw.files.map((file) => file && file.name) : []),
      ...(Array.isArray(raw.attachments) ? raw.attachments.map((file) => file && file.name) : []),
    ].filter(Boolean),
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
