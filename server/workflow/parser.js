const { runLlmStage } = require('../llm/stageRunner');

function stripHtml(input) {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeWhitespace(input) {
  return String(input || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function localParseSource(input) {
  const plainText = normalizeWhitespace(stripHtml(input.text));
  const words = plainText ? plainText.split(/\s+/).length : 0;

  return {
    sourceId: input.id,
    text: plainText,
    metadata: {
      ...input.metadata,
      wordCount: words,
      characterCount: plainText.length,
    },
  };
}

const PARSER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cleanText: { type: 'string' },
    canonicalTitle: { type: 'string' },
    sourceKind: { type: 'string', enum: ['pdf', 'webpage', 'note', 'chat', 'transcript', 'unknown'] },
    language: { type: 'string', enum: ['zh', 'en', 'mixed', 'unknown'] },
    authorOrSpeaker: { type: 'string' },
    sourceDate: { type: 'string' },
    abstract: { type: 'string' },
    qualitySignals: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['cleanText', 'canonicalTitle', 'sourceKind', 'language', 'authorOrSpeaker', 'sourceDate', 'abstract', 'qualitySignals', 'warnings'],
};

async function parseSource(input) {
  const local = localParseSource(input);
  const llm = await runLlmStage({
    stage: 'sourceParser',
    schemaName: 'lumen_source_parser',
    schema: PARSER_SCHEMA,
    parsed: local,
    chunks: [],
    system: [
      'You are Lumen source parser.',
      'Your job is to make raw user input readable and classifiable before knowledge extraction.',
      'Preserve meaning. Do not summarize away evidence. Do not invent metadata.',
    ].join(' '),
    user: JSON.stringify({
      source: input.metadata,
      text: local.text.slice(0, 12000),
      task: 'Clean obvious boilerplate/OCR/HTML artifacts and infer source metadata.',
      fieldDefinitions: {
        cleanText: 'Faithful cleaned text. Keep original claims, quotes, caveats, and sequence. Do not add new facts.',
        canonicalTitle: 'Best title for the source. Use supplied title if reliable.',
        sourceKind: 'One of pdf, webpage, note, chat, transcript, unknown.',
        language: 'zh, en, mixed, or unknown.',
        authorOrSpeaker: 'Known author/speaker or empty string.',
        sourceDate: 'Known publication/capture date or empty string.',
        abstract: 'One sentence saying what the source is about, not a full synthesis.',
        qualitySignals: 'Short labels such as has_citations, opinion, transcript, incomplete, noisy_ocr.',
        warnings: 'Only issues that should affect downstream trust or parsing.',
      },
      hardRules: [
        'Never fabricate author, date, citations, or claims.',
        'If the input is already clean, return it mostly unchanged.',
        'Remove navigation, cookie notices, repeated headers, and obvious markup when present.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output || !llm.output.cleanText) {
    return {
      ...local,
      llmStages: {
        sourceParser: llm,
      },
    };
  }

  const text = normalizeWhitespace(llm.output.cleanText);
  const words = text ? text.split(/\s+/).length : 0;
  return {
    ...local,
    text: text || local.text,
    metadata: {
      ...local.metadata,
      title: llm.output.canonicalTitle || local.metadata.title,
      type: llm.output.sourceKind || local.metadata.type,
      language: llm.output.language || 'unknown',
      authorOrSpeaker: llm.output.authorOrSpeaker || '',
      sourceDate: llm.output.sourceDate || '',
      parserSummary: llm.output.abstract || '',
      qualitySignals: Array.isArray(llm.output.qualitySignals) ? llm.output.qualitySignals : [],
      parserWarnings: Array.isArray(llm.output.warnings) ? llm.output.warnings : [],
      wordCount: words,
      characterCount: (text || local.text).length,
    },
    llmStages: {
      sourceParser: llm,
    },
  };
}

module.exports = {
  parseSource,
  localParseSource,
};
