# Lumen

Lumen is an AI-native knowledge workspace for turning sources into reviewed claims, citations, wiki updates, and an evolving understanding map. It pairs the original Lumen product shell with a local Node backend that owns the workflow directly in this codebase.

Run:

```bash
cd lumen-mvp
node server/index.js
```

Then open:

```text
http://127.0.0.1:8787
```

The formal workspace starts empty. For the guided onboarding/demo seed, open:

```text
http://127.0.0.1:8787?onboarding=1
```

What Lumen includes:

- Original Lumen visual system and navigation.
- Formal workspace defaults to empty data.
- One onboarding/demo seed is available through `?onboarding=1` or `?demo=1`.
- Original Add Source modal, connected to the backend through `window.LumenWorkflow.compileSource(...)`.
- Internal workflow modules in `server/workflow/`: input, parser, chunking, extraction, source linking, wiki generation, map updating, AI review, and confirmed database persistence.
- Mock compiler available only for explicit test/demo requests.
- Local backend in `server/`, with workspace, inbox, map, settings, compile, review/apply, and knowledge database APIs.
- `lumen.compile.v1` output schema validation.
- Review preview inside the original compile result modal.
- Add Source now has a proposal review gate: claims/citations, wiki proposals, map updates, and AI reviewer feedback are shown before the user confirms.
- Wiki pages also render matching proposals inline as colored insertion blocks, so pending and accepted changes can be reviewed in article context.
- Map illumination after accepting the compile result, persisted in `.data/app-state.json`.
- Accepted workflow artifacts are persisted in `.data/knowledge-db.json`; pending proposals stay in compile runs until the user confirms.
- Quick Capture, Inbox digest/dismiss, Create Map, Settings save, and Add Source apply actions are connected to `/api/*`.

Suggested demo path:

1. Open Source.
2. Click `Add a source`.
3. Click `编纂当前资料`.
4. Review claims, citations, concepts, and wiki patch.
5. Click the map button to accept.
6. Show the Understanding Map nodes brightening.
7. Open Wiki/Sources to show the same original product system.

## AI Workflow

`POST /api/compile` runs the internal workflow by default:

```text
upload/input
  -> parser
  -> chunking
  -> LLM extraction
  -> knowledge graph
  -> source linker
  -> wiki generator
  -> map updater
  -> AI reviewer
  -> proposal review
  -> user confirms
  -> database
```

The normal endpoint is AI-native: without an API key, source compile and question-to-map creation return configuration errors. Deterministic code paths remain only as internal development/test fallbacks.

The normal compile path uses the internal Lumen workflow and requires an LLM API key. Mock output is only for explicit test/demo requests, not a Settings mode.

`POST /api/maps` also uses the internal AI workflow. A user question is sent to `server/workflow/mapSeeder.js`, which returns a bounded seeded knowledge graph with title, domain, clusters, nodes, and links. This route requires the same API key and rejects invalid LLM output instead of creating a placeholder map.

## LLM Setup

The workflow calls OpenAI through the Responses API. If no key is configured, Lumen will not compile sources in Backend mode; this product is AI-native, so local rules are only an internal engineering fallback and test harness.

Server environment:

```bash
export OPENAI_API_KEY=sk-...
node server/index.js
```

Optional overrides:

```bash
export LUMEN_LLM_API_KEY=sk-...
export LUMEN_LLM_ENDPOINT=https://api.openai.com/v1/responses
```

Settings page:

- Provider: `OpenAI Responses API`
- API key: save once and Lumen routes all workflow stages internally.

Internal model routing:

- `sourceParser`: small model, cleans source text and metadata.
- `chunking`: small model, adds chunk summaries/tags without rewriting evidence text.
- `extraction`: stronger model, extracts claims, concepts, and source summary.
- `wiki`: stronger model, compiles wiki patches and open questions.
- `knowledgeGraph`: stronger model, creates concept relations for the graph.
- `sourceLinker`: small model recommends supporting chunks; code still creates citations.
- `mapUpdater`: fast model writes map update reasons and conservative deltas.
- `feedback`: small model creates review notes and next actions.

## Local API

The frontend buttons are wired to these local endpoints:

- `GET /api/workspace`
- `GET /api/knowledge`
- `POST /api/maps`
- `POST /api/inbox`
- `POST /api/inbox/:id/digest`
- `DELETE /api/inbox/:id`
- `POST /api/compile`
- `GET /api/compile-runs`
- `POST /api/reviews/:runId/apply`
- `GET /api/settings/ai`
- `POST /api/settings/ai`

## Data Policy

The formal app should not start with mock knowledge. `app/data.js` keeps one optional onboarding seed under `window.LUMEN_ONBOARDING_DATA`; default `window.LUMEN_DATA` is empty.

The core product structure begins at:

- `POST /api/compile`
- `POST /api/reviews/:runId/apply`
- `server/workflow/index.js`
- `server/schema.js`
- `server/store.js`

Future production work: replace JSON file persistence with Postgres/Supabase tables while keeping the same workflow module boundaries.

## License

Lumen is licensed under the [MIT License](LICENSE).
