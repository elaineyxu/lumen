/* ============================================================
   LUMEN — Sources (the library of materials)
   left: filterable list · right: contribution detail
   ============================================================ */
const { useState:useStateS, useMemo:useMemoS } = React;

const SRC_FILTERS = [
  { key:'inbox', label:window.t('f_inbox') },
  { key:'all',   label:window.t('f_all') },
  { key:'paper', label:window.t('f_paper') },
  { key:'link',  label:window.t('f_link') },
  { key:'video', label:window.t('f_video') },
  { key:'image', label:window.t('f_image') },
  { key:'chat',  label:window.t('f_chat') },
  { key:'voice', label:window.t('f_voice') },
  { key:'note',  label:window.t('f_note') },
];

function Sources({ data, litByMap, inbox=[], selectedSourceId, setSelectedSourceId, reviewInbox, clearReviewInbox, onOpenEntry, onGotoMapNode, onAddSource, onDigestInbox, onDismissInbox, onCapture }) {
  const { SOURCES } = data;
  const [filter, setFilter] = useStateS('all');
  const [q, setQ] = useStateS('');
  const [selInboxId, setSelInboxId] = useStateS(inbox[0] ? inbox[0].id : null);

  // arriving from a "Review Inbox" action → jump straight to the Inbox filter
  React.useEffect(()=>{ if(reviewInbox){ setFilter('inbox'); clearReviewInbox && clearReviewInbox(); } }, [reviewInbox]);

  const inboxView = filter==='inbox';

  const list = useMemoS(()=>{
    const s=q.trim().toLowerCase();
    return SOURCES.filter(x => (filter==='all'||x.type===filter) && (!s || (x.title+' '+x.meta).toLowerCase().includes(s)));
  },[filter, q, SOURCES]);

  const inboxList = useMemoS(()=>{
    const s=q.trim().toLowerCase();
    return inbox.filter(x => !s || (x.title+' '+x.meta).toLowerCase().includes(s));
  },[q, inbox]);

  const selInbox = inboxView ? (inbox.find(x=>x.id===selInboxId) || inbox[0] || null) : null;
  const sel = selectedSourceId ? LX.SRC_BY[selectedSourceId] : null;

  return (
    <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'380px minmax(0,1fr)', background:'var(--paper)' }}>
      <GlowField blobs={[{ x:90, y:88, r:40, hue:'teal', o:0.07, dur:36 }]}/>

      {/* ---- list ---- */}
      <aside style={{ position:'relative', zIndex:2, borderRight:'1px solid var(--hair-soft)', background:'var(--paper-deep)',
        display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{ padding:'24px 20px 12px' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
            <div className="mono-label">{inboxView ? window.t('inbox_head', inbox.length) : window.t('sources_head', SOURCES.length)}</div>
          </div>
          <button onClick={()=>onAddSource(null)} style={addSourceLib}><Icon name="plus" s={15}/> {window.t('add_a_source')}</button>
          <div style={libSearch}>
            <Icon name="search" s={15} c="var(--ink-4)"/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder={inboxView?window.t('search_inbox'):window.t('search_library')} style={libSearchInput}/>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:12 }}>
            {SRC_FILTERS.map(f=>{ const on=filter===f.key; const isInbox=f.key==='inbox';
              return (
              <button key={f.key} onClick={()=>setFilter(f.key)} style={{ ...filterChip,
                display:'inline-flex', alignItems:'center', gap:6,
                background: on?'var(--ink)':'var(--card)', color: on?'var(--paper)':'var(--ink-2)',
                borderColor: on?'var(--ink)':'var(--hair)' }}>
                {isInbox && <Icon name="inbox" s={13}/>}
                {f.label}
                {isInbox && inbox.length>0 && (
                  <span style={{ minWidth:16, height:16, padding:'0 4px', borderRadius:8, display:'inline-grid', placeItems:'center',
                    fontFamily:'var(--mono)', fontSize:9.5, lineHeight:1,
                    background: on?'var(--paper)':'var(--accent)', color: on?'var(--ink)':'var(--paper)' }}>{inbox.length}</span>
                )}
              </button>
            );})}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'4px 12px 20px' }}>
          {inboxView ? (
            <React.Fragment>
              {inboxList.map(it=>{ const on=it.id===(selInbox&&selInbox.id);
                return (
                <button key={it.id} onClick={()=>setSelInboxId(it.id)} style={{ ...srcRow,
                  background:on?'var(--card-solid)':'transparent',
                  boxShadow:on?'0 1px 3px oklch(0.3 0.04 280 / 0.10), 0 0 0 1px var(--hair)':'none' }}
                  onMouseEnter={e=>{ if(!on) e.currentTarget.style.background='var(--card)'; }}
                  onMouseLeave={e=>{ if(!on) e.currentTarget.style.background='transparent'; }}>
                  <span style={{ width:34, height:34, borderRadius:9, flex:'none', display:'grid', placeItems:'center',
                    background:'color-mix(in oklab, '+SRC_TINT[it.tint]+' 16%, transparent)', color:SRC_TINT[it.tint] }}>
                    <Icon name={it.type} s={17}/>
                  </span>
                  <span style={{ minWidth:0, flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', flex:'none', background:'var(--accent)', boxShadow:'0 0 6px 1px var(--accent)' }}/>
                      <span style={{ fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--accent)' }}>{window.t('pending')}</span>
                    </span>
                    <span style={{ fontSize:13.5, color:'var(--ink)', fontWeight:500, lineHeight:1.3, textWrap:'pretty' }}>{it.title}</span>
                    <span style={{ display:'flex', alignItems:'center', gap:7 }} className="mono-label">
                      <span style={{ fontSize:8.5 }}>{window.t('st_'+it.type)}</span>
                      <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--ink-4)' }}/>
                      <span style={{ fontSize:8.5 }}>{window.t('captured_pre')}{it.captured}</span>
                    </span>
                  </span>
                </button>
              );})}
              {inboxList.length===0 && (
                <div style={{ padding:'28px 14px', textAlign:'center' }}>
                  <Icon name="check" s={24} c="var(--glow-teal)"/>
                  <div style={{ marginTop:10, fontFamily:'var(--serif)', fontStyle:'italic', fontSize:17, color:'var(--ink-2)' }}>{window.t('inbox_zero')}</div>
                  <div style={{ marginTop:5, fontSize:12.5, color:'var(--ink-3)' }}>{window.t('inbox_zero_sub')}</div>
                </div>
              )}
            </React.Fragment>
          ) : (
          <React.Fragment>
          {list.map(s=>{ const on=s.id===selectedSourceId; const ents=LX.entriesForSource(s.id);
            return (
            <button key={s.id} onClick={()=>setSelectedSourceId(s.id)} style={{ ...srcRow,
              background:on?'var(--card-solid)':'transparent',
              boxShadow:on?'0 1px 3px oklch(0.3 0.04 280 / 0.10), 0 0 0 1px var(--hair)':'none' }}
              onMouseEnter={e=>{ if(!on) e.currentTarget.style.background='var(--card)'; }}
              onMouseLeave={e=>{ if(!on) e.currentTarget.style.background='transparent'; }}>
              <span style={{ width:34, height:34, borderRadius:9, flex:'none', display:'grid', placeItems:'center',
                background:'color-mix(in oklab, '+SRC_TINT[s.tint]+' 16%, transparent)', color:SRC_TINT[s.tint] }}>
                <Icon name={s.type} s={17}/>
              </span>
              <span style={{ minWidth:0, flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:9.5, color:'var(--ink-4)' }}>[{s.n}]</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:SRC_TINT[s.tint] }}>{window.t('st_'+s.type)}</span>
                </span>
                <span style={{ fontSize:13.5, color:'var(--ink)', fontWeight:500, lineHeight:1.3, textWrap:'pretty' }}>{s.title}</span>
                <span style={{ display:'flex', alignItems:'center', gap:7 }} className="mono-label">
                  <span style={{ fontSize:8.5 }}>{window.t('n_entries_low', ents.length)}</span>
                  <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--ink-4)' }}/>
                  <span style={{ fontSize:8.5 }}>{s.added}</span>
                </span>
              </span>
            </button>
          );})}
          {list.length===0 && <div style={{ padding:'16px 10px', fontSize:13, color:'var(--ink-3)', fontStyle:'italic', fontFamily:'var(--serif)' }}>{window.t('no_sources_match')}</div>}
          </React.Fragment>
          )}
        </div>
      </aside>

      {/* ---- detail ---- */}
      <div style={{ position:'relative', zIndex:2, overflowY:'auto' }}>
        {inboxView ? (
          selInbox ? <InboxDetail data={data} item={selInbox} onDigest={onDigestInbox} onDismiss={onDismissInbox} onGotoMapNode={onGotoMapNode} onOpenEntry={onOpenEntry}/>
                   : <div style={{ height:'100%', display:'grid', placeItems:'center', color:'var(--ink-3)' }}>
                       <div style={{ textAlign:'center', maxWidth:380 }}>
                         <Icon name="inbox" s={30} c="var(--ink-4)"/>
                         <div style={{ marginTop:12, fontFamily:'var(--serif)', fontStyle:'italic', fontSize:20, color:'var(--ink-2)' }}>{window.t('inbox_clear')}</div>
                         <div style={{ marginTop:6, fontSize:13.5 }}>{window.t('inbox_clear_a')}<strong style={{ fontWeight:600, color:'var(--ink-2)' }}>+ {window.t('capture')}</strong>{window.t('inbox_clear_b')}</div>
                         <button onClick={()=>onCapture && onCapture('note')} style={{ ...addSourceLib, width:'auto', display:'inline-flex', marginTop:16, padding:'10px 16px' }}><Icon name="plus" s={15}/> {window.t('quick_capture')}</button>
                       </div>
                     </div>
        ) : sel ? <SourceDetail data={data} litByMap={litByMap} src={sel} onOpenEntry={onOpenEntry} onGotoMapNode={onGotoMapNode}/>
             : <div style={{ height:'100%', display:'grid', placeItems:'center', color:'var(--ink-3)' }}>
                 <div style={{ textAlign:'center' }}>
                   <Icon name="library" s={30} c="var(--ink-4)"/>
                   <div style={{ marginTop:12, fontFamily:'var(--serif)', fontStyle:'italic', fontSize:20, color:'var(--ink-2)' }}>{window.t('select_source')}</div>
                   <div style={{ marginTop:6, fontSize:13.5 }}>{window.t('select_source_sub')}</div>
                 </div>
               </div>}
      </div>
    </div>
  );
}

