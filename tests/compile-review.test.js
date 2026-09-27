const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');

const projectRoot = path.join(__dirname, '..');

async function request(route, endpoint, method = 'GET', body) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = endpoint;
  const response = { status: 200, data: null };
  const res = {
    writeHead(status) { response.status = status; },
    end(payload) { response.data = JSON.parse(payload); },
  };
  await route(req, res);
  return response;
}

test('a source stays pending until review, then persists exactly once', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-test-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const isolatedProject = path.join(temporaryRoot, 'lumen-mvp');
  fs.mkdirSync(isolatedProject);
  fs.cpSync(path.join(projectRoot, 'server'), path.join(isolatedProject, 'server'), { recursive: true });
  const { route } = require(path.join(isolatedProject, 'server', 'index.js'));

  const source = { id: 'source-test', type: 'note', title: 'Research note', text: 'Memory consolidation links new evidence to prior concepts.' };
  const map = { id: 'map-test', title: 'Memory', nodes: [{ id: 'memory', label: 'Memory', explored: 0 }], links: [] };
  const compiled = await request(route, '/api/compile', 'POST', {
    engine: 'mock', source, map, boosts: { memory: 0.4 }, targetEntryId: 'entry-memory',
  });
  assert.equal(compiled.status, 200);
  assert.equal(compiled.data.engine, 'mock');
  assert.match(compiled.data.runId, /^run-/);

  const pendingWorkspace = await request(route, '/api/workspace');
  const pendingKnowledge = await request(route, '/api/knowledge');
  assert.equal(pendingWorkspace.data.state.sources.length, 0);
  assert.equal(pendingKnowledge.data.database.revision, 0);

  const applyPath = `/api/reviews/${compiled.data.runId}/apply`;
  const rejected = await request(route, applyPath, 'POST', {
    mapId: map.id,
    result: {
      ...compiled.data.result,
      feedback: { recommendation: 'reject', reviewNotes: [], nextActions: [] },
    },
  });
  assert.equal(rejected.status, 409);
  assert.equal((await request(route, '/api/knowledge')).data.database.revision, 0);

  const applied = await request(route, applyPath, 'POST', { mapId: map.id });
  assert.equal(applied.status, 200);
  assert.equal(applied.data.knowledgeRevision, 1);

  const savedWorkspace = await request(route, '/api/workspace');
  const savedKnowledge = await request(route, '/api/knowledge');
  assert.equal(savedWorkspace.data.state.sources[0].id, source.id);
  assert.equal(savedWorkspace.data.state.extraEntries[0].id, 'entry-memory');
  assert.ok(savedWorkspace.data.state.litByMap[map.id].memory > 0);
  assert.equal(savedKnowledge.data.database.sources[0].id, source.id);
  assert.equal(savedKnowledge.data.database.wikiEntries[0].entryId, 'entry-memory');
  assert.equal(savedKnowledge.data.database.wikiEntries[0].evidence[0].sourceId, source.id);
  assert.match(savedKnowledge.data.database.wikiEntries[0].evidence[0].quote, /Memory consolidation/);
  assert.equal(savedKnowledge.data.database.mapNodeEvidence[0].evidence[0].sourceId, source.id);
  assert.equal(savedKnowledge.data.database.mapNodeEvidence[0].mapId, map.id);
  assert.equal(savedWorkspace.data.state.extraEntries[0].sections[0].evidence[0].sourceId, source.id);
  assert.equal(savedWorkspace.data.state.sources[0].citations.length, 2);

  const repeated = await request(route, applyPath, 'POST', { mapId: map.id });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.alreadyApplied, true);
  assert.equal(repeated.data.knowledgeRevision, 1);
  assert.equal((await request(route, '/api/workspace')).data.state.sources.length, 1);

  const secondSource = { ...source, id: 'source-test-2', title: 'Second research note' };
  const secondCompile = await request(route, '/api/compile', 'POST', {
    engine: 'mock', source: secondSource, map, boosts: { memory: 0.3 }, targetEntryId: 'entry-memory',
  });
  assert.equal(secondCompile.status, 200);
  const secondApply = await request(route, `/api/reviews/${secondCompile.data.runId}/apply`, 'POST', { mapId: map.id });
  assert.equal(secondApply.status, 200);
  const combined = (await request(route, '/api/knowledge')).data.database;
  assert.equal(combined.citations.length, 4);
  assert.equal(new Set(combined.citations.map((item) => item.id)).size, 4);
  assert.equal(combined.wikiEntries.length, 2);
  assert.deepEqual(new Set(combined.wikiEntries.map((item) => item.evidence[0].sourceId)),
    new Set([source.id, secondSource.id]));
});

test('evidence keeps the cited source chunk and its location', () => {
  const { evidenceForClaims } = require('../server/store');
  const source = { id: 'source-a', title: 'Paper A' };
  const result = {
    claims: [{ id: 'claim-1', text: 'A supported conclusion', citationIds: ['cite-1'] }],
    citations: [{ id: 'cite-1', sourceId: source.id, chunkId: 'chunk-1', quote: 'An incorrect quote', locator: 'chunk 1' }],
  };
  const chunks = [{ id: 'chunk-1', sourceId: source.id, text: 'The source passage', start: 15, end: 33 }];
  assert.deepEqual(evidenceForClaims(result, ['claim-1'], source, chunks), [{
    id: 'source-a:claim-1:cite-1', sourceId: source.id, sourceTitle: source.title,
    claimId: 'source-a:claim-1', claimText: 'A supported conclusion', chunkId: 'chunk-1',
    quote: 'The source passage', locator: 'chunk 1', start: 15, end: 33,
  }]);
  assert.deepEqual(evidenceForClaims(result, ['missing-claim'], source, chunks), []);
});
