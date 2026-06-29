/* ============================================================
   LUMEN — app shell · Overview · Map · Wiki · Sources
   ============================================================ */
const { useState:useStateApp, useEffect:useEffectApp, useMemo:useMemoApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#5b8fc7","#5bbfae","#dcab5a","#d98a6f","#a47fc4"],
  "accent": "#4f6fad",
  "glow": 1.1,
  "grain": 0.5,
  "richness": 0,
  "lines": "auto",
  "type": "Editorial"
}/*EDITMODE-END*/;

const PALETTES = [
  ["#5b8fc7","#5bbfae","#dcab5a","#d98a6f","#a47fc4"], // aurora (ref)
  ["#5b8fc7","#5bbfae","#7aa6d6","#8f9ed8","#a47fc4"], // cool
  ["#dcab5a","#d98a6f","#d77fa0","#c98ab0","#a47fc4"], // warm
];
const ACCENTS = ["#4f6fad","#3f8f86","#b07840","#9a6bb0"];

const NAV = [
  { id:'wiki',    icon:'wiki',    key:'nav_wiki' },
  { id:'atlas',   icon:'atlas',   key:'nav_atlas' },
  { id:'sources', icon:'library', key:'nav_sources' },
];

const SOURCE_FIRST_BRANCH = {
  id:'source-first',
  label:window.LANG === 'zh' ? '问题' : 'Questions',
  note:window.LANG === 'zh' ? '以来源优先的研究页面' : 'Source-first research pages',
};
const SOURCE_FIRST_CATEGORY = {
  id:'questions',
  branch:'source-first',
  label:window.LANG === 'zh' ? '开放问题' : 'Open questions',
  note:window.LANG === 'zh' ? '等待来源与图谱覆盖检查的问题' : 'Questions waiting for sources and map coverage checks',
  hue:'coral',
};

