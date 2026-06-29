# Backend Structure

The first visual MVP used the original static prototype. This folder now has a local backend and an internal AI workflow, so Lumen no longer depends on an external workflow builder for the compile path.

## What Still Uses Mock Data

Keep only for onboarding:

- One optional seed workspace in `app/data.js` as `window.LUMEN_ONBOARDING_DATA`.
- Chinese overlay strings in `app/data.zh.js`.
- Existing visual routes: Home, Atlas, Wiki, Sources, Settings.

Do not pretend these are production data. The formal workspace starts empty.

Replace next:

- Move onboarding seed selection into an explicit onboarding flow.
- Replace JSON file storage with database-backed workspace records.

## What Is Real Structure Now

- `server/index.js` serves the app and exposes API routes.
- `server/workflow/ingestion.js` turns any uploaded source type into plain text: URL fetch + HTML readability, PDF text extraction, DOCX (`word/document.xml`) parsing, image OCR (vision stage), and audio transcription via OpenAI Whisper.
- `server/workflow/input.js` normalizes PDF/webpage/note/chat-shaped input into one source record.
- `server/workflow/parser.js` turns source content into clean text plus metadata.
- `server/workflow/chunker.js` creates source chunks with stable ids and offsets.
- `server/workflow/llmExtraction.js` owns the extraction boundary and calls the model stage runner.
- `server/llm/modelCatalog.js` owns model presets and model selection.
- `server/llm/openaiClient.js` calls the OpenAI Responses API with structured output.
- `server/llm/stageRunner.js` routes per-stage API calls and fallback metadata.
- `server/workflow/wikiGenerator.js` produces wiki patches, concepts, summaries, relationships, and questions.
- `server/workflow/sourceLinker.js` makes every claim cite source chunks.
- `server/workflow/mapUpdater.js` creates understanding-map deltas.
- `server/workflow/knowledgeGraph.js` creates concept relations for the knowledge graph.
- `server/workflow/feedbackGenerator.js` creates review notes and next actions.
- `server/workflow/database.js` persists workflow artifacts through `server/store.js`.
- `server/schema.js` validates `lumen.compile.v1`.
- `server/mockCompiler.js` is an explicit demo compiler for Mock mode.
- `server/store.js` stores recent compile runs, app state, local AI settings, and the JSON-backed knowledge database in `.data/`.

## API Boundary

```text
GET /api/workspace
  -> returns dynamic maps, sources, inbox, map lighting, and local settings state

GET /api/knowledge
  -> returns JSON-backed sources, chunks, citations, wiki entries, concepts, and map evidence

POST /api/maps
  -> creates a local map record

POST /api/inbox
  -> saves a quick capture into the backend inbox

POST /api/inbox/:id/digest
  -> turns an inbox item into a source and persisted map lighting

DELETE /api/inbox/:id
  -> dismisses an inbox item

POST /api/compile
  -> validates source input
  -> runs the internal Lumen workflow
  -> validates compile result
  -> saves compile run and workflow artifacts
  -> returns { runId, engine, result }

POST /api/reviews/:id/apply
  -> persists accepted compile results as sources and map lighting

GET/POST /api/settings/ai
  -> reads/writes engine mode, provider, model preset, endpoint, and key for demos
  -> reads/writes per-stage model routing for parser, chunking, imageOcr, audioTranscription, extraction, wiki, graph, linker, map, feedback
```

## Audio / Whisper Configuration

Audio and voice sources are transcribed through the OpenAI audio transcription API before compilation.

```text
OPENAI_API_KEY            shared key (also used for the Responses API)
LUMEN_WHISPER_MODEL       transcription model (default: whisper-1; e.g. gpt-4o-transcribe)
LUMEN_WHISPER_ENDPOINT    override transcription endpoint (default: api.openai.com/v1/audio/transcriptions)
LUMEN_WHISPER_TIMEOUT_MS  upload timeout in ms (default: 120000)
```

## Run Locally

```bash
cd lumen-mvp
node server/index.js
```

Then open:

```text
http://127.0.0.1:8787
```

Optional mock mode:

```bash
export LUMEN_AI_ENGINE=mock
node server/index.js
```

## Next Backend Milestone

For the next real MVP pass, replace file storage with Postgres/Supabase:

- `sources`
- `source_chunks`
- `compile_runs`
- `review_tasks`
- `wiki_entries`
- `wiki_entry_versions`
- `citations`
- `maps`
- `map_nodes`
- `map_node_evidence`