function SourceDetail({ data, litByMap, src, onOpenEntry, onGotoMapNode }) {
  const ents = LX.entriesForSource(src.id);
  const evidence = Array.isArray(src.citations) ? src.citations : (Array.isArray(src.evidence) ? src.evidence : []);
  return (
    <div style={{ maxWidth:720, margin:'0 auto', padding:'48px 44px 100px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ width:52, height:52, borderRadius:13, flex:'none', display:'grid', placeItems:'center',
          background:'color-mix(in oklab, '+SRC_TINT[src.tint]+' 16%, transparent)', color:SRC_TINT[src.tint] }}>
          <Icon name={src.type} s={26}/>
        </span>
        <div>
          <div className="mono-label" style={{ color:SRC_TINT[src.tint] }}>{window.t('st_'+src.type)} · {window.t('added_pre')}{src.added}</div>
          <h1 style={{ margin:'6px 0 0', fontFamily:'var(--serif)', fontWeight:400, fontSize:32, lineHeight:1.1, letterSpacing:'-0.01em', color:'var(--ink)', textWrap:'balance' }}>{src.title}</h1>
        </div>
      </div>
      <div style={{ fontSize:14, color:'var(--ink-3)', marginTop:12, paddingBottom:24, borderBottom:'1px solid var(--hair)' }}>{src.meta}</div>

      {/* contributed entries */}
      <div style={{ marginTop:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="wiki" s={15} c="var(--ink-4)"/>
          <h2 style={detailH2}>{window.t('wiki_entries_built')}</h2>
        </div>
        <div style={{ fontSize:13, color:'var(--ink-3)', marginTop:5 }}>{window.t('wove_into', ents.length)}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
          {ents.map(e=>{ const cat=LX.CAT_BY[e.category]; return (
            <button key={e.id} onClick={()=>onOpenEntry(e.id)} style={contribCard}
              onMouseEnter={ev=>ev.currentTarget.style.borderColor='var(--ink-4)'}
              onMouseLeave={ev=>ev.currentTarget.style.borderColor='var(--hair)'}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}><EntryGlyph type={e.type} s={14}/></span>
                <span className="mono-label" style={{ fontSize:8.5, color:hueColor(cat.hue) }}>{cat.label}</span>
              </div>
              <div style={{ fontFamily:'var(--serif)', fontStyle: e.type==='question'?'italic':'normal', fontSize:18, lineHeight:1.2, color:'var(--ink)', marginTop:9, textWrap:'pretty' }}>{e.title}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, fontSize:12, color:'var(--accent)', fontWeight:500 }}>{window.t('open_entry')} <Icon name="arrow" s={12}/></div>
            </button>
          );})}
        </div>
      </div>

      {/* evidence extracted */}
      <div style={{ marginTop:34 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="note" s={15} c="var(--ink-4)"/>
          <h2 style={detailH2}>{window.t('evidence_extracted')}</h2>
        </div>
        {evidence.length ? (
          <div style={{ display:'grid', gap:10, marginTop:14 }}>
            {evidence.slice(0,3).map((item,i)=>(
              <div key={(item.id||'evidence')+i} style={evidenceCard}>
                <div className="mono-label" style={{ marginBottom:6 }}>{item.locator || item.kind || 'citation'}</div>
                <div style={{ fontSize:13.5, lineHeight:1.5, color:'var(--ink-2)' }}>{item.quote || item.text || item.summary}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop:12, padding:'12px 13px', borderRadius:11, border:'1px solid var(--hair-soft)', background:'var(--card)', color:'var(--ink-3)', fontSize:13, lineHeight:1.45 }}>
            {window.t('evidence_empty')}
          </div>
        )}
      </div>

      {/* illuminated regions */}
      <div style={{ marginTop:36 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="atlas" s={15} c="var(--ink-4)"/>
          <h2 style={detailH2}>{window.t('map_coverage_impact')}</h2>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:18, marginTop:16 }}>
          {(src.illuminated||[]).map((il,i)=>{ const m=LX.MAP_BY[il.map]; if(!m) return null;
            const nodeLabels = il.nodes.map(id=>{ const n=m.nodes.find(x=>x.id===id); return n?{id,label:n.label,hue:n.hue}:null; }).filter(Boolean);
            // build a lit overlay so the thumb foregrounds this source's nodes
            const lit={}; il.nodes.forEach(id=>{ lit[id]=0.5; });
            const baseLit = litByMap[m.id]||{};
            const mergedLit = {...lit, ...baseLit};
            return (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:18, alignItems:'center',
                padding:16, borderRadius:16, border:'1px solid var(--hair-soft)', background:'var(--card)' }}>
                <button onClick={()=>onGotoMapNode(il.map, il.nodes[0])} style={{ border:'none', background:'none', padding:0, cursor:'pointer' }}>
                  <MapThumb map={m} height={120} lit={mergedLit}/>
                </button>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:`radial-gradient(circle,${hueColor(m.accentHue)},transparent 70%)` }}/>
                    <span style={{ fontSize:15, fontWeight:600, color:'var(--ink)' }}>{m.title}</span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--ink-3)', marginTop:5 }}>{window.t('brightened', nodeLabels.length)}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:11 }}>
                    {nodeLabels.map(n=>(
                      <button key={n.id} onClick={()=>onGotoMapNode(il.map, n.id)} style={nodeChip}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:`radial-gradient(circle,${hueColor(n.hue)},transparent 70%)` }}/>
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InboxDetail({ data, item, onDigest, onDismiss, onGotoMapNode, onOpenEntry }) {
  const sug = item.suggest || { maps:[], entries:[], concepts:[] };
  const tint = SRC_TINT[item.tint] || 'var(--glow-blue)';
  const hasSuggestions = !item.pending && (sug.maps.length || sug.entries.length || sug.concepts.length);

  return (
    <div style={{ maxWidth:720, margin:'0 auto', padding:'48px 44px 100px' }}>
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <span style={{ width:52, height:52, borderRadius:13, flex:'none', display:'grid', placeItems:'center',
          background:'color-mix(in oklab, '+tint+' 16%, transparent)', color:tint }}>
          <Icon name={item.type} s={26}/>
        </span>
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <span className="mono-label" style={{ color:tint }}>{window.t('st_'+item.type)} · {window.t('captured_pre')}{item.captured}</span>
            <span style={inboxPill}><span style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent)' }}/> {window.t('pending_digestion')}</span>
          </div>
          <h1 style={{ margin:'6px 0 0', fontFamily:'var(--serif)', fontWeight:400, fontSize:30, lineHeight:1.12, letterSpacing:'-0.01em', color:'var(--ink)', textWrap:'balance' }}>{item.title}</h1>
        </div>
      </div>
      <div style={{ fontSize:14, color:'var(--ink-3)', marginTop:12 }}>{item.meta}</div>
      {item.note && <p style={{ margin:'14px 0 0', fontSize:15, lineHeight:1.55, color:'var(--ink-2)', fontFamily:'var(--serif)', fontStyle:'italic', textWrap:'pretty' }}>{item.note}</p>}

      <div style={{ marginTop:24, paddingTop:24, borderTop:'1px solid var(--hair)' }}>
        {hasSuggestions ? (
          <React.Fragment>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Icon name="spark" s={15} c="var(--accent)"/>
              <h2 style={detailH2}>{window.t('where_belongs')}</h2>
            </div>
            <div style={{ fontSize:13, color:'var(--ink-3)', marginTop:5 }}>{window.t('review_then')}</div>

            <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:18 }}>
              {sug.maps.map(mid=>{ const m=LX.MAP_BY[mid]; if(!m) return null;
                const concepts=(sug.concepts||[]).filter(c=>c.map===mid);
                const lit={}; concepts.forEach((c,i)=>{ lit[c.node]=i===0?0.55:0.4; });
                return (
                  <div key={mid} style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:18, alignItems:'center',
                    padding:16, borderRadius:16, border:'1px solid var(--hair-soft)', background:'var(--card)' }}>
                    <button onClick={()=>onGotoMapNode(mid, concepts[0]?concepts[0].node:undefined)} style={{ border:'none', background:'none', padding:0, cursor:'pointer' }}>
                      <MapThumb map={m} height={112} lit={lit}/>
                    </button>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:9, height:9, borderRadius:'50%', background:`radial-gradient(circle,${hueColor(m.accentHue)},transparent 70%)` }}/>
                        <span style={{ fontSize:15, fontWeight:600, color:'var(--ink)' }}>{m.title}</span>
                      </div>
                      {concepts.length>0 ? (
                        <React.Fragment>
                          <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:6 }}>{window.t('would_brighten', concepts.length)}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:9 }}>
                            {concepts.map(c=>{ const n=m.nodes.find(x=>x.id===c.node); if(!n) return null;
                              return (
                              <button key={c.node} onClick={()=>onGotoMapNode(mid, c.node)} style={nodeChip}>
                                <span style={{ width:8, height:8, borderRadius:'50%', background:`radial-gradient(circle,${hueColor(n.hue)},transparent 70%)` }}/>
                                {n.label}
                              </button>
                            );})}
                          </div>
                        </React.Fragment>
                      ) : (
                        <div style={{ fontSize:12.5, color:'var(--ink-3)', marginTop:6 }}>{window.t('candidate_map')}</div>
                      )}
                      <button onClick={()=>onDigest(item, mid)} style={compileBtn}><Icon name="spark" s={14}/> {window.t('compile_into_map')}</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {sug.entries.length>0 && (
              <div style={{ marginTop:24 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Icon name="wiki" s={15} c="var(--ink-4)"/>
                  <h2 style={detailH2}>{window.t('entries_extend')}</h2>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:13 }}>
                  {sug.entries.map(eid=>{ const e=LX.ENTRY_BY[eid]; if(!e) return null; const cat=LX.CAT_BY[e.category];
                    return (
                    <button key={eid} onClick={()=>onOpenEntry(eid)} style={entryChip}>
                      <span style={{ color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}><EntryGlyph type={e.type} s={13}/></span>
                      {e.title}
                      <span className="mono-label" style={{ fontSize:8, color:hueColor(cat.hue) }}>{cat.label}</span>
                    </button>
                  );})}
                </div>
              </div>
            )}
          </React.Fragment>
        ) : (
          <div style={{ display:'flex', gap:13, padding:'18px 18px', borderRadius:14, border:'1px solid var(--hair-soft)', background:'var(--card)' }}>
            <span style={{ flex:'none', marginTop:1 }}><Icon name="spark" s={18} c="var(--accent)"/></span>
            <div>
              <div style={{ fontSize:14.5, fontWeight:600, color:'var(--ink)' }}>{window.t('still_reading')}</div>
              <div style={{ fontSize:13.5, color:'var(--ink-3)', marginTop:4, lineHeight:1.5 }}>{window.t('still_reading_sub')}</div>
            </div>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:26, paddingTop:20, borderTop:'1px solid var(--hair)' }}>
          <button onClick={()=>onDigest(item, sug.maps[0])} style={{ ...compileBtn, marginTop:0, background:'var(--ink)', color:'var(--paper)', borderColor:'var(--ink)' }}>
            <Icon name="layers" s={15}/> {sug.maps[0] ? window.t('compile_into', LX.MAP_BY[sug.maps[0]] ? LX.MAP_BY[sug.maps[0]].title : window.t('nav_atlas')) : window.t('compile_into_atlas')}
          </button>
          <button onClick={()=>onDismiss(item)} style={dismissBtn}>{window.t('dismiss')}</button>
        </div>
      </div>
    </div>
  );
}