function App() {
  const params = new URLSearchParams(window.location.search);
  const onboardingMode = params.has('onboarding') || params.has('demo') || params.has('seed');
  const seedOnlyMode = params.has('seed');
  const baseData = window.LUMEN_BASE_DATA || (window.LUMEN_BASE_DATA = onboardingMode && window.LUMEN_ONBOARDING_DATA ? window.LUMEN_ONBOARDING_DATA : window.LUMEN_DATA);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const requestedView = params.get('view');
  const initialView = NAV.some(item=>item.id===requestedView) || requestedView === 'overview' || requestedView === 'settings'
    ? requestedView
    : 'wiki';
  const initialMapId = params.get('map') || (baseData.MAPS[0] ? baseData.MAPS[0].id : null);
  const initialNodeId = params.get('node') || null;
  const initialCat = params.get('cat') || null;
  const initialEntryId = params.get('entry') || (baseData.ENTRIES[0] ? baseData.ENTRIES[0].id : null);
  const initialSourceId = params.get('source') || (baseData.SOURCES[0] ? baseData.SOURCES[0].id : null);

  const [view, setView] = useStateApp(initialView);
  const [extraMaps, setExtraMaps] = useStateApp([]);
  const [extraEntries, setExtraEntries] = useStateApp([]);
  const [dynamicSources, setDynamicSources] = useStateApp([]);
  const [activeMapId, setActiveMapId] = useStateApp(initialMapId);
  const [mapSelected, setMapSelected] = useStateApp(initialNodeId);
  const [activeEntryId, setActiveEntryId] = useStateApp(initialCat ? null : initialEntryId);
  const [browseCat, setBrowseCat] = useStateApp(initialCat);
  const [selectedSourceId, setSelectedSourceId] = useStateApp(initialSourceId);
  const [litByMap, setLitByMap] = useStateApp({});
  const [add, setAdd] = useStateApp(null);          // null | { mapId, preset }
  const [creating, setCreating] = useStateApp(false);
  const [captureOpen, setCaptureOpen] = useStateApp(false);
  const [captureType, setCaptureType] = useStateApp(null);   // null | type id → QuickCapture modal
  const [inbox, setInbox] = useStateApp(baseData.INBOX);
  const [reviewInbox, setReviewInbox] = useStateApp(false);  // open Sources on the Inbox filter
  const [wikiProposals, setWikiProposals] = useStateApp([]);

  const applyWorkspaceState = (payload)=>{
    const state = payload && payload.state ? payload.state : payload;
    if(!state) return;
    if(Array.isArray(state.extraMaps)) setExtraMaps(state.extraMaps);
    if(Array.isArray(state.extraEntries)) {
      setExtraEntries(state.extraEntries);
      if(!activeEntryId && state.extraEntries[0]) {
        setActiveEntryId(state.extraEntries[0].id);
        setBrowseCat(null);
      }
    }
    if(Array.isArray(state.sources)) setDynamicSources(state.sources);
    if(Array.isArray(state.inbox)) setInbox(state.inbox);
    if(state.litByMap && typeof state.litByMap === 'object') setLitByMap(state.litByMap);
  };

  const loadAcceptedWikiProposals = (database)=>{
    const rows = database && Array.isArray(database.wikiEntries) ? database.wikiEntries : [];
    setWikiProposals(prev=>{
      const accepted = rows.map((row, index)=>({
        id:'accepted:'+(row.sourceId||'source')+':'+row.id+':'+index,
        runId:null,
        sourceId:row.sourceId,
        sourceTitle:row.sourceTitle || 'Accepted source',
        mapId:null,
        boosts:{},
        result:null,
        status:'accepted',
        entryId:row.id,
        heading:row.heading,
        body:row.body,
        patchStatus:row.status || 'append',
        updateRule:row.updateRule || 'new_evidence',
        evidenceClaimIds:row.evidenceClaimIds || [],
        reviewer:null,
        createdAt:row.updatedAt || 'accepted',
      })).filter(p=>p.entryId && p.heading && p.body);
      const acceptedIds = new Set(accepted.map(p=>p.id));
      return [...accepted, ...prev.filter(p=>p.status!=='accepted' && !acceptedIds.has(p.id))]
        .filter((p,i,arr)=>arr.findIndex(x=>x.id===p.id)===i)
        .slice(0, 120);
    });
  };

  const mergeById = (items)=>{
    const byId = new Map();
    (items || []).forEach(item=>{ if(item && item.id) byId.set(item.id, item); });
    return Array.from(byId.values());
  };

  const snapshotForPatchEntry = (entryId)=>{
    if(!entryId || !window.LX) return null;
    const direct = window.LX.ENTRY_BY && window.LX.ENTRY_BY[entryId];
    if(direct && !direct._stub) return direct;
    const raw = String(entryId);
    if(raw.startsWith('entry-')){
      const nodeId = raw.slice(6);
      const entry = Object.values(window.LX.ENTRY_BY || {}).find(e=>(e.mapRefs||[]).some(ref=>ref.node===nodeId));
      if(entry) return entry;
    }
    return direct || null;
  };

  const entrySnapshotsForResult = (result)=>{
    const snapshots = {};
    ((result && result.wikiPatches) || []).forEach(patch=>{
      const entry = snapshotForPatchEntry(patch.entryId);
      if(entry) snapshots[patch.entryId] = {
        id:entry.id,
        type:entry.type,
        title:entry.title,
        subtitle:entry.subtitle,
        category:entry.category,
        mapRefs:entry.mapRefs || [],
        updated:entry.updated,
        updatedShort:entry.updatedShort,
        sourceNs:entry.sourceNs || [],
        sourceIds:entry.sourceIds || [],
        backlinks:entry.backlinks || [],
        lead:entry.lead || [],
        sections:entry.sections || [],
      };
    });
    return snapshots;
  };

  const rememberWikiProposal = ({ result, source, mapId, boosts })=>{
    if(!result || !Array.isArray(result.wikiPatches) || !result.wikiPatches.length) return;
    const runId = result._runId || ('local-'+Date.now());
    const next = result.wikiPatches.map((patch, index)=>({
      id:runId+':'+patch.entryId+':'+index,
      runId,
      sourceId:source && source.id,
      sourceTitle:(source && source.title) || 'Pending source',
      mapId,
      boosts:boosts || {},
      result,
      status:result.feedback && result.feedback.recommendation === 'reject' ? 'blocked' : 'pending',
      entryId:patch.entryId,
      heading:patch.heading,
      body:patch.body,
      patchStatus:patch.status || 'append',
      updateRule:patch.updateRule || 'new_evidence',
      evidenceClaimIds:patch.evidenceClaimIds || [],
      reviewer:result.feedback || null,
      createdAt:'pending',
    }));
    setWikiProposals(prev=>{
      const ids = new Set(next.map(p=>p.id));
      return [...next, ...prev.filter(p=>!ids.has(p.id))].slice(0, 120);
    });
  };

  const markWikiProposalStatus = (runId, status)=>{
    if(!runId) return;
    setWikiProposals(prev=>prev.map(p=>p.runId===runId ? { ...p, status } : p));
  };

  useEffectApp(()=>{
    let cancelled = false;
    if(seedOnlyMode) return undefined;
    if(!window.LumenApi) return undefined;
    window.LumenApi.getWorkspace()
      .then(payload=>{ if(!cancelled) applyWorkspaceState(payload); })
      .catch(()=>{});
    if(window.LumenApi.getKnowledge){
      window.LumenApi.getKnowledge()
        .then(payload=>{ if(!cancelled) loadAcceptedWikiProposals(payload.database); })
        .catch(()=>{});
    }
    return ()=>{ cancelled = true; };
  },[]);

  const maps = useMemoApp(()=>[...baseData.MAPS, ...extraMaps], [baseData.MAPS, extraMaps]);
  const data = useMemoApp(()=>{
    const entries = mergeById([...baseData.ENTRIES, ...extraEntries]);
    const needsQuestionShelf = entries.some(e=>e.category==='questions') || maps.length > baseData.MAPS.length;
    const branches = [...(baseData.BRANCHES || [])];
    const categories = [...(baseData.CATEGORIES || [])];
    if(needsQuestionShelf && !branches.some(b=>b.id===SOURCE_FIRST_BRANCH.id)) branches.unshift(SOURCE_FIRST_BRANCH);
    if(needsQuestionShelf && !categories.some(c=>c.id===SOURCE_FIRST_CATEGORY.id)) categories.unshift(SOURCE_FIRST_CATEGORY);
    const next = { ...baseData, MAPS:maps, BRANCHES:branches, CATEGORIES:categories, ENTRIES:entries, SOURCES:[...baseData.SOURCES, ...dynamicSources], INBOX:inbox };
    window.LUMEN_DATA = next;
    if(window.LumenBuildHelpers) window.LumenBuildHelpers(next);
    return next;
  }, [baseData, maps, extraEntries, dynamicSources, inbox]);
  const activeMap = maps.find(m=>m.id===activeMapId) || maps[0] || null;

  // apply tweak vars to :root
  useEffectApp(()=>{
    const r = document.documentElement.style;
    const p = t.palette || PALETTES[0];
    ['--glow-blue','--glow-teal','--glow-amber','--glow-coral','--glow-violet'].forEach((nm,i)=> r.setProperty(nm, p[i]));
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-soft', t.accent+'1f');
    r.setProperty('--glow-strength', t.glow);
    r.setProperty('--grain', t.grain);
    r.setProperty('--serif', t.type==='Editorial' ? "'Instrument Serif', 'Noto Serif SC', Georgia, serif" : "'Instrument Sans', 'Noto Sans SC', system-ui, sans-serif");
  },[t]);

  // active-map lit = source boosts + global "understanding" richness
  const activeLit = useMemoApp(()=>{
    const m = {}; const base = litByMap[activeMapId]||{};
    if(!activeMap) return m;
    activeMap.nodes.forEach(n=>{ m[n.id] = (base[n.id]||0) + (t.richness||0); });
    return m;
  },[litByMap, activeMapId, t.richness, activeMap]);

  /* ---- cross-navigation ---- */
  const openMap = (mapId)=>{ setActiveMapId(mapId); setMapSelected(null); setView('atlas'); };
  const gotoMapNode = (mapId, nodeId)=>{ setActiveMapId(mapId); setMapSelected(nodeId); setView('atlas'); };
  // open an entry in the encyclopedia (the one Wiki — panoramic)
  const openEntry = (id)=>{
    if(LX.ENTRY_BY[id]){ setBrowseCat(null); setActiveEntryId(id); } else if(LX.CAT_BY[id]){ setActiveEntryId(null); setBrowseCat(id); }
    setView('wiki');
  };
  const goWiki = ()=>{ setView('wiki'); };
  const openSource = (id)=>{ setSelectedSourceId(id); setView('sources'); };
  const askAddSource = (nodeId, options={})=>{
    const mapId = options.targetMapId || activeMapId || (maps[0] && maps[0].id);
    if(!mapId){ setCreating(true); return; }
    const preset = options.presetNode || nodeId || null;
    const entryId = options.targetEntryId || (preset && window.LX && window.LX.entryIdForNode ? window.LX.entryIdForNode(mapId, preset) : null);
    setAdd({ mapId, preset, targetEntryId:entryId });
  };

  /* ---- quick capture → Inbox (separate from the formal Add Source flow) ---- */
  const captureToInbox = (item)=>{
    const local = { ...item, id:'i'+Date.now(), captured:'just now', pending:false,
      suggest:{ maps:[], entries:[], concepts:[] } };
    setInbox(prev=>[local, ...prev]);
    if(window.LumenApi){
      window.LumenApi.captureInbox(item)
        .then(payload=>applyWorkspaceState(payload))
        .catch(()=>{});
    }
  };
  const goReviewInbox = ()=>{ setReviewInbox(true); setView('sources'); };
  // digest an inbox item into a chosen map: light its suggested concepts, then clear it
  const digestInbox = (item, mapId)=>{
    const mid = mapId || (item.suggest && item.suggest.maps[0]) || activeMapId || (maps[0] && maps[0].id);
    if(!mid){ setInbox(prev=>prev.filter(x=>x.id!==item.id)); setCreating(true); return; }
    const concepts = (item.suggest && item.suggest.concepts || []).filter(c=>c.map===mid).map(c=>c.node);
    if(concepts.length){
      setLitByMap(prev=>{ const cur={...(prev[mid]||{})}; concepts.forEach((id,i)=>{ cur[id]=Math.max(cur[id]||0, i===0?0.5:0.34); }); return {...prev, [mid]:cur}; });
    }
    setInbox(prev=>prev.filter(x=>x.id!==item.id));
    setActiveMapId(mid); setView('atlas');
    if(concepts[0]) setTimeout(()=>setMapSelected(concepts[0]), 250);
    if(window.LumenApi){
      window.LumenApi.digestInbox(item.id, mid)
        .then(payload=>applyWorkspaceState(payload))
        .catch(()=>{});
    }
  };
  const dismissInbox = (item)=>{
    setInbox(prev=>prev.filter(x=>x.id!==item.id));
    if(window.LumenApi){
      window.LumenApi.dismissInbox(item.id)
        .then(payload=>applyWorkspaceState(payload))
        .catch(()=>{});
    }
  };

  const applySource = (boosts, meta)=>{
    const mid = add ? add.mapId : activeMapId;
    if(!mid) return;
    const proposalBoosts = {};
    if(meta && meta.compileResult && Array.isArray(meta.compileResult.mapUpdates)){
      meta.compileResult.mapUpdates.forEach(update=>{ if(update && update.nodeId) proposalBoosts[update.nodeId] = update.delta; });
    }
    const appliedBoosts = Object.keys(proposalBoosts).length ? proposalBoosts : boosts;
    const first = Object.keys(appliedBoosts)[0];
    const targetEntry = meta && meta.compileResult && meta.compileResult.wikiPatches && meta.compileResult.wikiPatches[0]
      ? meta.compileResult.wikiPatches[0].entryId
      : (meta && meta.targetEntryId) || (first && window.LX && window.LX.entryIdForNode ? window.LX.entryIdForNode(mid, first) : activeEntryId);
    const finishApply = ()=>{
      setAdd(null);
      setActiveMapId(mid);
      if(meta && meta.destination === 'wiki'){
        if(targetEntry) setActiveEntryId(targetEntry);
        setView('wiki');
      } else {
        setView('atlas');
        if(first) setTimeout(()=>setMapSelected(first), 250);
      }
    };
    const runId = meta && meta.compileResult && meta.compileResult._runId;
    if(runId && window.LumenApi){
      window.LumenApi.applyReview(runId, {
        mapId: mid,
        boosts: appliedBoosts,
        result: meta.compileResult,
        source: meta.source,
        destination: meta.destination,
        entrySnapshots: entrySnapshotsForResult(meta.compileResult),
      })
        .then(payload=>{
          applyWorkspaceState(payload);
          markWikiProposalStatus(runId, 'accepted');
          finishApply();
          if(window.LumenApi && window.LumenApi.getKnowledge){
            window.LumenApi.getKnowledge().then(k=>loadAcceptedWikiProposals(k.database)).catch(()=>{});
          }
        })
        .catch(err=>{ window.alert((err && err.message) || 'Apply review failed'); });
      return;
    }
    setLitByMap(prev=>{ const cur={...(prev[mid]||{})}; Object.entries(appliedBoosts).forEach(([k,v])=>{ cur[k]=Math.max(cur[k]||0, v); }); return {...prev, [mid]:cur}; });
    finishApply();
  };

  const applyWikiProposal = (proposal)=>{
    if(!proposal || proposal.status==='accepted') return;
    if(proposal.status==='blocked' || (proposal.reviewer && proposal.reviewer.recommendation === 'reject')){
      window.alert('AI reviewer 建议暂不写入；请重新编纂或调整来源。');
      return;
    }
    if(!proposal.runId || !proposal.result || !window.LumenApi){
      setWikiProposals(prev=>prev.map(p=>p.id===proposal.id ? { ...p, status:'accepted' } : p));
      return;
    }
    const mapUpdates = Array.isArray(proposal.result.mapUpdates) ? proposal.result.mapUpdates : [];
    const boosts = {};
    mapUpdates.forEach(update=>{ if(update && update.nodeId) boosts[update.nodeId] = update.delta; });
    window.LumenApi.applyReview(proposal.runId, {
      mapId: proposal.mapId || activeMapId,
      boosts: Object.keys(boosts).length ? boosts : proposal.boosts,
      result: proposal.result,
      source: { id:proposal.sourceId, title:proposal.sourceTitle },
      destination:'wiki',
      entrySnapshots: entrySnapshotsForResult(proposal.result),
    })
      .then(payload=>{
        applyWorkspaceState(payload);
        markWikiProposalStatus(proposal.runId, 'accepted');
        if(window.LumenApi.getKnowledge) window.LumenApi.getKnowledge().then(k=>loadAcceptedWikiProposals(k.database)).catch(()=>{});
      })
      .catch(err=>{ window.alert((err && err.message) || 'Apply review failed'); });
  };

  const dismissWikiProposal = (proposal)=>{
    if(!proposal) return;
    setWikiProposals(prev=>prev.filter(p=>p.id!==proposal.id));
  };

  const createMap = (question)=>{
    const useMap = (m, entry)=>{
      setExtraMaps(prev=> prev.some(x=>x.id===m.id) ? prev : [...prev, m]);
      if(entry) setExtraEntries(prev=> prev.some(x=>x.id===entry.id) ? prev : [entry, ...prev]);
      setCreating(false);
      setActiveMapId(m.id); setMapSelected(null);
      if(entry){
        setActiveEntryId(entry.id);
        setBrowseCat(null);
        setView('wiki');
      } else {
        setView('atlas');
      }
    };
    if(!window.LumenApi) return Promise.reject(new Error('Lumen backend is required to create a map with AI.'));
    return window.LumenApi.createMap(question)
      .then(payload=>{
        const map = payload && payload.map;
        if(!map || !Array.isArray(map.nodes) || map.nodes.length < 7 || !map.seedMeta || map.seedMeta.generatedBy !== 'mapSeeder'){
          throw new Error('Map API returned an invalid AI seed. No local placeholder map was accepted.');
        }
        applyWorkspaceState(payload); useMap(map, payload.entry); return map;
      });
  };

  const reviseMap = (mapId, prompt)=>{
    const current = maps.find(m=>m.id===mapId);
    if(!current || !(current.seedMeta && current.seedMeta.generatedBy === 'mapSeeder')){
      return Promise.reject(new Error(window.t('revise_created_only')));
    }
    const text = String(prompt||'').trim();
    if(!text) return Promise.reject(new Error(window.t('revise_prompt_required')));
    if(!window.LumenApi || !window.LumenApi.reviseMap){
      return Promise.reject(new Error('Lumen backend is required to revise a map with AI.'));
    }
    return window.LumenApi.reviseMap(mapId, text)
      .then(payload=>{
        const map = payload && payload.map;
        if(!map || !Array.isArray(map.nodes) || map.nodes.length < 7 || !map.seedMeta || map.seedMeta.generatedBy !== 'mapSeeder'){
          throw new Error('Map API returned an invalid AI revision.');
        }
        applyWorkspaceState(payload);
        setActiveMapId(map.id);
        setMapSelected(null);
        return map;
      });
  };

  const renameMap = (mapId)=>{
    const current = maps.find(m=>m.id===mapId);
    if(!current || !(current.seedMeta && current.seedMeta.generatedBy === 'mapSeeder')) return;
    const title = window.prompt(window.t('rename_map_prompt'), current.title);
    const nextTitle = title && title.trim();
    if(!nextTitle || nextTitle===current.title) return;
    const applyLocal = (map)=>{
      setExtraMaps(prev=>prev.map(m=>m.id===mapId ? { ...m, ...map, title:map.title||nextTitle } : m));
    };
    if(window.LumenApi && window.LumenApi.renameMap){
      window.LumenApi.renameMap(mapId, nextTitle)
        .then(payload=>{ applyWorkspaceState(payload); })
        .catch(err=>window.alert((err && err.message) || 'Rename map failed'));
      return;
    }
    applyLocal({ title:nextTitle, updated:'just now' });
  };

  const deleteMap = (mapId)=>{
    const current = maps.find(m=>m.id===mapId);
    if(!current || !(current.seedMeta && current.seedMeta.generatedBy === 'mapSeeder')) return;
    if(!window.confirm(window.t('delete_map_confirm', current.title))) return;
    const fallback = maps.find(m=>m.id!==mapId);
    const finishLocal = (payload)=>{
      applyWorkspaceState(payload);
      if(activeMapId===mapId){
        setActiveMapId(fallback ? fallback.id : null);
        setMapSelected(null);
      }
    };
    if(window.LumenApi && window.LumenApi.deleteMap){
      window.LumenApi.deleteMap(mapId)
        .then(finishLocal)
        .catch(err=>window.alert((err && err.message) || 'Delete map failed'));
      return;
    }
      finishLocal({ state:{ extraMaps:extraMaps.filter(m=>m.id!==mapId), extraEntries:extraEntries.filter(e=>!(e.mapRefs||[]).some(r=>r.map===mapId)), sources:dynamicSources, inbox, litByMap } });
  };

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', position:'relative', isolation:'isolate' }}>
      <Grain/>

      {/* NAV */}
      <nav style={navBar}>
        <button onClick={goWiki} style={brandBtt}>
          <HorizonMark s={24}/>
          <span style={{ fontFamily:'var(--serif)', fontSize:25, lineHeight:1, letterSpacing:'0.01em', color:'var(--ink)', transform:'translateY(1px)' }}>Lumen</span>
        </button>

        <div style={tabWrap}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=> n.id==='wiki' ? goWiki() : setView(n.id)} style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 15px', borderRadius:10, border:'none',
              background: view===n.id?'var(--card-solid)':'transparent',
              boxShadow: view===n.id?'0 1px 3px oklch(0.3 0.04 280 / 0.12), 0 0 0 1px var(--hair)':'none',
              color: view===n.id?'var(--ink)':'var(--ink-3)', fontSize:14, fontWeight:view===n.id?600:500, transition:'all .2s' }}>
              <Icon name={n.icon} s={16}/> {window.t(n.key)}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12, justifySelf:'end' }}>
          <button onClick={goWiki} style={searchBox}>
            <Icon name="search" s={15} c="var(--ink-4)"/>
            <span style={{ fontSize:13, color:'var(--ink-4)' }}>{window.t('search_knowledge')}</span>
          </button>
          <div style={{ position:'relative' }}>
            <button data-capture-trigger onClick={()=>setCaptureOpen(o=>!o)} style={{ ...addBtn,
              background: captureOpen ? 'var(--ink-2)' : 'var(--ink)' }}>
              <Icon name="plus" s={16}/> {window.t('capture')}
            </button>
            {captureOpen && (
              <CaptureMenu
                onClose={()=>setCaptureOpen(false)}
                onPick={(typeId)=>{ setCaptureOpen(false); setCaptureType(typeId); }} />
            )}
          </div>
          <button onClick={()=>setView('overview')} title={window.t('overview')} style={{ width:38, height:38, borderRadius:11, flex:'none',
            border:'1px solid '+(view==='overview'?'transparent':'var(--hair)'),
            background: view==='overview'?'var(--card-solid)':'var(--card)',
            boxShadow: view==='overview'?'0 1px 3px oklch(0.3 0.04 280 / 0.12), 0 0 0 1px var(--hair)':'none',
            color: view==='overview'?'var(--ink)':'var(--ink-3)', display:'grid', placeItems:'center' }}>
            <Icon name="home" s={17}/>
          </button>
          <button onClick={()=>setView('settings')} title={window.t('settings')} style={{ width:38, height:38, borderRadius:11, flex:'none',
            border:'1px solid '+(view==='settings'?'transparent':'var(--hair)'),
            background: view==='settings'?'var(--card-solid)':'var(--card)',
            boxShadow: view==='settings'?'0 1px 3px oklch(0.3 0.04 280 / 0.12), 0 0 0 1px var(--hair)':'none',
            color: view==='settings'?'var(--ink)':'var(--ink-3)', display:'grid', placeItems:'center' }}>
            <Icon name="settings" s={17}/>
          </button>
        </div>
      </nav>

      {/* VIEW */}
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        {view==='overview' && (
          <Home data={data} litByMap={litByMap} inbox={inbox}
            onOpenMap={openMap} onOpenEntry={openEntry} onGotoMapNode={gotoMapNode}
            goAtlas={()=>setView('atlas')} goWiki={goWiki} goSources={()=>setView('sources')}
            onReviewInbox={goReviewInbox} />
        )}
        {view==='atlas' && (
          <Atlas data={data} litMap={activeLit} litByMap={litByMap} lineStyle={t.lines}
            activeMapId={activeMapId} setActiveMapId={setActiveMapId}
            selected={mapSelected} setSelected={setMapSelected}
            onOpenEntry={openEntry}
            onGotoMapNode={gotoMapNode} onOpenSource={openSource}
            onAddSource={askAddSource} onCreateMap={()=>setCreating(true)}
            onRenameMap={renameMap} onDeleteMap={deleteMap} onReviseMap={reviseMap} />
        )}
        {view==='wiki' && (
          <WikiView data={data} litByMap={litByMap}
            activeEntryId={activeEntryId} setActiveEntryId={setActiveEntryId}
            browseCat={browseCat} setBrowseCat={setBrowseCat}
            onGotoMapNode={gotoMapNode}
            onAddSource={askAddSource} onOpenSource={openSource} onCreateMap={()=>setCreating(true)}
            wikiProposals={wikiProposals}
            onApplyWikiProposal={applyWikiProposal}
            onDismissWikiProposal={dismissWikiProposal} />
        )}
        {view==='sources' && (
          <Sources data={data} litByMap={litByMap} inbox={inbox}
            selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId}
            reviewInbox={reviewInbox} clearReviewInbox={()=>setReviewInbox(false)}
            onOpenEntry={openEntry} onGotoMapNode={gotoMapNode} onAddSource={askAddSource}
            onDigestInbox={digestInbox} onDismissInbox={dismissInbox} onCapture={(typeId)=>setCaptureType(typeId)} />
        )}
        {view==='settings' && (
          <Settings data={data} litByMap={litByMap} inbox={inbox} t={t} setTweak={setTweak} />
        )}
      </div>

      {add && <AddSource map={maps.find(m=>m.id===add.mapId)||activeMap} presetNode={add.preset} targetEntryId={add.targetEntryId} onClose={()=>setAdd(null)} onApply={applySource} onProposal={rememberWikiProposal} />}
      {creating && <CreateMap onClose={()=>setCreating(false)} onCreate={createMap} />}
      {captureType && <QuickCapture typeId={captureType} onClose={()=>setCaptureType(null)} onSave={captureToInbox} onReview={()=>{ setCaptureType(null); goReviewInbox(); }} />}

      {/* TWEAKS */}
      <TweaksPanel>
        <TweakSection label={window.t('tw_atmosphere')} />
        <TweakColor label={window.t('tw_halo')} value={t.palette} options={PALETTES} onChange={v=>setTweak('palette', v)} />
        <TweakColor label={window.t('tw_accent')} value={t.accent} options={ACCENTS} onChange={v=>setTweak('accent', v)} />
        <TweakSlider label={window.t('tw_glow')} value={t.glow} min={0.3} max={1.7} step={0.05} onChange={v=>setTweak('glow', v)} />
        <TweakSlider label={window.t('tw_grain')} value={t.grain} min={0} max={1} step={0.05} onChange={v=>setTweak('grain', v)} />
        <TweakSection label={window.t('tw_map')} />
        <TweakSlider label={window.t('tw_understanding')} value={t.richness} min={-0.25} max={0.45} step={0.05} unit="" onChange={v=>setTweak('richness', v)} />
        <TweakRadio label={window.t('tw_connections')} value={t.lines} options={[
          {value:'auto',label:window.t('line_auto')},{value:'dash',label:window.t('line_dash')},
          {value:'dot',label:window.t('line_dot')},{value:'solid',label:window.t('line_solid')}]} onChange={v=>setTweak('lines', v)} />
        <TweakSection label={window.t('tw_type')} />
        <TweakRadio label={window.t('tw_voice')} value={t.type} options={[
          {value:'Editorial',label:window.t('tw_editorial')},{value:'Quiet sans',label:window.t('tw_quiet')}]} onChange={v=>setTweak('type', v)} />
      </TweaksPanel>
    </div>
  );
}

