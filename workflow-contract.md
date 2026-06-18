# Lumen Internal Workflow Contract

The compile path is owned by this repo. The browser calls `POST /api/compile`; the server runs `server/workflow/*` and returns `lumen.compile.v1`.

## Request

```json
{
  "source": {
    "id": "source-123",
    "title": "Market memo",
    "type": "note",
    "text": "Full source text..."
  },
  "map": {
    "id": "map-123",
    "title": "Research map",
    "nodes": [
      { "id": "node-1", "label": "Concept", "cluster": "core" }
    ]
  },
  "boosts": {
    "node-1": 0.48
  }
}
```

Supported source shapes:

- PDF upload text: `{ type: "pdf", title, text, metadata }`
- Pasted webpage: `{ type: "link", url, title, text }`
- Note: `{ type: "note", title, text }`
- AI conversation: `{ type: "chat", title, messages: [{ role, content }] }`

## Response

```json
{
  "schemaVersion": "lumen.compile.v1",
  "sourceSummary": "Short synthesis of what this source contributes.",
  "claims": [
    {
      "id": "claim-1",
      "text": "A source-grounded claim.",
      "confidence": "high",
      "citationIds": ["cite-1"],
      "targetEntryId": "entry-node-1"
    }
  ],
  "concepts": [
    {
      "id": "concept-node-1",
      "label": "Concept",
      "mapNodeId": "node-1",
      "relevance": 0.78
    }
  ],
  "wikiPatches": [
    {
      "entryId": "entry-node-1",
      "operation": "append_section",
      "heading": "新来源带来的判断更新",
      "body": "Wiki-ready text grounded in citations."
    }
  ],
  "mapUpdates": [
    {
      "nodeId": "node-1",
      "delta": 0.48,
      "reason": "Why this source brightens the node."
    }
  ],
  "openQuestions": [
    {
      "id": "oq-1",
      "text": "A follow-up question.",
      "targetEntryId": "entry-node-1"
    }
  ],
  "citations": [
    {
      "id": "cite-1",
      "sourceId": "source-123",
      "chunkId": "source-123:chunk-1",
      "quote": "Exact source excerpt.",
      "locator": "chunk 1 · chars 0-280"
    }
  ]
}
```

## Invariants

- `schemaVersion` must equal `lumen.compile.v1`.
- Every claim must reference at least one citation.
- Every citation must point to a source chunk.
- Wiki and map updates remain proposals until the user applies the review.
- `POST /api/compile` saves a compile run only; accepted knowledge records are written by `POST /api/reviews/:runId/apply`.
- The extractor can become an LLM call later, but the output contract should not change.

## LLM Extractor Contract

`server/llm/stageRunner.js` routes every model-backed stage through `server/llm/openaiClient.js`. Each stage has its own schema and internal fallback path for tests, but the normal compile path requires a configured LLM API key. The extraction stage returns only this intermediate extraction shape:

```json
{
  "sourceSummary": "Short source synthesis.",
  "claims": [
    {
      "text": "Claim grounded in a supplied chunk.",
      "confidence": "high",
      "targetEntryId": "entry-node-1",
      "chunkIds": ["source-123:chunk-1"]
    }
  ],
  "concepts": [
    {
      "label": "Concept",
      "mapNodeId": "node-1",
      "relevance": 0.78,
      "chunkIds": ["source-123:chunk-1"]
    }
  ]
}
```

The server then creates citations, wiki patches, and map update proposals. Database records are created only after the user applies the review. This keeps provenance deterministic even when the extractor is an LLM.

## Stage Model Plan

```text
mapSeeder
  -> balanced model
  -> title, domain, clusters, nodes, links
  -> used by POST /api/maps when user starts from a question

sourceParser
  -> small model
  -> cleanText, canonicalTitle, sourceKind, language, authorOrSpeaker, sourceDate,
     abstract, qualitySignals, warnings

chunking
  -> small model
  -> per-chunk summary, tags, role, importance, keyTerms
  -> original chunk text stays code-owned

extraction
  -> balanced/quality model
  -> sourceSummary
  -> claims: text, claimType, stance, confidence, targetEntryId, chunkIds
  -> concepts: label, mapNodeId, relevance, mergeHint, chunkIds

knowledgeGraph
  -> balanced model
  -> relations: fromNodeId, toNodeId, type, label, directionality,
     evidenceClaimIds, confidence, rationale

sourceLinker
  -> small model can recommend chunk ids
  -> assignments: claimId, chunkIds, supportLevel, rationale
  -> code creates final citations and locators

wiki
  -> balanced model
  -> wikiPatches: entryId, operation, heading, body, evidenceClaimIds, status
  -> openQuestions: text, targetEntryId, reason

mapUpdater
  -> fast/small model
  -> mapUpdates: nodeId, delta, reason, coverage, nextGap

feedback
  -> small model
  -> recommendation, summary, reviewNotes, checklist, wikiReview, mapReview,
     nextActions, riskFlags
```

The Settings page exposes this as one API key field. Per-stage model routing is internal product logic, not a user-facing choice. The code-owned source linker still creates final citations and locators.

## Source Update Rules

When a new source is compiled, Lumen creates review proposals. It does not silently rewrite the user's knowledge base.

Review flow:

```text
new source
  -> parser/chunking/extraction
  -> source linker creates citation-backed claims
  -> wikiGenerator proposes wiki patches
  -> mapUpdater proposes node updates
  -> feedbackGenerator acts as AI reviewer
  -> user confirms
  -> POST /api/reviews/:runId/apply writes accepted source/wiki/map state
```

