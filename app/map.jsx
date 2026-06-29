/* ============================================================
   LUMEN — Expert Map view (renders any map object)
   ============================================================ */
const { useState:useStateM, useRef:useRefM, useEffect:useEffectM, useMemo:useMemoM } = React;

function effExplored(node, litMap){
  return Math.min(1, node.explored + (litMap[node.id]||0));
}

function ExpertMap({ map, litMap, lineStyle, onOpenEntry, onAddSource, onReviseMap, selected, setSelected }) {
  const { nodes:NODES, links:LINKS, clusters:CLUSTERS } = map;
  const wrapRef = useRefM(null);
  const dragRef = useRefM(null);
  const suppressClickRef = useRefM(false);
  const [dim, setDim] = useStateM({ w:1200, h:760 });
  const [hover, setHover] = useStateM(null);
  const [hidden, setHidden] = useStateM(()=>new Set());   // category toggles
  const [diagOpen, setDiagOpen] = useStateM(false);       // expand coverage breakdown
  const [viewport, setViewport] = useStateM({ x:0, y:0, scale:1 });
  const [panning, setPanning] = useStateM(false);
  const [revisionPrompt, setRevisionPrompt] = useStateM('');
  const [revising, setRevising] = useStateM(false);
  const [reviseError, setReviseError] = useStateM('');
  const byId = useMemoM(()=>Object.fromEntries(NODES.map(n=>[n.id,n])), [NODES]);

  // reset toggles & selection when the map changes
  useEffectM(()=>{
    setHidden(new Set());
    setSelected(null);
    setViewport({ x:0, y:0, scale:1 });
    setRevisionPrompt('');
    setReviseError('');
  }, [map.id]);

  useEffectM(()=>{
    const el = wrapRef.current; if(!el) return;
    const ro = new ResizeObserver(()=>{ const r = el.getBoundingClientRect(); setDim({ w:r.width, h:r.height }); });
    ro.observe(el); return ()=>ro.disconnect();
  },[]);

  const px = (n)=>({ x: n.x/100*dim.w, y: n.y/100*dim.h });
  const visible = (n)=>!hidden.has(n.cluster);
  const focus = selected || hover;
  const connected = useMemoM(()=>{
    if(!focus) return null;
    const s = new Set([focus]);
    LINKS.forEach(([a,b])=>{ if(a===focus) s.add(b); if(b===focus) s.add(a); });
    return s;
  },[focus, LINKS]);

  const stats = LX.mapStats(map, litMap);
  const diag = LX.diagnosis(map, litMap);
  const dash = { solid:'none', dash:'5 7', dot:'1.5 7' };
  const selNode = selected ? byId[selected] : null;
  const toggleCluster = (k)=> setHidden(prev=>{ const s=new Set(prev); s.has(k)?s.delete(k):s.add(k); return s; });
  const canRevise = Boolean(map.seedMeta && map.seedMeta.generatedBy === 'mapSeeder' && onReviseMap);
  const layoutReason = map.layoutReason || window.t('map_reason_fallback');
  const quality = map.seedMeta && map.seedMeta.quality;
  const qualityIssues = quality && Array.isArray(quality.issues) ? quality.issues.slice(0, 3) : [];
  const qualityTone = quality && quality.confidence === 'high' ? 'var(--glow-teal)'
    : quality && quality.confidence === 'medium' ? 'var(--glow-amber)'
      : 'var(--glow-coral)';
  const viewportTransform = `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`;
  const diagnosisBottom = selNode ? 252 : 24;

  const isMapUiTarget = (target)=>{
    if(!target || !target.closest) return false;
    return Boolean(target.closest('button,input,textarea,a,[data-map-ui],[data-map-node]'));
  };
  const handlePointerDown = (e)=>{
    if((e.button !== undefined && e.button !== 0) || isMapUiTarget(e.target)) return;
    dragRef.current = { id:e.pointerId, x:e.clientX, y:e.clientY, moved:false };
    setPanning(true);
    if(e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e)=>{
    const drag = dragRef.current;
    if(!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if(Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    setViewport(v=>({ ...v, x:v.x+dx, y:v.y+dy }));
  };
  const finishPointer = (e)=>{
    const drag = dragRef.current;
    if(drag && drag.id === e.pointerId && drag.moved){
      suppressClickRef.current = true;
      window.setTimeout(()=>{ suppressClickRef.current = false; }, 0);
    }
    dragRef.current = null;
    setPanning(false);
    if(e.currentTarget.releasePointerCapture) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(_err) {}
    }
  };
  const handleWheel = (e)=>{
    if(isMapUiTarget(e.target)) return;
    e.preventDefault();
    const el = wrapRef.current; if(!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setViewport(v=>{
      const nextScale = Math.max(0.62, Math.min(1.85, v.scale * factor));
      const wx = (mx - v.x) / v.scale;
      const wy = (my - v.y) / v.scale;
      return { scale:nextScale, x:mx - wx*nextScale, y:my - wy*nextScale };
    });
  };
  const resetViewport = ()=>setViewport({ x:0, y:0, scale:1 });
  const submitRevision = ()=>{
    const prompt = revisionPrompt.trim();
    if(!prompt || !canRevise || revising) return;
    setRevising(true);
    setReviseError('');
    Promise.resolve(onReviseMap(map.id, prompt))
      .then(()=>{ setRevisionPrompt(''); })
      .catch(err=>setReviseError((err && err.message) || 'Map revision failed'))
      .finally(()=>setRevising(false));
  };

  // atmospheric blobs from cluster centroids
  const fieldBlobs = useMemoM(()=>{
    const groups = {};
    NODES.forEach(n=>{ if(hidden.has(n.cluster)) return; (groups[n.cluster] = groups[n.cluster]||[]).push(n); });
    return Object.entries(groups).map(([c, ns])=>{
      const ax = ns.reduce((s,n)=>s+n.x,0)/ns.length;
      const ay = ns.reduce((s,n)=>s+n.y,0)/ns.length;
      const cov = ns.reduce((s,n)=>s+effExplored(n,litMap),0)/ns.length;
      return { x:ax, y:ay, r:46, hue:CLUSTERS[c].hue, o:0.10+cov*0.16, dur:30+Math.random()*10,
               dx:(Math.random()*4-2)+'%', dy:(Math.random()*4-2)+'%' };
    });
  },[NODES, litMap, CLUSTERS, hidden]);

  return (
    <div ref={wrapRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onWheel={handleWheel}
      style={{ position:'absolute', inset:0, overflow:'hidden', background:'var(--paper)', touchAction:'none', cursor:panning?'grabbing':'grab' }}>
      <GlowField blobs={fieldBlobs} />

      <div style={{ position:'absolute', inset:0, zIndex:1, transform:viewportTransform, transformOrigin:'0 0', willChange:'transform' }}>
        {/* connection lines */}
        <svg width={dim.w} height={dim.h} style={{ position:'absolute', inset:0, zIndex:5, pointerEvents:'none', overflow:'visible' }}>
          {LINKS.map(([a,b,st],i)=>{
            const na=byId[a], nb=byId[b]; if(!na||!nb) return null;
            if(hidden.has(na.cluster)||hidden.has(nb.cluster)) return null;
            const pa=px(na), pb=px(nb);
            const ea=effExplored(na,litMap), eb=effExplored(nb,litMap);
            const both=(ea>.18&&eb>.18);
            const isFoc = connected && (a===focus||b===focus);
            const op = isFoc? 0.5 : (both? 0.20 : 0.10);
            return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={isFoc? 'var(--accent)':'var(--ink-2)'}
              strokeWidth={isFoc?1.1:0.8}
              strokeDasharray={dash[lineStyle==='auto'? st : lineStyle] ?? dash[st]}
              opacity={op} style={{ transition:'opacity .3s, stroke .3s' }} />;
          })}
        </svg>

        {/* nodes */}
        {NODES.map(n=> visible(n) && (
          <NodeBlob key={n.id} node={n} lit={litMap[n.id]||0}
            active={selected===n.id}
            dimmed={connected && !connected.has(n.id)}
            onHover={setHover}
            onClick={()=>{
              if(suppressClickRef.current) return;
              setSelected(selected===n.id? null : n.id);
            }} />
        ))}
      </div>

      {/* header */}
      <div style={{ position:'absolute', top:24, left:30, zIndex:40, maxWidth:440, pointerEvents:'none' }}>
        <div className="mono-label" style={{ marginBottom:8 }}>{map.domain} · {window.t('guiding_question')}</div>
        <h1 style={{ margin:0, fontFamily:'var(--serif)', fontWeight:400, fontSize:32, lineHeight:1.1, letterSpacing:'-0.01em', color:'var(--ink)' }}
          dangerouslySetInnerHTML={{ __html: map.question }} />
      </div>

      {/* diagnosis panel */}
      <div data-map-ui style={{ position:'absolute', top:24, right:28, bottom:diagnosisBottom, zIndex:40, width:326, overflowY:'auto', cursor:'default' }}>
        <Frost style={{ padding:'15px 16px' }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', justifyContent:'space-between' }}>
            <div style={{ minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }} className="mono-label">
                <Icon name="compass" s={12} c="var(--accent)"/> {window.t('map_layout')}
              </div>
              <div style={{ fontSize:12.5, lineHeight:1.5, color:'var(--ink-2)' }}>{layoutReason}</div>
              {quality && (
                <div style={qualityWrap}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                    <span style={{ ...qualityPill, borderColor:qualityTone }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:qualityTone }}/>
                      {window.t('map_quality')}: {window.t('map_quality_' + quality.confidence)}
                    </span>
                    {typeof quality.score === 'number' && (
                      <span className="mono-label" style={{ fontSize:8.5, color:'var(--ink-4)' }}>{quality.score}/100</span>
                    )}
                  </div>
                  {qualityIssues.length > 0 && (
                    <div style={{ marginTop:7, display:'flex', flexDirection:'column', gap:4 }}>
                      {qualityIssues.map((issue, index)=>(
                        <div key={(issue.code||'issue')+index} style={qualityIssue}>
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={resetViewport} title={window.t('reset_map_view')} style={viewResetBtn}>
              <Icon name="compass" s={14}/>
            </button>
          </div>

          <div style={{ marginTop:13, paddingTop:12, borderTop:'1px solid var(--hair-soft)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span className="mono-label">{window.t('understanding')}</span>
              <span style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:22, color:'var(--ink)' }}>{stats.pct}%</span>
            </div>
            <div style={{ marginTop:8 }}><CoverageBar pct={stats.pct} hue={map.accentHue} /></div>
            <div style={{ marginTop:7, fontSize:12, color:'var(--ink-3)' }}>
              <strong style={{ color:'var(--ink-2)', fontWeight:600 }}>{stats.illum}</strong> {window.t('illum_of', stats.illum, stats.total)}
            </div>
          </div>

          {/* diagnosis sentence (always shown) */}
          <div style={{ marginTop:13, paddingTop:12, borderTop:'1px solid var(--hair-soft)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }} className="mono-label">
              <Icon name="spark" s={12} c="var(--accent)"/> {window.t('lumens_read')}
            </div>
            <div style={{ fontSize:12.5, lineHeight:1.5, color:'var(--ink-2)' }}>
              {stats.illum === 0 ? (
                window.t('dx_no_sources')
              ) : (
                <>
                  {window.t('dx_strong')}<strong style={{ fontWeight:600, color:'var(--ink)' }}>{diag.strongest.label}</strong>{window.t('dx_thin')}<strong style={{ fontWeight:600, color:'var(--ink)' }}>{diag.thinnest.label}</strong>{window.t('dx_end')}
                  {diag.unexplored.length>0 && window.t('dx_dark', diag.unexplored.length)}
                </>
              )}
            </div>
          </div>

          {/* expandable coverage breakdown — rows double as category toggles */}
          {diagOpen && (
            <div style={{ marginTop:13, paddingTop:12, borderTop:'1px solid var(--hair-soft)', display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                <span className="mono-label" style={{ fontSize:9.5 }}>{window.t('coverage_region')}</span>
                <span className="mono-label" style={{ fontSize:8.5, color:'var(--ink-4)' }}>{window.t('tap_toggle')}</span>
              </div>
              {diag.cov.map(c=>{ const off=hidden.has(c.key); return (
                <button key={c.key} onClick={()=>toggleCluster(c.key)} style={{ ...covRow, opacity:off?0.45:1 }}>
                  <span style={{ width:9, height:9, borderRadius:'50%', flex:'none',
                    background: off?'var(--ink-4)':`radial-gradient(circle, ${hueColor(c.hue)}, transparent 72%)` }}/>
                  <span style={{ minWidth:0, flex:1 }}>
                    <span style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                      <span style={{ flex:1, minWidth:0, fontSize:11.5, color:'var(--ink-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.label}</span>
                      <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-3)', flex:'none', marginLeft:8 }}>{off?window.t('hidden'):c.pct+'%'}</span>
                    </span>
                    <CoverageBar pct={off?0:c.pct} hue={c.hue} height={4} />
                  </span>
                </button>
              );})}
              {diag.unexplored[0] && (
                <button onClick={()=>{ setSelected(diag.unexplored[0].id); setHidden(new Set()); }} style={nextQBtn}>
                  <Icon name="arrow" s={13}/>
                  <span style={{ lineHeight:1.35 }}>{window.t('next_illuminate_pre')}<em style={{ fontFamily:'var(--serif)', fontStyle:'italic' }}>{diag.unexplored[0].label}</em></span>
                </button>
              )}
            </div>
          )}

          <button onClick={()=>setDiagOpen(o=>!o)} style={diagToggle}>
            {diagOpen ? window.t('hide_breakdown') : window.t('coverage_region')}
            <span style={{ display:'inline-flex', transform:diagOpen?'rotate(-90deg)':'rotate(90deg)', transition:'transform .2s' }}><Icon name="arrow" s={12}/></span>
          </button>

          {onReviseMap && (
            <div style={{ marginTop:13, paddingTop:12, borderTop:'1px solid var(--hair-soft)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }} className="mono-label">
                <Icon name="pen" s={12} c="var(--accent)"/> {window.t('revise_map_panel')}
              </div>
              <textarea
                value={revisionPrompt}
                onChange={e=>setRevisionPrompt(e.target.value)}
                disabled={!canRevise || revising}
                placeholder={window.t('revise_map_placeholder')}
                style={reviseInput}
                rows={3}
              />
              {reviseError && <div style={{ marginTop:7, fontSize:11.5, lineHeight:1.4, color:'var(--coral, #b45f4d)' }}>{reviseError}</div>}
              <button onClick={submitRevision} disabled={!canRevise || revising || !revisionPrompt.trim()} style={{
                ...reviseBtn,
                opacity:(!canRevise || revising || !revisionPrompt.trim())?0.48:1,
                cursor:(!canRevise || revising || !revisionPrompt.trim())?'not-allowed':'pointer',
              }}>
                {revising ? window.t('revise_map_busy') : window.t('revise_map_button')}
              </button>
            </div>
          )}
        </Frost>
      </div>

      {/* legend */}
      <div style={{ position:'absolute', bottom:24, left:30, zIndex:40 }}>
        <div style={{ display:'flex', alignItems:'center', gap:18, fontSize:12, color:'var(--ink-3)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ width:13, height:13, borderRadius:'50%', background:'radial-gradient(circle, var(--glow-blue), transparent 72%)' }}/>{window.t('legend_covered')}
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ width:13, height:13, borderRadius:'50%', background:'radial-gradient(circle, var(--glow-dim), transparent 72%)' }}/>{window.t('legend_unexplored')}
          </span>
        </div>
      </div>

      {/* selected node detail */}
      {selNode && (
        <div data-map-ui style={{ position:'absolute', bottom:24, right:28, zIndex:45, width:300, animation:'fadeUp .35s ease', cursor:'default' }}>
          <Frost style={{ padding:18 }}>
            <button onClick={()=>setSelected(null)} style={detailClose}><Icon name="close" s={14}/></button>
            <div className="mono-label" style={{ color:hueColor(selNode.hue) }}>{CLUSTERS[selNode.cluster].label}</div>
            <h3 style={{ margin:'7px 0 0', fontFamily:'var(--serif)', fontStyle:'italic', fontWeight:400, fontSize:25, lineHeight:1.1 }}>{selNode.label}</h3>
            {(() => { const e=effExplored(selNode,litMap);
              const lvl = e>.7?window.t('lvl_well'): e>.4?window.t('lvl_light'): e>.18?window.t('lvl_begun'):window.t('lvl_unexplored');
              const lit = e>.18; const eid = LX.entryIdForNode(map.id, selNode.id);
              return (<>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14 }}>
                  <div style={{ flex:1 }}><CoverageBar pct={Math.max(4,e*100)} hue={e>.18?selNode.hue:'blue'} /></div>
                  <span style={{ fontSize:11.5, color:'var(--ink-3)', whiteSpace:'nowrap' }}>{lvl}</span>
                </div>
                <div style={{ marginTop:12, fontSize:13, color:'var(--ink-2)', lineHeight:1.5 }}>
                  {window.t('drawn_from_pre')}<strong style={{ fontWeight:600, color:'var(--ink)' }}>{selNode.sources}</strong> {window.t('drawn_from', selNode.sources)}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:16 }}>
                  <button onClick={()=>onOpenEntry(eid)}
                    title={lit?window.t('open_in_wiki'):window.t('open_wiki_gap')}
                    style={btnPrimary}>
                    {lit ? <>{window.t('open_in_wiki')} <Icon name="arrow" s={14}/></> : <>{window.t('open_wiki_gap')}</>}
                  </button>
                  <button onClick={()=>onAddSource(selNode.id)} style={btnGhost}>
                    <Icon name="plus" s={14}/> {window.t('source_btn')}
                  </button>
                </div>
              </>); })()}
          </Frost>
        </div>
      )}
    </div>
  );
}

const covRow = { display:'flex', alignItems:'center', gap:9, width:'100%', textAlign:'left', padding:'5px 4px',
  border:'none', background:'transparent', borderRadius:7, transition:'opacity .2s' };
const viewResetBtn = { width:28, height:28, borderRadius:8, flex:'none', display:'grid', placeItems:'center',
  border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-3)' };
const qualityWrap = { marginTop:10, paddingTop:9, borderTop:'1px solid var(--hair-soft)' };
const qualityPill = { display:'inline-flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:8,
  border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-2)',
  fontFamily:'var(--mono)', fontSize:9.5, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase' };
const qualityIssue = { fontSize:11.5, lineHeight:1.35, color:'var(--ink-3)', paddingLeft:10,
  borderLeft:'2px solid var(--hair)' };
const diagToggle = { marginTop:13, width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
  padding:'9px 11px', borderRadius:9, border:'1px solid var(--hair)', background:'var(--card)',
  color:'var(--ink-2)', fontSize:11.5, fontWeight:600, fontFamily:'var(--mono)', letterSpacing:'.08em', textTransform:'uppercase' };
const reviseInput = { width:'100%', minHeight:70, resize:'vertical', boxSizing:'border-box', padding:'9px 10px',
  borderRadius:9, border:'1px solid var(--hair)', background:'var(--card-solid)', color:'var(--ink)',
  outline:'none', fontFamily:'var(--sans)', fontSize:12.5, lineHeight:1.45 };
const reviseBtn = { marginTop:8, width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
  padding:'9px 11px', borderRadius:9, border:'none', background:'var(--ink)', color:'var(--paper)',
  fontSize:12.5, fontWeight:600 };
const nextQBtn = { marginTop:4, width:'100%', display:'flex', alignItems:'flex-start', gap:7, textAlign:'left',
  padding:'9px 11px', borderRadius:9, border:'1px solid var(--hair)', background:'var(--card)',
  color:'var(--ink-2)', fontSize:12.5, fontWeight:500 };
const clusterPill = { display:'flex', alignItems:'center', gap:7, padding:'7px 12px', borderRadius:20,
  border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-2)', fontSize:12.5, fontWeight:500,
  transition:'all .2s' };
const detailClose = { position:'absolute', top:12, right:12, width:26, height:26, borderRadius:8,
  border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-3)',
  display:'grid', placeItems:'center' };
const btnPrimary = { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
  padding:'9px 12px', borderRadius:10, border:'none', background:'var(--ink)', color:'var(--paper)',
  fontSize:13, fontWeight:500 };
const btnPrimaryDim = { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
  padding:'9px 12px', borderRadius:10, border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-4)',
  fontSize:13, fontWeight:500, cursor:'not-allowed' };
const btnGhost = { display:'flex', alignItems:'center', gap:5, padding:'9px 12px', borderRadius:10,
  border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-2)', fontSize:13, fontWeight:500 };

window.ExpertMap = ExpertMap;
