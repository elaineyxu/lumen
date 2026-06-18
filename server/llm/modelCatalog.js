const MODEL_PRESETS = {
  quality: {
    id: 'quality',
    label: 'Quality',
    model: 'gpt-5.5',
    note: 'Best for difficult synthesis, ambiguous sources, and higher-stakes wiki updates.',
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    model: 'gpt-5.4-mini',
    note: 'Default for source compilation: strong extraction at a lower latency/cost point.',
  },
  fast: {
    id: 'fast',
    label: 'Fast',
    model: 'gpt-5.4-mini',
    note: 'Good for short notes and interactive review loops.',
  },
  economy: {
    id: 'economy',
    label: 'Economy',
    model: 'gpt-5.4-nano',
    note: 'Cheapest option for lightweight cleanup, labeling, and obvious source mapping.',
  },
};

const STAGE_DEFAULTS = {
  sourceParser: { mode: 'auto', preset: 'economy', label: 'Source parser' },
  chunking: { mode: 'auto', preset: 'economy', label: 'Chunking helper' },
  extraction: { mode: 'auto', preset: 'balanced', label: 'Knowledge extraction' },
  wiki: { mode: 'auto', preset: 'balanced', label: 'Wiki compiler' },
  knowledgeGraph: { mode: 'auto', preset: 'balanced', label: 'Knowledge graph' },
  mapSeeder: { mode: 'auto', preset: 'balanced', label: 'Map seeder' },
  sourceLinker: { mode: 'auto', preset: 'economy', label: 'Source linker' },
  mapUpdater: { mode: 'auto', preset: 'fast', label: 'Map updater' },
  feedback: { mode: 'auto', preset: 'economy', label: 'Review feedback' },
};

function normalizeStageSettings(stages) {
  const next = {};
  Object.entries(STAGE_DEFAULTS).forEach(([stage, defaults]) => {
    next[stage] = {
      mode: defaults.mode,
      preset: defaults.preset,
      model: 'auto',
    };
  });
  return next;
}

function resolveModel(settings, parsed, chunks, stage) {
  const configured = settings || {};
  const stages = normalizeStageSettings(configured.stages);
  const stageConfig = stage && stages[stage] ? stages[stage] : null;
  if (stageConfig && stageConfig.model && stageConfig.model !== 'auto') return stageConfig.model;
  if (stageConfig && stageConfig.preset) return MODEL_PRESETS[stageConfig.preset].model;
  if (configured.model && configured.model !== 'auto') return configured.model;

  const preset = MODEL_PRESETS[configured.modelPreset || 'balanced'] || MODEL_PRESETS.balanced;
  if ((configured.modelPreset || 'balanced') !== 'auto') return preset.model;

  const charCount = parsed && parsed.metadata ? Number(parsed.metadata.characterCount || 0) : 0;
  const chunkCount = Array.isArray(chunks) ? chunks.length : 0;
  if (charCount > 12000 || chunkCount > 18) return MODEL_PRESETS.quality.model;
  if (charCount < 1800 && chunkCount <= 3) return MODEL_PRESETS.fast.model;
  return MODEL_PRESETS.balanced.model;
}

module.exports = {
  MODEL_PRESETS,
  STAGE_DEFAULTS,
  normalizeStageSettings,
  resolveModel,
};
