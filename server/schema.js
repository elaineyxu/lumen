const SCHEMA_VERSION = 'lumen.compile.v1';

function validateCompileResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object') errors.push('result must be an object');
  if (result && result.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion must be ' + SCHEMA_VERSION);

  ['sourceSummary', 'claims', 'concepts', 'wikiPatches', 'mapUpdates', 'openQuestions', 'citations'].forEach((key) => {
    if (!(key in (result || {}))) errors.push('missing ' + key);
  });

  ['claims', 'concepts', 'wikiPatches', 'mapUpdates', 'openQuestions', 'citations'].forEach((key) => {
    if (result && !Array.isArray(result[key])) errors.push(key + ' must be an array');
  });

  if (result && Array.isArray(result.claims)) {
    result.claims.forEach((claim, index) => {
      if (!claim.text) errors.push('claims[' + index + '].text is required');
      if (!claim.citationIds || !claim.citationIds.length) errors.push('claims[' + index + '] needs citationIds');
      (claim.citationIds || []).forEach((citationId) => {
        const exists = result.citations && result.citations.some((citation) => citation.id === citationId);
        if (!exists) errors.push('claims[' + index + '] references missing citation ' + citationId);
      });
    });
  }

  if (result && Array.isArray(result.wikiPatches)) {
    result.wikiPatches.forEach((patch, index) => {
      if (!patch.entryId) errors.push('wikiPatches[' + index + '].entryId is required');
      if (!patch.heading || !patch.body) errors.push('wikiPatches[' + index + '] needs heading and body');
      if ('evidenceClaimIds' in patch && !Array.isArray(patch.evidenceClaimIds)) errors.push('wikiPatches[' + index + '].evidenceClaimIds must be an array');
      if ('status' in patch && !['append', 'revise', 'needs_review'].includes(patch.status)) errors.push('wikiPatches[' + index + '].status is invalid');
    });
  }

  if (result && Array.isArray(result.mapUpdates)) {
    result.mapUpdates.forEach((update, index) => {
      if (!update.nodeId) errors.push('mapUpdates[' + index + '].nodeId is required');
      if (typeof update.delta !== 'number') errors.push('mapUpdates[' + index + '].delta must be a number');
      if ('coverage' in update && !['seed', 'partial', 'strong'].includes(update.coverage)) errors.push('mapUpdates[' + index + '].coverage is invalid');
      if ('evidenceClaimIds' in update && !Array.isArray(update.evidenceClaimIds)) errors.push('mapUpdates[' + index + '].evidenceClaimIds must be an array');
    });
  }

  if (result && 'relations' in result) {
    if (!Array.isArray(result.relations)) errors.push('relations must be an array');
    (result.relations || []).forEach((relation, index) => {
      if (!relation.fromNodeId || !relation.toNodeId) errors.push('relations[' + index + '] needs fromNodeId and toNodeId');
      if (!relation.type) errors.push('relations[' + index + '].type is required');
    });
  }

  if (result && 'feedback' in result) {
    if (!result.feedback || typeof result.feedback !== 'object') errors.push('feedback must be an object');
    if (result.feedback && 'recommendation' in result.feedback && !['accept', 'review', 'reject'].includes(result.feedback.recommendation)) errors.push('feedback.recommendation is invalid');
    if (result.feedback && !Array.isArray(result.feedback.reviewNotes)) errors.push('feedback.reviewNotes must be an array');
    if (result.feedback && !Array.isArray(result.feedback.nextActions)) errors.push('feedback.nextActions must be an array');
    if (result.feedback && 'checklist' in result.feedback && !Array.isArray(result.feedback.checklist)) errors.push('feedback.checklist must be an array');
    if (result.feedback && 'riskFlags' in result.feedback && !Array.isArray(result.feedback.riskFlags)) errors.push('feedback.riskFlags must be an array');
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  SCHEMA_VERSION,
  validateCompileResult,
};
