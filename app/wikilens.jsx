/* ============================================================
   LUMEN — Wiki lenses
   One entry, two ways of looking at it:
     • GLOBAL  — the whole personal encyclopedia (panoramic)
     • MAP     — through one Expert Map / question (local)
   These are NOT two wikis. Same entry, two frames around it.
   ============================================================ */
const { useState:useStateWL, useMemo:useMemoWL } = React;

function effWL(node, litMap){ return node ? Math.min(1, node.explored + ((litMap||{})[node.id]||0)) : 0; }
function levelWL(e){ return e>.7?window.t('lvl_well'): e>.4?window.t('lvl_light'): e>.18?window.t('lvl_begun'):window.t('lvl_unexplored'); }

/* ============================================================
   LENS SWITCHER — the hinge between the two views.
   Designed to read as "same entry, swap the frame", never as two wikis.
   ============================================================ */
function LensSwitcher({ lens, setLens, maps, lensMapId }) {
  const hasMap = maps.length > 0;
  const targetMap = (maps.find(m=>m.id===lensMapId) || maps[0]);
  return (
    <div style={wls.switchWrap}>
      <div style={wls.switchPill} role="tablist" aria-label="Viewing lens">
        <button role="tab" aria-selected={lens==='map'} disabled={!hasMap}
          onClick={()=> hasMap && setLens('map', targetMap.id)}
          style={{ ...wls.switchSeg, ...(lens==='map'?wls.switchOn:null), opacity:hasMap?1:0.4, cursor:hasMap?'pointer':'not-allowed' }}>
          <Icon name="map" s={14} c={lens==='map'?'var(--ink)':'var(--ink-3)'}/> {window.t('through_question')}
        </button>
        <button role="tab" aria-selected={lens==='global'}
          onClick={()=>setLens('global')}
          style={{ ...wls.switchSeg, ...(lens==='global'?wls.switchOn:null) }}>
          <Icon name="library" s={14} c={lens==='global'?'var(--ink)':'var(--ink-3)'}/> {window.t('across_wiki')}
        </button>
      </div>
      <span style={wls.switchHint}>{window.t('same_entry')}{lens==='map'?window.t('local_lens'):window.t('panoramic_lens')}</span>
    </div>
  );
}

/* ============================================================
   GLOBAL LENS HEADER — light context strip above the article
   The Wiki is panoramic only: this entry's place across everything
   you know. (No lens switcher — there is just one encyclopedia.)
   ============================================================ */
function GlobalLensHeader({ entry }) {
  const links = LX.linksFromEntry(entry).length;
  const back = (entry.backlinks||[]).filter(id=>LX.ENTRY_BY[id]).length;
  const srcs = LX.sourcesForEntry(entry.id).length;
  const maps = LX.mapsForEntry(entry);
  return (
    <div style={{ maxWidth:680, margin:'0 auto 26px' }}>
      <div style={wls.gCtx}>
        <Icon name="library" s={15} c="var(--ink-3)"/>
        <span style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.4 }}>
          {window.t('place_across_a')}{window.t('place_across_b', maps.length, links+back, srcs)}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   MAP LENS HEADER — "Viewing through: <question>"
   The local frame: which question you're reading this entry inside of.
   ============================================================ */
