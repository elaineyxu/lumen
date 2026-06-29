const { readAiSettings } = require('../store');
const { callOpenAiJson, callOpenAiJsonInput, transcribeAudio } = require('./openaiClient');
const { normalizeStageSettings, resolveModel } = require('./modelCatalog');

function getApiKey(settings) {
  return process.env.OPENAI_API_KEY || process.env.LUMEN_LLM_API_KEY || settings.apiKey;
}

function getEndpoint(settings) {
  return process.env.OPENAI_RESPONSES_ENDPOINT || process.env.LUMEN_LLM_ENDPOINT || settings.endpoint;
}

function getTranscriptionEndpoint(settings) {
  return process.env.OPENAI_TRANSCRIPTION_ENDPOINT || process.env.LUMEN_WHISPER_ENDPOINT || (settings && settings.transcriptionEndpoint) || '';
}

function getTranscriptionModel(settings) {
  return process.env.LUMEN_WHISPER_MODEL || (settings && settings.transcriptionModel) || 'whisper-1';
}

const LANGUAGE_NAMES = {
  zh: 'Simplified Chinese (简体中文)',
  en: 'English',
};

function languageDirective(locale) {
  const lang = LANGUAGE_NAMES[locale] || LANGUAGE_NAMES.zh;
  return [
    'OUTPUT LANGUAGE: Write every human-facing field — summaries, headings, section bodies, reasons, review notes, questions, and concept labels — in ' + lang + '.',
    'Do not mix languages within the output; keep terminology consistent.',
    'Preserve verbatim quotes, OCR text, code, URLs, and proper nouns (names, titles, technical terms) in their original form.',
  ].join(' ');
}

function withLanguage(system, locale) {
  if (!locale) return system;
  return String(system || '') + '\n\n' + languageDirective(locale);
}

function getStageConfig(settings, stage) {
  const stages = normalizeStageSettings(settings.stages);
  return stages[stage];
}

async function runLlmStage({ stage, schema, schemaName, system, user, parsed, chunks, locale }) {
  const settings = readAiSettings();
  const stageConfig = getStageConfig(settings, stage);
  const provider = settings.provider || 'openai';
  const apiKey = getApiKey(settings);

  if (provider !== 'openai' || !apiKey || !stageConfig || stageConfig.mode !== 'auto') {
    return {
      ok: false,
      skipped: true,
      reason: !apiKey ? 'missing-api-key' : 'stage-disabled',
      stage,
      mode: stageConfig && stageConfig.mode,
    };
  }

  const model = resolveModel(settings, parsed, chunks, stage);
  try {
    const output = await callOpenAiJson({
      apiKey,
      endpoint: getEndpoint(settings),
      model,
      system: withLanguage(system, locale),
      user,
      schema,
      schemaName: schemaName || 'lumen_' + stage,
    });
    return { ok: true, stage, model, output };
  } catch (error) {
    return {
      ok: false,
      stage,
      model,
      error: error.message || String(error),
    };
  }
}

async function runLlmImageStage({ stage, schema, schemaName, system, prompt, imageUrl, mimeType }) {
  const settings = readAiSettings();
  const stageConfig = getStageConfig(settings, stage);
  const provider = settings.provider || 'openai';
  const apiKey = getApiKey(settings);

  if (provider !== 'openai' || !apiKey || !stageConfig || stageConfig.mode !== 'auto') {
    return {
      ok: false,
      skipped: true,
      reason: !apiKey ? 'missing-api-key' : 'stage-disabled',
      stage,
      mode: stageConfig && stageConfig.mode,
    };
  }

  const model = resolveModel(settings, { metadata: { characterCount: 0, mimeType } }, [], stage);
  try {
    const output = await callOpenAiJsonInput({
      apiKey,
      endpoint: getEndpoint(settings),
      model,
      input: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl, detail: 'auto' },
          ],
        },
      ],
      schema,
      schemaName: schemaName || 'lumen_' + stage,
    });
    return { ok: true, stage, model, output };
  } catch (error) {
    return {
      ok: false,
      stage,
      model,
      error: error.message || String(error),
    };
  }
}

async function runWhisperStage({ buffer, filename, contentType, language, prompt }) {
  const settings = readAiSettings();
  const stageConfig = getStageConfig(settings, 'audioTranscription');
  const provider = settings.provider || 'openai';
  const apiKey = getApiKey(settings);

  if (provider !== 'openai' || !apiKey || !stageConfig || stageConfig.mode !== 'auto') {
    return {
      ok: false,
      skipped: true,
      reason: !apiKey ? 'missing-api-key' : 'stage-disabled',
      stage: 'audioTranscription',
      mode: stageConfig && stageConfig.mode,
    };
  }

  const model = getTranscriptionModel(settings);
  try {
    const text = await transcribeAudio({
      apiKey,
      endpoint: getTranscriptionEndpoint(settings),
      model,
      buffer,
      filename,
      contentType,
      language,
      prompt,
    });
    return { ok: true, stage: 'audioTranscription', model, text };
  } catch (error) {
    return {
      ok: false,
      stage: 'audioTranscription',
      model,
      error: error.message || String(error),
    };
  }
}

module.exports = {
  runLlmStage,
  runLlmImageStage,
  runWhisperStage,
};
