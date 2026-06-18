const { runLlmStage } = require('../llm/stageRunner');

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[。！？.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function localChunkText(parsed, options) {
  const maxChars = (options && options.maxChars) || 720;
  const sentences = splitSentences(parsed.text);
  const chunks = [];
  let current = '';
  let start = 0;

  sentences.forEach((sentence) => {
    const next = current ? current + ' ' + sentence : sentence;
    if (next.length > maxChars && current) {
      chunks.push({
        id: parsed.sourceId + ':chunk-' + (chunks.length + 1),
        sourceId: parsed.sourceId,
        text: current,
        start,
        end: start + current.length,
      });
      start += current.length + 1;
      current = sentence;
    } else {
      current = next;
    }
  });

  if (current) {
    chunks.push({
      id: parsed.sourceId + ':chunk-' + (chunks.length + 1),
      sourceId: parsed.sourceId,
      text: current,
      start,
      end: start + current.length,
    });
  }

  if (!chunks.length && parsed.text) {
    chunks.push({
      id: parsed.sourceId + ':chunk-1',
      sourceId: parsed.sourceId,
      text: parsed.text.slice(0, maxChars),
      start: 0,
      end: Math.min(parsed.text.length, maxChars),
    });
  }

  return chunks;
}

const CHUNK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    chunks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          summary: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          role: { type: 'string', enum: ['definition', 'claim', 'evidence', 'example', 'method', 'question', 'context', 'other'] },
          importance: { type: 'number' },
          keyTerms: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'summary', 'tags', 'role', 'importance', 'keyTerms'],
      },
    },
  },
  required: ['chunks'],
};

async function chunkText(parsed, options) {
  const chunks = localChunkText(parsed, options);
  const llm = await runLlmStage({
    stage: 'chunking',
    schemaName: 'lumen_chunking',
    schema: CHUNK_SCHEMA,
    parsed,
    chunks,
    system: [
      'You are Lumen chunk annotator.',
      'You label already-created evidence chunks for retrieval and later citation.',
      'Never rewrite chunk text or create new chunks.',
    ].join(' '),
    user: JSON.stringify({
      source: parsed.metadata,
      chunks: chunks.map((chunk) => ({ id: chunk.id, text: chunk.text.slice(0, 900) })),
      task: 'Annotate each chunk so later stages can pick evidence reliably.',
      fieldDefinitions: {
        summary: 'One sentence, <= 24 words, faithful to the chunk.',
        tags: '3-6 retrieval tags, lower-level concepts are better than generic tags.',
        role: 'The chunk role in the source.',
        importance: '0.0-1.0 estimate of usefulness for knowledge extraction.',
        keyTerms: 'Important phrases exactly or nearly exactly present in the chunk.',
      },
      hardRules: [
        'Return exactly one object per supplied id.',
        'Use only supplied ids.',
        'Do not infer claims not present in the chunk.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output || !Array.isArray(llm.output.chunks)) {
    return chunks.map((chunk) => ({
      ...chunk,
      summary: chunk.text.slice(0, 140),
      tags: [],
      role: 'other',
      importance: 0.5,
      keyTerms: [],
      llmStage: 'local',
    }));
  }

  const byId = Object.fromEntries(llm.output.chunks.map((chunk) => [chunk.id, chunk]));
  return chunks.map((chunk) => {
    const enriched = byId[chunk.id] || {};
    return {
      ...chunk,
      summary: enriched.summary || chunk.text.slice(0, 140),
      tags: Array.isArray(enriched.tags) ? enriched.tags.slice(0, 8) : [],
      role: enriched.role || 'other',
      importance: Math.max(0, Math.min(1, Number(enriched.importance) || 0.5)),
      keyTerms: Array.isArray(enriched.keyTerms) ? enriched.keyTerms.slice(0, 8) : [],
      llmStage: llm.model ? 'openai:' + llm.model : 'local',
    };
  });
}

module.exports = {
  chunkText,
  localChunkText,
};