function MapLensHeader({ map, entry, litMap, lens, setLens, maps, lensMapId, onBackToMap, onAddSource }) {
  const ref = LX.nodeRefInMap(entry, map.id);
  const node = ref ? map.nodes.find(n=>n.id===ref.node) : null;
  const region = node ? map.clusters[node.cluster] : null;
  const cov = Math.round(effWL(node, litMap)*100);
  const hue = hueColor(map.accentHue);
  return (
    <div style={{ maxWidth:680, margin:'0 auto 26px' }}>
      <LensSwitcher lens={lens} setLens={setLens} maps={maps} lensMapId={lensMapId} />
      <div style={{ ...wls.mCtx, borderColor:`color-mix(in oklab, ${hue} 38%, var(--hair))`,
        background:`color-mix(in oklab, ${hue} 7%, var(--card))` }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:13 }}>
          <span style={{ width:11, height:11, borderRadius:'50%', flex:'none', marginTop:5,
            background:`radial-gradient(circle at 40% 35%, ${hue}, transparent 72%)`,
            boxShadow:`0 0 10px 0 color-mix(in oklab, ${hue} 60%, transparent)` }}/>
          <div style={{ minWidth:0, flex:1 }}>
            <div className="mono-label" style={{ color:`color-mix(in oklab, ${hue} 55%, var(--ink-3))` }}>{window.t('viewing_through')}</div>
            <div style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:25, lineHeight:1.12, color:'var(--ink)', marginTop:3, textWrap:'pretty' }}
              dangerouslySetInnerHTML={{ __html: map.question }} />
            {region && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:9, flexWrap:'wrap' }}>
                <span style={wls.regionChip}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:`radial-gradient(circle, ${hueColor(region.hue)}, transparent 72%)` }}/>
                  {region.label}
                </span>
                <span style={{ fontFamily:'var(--mono)', fontSize:10.5, letterSpacing:'.06em', color:'var(--ink-3)' }}>
                  {window.t('lit_in_map', cov)}
                </span>
              </div>
            )}
          </div>
          <button onClick={onBackToMap} style={wls.backChip}>
            <Icon name="back" s={14}/> {window.t('back_to_map')}
          </button>
        </div>
        <p style={{ margin:'13px 0 0', fontSize:13, lineHeight:1.5, color:'var(--ink-2)' }}>
          {window.t('reading_as_part_a')}<em className="serif-em" dangerouslySetInnerHTML={{ __html: map.question }} />{window.t('reading_as_part_b')}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   MAP LENS SIDEBAR — the "smaller wiki dedicated to the question"
   Only the entries that live inside this map, grouped by its regions.
   ============================================================ */
function MapLensSidebar({ map, litMap, activeEntryId, onOpenEntry, onBackToMap }) {
  const [q, setQ] = useStateWL('');
  const regions = useMemoWL(()=>LX.entriesForMapByRegion(map.id), [map.id]);
  const all = useMemoWL(()=>regions.flatMap(r=>r.items), [regions]);
  const s = q.trim().toLowerCase();
  const filtered = s ? all.filter(it=>(it.entry.title+' '+it.entry.subtitle).toLowerCase().includes(s)) : null;
  const hue = hueColor(map.accentHue);

  return (
    <aside style={{ position:'relative', zIndex:2, borderRight:'1px solid var(--hair-soft)',
      background:'var(--paper-deep)', display:'flex', flexDirection:'column', minHeight:0 }}>
      <div style={{ padding:'22px 16px 12px' }}>
        <button onClick={onBackToMap} style={wls.sideBack}>
          <Icon name="back" s={15}/> {window.t('back_to_map')}
        </button>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginTop:14, padding:'0 3px' }}>
          <span style={{ width:11, height:11, borderRadius:'50%', flex:'none', marginTop:5,
            background:`radial-gradient(circle at 40% 35%, ${hue}, transparent 72%)`,
            boxShadow:`0 0 9px 0 color-mix(in oklab, ${hue} 55%, transparent)` }}/>
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:19, lineHeight:1.12, color:'var(--ink)', textWrap:'pretty' }}>{map.title}</div>
            <div className="mono-label" style={{ marginTop:4 }}>{window.t('map_wiki', all.length)}</div>
          </div>
        </div>
        <div style={wls.sideSearch}>
          <Icon name="search" s={15} c="var(--ink-4)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder={window.t('search_this_question')} style={wls.sideSearchInput}/>
        </div>
      </div>

      <nav style={{ flex:1, overflowY:'auto', padding:'2px 8px 18px' }}>
        {filtered ? (
          <div style={{ padding:'4px 6px' }}>
            <div className="mono-label" style={{ marginBottom:8 }}>{window.t('n_results', filtered.length)}</div>
            {filtered.map(it=> <MapEntryRow key={it.entry.id} it={it} litMap={litMap} active={it.entry.id===activeEntryId} onClick={()=>onOpenEntry(it.entry.id)} />)}
            {filtered.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', fontStyle:'italic', fontFamily:'var(--serif)', padding:'8px 6px' }}>{window.t('nothing_in_map', q)}</div>}
          </div>
        ) : regions.map(r=>(
          <div key={r.key} style={{ marginBottom:10 }}>
            <div style={wls.regionHead}>
              <span style={{ width:8, height:8, borderRadius:'50%', flex:'none',
                background:`radial-gradient(circle, ${hueColor(r.hue)}, transparent 72%)` }}/>
              {r.label}
              <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:9.5, color:'var(--ink-4)' }}>{r.items.length}</span>
            </div>
            {r.items.map(it=> <MapEntryRow key={it.entry.id} it={it} litMap={litMap} active={it.entry.id===activeEntryId} onClick={()=>onOpenEntry(it.entry.id)} />)}
          </div>
        ))}
      </nav>

      <div style={{ padding:'13px 18px', borderTop:'1px solid var(--hair-soft)' }}>
        <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.5 }}>
          {window.t('focused_slice')}
        </div>
      </div>
    </aside>
  );
}

