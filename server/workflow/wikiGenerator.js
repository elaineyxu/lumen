const { runLlmStage } = require('../llm/stageRunner');

const WIKI_UPDATE_POLICY = {
  maxPatches: 4,
  maxBodyChars: 900,
  allowedStatuses: ['append', 'revise', 'needs_review'],
  allowedOperations: ['append_section', 'revise_section', 'create_entry_stub'],
};

function localGenerateWiki({ extraction }) {
  const patchesByEntry = new Map();

  extraction.claims.forEach((claim) => {
    const existing = patchesByEntry.get(claim.targetEntryId) || [];
    existing.push(claim.text);
    patchesByEntry.set(claim.targetEntryId, existing);
  });

  const wikiPatches = Array.from(patchesByEntry.entries()).map(([entryId, claims]) => ({
    entryId,
    operation: 'append_section',
    heading: '新来源带来的判断更新',
    body: claims.join('\n\n'),
    evidenceClaimIds: extraction.claims.filter((claim) => claim.targetEntryId === entryId).map((claim) => claim.id),
    status: 'append',
    updateRule: 'new_evidence',
  }));

  const openQuestions = extraction.concepts.slice(0, 2).map((concept, index) => ({
    id: 'oq-' + Date.now() + '-' + (index + 1),
    text: '围绕「' + concept.label + '」，还需要哪些来源来验证这个判断？',
    targetEntryId: 'entry-' + concept.mapNodeId,
    reason: '当前来源提供了线索，但还不足以封闭这个问题。',
  }));

  return {
    wikiPatches,
    openQuestions,
  };
}

const WIKI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wikiPatches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          entryId: { type: 'string' },
          operation: { type: 'string' },
          heading: { type: 'string' },
          body: { type: 'string' },
          evidenceClaimIds: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['append', 'revise', 'needs_review'] },
          updateRule: { type: 'string', enum: ['new_evidence', 'changed_stance', 'clarification', 'open_question_only'] },
        },
        required: ['entryId', 'operation', 'heading', 'body', 'evidenceClaimIds', 'status', 'updateRule'],
      },
    },
    openQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          targetEntryId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['text', 'targetEntryId', 'reason'],
      },
    },
  },
  required: ['wikiPatches', 'openQuestions'],
};

async function generateWiki({ extraction, parsed, chunks }) {
  const fallback = localGenerateWiki({ extraction });
  const llm = await runLlmStage({
    stage: 'wiki',
    schemaName: 'lumen_wiki',
    schema: WIKI_SCHEMA,
    parsed,
    chunks,
    system: [
      'You are Lumen wiki compiler.',
      'You turn extracted, cited claims into wiki patch proposals for human review.',
      'Write durable knowledge, not a source summary.',
    ].join(' '),
    user: JSON.stringify({
      source: parsed && parsed.metadata,
      claims: extraction.claims,
      concepts: extraction.concepts,
      chunks: (chunks || []).map((chunk) => ({ id: chunk.id, summary: chunk.summary, text: chunk.text.slice(0, 700) })),
      fieldDefinitions: {
        wikiPatches: 'Proposed sections or revisions grouped by target entry.',
        heading: 'Specific section title, not "Summary".',
        body: '1-2 concise paragraphs. Include nuance and caveats from claims. Do not cite manually.',
        evidenceClaimIds: 'Claim ids that justify the patch.',
        status: 'append for new evidence, revise for changed stance, needs_review when uncertain.',
        updateRule: 'new_evidence, changed_stance, clarification, or open_question_only.',
        openQuestions: 'Questions the user should explore next because this source leaves gaps.',
      },
      updatePolicy: {
        append: 'Use when the source adds evidence/detail without overturning the entry.',
        revise: 'Use only when claims complicate, contradict, or materially change the entry stance.',
        needs_review: 'Use when the claim is useful but source quality, ambiguity, or conflict requires human judgment.',
        noPatch: 'Do not patch if claims are generic, unsupported, duplicate, or only mention a topic.',
      },
      hardRules: [
        'Use only provided claims/chunks.',
        'Every patch must cite at least one evidenceClaimId.',
        'Keep entryId aligned with claim targetEntryId values.',
        'Do not make stronger conclusions than the claims support.',
        'Prefer fewer high-quality patches over many tiny patches.',
        'Do not write more than 900 characters per patch body.',
      ],
    }, null, 2),
  });

  if (!llm.ok || !llm.output) return { ...fallback, llmStage: llm };
  const targetEntryIds = new Set(extraction.claims.map((claim) => claim.targetEntryId));
  const claimIds = new Set(extraction.claims.map((claim) => claim.id));
  const wikiPatches = Array.isArray(llm.output.wikiPatches)
    ? llm.output.wikiPatches
      .filter((patch) => patch.entryId && targetEntryIds.has(patch.entryId) && patch.heading && patch.body)
      .map((patch) => ({
        ...patch,
        evidenceClaimIds: Array.isArray(patch.evidenceClaimIds) ? patch.evidenceClaimIds.filter((id) => claimIds.has(id)) : [],
      }))
      .filter((patch) => patch.evidenceClaimIds.length > 0)
      .slice(0, WIKI_UPDATE_POLICY.maxPatches)
      .map((patch) => ({
        entryId: patch.entryId,
        operation: WIKI_UPDATE_POLICY.allowedOperations.includes(patch.operation) ? patch.operation : 'append_section',
        heading: patch.heading,
        body: String(patch.body || '').slice(0, WIKI_UPDATE_POLICY.maxBodyChars),
        evidenceClaimIds: patch.evidenceClaimIds,
        status: WIKI_UPDATE_POLICY.allowedStatuses.includes(patch.status) ? patch.status : 'needs_review',
        updateRule: patch.updateRule || 'new_evidence',
      }))
    : [];
  const openQuestions = Array.isArray(llm.output.openQuestions)
    ? llm.output.openQuestions
      .filter((question) => question.text && question.targetEntryId)
      .slice(0, 5)
      .map((question, index) => ({
        id: 'oq-' + Date.now() + '-' + (index + 1),
        text: question.text,
        targetEntryId: question.targetEntryId,
        reason: question.reason || '',
      }))
    : [];
  return {
    wikiPatches: wikiPatches.length ? wikiPatches : fallback.wikiPatches,
    openQuestions: openQuestions.length ? openQuestions : fallback.openQuestions,
    llmStage: llm,
  };
}

module.exports = {
  generateWiki,
  localGenerateWiki,
  WIKI_UPDATE_POLICY,
};
