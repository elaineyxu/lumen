/* ============================================================
   LUMEN — derived helpers (plain JS, after data.js)
   Pure read helpers over window.LUMEN_DATA. Exposed on window.LX
   ============================================================ */
(function () {
  function buildHelpers(data) {
  const D = data || window.LUMEN_DATA;
  const byArr = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));

  const MAP_BY = byArr(D.MAPS);
  const ENTRY_BY = byArr(D.ENTRIES);
  const CAT_BY = byArr(D.CATEGORIES);
  const SRC_BY = byArr(D.SOURCES);
  const BRANCH_BY = byArr(D.BRANCHES || []);

  const eff = (node, lit = {}) => Math.min(1, node.explored + (lit[node.id] || 0));
  const sourcesForMapRaw = (mapId) =>
    D.SOURCES.filter(s => (s.illuminated || []).some(i => i.map === mapId));

  function mapStats(map, lit = {}) {
    const total = map.nodes.length;
    const illum = map.nodes.filter(n => eff(n, lit) > 0.18).length;
    const pct = Math.round(map.nodes.reduce((s, n) => s + eff(n, lit), 0) / total * 100);
    const sourceCount = sourcesForMapRaw(map.id).length;
    return { total, illum, pct, sourceCount };
  }

  function clusterCoverage(map, lit = {}) {
    return Object.entries(map.clusters).map(([key, c]) => {
      const ns = map.nodes.filter(n => n.cluster === key);
      const illum = ns.filter(n => eff(n, lit) > 0.18).length;
      const pct = Math.round(ns.reduce((s, n) => s + eff(n, lit), 0) / ns.length * 100);
      return { key, label: c.label, hue: c.hue, note: c.note, pct, illum, total: ns.length };
    });
  }

  function diagnosis(map, lit = {}) {
    const cov = clusterCoverage(map, lit).slice().sort((a, b) => b.pct - a.pct);
    const strongest = cov[0];
    const thinnest = cov[cov.length - 1];
    const unexplored = map.nodes.filter(n => eff(n, lit) <= 0.18);
    return { strongest, thinnest, unexplored, cov };
  }

  // sources whose contributions touch this entry
  const sourcesForEntry = (entryId) =>
    D.SOURCES.filter(s => (s.contributedTo || []).includes(entryId));

  // entries this source helped build
  const entriesForSource = (srcId) =>
    (SRC_BY[srcId].contributedTo || []).map(id => ENTRY_BY[id]).filter(Boolean);

  // maps an entry appears in (resolved)
  const mapsForEntry = (entry) =>
    (entry.mapRefs || []).map(r => ({ map: MAP_BY[r.map], node: r.node })).filter(x => x.map);

  const entriesInCategory = (catId) => D.ENTRIES.filter(e => e.category === catId);

  const sourcesForMap = sourcesForMapRaw;

  const entriesForMap = (mapId) =>
    D.ENTRIES.filter(e => (e.mapRefs || []).some(r => r.map === mapId));

  // the wiki entry (if any) that documents a given map node
  const entryForNode = (mapId, nodeId) =>
    D.ENTRIES.find(e => (e.mapRefs || []).some(r => r.map === mapId && r.node === nodeId)) || null;

  // the mapRef linking an entry into a given map (→ { map, node })
  const nodeRefInMap = (entry, mapId) =>
    (entry.mapRefs || []).find(r => r.map === mapId) || null;

  // forward links: entries this entry points at via [[id||label]] in its prose
  const linksFromEntry = (entry) => {
    const ids = new Set();
    const scan = (t) => { if (!t) return; const re = /\[\[([^\]|]+)\|\|/g; let m;
      while ((m = re.exec(t))) if (ENTRY_BY[m[1]]) ids.add(m[1]); };
    (entry.lead || []).forEach(scan);
    (entry.sections || []).forEach(s => (s.blocks || []).forEach(b => {
      scan(b.text);
      (b.items || []).forEach(it => scan(typeof it === 'string' ? it : (it.def || '')));
    }));
    ids.delete(entry.id);
    return [...ids].map(id => ENTRY_BY[id]).filter(Boolean);
  };

  // a map's entries grouped by the region (cluster) their node lives in — the
  // "smaller wiki dedicated to this question", organised by the map's own regions
  const entriesForMapByRegion = (mapId) => {
    const map = MAP_BY[mapId]; if (!map) return [];
    const nodeBy = byArr(map.nodes);
    const groups = {};
    entriesForMap(mapId).forEach(e => {
      const ref = nodeRefInMap(e, mapId); if (!ref) return;
      const node = nodeBy[ref.node]; const key = node ? node.cluster : '_';
      (groups[key] = groups[key] || []).push({ entry: e, node });
    });
    return Object.entries(map.clusters)
      .filter(([k]) => groups[k])
      .map(([k, c]) => ({ key: k, label: c.label, hue: c.hue, items: groups[k] }));
  };

  // categories related to an entry (its own + those of its links & backlinks)
  const relatedCategories = (entry) => {
    const ids = new Set([entry.category]);
    linksFromEntry(entry).forEach(e => ids.add(e.category));
    (entry.backlinks || []).forEach(id => { const e = ENTRY_BY[id]; if (e) ids.add(e.category); });
    return [...ids].map(id => CAT_BY[id]).filter(Boolean);
  };

  /* ============================================================
     STUB ENTRIES — every map node is a wiki entry.
     Authored entries (in D.ENTRIES) are the rich pages; for any node
     without one, we synthesise a thin stub so a lit concept always
     has a destination in the encyclopedia. Stubs resolve through
     ENTRY_BY but are NOT pushed into D.ENTRIES (the encyclopedia
     lists them only once the node is lit).
     ============================================================ */
  const stubCatFor = () => (D.CATEGORIES[0] && D.CATEGORIES[0].id) || 'general';
  const stubIdFor = (mapId, nodeId) => 'stub:' + mapId + ':' + nodeId;

  function makeStub(map, node) {
    const zh = window.LANG === 'zh';
    const cl = map.clusters[node.cluster];
    const region = cl ? (zh ? cl.label : cl.label.toLowerCase()) : (zh ? '这张图谱' : 'this map');
    const note = cl && cl.note ? (zh ? cl.note : cl.note.toLowerCase()) : '';
    const lead = zh
      ? ('__' + node.label + '__位于__' + map.title + '__的「' + region + '」区域' +
         (note ? ' —— ' + note + '。' : '。') +
         ' 随你添加触及该概念的来源，Lumen 会逐步充实这一页；每一条都会点亮它在图谱上的节点，并加深这里的词条。')
      : ('__' + node.label + '__ sits in the ' + region + ' of __' + map.title + '__' +
         (note ? ' — ' + note + '.' : '.') +
         ' Lumen fills this page out as you add sources that touch the concept; each one brightens its node on the map and deepens the entry here.');
    return {
      id: stubIdFor(map.id, node.id), _stub: true, type: 'concept',
      title: node.label, subtitle: cl ? cl.note : '',
      category: stubCatFor(map, node), mapRefs: [{ map: map.id, node: node.id }],
      updated: zh ? ('综合自你的来源 · 目前 ' + node.sources + ' 条') : ('Synthesised from your sources · ' + node.sources + ' so far'),
      updatedShort: zh ? '综合' : 'synthesised', sourceNs: [], backlinks: [],
      lead: [lead],
      sections: [],
    };
  }

  const STUBS = {};
  D.MAPS.forEach(m => m.nodes.forEach(n => {
    if (!entryForNode(m.id, n.id)) { const s = makeStub(m, n); STUBS[s.id] = s; ENTRY_BY[s.id] = s; }
  }));

  // the wiki entry id for a node — authored if it exists, else its stub
  const entryIdForNode = (mapId, nodeId) => {
    const e = entryForNode(mapId, nodeId);
    return e ? e.id : stubIdFor(mapId, nodeId);
  };

  // is this node lit (illuminated enough to have a real place in the wiki)?
  const nodeLit = (map, node, litByMap) => {
    const lit = (litByMap && litByMap[map.id]) || {};
    return eff(node, lit) > 0.18;
  };

  // wiki entries in a category given current illumination:
  // authored entries (always) + stubs for nodes that are lit
  const wikiEntriesInCategory = (catId, litByMap) => {
    const authored = D.ENTRIES.filter(e => e.category === catId);
    const stubs = [];
    D.MAPS.forEach(m => m.nodes.forEach(n => {
      const s = STUBS[stubIdFor(m.id, n.id)];
      if (s && s.category === catId && nodeLit(m, n, litByMap)) stubs.push(s);
    }));
    return [...authored, ...stubs];
  };

  // every wiki entry currently in the encyclopedia (for search)
  const allWikiEntries = (litByMap) =>
    D.CATEGORIES.reduce((acc, c) => acc.concat(wikiEntriesInCategory(c.id, litByMap)), []);

  function globalStats() {
    const nodes = D.MAPS.reduce((s, m) => s + m.nodes.length, 0);
    const openQuestions = D.ENTRIES.filter(e => e.type === 'question').length
      + D.MAPS.reduce((s, m) => s + m.nodes.filter(n => n.explored <= 0.18).length, 0);
    return {
      maps: D.MAPS.length,
      nodes,
      entries: D.ENTRIES.filter(e => e.type !== 'moc').length,
      sources: D.SOURCES.length,
      openQuestions,
    };
  }

  window.LX = {
    MAP_BY, ENTRY_BY, CAT_BY, SRC_BY, BRANCH_BY,
    eff, mapStats, clusterCoverage, diagnosis,
    sourcesForEntry, entriesForSource, mapsForEntry,
    entriesInCategory, sourcesForMap, entriesForMap, entryForNode, globalStats,
    nodeRefInMap, linksFromEntry, entriesForMapByRegion, relatedCategories,
    entryIdForNode, nodeLit, wikiEntriesInCategory, allWikiEntries,
  };
  return window.LX;
  }

  window.LumenBuildHelpers = buildHelpers;
  buildHelpers();
})();
