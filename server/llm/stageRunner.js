const { readAiSettings } = require('../store');
const { callOpenAiJson } = require('./openaiClient');
const { normalizeStageSettings, resolveModel } = require('./modelCatalog');

function getApiKey(settings) {
  return process.env.OPENAI_API_KEY || process.env.LUMEN_LLM_API_KEY || settings.apiKey;
}

function getEndpoint(settings) {
  return process.env.OPENAI_RESPONSES_ENDPOINT || process.env.LUMEN_LLM_ENDPOINT || settings.endpoint;
}

function getStageConfig(settings, stage) {
  const stages = normalizeStageSettings(settings.stages);
  return stages[stage];
}

async function runLlmStage({ stage, schema, schemaName, system, user, parsed, chunks }) {
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
      system,
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

module.exports = {
  runLlmStage,
};
