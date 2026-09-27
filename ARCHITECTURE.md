# Lumen MVP Architecture

The MVP keeps the original Lumen HTML prototype as the product shell and moves the AI workflow into code modules owned by this repo.

## Product Components

1. Source Intake
   - Uses the original Add Source modal and source type picker.
   - Accepts every picker type: links/webpages, PDFs, Word `.docx`, images, audio/voice, video, chat transcripts, and notes.
   - `server/workflow/ingestion.js` normalizes each type into plain text before the pipeline runs:
     - URL/link → fetch + HTML readability extraction (also handles PDF/DOCX/audio URLs).
     - PDF → embedded text extraction; DOCX → dependency-free ZIP + `word/document.xml` parse.
     - Image → vision OCR stage (`imageOcr`) producing OCR text + visual summary.
     - Audio/voice → OpenAI Whisper transcription stage (`audioTranscription`); user-pasted transcript is merged/fallback.
     - Note/chat → direct text and role-labelled message flattening.

2. Workflow Adapter
   - `LumenWorkflow.compileSource(source, config)` is the browser boundary.
   - In `backend` mode it calls `POST /api/compile`.
   - Deterministic output is isolated to test fixtures and is not reachable from the browser or production API.

3. Backend Pipeline
   - `server/workflow/input.js`
   - `server/workflow/mapSeeder.js`
   - `server/workflow/parser.js`
   - `server/workflow/chunker.js`
   - `server/workflow/llmExtraction.js`
   - `server/llm/modelCatalog.js`
   - `server/llm/openaiClient.js`
   - `server/workflow/wikiGenerator.js`
   - `server/workflow/knowledgeGraph.js`
   - `server/workflow/sourceLinker.js`
   - `server/workflow/mapUpdater.js`
   - `server/workflow/feedbackGenerator.js`
   - `server/workflow/database.js`

4. Compile Schema
   - `lumen.compile.v1` is validated before the UI accepts any result.
   - Claims must cite source chunks.
   - Wiki patches and map updates must be structured.

5. Human Review
   - Shows summary, claims, citations, wiki proposals, map updates, and AI reviewer feedback inside the Add Source completion modal.
   - `reject` reviewer results are blocked from direct apply until the proposal is revised or rerun.

6. Apply Engine
   - Applies accepted wiki/map/source state through `POST /api/reviews/:runId/apply`.
   - This is the write boundary for `.data/knowledge-db.json` and map illumination.

## Internal Workflow

```text
Lumen UI
  -> LumenWorkflow.compileSource(source, config)
  -> POST /api/compile
  -> input normalization
  -> parsing
  -> chunking
  -> extraction
  -> wiki generation
  -> source linking
  -> map updating
  -> CompileSchema.validate(result)
  -> Review UI + AI reviewer feedback
  -> User confirms
  -> Apply Engine
  -> database persistence
  -> Wiki + Map + Sources
```

Each workflow stage calls OpenAI in Backend mode. Parser and chunking use small-model tasks; extraction, wiki, and graph generation use stronger synthesis tasks; source linking keeps final citation creation in code; map updater and feedback can use small models for explanations and next steps. The user only connects an API key; model routing is encapsulated inside Lumen. Deterministic local code remains only as an internal test/fallback layer, not as a user-facing product mode.

## Backend Skeleton

The current backend is intentionally small and dependency-free:

- `server/index.js` serves the app and exposes API routes.
- `server/workflow/*` owns the compile pipeline.
- `tests/fixtures/compileProposal.js` provides deterministic test-only proposals.
- `server/schema.js` validates `lumen.compile.v1`.
- `server/store.js` saves app state, compile runs, and accepted workflow artifacts under `.data/`.

This is not the final production backend. The next backend pass should move from file storage to Supabase/Postgres tables for sources, chunks, compile runs, review tasks, wiki entries, citations, maps, and map node evidence.