The Add Source UI shows an explicit proposal review gate. Matching Wiki pages also render proposals inline as colored insertion blocks, with pending/accepted/blocked states. Wiki and map changes are not applied until the user clicks the confirmation button; reviewer `reject` blocks direct apply.

### Wiki Update Rules

Code module: `server/workflow/wikiGenerator.js`

Output:

```json
{
  "wikiPatches": [
    {
      "entryId": "entry-node-1",
      "operation": "append_section",
      "heading": "Specific section heading",
      "body": "Durable wiki prose grounded in claims.",
      "evidenceClaimIds": ["claim-1"],
      "status": "append",
      "updateRule": "new_evidence"
    }
  ],
  "openQuestions": [
    {
      "text": "What remains unresolved?",
      "targetEntryId": "entry-node-1",
      "reason": "Why this question remains open."
    }
  ]
}
```

Rules:

- `append`: source adds evidence/detail without overturning the entry.
- `revise`: source complicates, contradicts, or materially changes the entry stance.
- `needs_review`: source is useful but ambiguous, low quality, or conflicts with existing understanding.
- Do not patch if the source is generic, unsupported, duplicate, or only mentions a topic.
- Every patch must include at least one `evidenceClaimIds` value.
- Patch body is capped to 900 characters.
- Wiki output is a proposal for review, not an automatic final rewrite.

### Map Update Rules

Code module: `server/workflow/mapUpdater.js`

Output:

```json
{
  "mapUpdates": [
    {
      "nodeId": "node-1",
      "delta": 0.28,
      "reason": "Why this source brightens the node.",
      "coverage": "partial",
      "nextGap": "What is still missing.",
      "updateRule": "new_node_evidence",
      "evidenceClaimIds": ["claim-1"]
    }
  ]
}
```

Rules:

- Brighten only when a claim materially improves understanding of the node.
- Do not brighten for mere mentions, duplicate context, or unsupported claims.
- Every map update must include at least one `evidenceClaimIds` value.
- `seed` coverage delta: `0.08-0.22`.
- `partial` coverage delta: `0.18-0.40`.
- `strong` coverage delta: `0.32-0.55`.
- The map updater updates existing concept nodes from extraction; adding new map nodes is a separate map-structure operation.
- Each update includes `nextGap` so the map shows what remains to explore.

### AI Reviewer Rules

Code module: `server/workflow/feedbackGenerator.js`

Output:

```json
{
  "recommendation": "review",
  "summary": "One sentence review verdict.",
  "reviewNotes": ["What changed or needs judgment."],
  "nextActions": ["What the user should explore next."],
  "checklist": ["Claims have source citations."],
  "wikiReview": "Whether wiki patches should be accepted/revised.",
  "mapReview": "Whether map updates should brighten nodes.",
  "riskFlags": ["Weak evidence or broad claim."]
}
```

Rules:

- `accept`: proposal is well-grounded and low risk.
- `review`: proposal is useful but needs human judgment.
- `reject`: proposal is weak, unsupported, or structurally unsafe.
- Reviewer must flag missing citations, unsupported map deltas, broad claims, contradiction, or low source quality.
- Reviewer `accept` and `review` can proceed to user confirmation. Reviewer `reject` blocks direct apply until the proposal is revised or rerun.

## Map Seeder Prompt

Code module: `server/workflow/mapSeeder.js`

Route: `POST /api/maps`

This route requires a configured LLM API key. If the model call fails or the normalized map does not meet the cluster/node limits, the route returns an error instead of creating a placeholder map.

Input:

```json
{
  "question": "How do AI agents change knowledge work?"
}
```

The model prompt:

```text
You are Lumen map seeder.
A user gives a research question. Create an initial understanding map.
The map should reveal concepts, gaps, relationships, and next exploration paths.
Do not answer the question as an essay. Build a navigable knowledge graph seed.
```

Output shape:

```json
{
  "title": "Short map title",
  "domain": "Research domain",
  "question": "Original or normalized question",
  "clusters": [
    {
      "id": "cluster-slug",
      "label": "Cluster label",
      "note": "What this region covers",
      "hue": "blue"
    }
  ],
  "nodes": [
    {
      "id": "node-slug",
      "label": "Concept label",
      "cluster": "cluster-slug",
      "x": 50,
      "y": 42,
      "size": 96,
      "hue": "blue",
      "why": "Why this node matters",
      "startingQuestion": "What should the user ask next?"
    }
  ],
  "links": [
    {
      "from": "node-a",
      "to": "node-b",
      "type": "dash",
      "label": "relationship label"
    }
  ]
}
```

Rules:

- Generate 3-5 clusters, 7-10 nodes, and at most 14 links.
- Do not put more than 3 nodes in one cluster.
- Include unknowns/gaps, not only known concepts.
- Use short labels and stable slug ids.
- Use `dash` for tentative links and `solid` for strong structural links.
- Do not invent sources or citations.

Allowed on map:

- Core concepts required to understand the question.
- Sub-questions that decompose the user question.
- Mechanisms or causal processes.
- Theories/frameworks that organize the topic.
- Evidence types or methods the user should look for.
- Debates, tradeoffs, contradictions, or failure modes.
- Knowledge gaps or unknowns that guide exploration.

Not allowed on map:

- Generic buckets such as overview, background, benefits, challenges, future.
- Decorative or motivational labels.
- Long essay-like phrases.
- Items merely associated with the topic but not useful for learning the question.
