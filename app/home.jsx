/* ============================================================
   LUMEN — Home (overview of the whole knowledge system)
   ============================================================ */
const { useMemo:useMemoH } = React;

function Home({ data, litByMap, inbox, onOpenMap, onOpenEntry, onGotoMapNode, goAtlas, goWiki, goSources, onReviewInbox }) {
  const { MAPS, ENTRIES, SOURCES, CONNECTIONS, ACTIVITY } = data;
  const stats = LX.globalStats();
  const hero = window.t('hero_line', stats);

  const recentEntries = useMemoH(()=> ENTRIES.filter(e=>e.type!=='moc').slice(0,5), [ENTRIES]);
  const openQs = useMemoH(()=>{
    const qs = ENTRIES.filter(e=>e.type==='question').map(e=>({ q:e.subtitle? e.title : e.title, entry:e.id, map:e.mapRefs[0]&&e.mapRefs[0].map }));
    // also surface a couple of dark map nodes as open questions
    const dark = [];
    MAPS.forEach(m=> m.nodes.filter(n=>n.explored<=0.18).slice(0,1).forEach(n=> dark.push({ q:window.t('what_is', n.label), map:m.id, node:n.id })));
    return [...qs, ...dark].slice(0,5);
  },[ENTRIES, MAPS]);

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:'var(--paper)' }}>
      <GlowField blobs={[
        { x:18, y:12, r:46, hue:'blue',   o:0.10, dur:36 },
        { x:88, y:20, r:40, hue:'amber',  o:0.08, dur:32 },
        { x:70, y:92, r:44, hue:'violet', o:0.08, dur:40 },
      ]}/>

      <div style={{ position:'relative', zIndex:2, maxWidth:1080, margin:'0 auto', padding:'52px 40px 100px' }}>
        {/* hero */}
        <div className="mono-label" style={{ marginBottom:14 }}>{window.t('overview_growing')}</div>
        <h1 style={{ margin:0, fontFamily:'var(--serif)', fontWeight:400, fontSize:40, lineHeight:1.14, letterSpacing:'-0.02em', color:'var(--ink)', maxWidth:740, textWrap:'balance' }}>
          {hero.before}<em style={{ fontStyle:'italic' }}>{hero.emphasis}</em>{hero.after}
        </h1>

        {/* inbox — slim inline notice, integrated under the hero */}
        {inbox && inbox.length>0 && (
          <button onClick={onReviewInbox} style={inboxStrip}
            onMouseEnter={e=>{ e.currentTarget.style.background='var(--card)'; e.currentTarget.querySelector('[data-rev]').style.color='var(--accent)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.querySelector('[data-rev]').style.color='var(--ink-3)'; }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:8, color:'var(--accent)', flex:'none' }}>
              <Icon name="inbox" s={16}/>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 7px 1px var(--accent)' }}/>
            </span>
            <span style={{ fontSize:13.5, color:'var(--ink-2)', whiteSpace:'nowrap' }}>
              <strong style={{ fontWeight:600, color:'var(--ink)' }}>{window.t('inbox_pending', inbox.length)}</strong>{window.t('inbox_pending_tail')}
            </span>
            <span data-rev style={{ display:'inline-flex', alignItems:'center', gap:5, marginLeft:6, flex:'none',
              paddingLeft:13, borderLeft:'1px solid var(--hair)', whiteSpace:'nowrap',
              fontSize:12.5, fontWeight:600, color:'var(--ink-3)', transition:'color .15s' }}>{window.t('review')} <Icon name="arrow" s={13}/></span>
          </button>
        )}

        {/* stats strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginTop:42 }}>
          <StatCard n={stats.maps} label={window.t('stat_maps')} sub={window.t('stat_maps_sub')} hue="blue" onClick={goAtlas}/>
          <StatCard n={stats.nodes} label={window.t('stat_nodes')} sub={window.t('stat_nodes_sub')} hue="violet" onClick={goAtlas}/>
          <StatCard n={stats.sources} label={window.t('stat_sources')} sub={window.t('stat_sources_sub')} hue="teal" onClick={goSources}/>
          <StatCard n={stats.openQuestions} label={window.t('stat_open')} sub={window.t('stat_open_sub')} hue="coral" onClick={goWiki}/>
        </div>

        {/* recent maps */}
        <SectionHead title={window.t('recent_maps')} action={window.t('open_atlas')} onAction={goAtlas} icon="atlas" style={{ marginTop:54 }}/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16, marginTop:18 }}>
          {MAPS.map(m=>{ const st=LX.mapStats(m, litByMap[m.id]||{}); return (
            <button key={m.id} onClick={()=>onOpenMap(m.id)} style={mapCard}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--ink-4)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--hair)'}>
              <MapThumb map={m} height={108} lit={litByMap[m.id]||{}}/>
              <div style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:21, color:'var(--ink)', lineHeight:1.15, marginTop:14, textWrap:'pretty' }}>{m.title}</div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:11 }}>
                <div style={{ flex:1 }}><CoverageBar pct={st.pct} hue={m.accentHue}/></div>
                <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-3)', flex:'none' }}>{st.pct}%</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:11 }} className="mono-label">
                <span style={{ fontSize:9 }}>{m.domain}</span>
                <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--ink-4)' }}/>
                <span style={{ fontSize:9 }}>{window.t('updated_pre')}{m.updated}</span>
              </div>
            </button>
          );})}
        </div>

        {/* insight columns */}
        <div style={insightGrid}>
          <HomeInsightSection title={window.t('cross_domain')} sub={window.t('cross_domain_sub')} icon="connect">
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:18 }}>
              {CONNECTIONS.map((c,i)=>{ const ea=LX.ENTRY_BY[c.a], eb=LX.ENTRY_BY[c.b]; const ma=LX.MAP_BY[c.aMap], mb=LX.MAP_BY[c.bMap];
                return (
                  <div key={i} style={connCard}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                      <button onClick={()=>onOpenEntry(c.a)} style={connChip}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:`radial-gradient(circle,${hueColor(ma.accentHue)},transparent 70%)` }}/>
                        {ea?ea.title:c.a}
                      </button>
                      <span style={{ color:'var(--ink-4)', display:'flex' }}><Icon name="connect" s={15}/></span>
                      <button onClick={()=>onOpenEntry(c.b)} style={connChip}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:`radial-gradient(circle,${hueColor(mb.accentHue)},transparent 70%)` }}/>
                        {eb?eb.title:c.b}
                      </button>
                    </div>
                    <p style={{ margin:'11px 0 0', fontSize:14, lineHeight:1.55, color:'var(--ink-2)', textWrap:'pretty' }}>{c.note}</p>
                  </div>
                );
              })}
              {!CONNECTIONS.length && <QuietPlaceholder rows={3}/>}
            </div>
          </HomeInsightSection>

          <HomeInsightSection title={window.t('open_questions')} sub={window.t('open_questions_sub')} icon="question">
            <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:18 }}>
              {openQs.map((o,i)=>(
                <button key={i} onClick={()=> o.entry? onOpenEntry(o.entry) : onGotoMapNode(o.map, o.node)} style={qRow}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--card)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--glow-coral)', marginTop:3, flex:'none' }}>0{i+1}</span>
                  <span style={{ minWidth:0, display:'flex', flexDirection:'column', gap:4 }}>
                    <span style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:16.5, lineHeight:1.3, color:'var(--ink)', textWrap:'pretty' }}>{o.q}</span>
                    <span className="mono-label" style={{ fontSize:8.5 }}>{LX.MAP_BY[o.map]?LX.MAP_BY[o.map].title:''}</span>
                  </span>
                </button>
              ))}
              {!openQs.length && <QuietPlaceholder rows={4}/>}
            </div>
          </HomeInsightSection>

          <HomeInsightSection title={window.t('recently_updated')} action={window.t('open_wiki')} onAction={goWiki} icon="wiki" compactAction>
            <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:18 }}>
              {recentEntries.length ? recentEntries.map(e=>{ const cat=LX.CAT_BY[e.category]; return (
                <button key={e.id} onClick={()=>onOpenEntry(e.id)} style={entryRowH}
                  onMouseEnter={ev=>ev.currentTarget.style.background='var(--card)'}
                  onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                  <span style={{ flex:'none', marginTop:2, color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}><EntryGlyph type={e.type} s={14}/></span>
                  <span style={{ minWidth:0, flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                    <span style={{ fontSize:14.5, color:'var(--ink)', fontWeight:500, lineHeight:1.3, textWrap:'pretty' }}>{e.title}</span>
                    <span className="mono-label" style={{ fontSize:8.5, color:hueColor(cat.hue) }}>{cat.label}</span>
                  </span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-4)', flex:'none', marginTop:2 }}>{e.updatedShort}</span>
                </button>
              );}) : <QuietPlaceholder rows={4}/>}
            </div>
          </HomeInsightSection>

          <HomeInsightSection title={window.t('how_grew')} icon="spark">
            <div style={{ display:'flex', flexDirection:'column', gap:15, marginTop:20 }}>
              {ACTIVITY.length ? ACTIVITY.map((a,i)=>{ const m=LX.MAP_BY[a.map]; return (
                <div key={i} style={{ display:'flex', gap:12 }}>
                  <div style={{ flex:'none', marginTop:2, color: a.kind==='light'?'var(--glow-amber)': a.kind==='link'?'var(--accent)': a.kind==='map'?hueColor(m?m.accentHue:'blue'):'var(--ink-4)' }}>
                    <Icon name={a.kind==='light'?'spark':a.kind==='link'?'connect':a.kind==='map'?'atlas':'plus'} s={15}/>
                  </div>
                  <div>
                    <div style={{ fontSize:13.5, color:'var(--ink-2)', lineHeight:1.5 }}>{parseInline(a.text)}</div>
                    <div className="mono-label" style={{ marginTop:4, fontSize:9 }}>{a.t}{m?` · ${m.title}`:''}</div>
                  </div>
                </div>
              );}) : <QuietPlaceholder rows={5}/>}
            </div>
          </HomeInsightSection>
        </div>
      </div>
    </div>
  );
}

