function buildWorkflowArtifacts({ input, parsed, chunks }) {
  return {
    source: {
      id: input.id,
      title: input.metadata.title,
      type: input.metadata.type,
      kind: input.metadata.kind,
      metadata: parsed.metadata,
    },
    chunks,
  };
}

function persistWorkflowArtifacts(args) {
  return buildWorkflowArtifacts(args);
}

module.exports = {
  buildWorkflowArtifacts,
  persistWorkflowArtifacts,
};
