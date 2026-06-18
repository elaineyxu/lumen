/* ============================================================
   LUMEN — Atlas (all Expert Maps)
   Left sidebar (maps · search · create) + active map
   ============================================================ */
const { useState:useStateAt, useMemo:useMemoAt } = React;

function Atlas({ data, litMap, litByMap, lineStyle, activeMapId, setActiveMapId,
                selected, setSelected, onOpenEntry,
                onGotoMapNode, onOpenSource, onAddSource, onCreateMap,
                onRenameMap, onDeleteMap, onReviseMap }) {
  const { MAPS } = data;
  const [q, setQ] = useStateAt('');
  const activeMap = MAPS.find(m=>m.id===activeMapId) || MAPS[0];

  const filtered = useMemoAt(()=>{
    const s = q.trim().toLowerCase();
    if(!s) return MAPS;
    return MAPS.filter(m => (m.title+' '+m.domain).toLowerCase().includes(s));
  },[q, MAPS]);

  return (
    <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'288px minmax(0,1fr)', background:'var(--paper)' }}>
      {/* ---- sidebar ---- */}
      <aside style={{ position:'relative', zIndex:2, borderRight:'1px solid var(--hair-soft)',
        background:'var(--paper-deep)', display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{ padding:'22px 18px 14px' }}>
          <div className="mono-label" style={{ marginBottom:12 }}>{window.t('atlas_n_maps', MAPS.length)}</div>
          <button onClick={onCreateMap} style={createMapBtn}>
            <span style={{ width:22, height:22, borderRadius:7, background:'var(--paper)', display:'grid', placeItems:'center', flex:'none' }}>
              <Icon name="plus" s={15} c="var(--ink)"/>
            </span>
            {window.t('create_new_map')}
          </button>
          <div style={atlasSearch}>
            <Icon name="search" s={15} c="var(--ink-4)"/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder={window.t('search_maps')} style={atlasSearchInput}/>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'2px 10px 18px' }}>
          {filtered.map(m=>{ const st=LX.mapStats(m, m.id===activeMapId?litMap:{}); const on=m.id===activeMapId; const manageable=m.seedMeta && m.seedMeta.generatedBy === 'mapSeeder'; return (
            <div key={m.id}
              style={{ ...mapRow, background:on?'var(--card-solid)':'transparent',
                boxShadow:on?'0 1px 3px oklch(0.3 0.04 280 / 0.10), 0 0 0 1px var(--hair)':'none' }}
              onMouseEnter={e=>{ if(!on) e.currentTarget.style.background='var(--card)'; }}
              onMouseLeave={e=>{ if(!on) e.currentTarget.style.background='transparent'; }}>
              <button onClick={()=>{ setActiveMapId(m.id); setSelected(null); }} style={mapRowMain}>
                <span style={{ width:10, height:10, borderRadius:'50%', flex:'none', marginTop:4,
                  background:`radial-gradient(circle at 40% 35%, ${hueColor(m.accentHue)}, transparent 72%)`,
                  boxShadow:`0 0 8px 0 color-mix(in oklab, ${hueColor(m.accentHue)} 55%, transparent)` }}/>
                <span style={{ minWidth:0, flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                  <span style={{ fontSize:13.5, fontWeight: on?600:500, color:'var(--ink)', lineHeight:1.25, textWrap:'pretty' }}>{m.title}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="mono-label" style={{ fontSize:9 }}>{m.domain}</span>
                    <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--ink-4)' }}/>
                    <span style={{ fontFamily:'var(--mono)', fontSize:9.5, color:'var(--ink-3)' }}>{st.pct}%</span>
                  </span>
                </span>
              </button>
              {manageable && (
                <span style={mapActions}>
                  <button title={window.t('rename_map')} onClick={()=>onRenameMap && onRenameMap(m.id)} style={mapActionBtn}><Icon name="pen" s={13}/></button>
                  <button title={window.t('delete_map')} onClick={()=>onDeleteMap && onDeleteMap(m.id)} style={mapActionBtn}><Icon name="trash" s={13}/></button>
                </span>
              )}
            </div>
          );})}
          {filtered.length===0 && <div style={{ padding:'18px 12px', fontSize:13, color:'var(--ink-3)', fontStyle:'italic', fontFamily:'var(--serif)' }}>{MAPS.length ? window.t('no_maps_match', q) : 'No maps yet.'}</div>}
        </div>

        <div style={{ padding:'14px 18px', borderTop:'1px solid var(--hair-soft)' }}>
          <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.5 }}>
            {window.t('atlas_foot')}
          </div>
        </div>
      </aside>

      {/* ---- map area ---- */}
      <div style={{ position:'relative', minWidth:0 }}>
        {activeMap ? (
          <ExpertMap map={activeMap} litMap={activeMap.id===activeMapId?litMap:{}} lineStyle={lineStyle}
            selected={selected} setSelected={setSelected}
            onOpenEntry={onOpenEntry} onAddSource={onAddSource} onReviseMap={onReviseMap} />
        ) : (
          <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:'var(--paper)' }}>
            <div style={{ textAlign:'center', maxWidth:360 }}>
              <Icon name="atlas" s={34} c="var(--ink-4)"/>
              <h2 style={{ margin:'14px 0 0', fontFamily:'var(--serif)', fontStyle:'italic', fontWeight:400, fontSize:28, color:'var(--ink)' }}>Start with a question</h2>
              <p style={{ margin:'8px 0 0', fontSize:14, lineHeight:1.55, color:'var(--ink-3)' }}>Your formal workspace is empty until you create a map or add a source.</p>
              <button onClick={onCreateMap} style={{ ...createMapBtn, width:'auto', display:'inline-flex', marginTop:18, padding:'10px 16px' }}>
                <Icon name="plus" s={15}/> {window.t('create_new_map')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const createMapBtn = { width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:11,
  border:'none', background:'var(--ink)', color:'var(--paper)', fontSize:13.5, fontWeight:500, textAlign:'left' };
const atlasSearch = { display:'flex', alignItems:'center', gap:8, marginTop:12, padding:'9px 12px', borderRadius:10,
  border:'1px solid var(--hair)', background:'var(--card)' };
const atlasSearchInput = { flex:1, border:'none', background:'transparent', outline:'none', fontFamily:'var(--sans)',
  fontSize:13, color:'var(--ink)', minWidth:0 };
const mapRow = { width:'100%', display:'flex', alignItems:'stretch', gap:5, padding:'7px 8px', borderRadius:11,
  border:'none', textAlign:'left', marginBottom:2, transition:'background .15s' };
const mapRowMain = { flex:1, minWidth:0, display:'flex', gap:11, alignItems:'flex-start', padding:'4px 4px',
  border:'none', background:'transparent', textAlign:'left', cursor:'pointer' };
const mapActions = { flex:'none', display:'flex', alignItems:'center', gap:3, alignSelf:'center' };
const mapActionBtn = { width:28, height:28, borderRadius:8, border:'1px solid var(--hair)', background:'var(--card)',
  color:'var(--ink-3)', display:'grid', placeItems:'center' };

window.Atlas = Atlas;