function StatCard({ n, label, sub, hue, onClick }) {
  return (
    <button onClick={onClick} style={statCard}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--ink-4)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--hair)'}>
      <div style={{ position:'absolute', right:-18, top:-18, width:64, height:64, borderRadius:'50%',
        background:`radial-gradient(circle, ${hueColor(hue)}, transparent 70%)`, opacity:0.4, filter:'blur(4px)' }}/>
      <div style={{ position:'relative', fontFamily:'var(--serif)', fontStyle:'italic', fontSize:44, lineHeight:1, color:'var(--ink)' }}>{n}</div>
      <div style={{ position:'relative', fontSize:13.5, fontWeight:600, color:'var(--ink)', marginTop:9 }}>{label}</div>
      <div className="mono-label" style={{ position:'relative', fontSize:9, marginTop:4 }}>{sub}</div>
    </button>
  );
}

function SectionHead({ title, sub, action, onAction, icon, style }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, ...style }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {icon && <span style={{ color:'var(--ink-4)' }}><Icon name={icon} s={15}/></span>}
          <h2 style={{ margin:0, fontFamily:'var(--sans)', fontWeight:600, fontSize:17, letterSpacing:'-0.01em', color:'var(--ink)' }}>{title}</h2>
        </div>
        {sub && <div style={{ fontSize:13, color:'var(--ink-3)', marginTop:5 }}>{sub}</div>}
      </div>
      {action && <button onClick={onAction} style={sectionAction}>{action} <Icon name="arrow" s={13}/></button>}
    </div>
  );
}