/* ---------- Create New Map modal ---------- */
function CreateMap({ onClose, onCreate }) {
  const [q, setQ] = useStateApp('');
  const [phase, setPhase] = useStateApp('ask'); // ask | sketching
  const [error, setError] = useStateApp('');
  const PRESETS = [window.t('cm_p1'), window.t('cm_p2'), window.t('cm_p3')];
  const go = ()=>{
    const prompt = q.trim();
    if(!prompt) return;
    setError('');
    setPhase('sketching');
    setTimeout(()=>{
      Promise.resolve(onCreate(prompt))
        .catch(err=>{
          setPhase('ask');
          setError((err && err.message) || 'Lumen needs an AI API key before it can create this map.');
        });
    }, 900);
  };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, display:'grid', placeItems:'center',
      background:'oklch(0.3 0.02 280 / 0.18)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', animation:'fadeUp .25s ease' }}>
      <Frost onClick={e=>e.stopPropagation()} style={{ width:560, maxWidth:'92vw', padding:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 0' }}>
          <div className="mono-label">{window.t('create_expert_map')}</div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-3)', display:'grid', placeItems:'center' }}><Icon name="close" s={16}/></button>
        </div>
        {phase==='ask' ? (
          <div style={{ padding:'14px 24px 26px' }}>
            <h2 style={{ margin:'8px 0 0', fontFamily:'var(--serif)', fontStyle:'italic', fontWeight:400, fontSize:27, color:'var(--ink)', lineHeight:1.15 }}>
              {window.t('cm_title')}
            </h2>
            <p style={{ margin:'10px 0 0', fontSize:14.5, lineHeight:1.5, color:'var(--ink-3)' }}>
              {window.t('cm_sub')}
            </p>
            <input autoFocus value={q} onChange={e=>{ setQ(e.target.value); if(error) setError(''); }} onKeyDown={e=>{ if(e.key==='Enter') go(); }}
              placeholder={window.t('cm_ph')} style={{ width:'100%', marginTop:18, padding:'14px 16px', borderRadius:12,
              border:'1px solid var(--hair)', background:'var(--card-solid)', fontFamily:'var(--serif)', fontSize:19, color:'var(--ink)', outline:'none' }}/>
            {error && (
              <div style={{ marginTop:12, padding:'10px 12px', borderRadius:11,
                border:'1px solid color-mix(in oklab, var(--glow-coral) 35%, var(--hair))',
                background:'color-mix(in oklab, var(--glow-coral) 10%, transparent)', color:'var(--ink-2)', fontSize:12.5, lineHeight:1.45 }}>
                {error}
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              {PRESETS.map(p=>(
                <button key={p} onClick={()=>setQ(p)} style={{ padding:'7px 12px', borderRadius:18, border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-2)', fontSize:12.5 }}>{p}</button>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
              <button onClick={onClose} style={{ padding:'11px 18px', borderRadius:11, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-2)', fontSize:14, fontWeight:500 }}>{window.t('cancel')}</button>
              <button onClick={go} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 18px', borderRadius:11, border:'none', background:'var(--ink)', color:'var(--paper)', fontSize:14, fontWeight:500 }}>
                <Icon name="spark" s={15}/> {window.t('cm_sketch')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding:'40px 24px 44px', textAlign:'center' }}>
            <div style={{ width:54, height:54, borderRadius:'50%', margin:'0 auto', display:'grid', placeItems:'center',
              background:'radial-gradient(circle, var(--glow-blue), transparent 72%)' }}>
              <Icon name="compass" s={24} c="var(--ink)"/>
            </div>
            <h2 style={{ margin:'16px 0 0', fontFamily:'var(--serif)', fontStyle:'italic', fontWeight:400, fontSize:25, color:'var(--ink)' }}>{window.t('cm_sketching')}</h2>
            <p style={{ margin:'8px 0 0', fontSize:14, color:'var(--ink-3)' }}>{window.t('cm_laying', q)}</p>
          </div>
        )}
      </Frost>
    </div>
  );
}

function Tab(){ return null; }

/* ---------- Capture quick-entry menu ---------- */
const CAPTURE_TYPES = [
  { id:'link',  icon:'link',  label:window.t('cap_link'),  hint:window.t('cap_link_h') },
  { id:'paper', icon:'paper', label:window.t('cap_paper'), hint:window.t('cap_paper_h') },
  { id:'chat',  icon:'chat',  label:window.t('cap_chat'),  hint:window.t('cap_chat_h') },
  { id:'voice', icon:'voice', label:window.t('cap_voice'), hint:window.t('cap_voice_h') },
  { id:'image', icon:'image', label:window.t('cap_image'), hint:window.t('cap_image_h') },
  { id:'note',  icon:'note',  label:window.t('cap_note'),  hint:window.t('cap_note_h') },
];

function CaptureMenu({ onPick, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const onDown = (e)=>{ if(ref.current && !ref.current.contains(e.target) && !e.target.closest('[data-capture-trigger]')) onClose(); };
    const onKey = (e)=>{ if(e.key==='Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return ()=>{ document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  },[onClose]);
  return (
    <div ref={ref} style={captureMenu}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 15px 9px' }}>
        <div className="mono-label">{window.t('quick_capture')}</div>
        <span style={{ fontSize:11.5, color:'var(--ink-4)' }}>{window.t('save_now_file_later')}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', padding:'0 7px 7px' }}>
        {CAPTURE_TYPES.map(c=>(
          <button key={c.id} onClick={()=>onPick(c.id)} style={captureRow}
            onMouseEnter={e=>e.currentTarget.style.background='var(--card)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={captureIcon}><Icon name={c.icon} s={16} c="var(--ink-2)"/></span>
            <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.25 }}>
              <span style={{ fontSize:13.5, fontWeight:500, color:'var(--ink)' }}>{c.label}</span>
              <span style={{ fontSize:11.5, color:'var(--ink-4)' }}>{c.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div style={captureFoot}>
        <span style={{ marginTop:1, flex:'none' }}><Icon name="layers" s={15} c="var(--accent)"/></span>
        <span style={{ fontSize:11.5, lineHeight:1.45, color:'var(--ink-3)' }}>
          {window.t('capture_foot_a')}<strong style={{ color:'var(--ink-2)', fontWeight:600 }}>{window.t('capture_foot_inbox')}</strong>{window.t('capture_foot_b')}
        </span>
      </div>
    </div>
  );
}

const navBar = { position:'relative', zIndex:50, flex:'none', height:60,
  display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap:16,
  padding:'0 22px', borderBottom:'1px solid var(--hair-soft)',
  background:'oklch(0.985 0.004 95 / 0.7)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)' };
const brandBtt = { display:'flex', alignItems:'center', gap:9, border:'none', background:'transparent', padding:0, justifySelf:'start' };
const tabWrap = { display:'flex', gap:4, padding:4, borderRadius:13, background:'var(--card)', border:'1px solid var(--hair-soft)' };
const searchBox = { display:'flex', alignItems:'center', gap:8, padding:'8px 13px', borderRadius:10,
  border:'1px solid var(--hair)', background:'var(--card)', minWidth:210, whiteSpace:'nowrap', cursor:'pointer' };
const addBtn = { display:'flex', alignItems:'center', gap:7, padding:'9px 15px', borderRadius:11, border:'none',
  background:'var(--ink)', color:'var(--paper)', fontSize:13.5, fontWeight:500, whiteSpace:'nowrap' };

const captureMenu = { position:'absolute', top:'calc(100% + 9px)', right:0, zIndex:100, width:268,
  borderRadius:14, border:'1px solid var(--hair)', background:'var(--card-solid)',
  boxShadow:'0 14px 40px oklch(0.3 0.04 280 / 0.16), 0 2px 8px oklch(0.3 0.04 280 / 0.08)',
  backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', overflow:'hidden', animation:'fadeUp .16s ease' };
const captureRow = { display:'flex', alignItems:'center', gap:11, width:'100%', padding:'8px 8px', borderRadius:9,
  border:'none', background:'transparent', textAlign:'left', cursor:'pointer', transition:'background .14s' };
const captureIcon = { flex:'none', width:30, height:30, borderRadius:8, display:'grid', placeItems:'center',
  background:'var(--card)', border:'1px solid var(--hair-soft)' };
const captureFoot = { display:'flex', gap:9, padding:'11px 14px', borderTop:'1px solid var(--hair-soft)',
  background:'var(--accent-soft)' };

/* ---------- Quick capture metadata + modal ---------- */
const CAPTURE_TINT = { link:'teal', paper:'blue', chat:'amber', voice:'amber', image:'violet', note:'blue' };
const CAPTURE_INPUT = {
  link:  { mode:'input', ph:window.t('ph_link') },
  paper: { mode:'drop',  ph:window.t('ph_paper') },
  chat:  { mode:'area',  ph:window.t('ph_chat') },
  voice: { mode:'drop',  ph:window.t('ph_voice'), mic:true },
  image: { mode:'drop',  ph:window.t('ph_image') },
  note:  { mode:'area',  ph:window.t('ph_note') },
};

function QuickCapture({ typeId, onClose, onSave, onReview }) {
  const meta = CAPTURE_TYPES.find(c=>c.id===typeId) || CAPTURE_TYPES[0];
  const cfg = CAPTURE_INPUT[typeId] || CAPTURE_INPUT.note;
  const tint = SRC_TINT[CAPTURE_TINT[typeId]] || 'var(--glow-blue)';
  const [val, setVal] = useStateApp('');
  const [saved, setSaved] = useStateApp(false);

  const titleFor = ()=>{
    const v = val.trim();
    if(v){ const first = v.split('\n')[0]; return first.length>72 ? first.slice(0,70)+'…' : first; }
    return window.t('qc_untitled', meta.label);
  };
  const save = ()=>{
    onSave({ type:typeId, tint:CAPTURE_TINT[typeId], title:titleFor(),
      meta:window.t('qc_from', meta.label) });
    setSaved(true);
  };
  const again = ()=>{ setVal(''); setSaved(false); };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, display:'grid', placeItems:'center',
      background:'oklch(0.3 0.02 280 / 0.18)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', animation:'fadeUp .25s ease' }}>
      <Frost onClick={e=>e.stopPropagation()} style={{ width:520, maxWidth:'92vw', padding:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 0' }}>
          <div className="mono-label" style={{ display:'flex', alignItems:'center', gap:7 }}>
            <Icon name="inbox" s={14} c="var(--accent)"/> {window.t('qc_to_inbox')}
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-3)', display:'grid', placeItems:'center' }}><Icon name="close" s={16}/></button>
        </div>

        {!saved ? (
          <div style={{ padding:'14px 24px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <span style={{ width:36, height:36, borderRadius:10, display:'grid', placeItems:'center', flex:'none',
                background:'color-mix(in oklab, '+tint+' 16%, transparent)', color:tint }}>
                <Icon name={typeId} s={19}/>
              </span>
              <h2 style={{ margin:0, fontFamily:'var(--sans)', fontWeight:600, fontSize:21, letterSpacing:'-0.01em', color:'var(--ink)' }}>{meta.label}</h2>
            </div>
            <p style={{ margin:'12px 0 0', fontSize:14, lineHeight:1.5, color:'var(--ink-3)' }}>
              {window.t('qc_body')}<strong style={{ color:'var(--ink-2)', fontWeight:600 }}>{window.t('qc_pending_bold')}</strong>{window.t('qc_body_b')}
            </p>

            {cfg.mode==='drop' ? (
              <div style={qcDrop}>
                <Icon name={typeId} s={24} c="var(--ink-4)"/>
                <div style={{ fontSize:13.5, color:'var(--ink-2)', marginTop:9 }}>{cfg.ph}</div>
                <div className="mono-label" style={{ marginTop:6 }}>{cfg.mic?window.t('qc_drop_mic'):window.t('qc_drop_file')}</div>
              </div>
            ) : cfg.mode==='area' ? (
              <textarea autoFocus value={val} onChange={e=>setVal(e.target.value)} placeholder={cfg.ph} style={{ ...qcField, minHeight:104, resize:'vertical' }}/>
            ) : (
              <input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') save(); }} placeholder={cfg.ph} style={qcField}/>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 }}>
              <button onClick={onClose} style={qcGhost}>{window.t('cancel')}</button>
              <button onClick={save} style={qcSolid}><Icon name="inbox" s={15}/> {window.t('save_to_inbox')}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding:'26px 24px 26px', textAlign:'center' }}>
            <div style={{ width:54, height:54, borderRadius:'50%', margin:'0 auto', display:'grid', placeItems:'center',
              background:'radial-gradient(circle, var(--accent-soft), transparent 72%)' }}>
              <Icon name="inbox" s={24} c="var(--accent)"/>
            </div>
            <h2 style={{ margin:'14px 0 0', fontFamily:'var(--sans)', fontWeight:600, fontSize:21, letterSpacing:'-0.01em', color:'var(--ink)' }}>{window.t('qc_saved')}</h2>
            <p style={{ margin:'8px auto 0', maxWidth:380, fontSize:14, lineHeight:1.5, color:'var(--ink-3)' }}>
              {window.t('qc_saved_a')}<strong style={{ color:'var(--ink-2)', fontWeight:600 }}>{window.t('qc_saved_pending')}</strong>{window.t('qc_saved_b')}
            </p>
            <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:22 }}>
              <button onClick={again} style={qcGhost}><Icon name="plus" s={14}/> {window.t('capture_another')}</button>
              <button onClick={onReview} style={qcSolid}><Icon name="inbox" s={15}/> {window.t('review_inbox')}</button>
            </div>
          </div>
        )}
      </Frost>
    </div>
  );
}

const qcField = { width:'100%', marginTop:16, padding:'13px 15px', borderRadius:12, border:'1px solid var(--hair)',
  background:'var(--card-solid)', fontFamily:'var(--sans)', fontSize:15, color:'var(--ink)', outline:'none' };
const qcDrop = { marginTop:16, padding:'28px 20px', borderRadius:14, border:'1.5px dashed var(--ink-4)',
  background:'var(--card)', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' };
const qcSolid = { display:'inline-flex', alignItems:'center', gap:7, padding:'11px 18px', borderRadius:11, border:'none', background:'var(--ink)', color:'var(--paper)', fontSize:14, fontWeight:500 };
const qcGhost = { display:'inline-flex', alignItems:'center', gap:6, padding:'11px 18px', borderRadius:11, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-2)', fontSize:14, fontWeight:500 };

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