function MapEntryRow({ it, litMap, active, onClick }) {
  const { entry:e, node } = it;
  const cov = effWL(node, litMap);
  const on = cov>0.18;
  return (
    <button onClick={onClick} style={{ width:'100%', display:'flex', alignItems:'flex-start', gap:9, textAlign:'left',
      padding:'7px 9px', borderRadius:8, border:'none', marginBottom:1,
      background: active?'var(--card)':'transparent',
      borderLeft:'2px solid '+(active?'var(--accent)':'transparent') }}
      onMouseEnter={ev=>{ if(!active) ev.currentTarget.style.background='var(--card)'; }}
      onMouseLeave={ev=>{ if(!active) ev.currentTarget.style.background='transparent'; }}>
      <span style={{ flex:'none', marginTop:3, width:8, height:8, borderRadius:'50%',
        background: on?`radial-gradient(circle, ${hueColor(node?node.hue:'blue')}, transparent 72%)`:'var(--glow-dim)',
        opacity: on?Math.min(1,0.4+cov*0.7):0.6 }}/>
      <span style={{ minWidth:0, display:'flex', flexDirection:'column', gap:2 }}>
        <span style={{ fontSize:13, lineHeight:1.3, color: active?'var(--ink)':'var(--ink-2)', fontWeight:active?600:400, textWrap:'pretty' }}>{e.title}</span>
        <span className="mono-label" style={{ fontSize:8.5, color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}>
          {e.type==='question'?window.t('open_question_tag'):e.type==='moc'?window.t('moc_tag'):''}{window.t('pct_lit', Math.round(cov*100))}
        </span>
      </span>
    </button>
  );
}

/* ============================================================
   MAP LENS META (right rail) — how this entry answers the question
   ============================================================ */
function MapLensMeta({ map, entry, litMap, hiCite, srcRefs, onOpenEntry, onGotoMapNode, onAddSource, onOpenSource }) {
  const ref = LX.nodeRefInMap(entry, map.id);
  const node = ref ? map.nodes.find(n=>n.id===ref.node) : null;
  const region = node ? map.clusters[node.cluster] : null;
  const cov = effWL(node, litMap);
  const stats = LX.mapStats(map, litMap);
  const srcs = LX.sourcesForEntry(entry.id);

  const neighbors = useMemoWL(()=>{
    if(!node) return [];
    const ids = new Set();
    map.links.forEach(([a,b])=>{ if(a===node.id) ids.add(b); if(b===node.id) ids.add(a); });
    return [...ids].map(id=>map.nodes.find(n=>n.id===id)).filter(Boolean)
      .map(n=>({ n, entry:LX.entryForNode(map.id, n.id), cov:effWL(n, litMap) }))
      .sort((a,b)=>b.cov-a.cov);
  },[node, map, litMap]);

  return (
    <>
      <button onClick={()=>onAddSource(node?node.id:null)} style={wls.addToMap}>
        <Icon name="plus" s={16}/> {window.t('add_to_map')}
      </button>

      {/* place in the question */}
      <div style={{ marginTop:22 }}>
        <div className="mono-label" style={{ marginBottom:11 }}>{window.t('concept_in_map')}</div>
        <div style={wls.placeCard}>
          {region && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:11 }}>
              <span style={{ width:9, height:9, borderRadius:'50%', flex:'none',
                background:`radial-gradient(circle, ${hueColor(region.hue)}, transparent 72%)` }}/>
              <span style={{ fontSize:12.5, color:'var(--ink-2)', fontWeight:500 }}>{region.label}</span>
              <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-3)' }}>{levelWL(cov)}</span>
            </div>
          )}
          <CoverageBar pct={Math.max(4,cov*100)} hue={node?node.hue:'blue'} />
          <div style={{ marginTop:9, fontSize:12.5, color:'var(--ink-3)', lineHeight:1.45 }}>
            {window.t('drawn_from_pre')}<strong style={wls.b}>{node?node.sources:0}</strong> {window.t('drawn_feeding', node?node.sources:0)}
          </div>
        </div>
        <div style={wls.progressRow}>
          <span style={{ fontSize:12, color:'var(--ink-3)' }}>{window.t('whole_map')}</span>
          <span style={{ flex:1 }}><CoverageBar pct={stats.pct} hue={map.accentHue} height={4} /></span>
          <span style={{ fontFamily:'var(--mono)', fontSize:10.5, color:'var(--ink-2)' }}>{stats.pct}%</span>
        </div>
      </div>

      {/* neighbours within this question */}
      {neighbors.length>0 && (
        <div style={{ marginTop:24 }}>
          <div className="mono-label" style={{ marginBottom:11 }}>{window.t('connected_in_q')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {neighbors.slice(0,7).map(({n, entry:ne, cov:c})=>(
              <button key={n.id} onClick={()=> ne ? onOpenEntry(ne.id) : onGotoMapNode(map.id, n.id)} style={wls.neighborRow}
                onMouseEnter={e=>e.currentTarget.style.background='var(--card)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{ flex:'none', width:8, height:8, borderRadius:'50%',
                  background: c>0.18?`radial-gradient(circle, ${hueColor(n.hue)}, transparent 72%)`:'var(--glow-dim)',
                  opacity: c>0.18?Math.min(1,0.4+c*0.7):0.6 }}/>
                <span style={{ flex:1, minWidth:0, fontSize:13, color:'var(--ink-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{n.label}</span>
                {ne
                  ? <span style={{ flex:'none', color:'var(--ink-4)' }}><Icon name="arrow" s={13}/></span>
                  : <span className="mono-label" style={{ flex:'none', fontSize:8 }}>{window.t('tag_map')}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* sources feeding this in the question */}
      {srcs.length>0 && (
        <div style={{ marginTop:24 }}>
          <div className="mono-label" style={{ marginBottom:11 }}>{window.t('sources_behind', srcs.length)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {srcs.map(sx=>(
              <button key={sx.id} onClick={()=>onOpenSource&&onOpenSource(sx.id)} ref={el=>{ if(srcRefs) srcRefs.current[sx.n]=el; }} style={{ ...wls.srcRow,
                border:'1px solid '+((hiCite===sx.n)?'var(--accent)':'var(--hair-soft)'),
                background:(hiCite===sx.n)?'var(--accent-soft)':'var(--card)',
                boxShadow:(hiCite===sx.n)?'0 0 0 3px var(--accent-soft)':'none', transition:'all .3s' }}>
                <span style={{ width:28, height:28, borderRadius:8, flex:'none', display:'grid', placeItems:'center',
                  background:'color-mix(in oklab, '+SRC_TINT[sx.tint]+' 16%, transparent)', color:SRC_TINT[sx.tint] }}>
                  <Icon name={sx.type} s={15}/>
                </span>
                <span style={{ minWidth:0, display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontFamily:'var(--mono)', fontSize:9.5, color:'var(--ink-4)' }}>[{sx.n}]</span>
                    <span style={{ fontSize:12.5, color:'var(--ink)', lineHeight:1.3, fontWeight:500, textWrap:'pretty' }}>{sx.title}</span>
                  </span>
                  <span style={{ fontSize:11, color:'var(--ink-3)' }}>{sx.meta}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const wls = {
  b:{ color:'var(--ink-2)', fontWeight:600 },
  switchWrap:{ display:'flex', alignItems:'center', gap:12, marginBottom:14, flexWrap:'wrap' },
  switchPill:{ display:'inline-flex', padding:4, gap:3, borderRadius:12, background:'var(--card)', border:'1px solid var(--hair)' },
  switchSeg:{ display:'inline-flex', alignItems:'center', gap:7, padding:'7px 13px', borderRadius:9, border:'none',
    background:'transparent', color:'var(--ink-3)', fontSize:13, fontWeight:500, fontFamily:'var(--sans)', transition:'all .18s' },
  switchOn:{ background:'var(--card-solid)', color:'var(--ink)', fontWeight:600,
    boxShadow:'0 1px 3px oklch(0.3 0.04 280 / 0.12), 0 0 0 1px var(--hair)' },
  switchHint:{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-4)' },

  gCtx:{ display:'flex', alignItems:'flex-start', gap:11, padding:'13px 16px', borderRadius:13,
    border:'1px solid var(--hair-soft)', background:'var(--card)' },

  mCtx:{ padding:'17px 19px', borderRadius:16, border:'1px solid var(--hair)' },
  regionChip:{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 11px', borderRadius:18,
    border:'1px solid var(--hair)', background:'var(--card-solid)', fontSize:12, color:'var(--ink-2)', fontWeight:500 },
  backChip:{ flex:'none', display:'inline-flex', alignItems:'center', gap:6, padding:'8px 13px', borderRadius:10,
    border:'1px solid var(--hair)', background:'var(--card-solid)', color:'var(--ink-2)', fontSize:12.5, fontWeight:500 },

  sideBack:{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:11,
    border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-2)', fontSize:13, fontWeight:500 },
  sideSearch:{ display:'flex', alignItems:'center', gap:8, marginTop:13, padding:'9px 12px', borderRadius:10,
    border:'1px solid var(--hair)', background:'var(--card)' },
  sideSearchInput:{ flex:1, border:'none', background:'transparent', outline:'none', fontFamily:'var(--sans)', fontSize:13, color:'var(--ink)', minWidth:0 },
  regionHead:{ display:'flex', alignItems:'center', gap:9, padding:'7px 8px 7px 9px', fontSize:11,
    fontFamily:'var(--mono)', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-3)', fontWeight:500 },

  addToMap:{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
    padding:'12px', borderRadius:12, border:'1px dashed var(--ink-4)', background:'var(--card)',
    color:'var(--ink)', fontSize:14, fontWeight:500 },
  placeCard:{ padding:'14px 15px', borderRadius:12, border:'1px solid var(--hair-soft)', background:'var(--card)' },
  progressRow:{ display:'flex', alignItems:'center', gap:10, marginTop:10, padding:'0 2px' },
  neighborRow:{ display:'flex', alignItems:'center', gap:9, width:'100%', textAlign:'left', padding:'7px 8px',
    borderRadius:8, border:'none', background:'transparent', transition:'background .14s' },
  srcRow:{ display:'flex', gap:10, padding:'9px 10px', borderRadius:10, width:'100%', textAlign:'left',
    border:'1px solid var(--hair-soft)', background:'var(--card)' },
};

Object.assign(window, { LensSwitcher, GlobalLensHeader, MapLensHeader, MapLensSidebar, MapLensMeta });
