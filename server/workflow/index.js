const { SCHEMA_VERSION } = require('../schema');
const { normalizeInput } = require('./input');
const { parseSource } = require('./parser');
const { chunkText } = require('./chunker');
const { extractKnowledge } = require('./llmExtraction');
const { generateWiki } = require('./wikiGenerator');
const { linkSources } = require('./sourceLinker');
const { updateMap } = require('./mapUpdater');
const { generateKnowledgeGraph } = require('./knowledgeGraph');
const { generateFeedback } = require('./feedbackGenerator');
const { buildWorkflowArtifacts } = require('./database');

function summarizeStage(stage) {
  if (!stage) return null;
  return {
    ok: Boolean(stage.ok),
    skipped: Boolean(stage.skipped),
    model: stage.model || null,
    reason: stage.reason || null,
    error: stage.error || null,
  };
}

async function runLumenWorkflow({ source, map, boosts }) {
  const input = normalizeInput(source);
  const parsed = await parseSource(input);
  const chunks = await chunkText(parsed);
  const extraction = await extractKnowledge({ parsed, chunks, map, boosts });
  const graph = await generateKnowledgeGraph({ extraction, parsed, chunks, map });
  const linked = await linkSources({ extraction, chunks, parsed });
  const wiki = await generateWiki({ extraction, parsed, chunks });
  const mapResult = await updateMap({ extraction, boosts, map, parsed, chunks });
  const feedback = await generateFeedback({ extraction, linked, graph, wiki, mapResult, parsed, chunks });

  const result = {
    schemaVersion: SCHEMA_VERSION,
    sourceSummary: extraction.sourceSummary,
    claims: linked.claims,
    concepts: extraction.concepts,
    relations: graph.relations,
    wikiPatches: wiki.wikiPatches,
    mapUpdates: mapResult.mapUpdates,
    openQuestions: wiki.openQuestions,
    citations: linked.citations,
    feedback: {
      recommendation: feedback.recommendation,
      summary: feedback.summary,
      reviewNotes: feedback.reviewNotes,
      nextActions: feedback.nextActions,
      checklist: feedback.checklist || [],
      wikiReview: feedback.wikiReview || '',
      mapReview: feedback.mapReview || '',
      riskFlags: feedback.riskFlags || [],
    },
  };

  const stageSummary = {
    sourceParser: summarizeStage(parsed.llmStages && parsed.llmStages.sourceParser),
    chunking: chunks.some((chunk) => chunk.llmStage && chunk.llmStage.startsWith('openai:'))
      ? { ok: true, skipped: false, model: chunks.find((chunk) => chunk.llmStage && chunk.llmStage.startsWith('openai:')).llmStage.replace('openai:', ''), reason: null, error: null }
      : { ok: false, skipped: true, model: null, reason: 'local-chunks', error: null },
    extraction: summarizeStage(extraction._llmStages && extraction._llmStages.extraction),
    knowledgeGraph: summarizeStage(graph.llmStage),
    sourceLinker: summarizeStage(linked.llmStage),
    wiki: summarizeStage(wiki.llmStage),
    mapUpdater: summarizeStage(mapResult.llmStage),
    feedback: summarizeStage(feedback.llmStage),
  };
  result._pipeline = {
    input: input.metadata.kind,
    parser: 'plain-text',
    chunks: chunks.length,
    extractor: extraction._extractor || 'local-heuristic',
    llmError: extraction._llmError || null,
    stages: stageSummary,
    proposalStatus: 'pending-review',
  };
  Object.defineProperty(result, '_proposalArtifacts', {
    value: buildWorkflowArtifacts({ input, parsed, chunks, result }),
    enumerable: false,
  });

  return result;
}

module.exports = {
  runLumenWorkflow,
};