const inboxPill = { display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:20,
  border:'1px solid color-mix(in oklab, var(--accent) 30%, transparent)', background:'var(--accent-soft)',
  color:'var(--accent)', fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.08em', textTransform:'uppercase' };
const compileBtn = { display:'inline-flex', alignItems:'center', gap:7, marginTop:14, padding:'9px 15px', borderRadius:10,
  border:'1px solid var(--accent)', background:'var(--accent-soft)', color:'var(--accent)', fontSize:13, fontWeight:600, cursor:'pointer' };
const dismissBtn = { padding:'10px 16px', borderRadius:10, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-3)', fontSize:13.5, fontWeight:500, cursor:'pointer' };
const entryChip = { display:'inline-flex', alignItems:'center', gap:8, padding:'8px 13px', borderRadius:11, border:'1px solid var(--hair)', background:'var(--card-solid)', color:'var(--ink)', fontSize:13, fontWeight:500, cursor:'pointer' };

const addSourceLib = { width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:12,
  padding:'10px', borderRadius:11, border:'none', background:'var(--ink)', color:'var(--paper)', fontSize:13.5, fontWeight:500 };
const libSearch = { display:'flex', alignItems:'center', gap:8, marginTop:11, padding:'9px 12px', borderRadius:10, border:'1px solid var(--hair)', background:'var(--card)' };
const libSearchInput = { flex:1, border:'none', background:'transparent', outline:'none', fontFamily:'var(--sans)', fontSize:13, color:'var(--ink)', minWidth:0 };
const filterChip = { padding:'6px 12px', borderRadius:18, border:'1px solid var(--hair)', fontSize:12, fontWeight:500, fontFamily:'var(--sans)', transition:'all .15s' };
const srcRow = { width:'100%', display:'flex', gap:12, alignItems:'flex-start', textAlign:'left', padding:'12px 12px', borderRadius:12, border:'none', marginBottom:3, transition:'background .15s' };
const detailH2 = { margin:0, fontFamily:'var(--sans)', fontWeight:600, fontSize:16, letterSpacing:'-0.01em', color:'var(--ink)' };
const contribCard = { textAlign:'left', padding:'15px 16px', borderRadius:14, border:'1px solid var(--hair)', background:'var(--card)', transition:'border-color .2s', cursor:'pointer' };
const evidenceCard = { padding:'12px 13px', borderRadius:11, border:'1px solid var(--hair-soft)', background:'var(--card)' };
const nodeChip = { display:'inline-flex', alignItems:'center', gap:7, padding:'6px 11px', borderRadius:18, border:'1px solid var(--hair)', background:'var(--card-solid)', color:'var(--ink-2)', fontSize:12.5, fontWeight:500 };

window.Sources = Sources;