function HomeInsightSection({ title, sub, action, onAction, icon, compactAction=false, children }) {
  const headStyle = compactAction ? { justifyContent:'flex-start', alignItems:'flex-start', gap:14 } : undefined;

  return (
    <section style={insightSection}>
      <SectionHead title={title} sub={sub} action={action} onAction={onAction} icon={icon}
        style={headStyle}/>
      {children}
    </section>
  );
}

function QuietPlaceholder({ rows=3 }) {
  return (
    <div style={quietPlaceholder}>
      {Array.from({ length:rows }).map((_,i)=>(
        <span key={i} style={{ width:(i % 2 ? '72%' : '88%'), height:1, background:'var(--hair-soft)' }}/>
      ))}
    </div>
  );
}

const inboxStrip = { display:'flex', alignItems:'center', gap:11, width:'fit-content', maxWidth:'100%', marginTop:20,
  padding:'8px 14px 8px 12px', borderRadius:11, border:'1px solid var(--hair-soft)', background:'transparent',
  transition:'background .15s', cursor:'pointer' };
const statCard = { position:'relative', overflow:'hidden', textAlign:'left', padding:'18px 18px 16px', borderRadius:16,
  border:'1px solid var(--hair)', background:'var(--card)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', transition:'border-color .2s', cursor:'pointer' };
const mapCard = { textAlign:'left', padding:14, borderRadius:18, border:'1px solid var(--hair)', background:'var(--card)',
  backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', transition:'border-color .2s', cursor:'pointer' };
const connCard = { padding:'16px 18px', borderRadius:14, border:'1px solid var(--hair-soft)', background:'var(--card)' };
const connChip = { display:'inline-flex', alignItems:'center', gap:7, padding:'6px 11px', borderRadius:20, border:'1px solid var(--hair)',
  background:'var(--card-solid)', color:'var(--ink)', fontSize:12.5, fontWeight:500 };
const qRow = { display:'flex', gap:12, alignItems:'flex-start', textAlign:'left', border:'none', background:'transparent',
  padding:'11px 10px', borderRadius:11, transition:'background .15s', cursor:'pointer' };
const entryRowH = { display:'flex', gap:11, alignItems:'flex-start', textAlign:'left', border:'none', background:'transparent',
  padding:'10px 10px', borderRadius:10, transition:'background .15s', cursor:'pointer' };
const insightGrid = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', columnGap:46, rowGap:42, marginTop:54, alignItems:'start' };
const insightSection = { minWidth:0 };
const quietPlaceholder = { minHeight:104, display:'flex', flexDirection:'column', justifyContent:'center', gap:15,
  padding:'4px 10px', borderTop:'1px solid var(--hair-soft)', borderBottom:'1px solid var(--hair-soft)', opacity:0.75 };
const sectionAction = { display:'inline-flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:9,
  border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-2)', fontSize:12.5, fontWeight:500, whiteSpace:'nowrap' };

window.Home = Home;
