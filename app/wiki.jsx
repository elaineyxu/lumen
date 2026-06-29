/* ============================================================
   LUMEN — Personal Wiki (encyclopedia)
   left: categories + entries · center: entry/MOC · right: metadata
   ============================================================ */
const { useState:useStateW, useRef:useRefW, useEffect:useEffectW, useMemo:useMemoW } = React;

function effExploredW(n, litMap){ return Math.min(1, n.explored + (litMap[n.id]||0)); }

const TYPE_LABEL = new Proxy({}, { get: (_, k) => window.t('type_' + String(k)) });

function WikiView({ data, litByMap,
                    activeEntryId, setActiveEntryId, browseCat, setBrowseCat,
                    onGotoMapNode, onAddSource, onOpenSource, onCreateMap,
                    wikiProposals=[], onApplyWikiProposal, onDismissWikiProposal }) {
  const { BRANCHES, CATEGORIES } = data;
  const hasWiki = BRANCHES.length > 0 && CATEGORIES.length > 0;
  const [q, setQ] = useStateW('');
  const allIds = useMemoW(()=>[...BRANCHES.map(b=>b.id), ...CATEGORIES.map(c=>c.id)], [BRANCHES, CATEGORIES]);
  const [open, setOpen] = useStateW(()=>new Set(allIds));
  const scrollRef = useRefW(null);
  const railRef = useRefW(null);
  const srcRefs = useRefW({});
  const [hiCite, setHiCite] = useStateW(null);

  const entry = activeEntryId ? LX.ENTRY_BY[activeEntryId] : null;
  const showIndex = !!browseCat || !entry;
  const entryAddTarget = entry && !browseCat ? (() => {
    const ref = (entry.mapRefs || [])[0] || {};
    return { targetEntryId:entry.id, targetMapId:ref.map, presetNode:ref.node };
  })() : null;

  const matches = useMemoW(()=>{
    const s=q.trim().toLowerCase(); if(!s) return null;
    return LX.allWikiEntries(litByMap).filter(e=>(e.title+' '+e.subtitle).toLowerCase().includes(s));
  },[q, litByMap]);

  const toggle = (id)=> setOpen(p=>{ const s=new Set(p); s.has(id)?s.delete(id):s.add(id); return s; });
  const anyOpen = open.size>0;
  const toggleAll = ()=> setOpen(anyOpen ? new Set() : new Set(allIds));

  const openEntry = (id)=>{
    if(LX.ENTRY_BY[id]){ setBrowseCat(null); setActiveEntryId(id); if(scrollRef.current) scrollRef.current.scrollTo({top:0}); }
    else if(LX.CAT_BY[id]){ setActiveEntryId(null); setBrowseCat(id); }
  };
  const onCite = (n)=>{
    setHiCite(n);
    const t = srcRefs.current[n], rail=railRef.current;
    if(t&&rail) rail.scrollTo({ top: t.offsetTop-12, behavior:'smooth' });
    setTimeout(()=>setHiCite(c=>c===n?null:c), 2200);
  };
  const linkOpts = { onLink:(id)=>openEntry(id), onCite };

  return (
    <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'258px minmax(0,1fr) 300px',
      background:'var(--paper)', overflow:'hidden' }}>
      <GlowField blobs={[
        { x:86, y:12, r:40, hue:'blue',   o:0.08, dur:34 },
        { x:10, y:90, r:44, hue:'violet', o:0.07, dur:38 },
      ]}/>

      {/* ---- left: classic branches → shelves → entries ---- */}
      <aside style={{ position:'relative', zIndex:2, borderRight:'1px solid var(--hair-soft)',
        background:'var(--paper-deep)', display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{ padding:'22px 16px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div className="mono-label" style={{ display:'flex', alignItems:'center', gap:7 }}>
              <Icon name="library" s={14} c="var(--ink-3)"/> {window.t('encyclopedia')}
            </div>
            <button onClick={toggleAll} style={collapseAllBtn} title={anyOpen?window.t('collapse_all'):window.t('expand_all')}>
              <span style={{ display:'inline-flex', transform:anyOpen?'rotate(90deg)':'none', transition:'transform .2s' }}><Icon name="arrow" s={11}/></span>
              {anyOpen?window.t('collapse_all'):window.t('expand_all')}
            </button>
          </div>
          <div style={atlasSearchW}>
            <Icon name="search" s={15} c="var(--ink-4)"/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder={window.t('search_encyclopedia')} style={atlasSearchInputW}/>
          </div>
        </div>

        <nav style={{ flex:1, overflowY:'auto', padding:'2px 8px 18px' }}>
          {matches ? (
            <div style={{ padding:'4px 6px' }}>
              <div className="mono-label" style={{ marginBottom:8 }}>{window.t('n_results', matches.length)}</div>
              {matches.map(e=> <EntryRow key={e.id} e={e} active={e.id===activeEntryId} onClick={()=>openEntry(e.id)} />)}
              {matches.length===0 && <div style={{ fontSize:13, color:'var(--ink-3)', fontStyle:'italic', fontFamily:'var(--serif)', padding:'8px 6px' }}>{window.t('nothing_yet', q)}</div>}
            </div>
          ) : BRANCHES.map(branch=>{
            const cats = CATEGORIES.filter(c=>c.branch===branch.id)
              .map(c=>({ cat:c, es:LX.wikiEntriesInCategory(c.id, litByMap) }))
              .filter(x=>x.es.length);
            if(!cats.length) return null;
            const total = cats.reduce((s,x)=>s+x.es.length,0);
            const bOpen = open.has(branch.id);
            return (
              <div key={branch.id} style={{ marginBottom:10 }}>
                <button onClick={()=>toggle(branch.id)} style={branchHead}>
                  <span style={{ display:'inline-flex', transform:bOpen?'rotate(90deg)':'none', transition:'transform .2s' }}><Icon name="arrow" s={11} c="var(--ink-3)"/></span>
                  {branch.label}
                  <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:9, color:'var(--ink-4)' }}>{total}</span>
                </button>
                {bOpen && (
                  <div style={{ paddingLeft:4, marginTop:2 }}>
                    {cats.map(({cat,es})=>{ const isOpen=open.has(cat.id);
                      return (
                        <div key={cat.id} style={{ marginBottom:3 }}>
                          <div style={{ display:'flex', alignItems:'center' }}>
                            <button onClick={()=>toggle(cat.id)}
                              style={{ ...catCaret, transform: isOpen?'rotate(90deg)':'none', transition:'transform .2s' }}><Icon name="arrow" s={11} c="var(--ink-4)" /></button>
                            <button onClick={()=>{ setBrowseCat(cat.id); setActiveEntryId(null); }} style={{ ...catHeader, color: browseCat===cat.id?'var(--ink)':'var(--ink-2)' }}>
                              <span style={{ width:7, height:7, borderRadius:'50%', flex:'none',
                                background:`radial-gradient(circle, ${hueColor(cat.hue)}, transparent 72%)` }}/>
                              {cat.label}
                              <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:9, color:'var(--ink-4)' }}>{es.length}</span>
                            </button>
                          </div>
                          {isOpen && (
                            <div style={{ paddingLeft:6 }}>
                              {es.map(e=> <EntryRow key={e.id} e={e} active={e.id===activeEntryId&&!browseCat} onClick={()=>openEntry(e.id)} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ---- center ---- */}
      <main ref={scrollRef} style={{ position:'relative', zIndex:2, overflowY:'auto', padding:'46px 7% 120px' }}>
        {!hasWiki
          ? <EmptyWiki onAddSource={onAddSource} onCreateMap={onCreateMap} />
          : showIndex
          ? <CategoryIndex data={data} litByMap={litByMap} catId={browseCat||CATEGORIES[0].id} onOpen={openEntry} />
          : <>
              <GlobalLensHeader entry={entry} />
              <Article entry={entry} litMap={{}} opts={linkOpts}
                proposals={wikiProposals}
                onApplyProposal={onApplyWikiProposal}
                onDismissProposal={onDismissWikiProposal} />
            </>}
      </main>

      {/* ---- right rail ---- */}
      <aside ref={railRef} style={{ position:'relative', zIndex:2, borderLeft:'1px solid var(--hair-soft)',
        padding:'26px 20px 60px', overflowY:'auto', background:'var(--paper-deep)' }}>
        <button onClick={()=>onAddSource(entryAddTarget && entryAddTarget.presetNode, entryAddTarget || {})} style={addSrcBtn}>
          <Icon name="plus" s={16}/> {window.t('add_a_source')}
        </button>
        {entry && !browseCat && <EntryMeta entry={entry} litByMap={litByMap} hiCite={hiCite} srcRefs={srcRefs}
          onGotoMapNode={onGotoMapNode}
          onOpenEntry={openEntry} onOpenSource={onOpenSource} onBrowseCat={(id)=>{ setActiveEntryId(null); setBrowseCat(id); }} />}
        {showIndex && <IndexMeta data={data} litByMap={litByMap} catId={browseCat||(CATEGORIES[0]&&CATEGORIES[0].id)||'questions'} />}
      </aside>
    </div>
  );
}

function EmptyWiki({ onAddSource, onCreateMap }) {
  return (
    <div style={{ minHeight:'70vh', display:'grid', placeItems:'center' }}>
      <div style={{ textAlign:'center', maxWidth:390 }}>
        <Icon name="wiki" s={34} c="var(--ink-4)"/>
        <h1 style={{ margin:'14px 0 0', fontFamily:'var(--serif)', fontStyle:'italic', fontWeight:400, fontSize:30, color:'var(--ink)' }}>{window.t('empty_wiki_title')}</h1>
        <p style={{ margin:'8px 0 0', fontSize:14, lineHeight:1.55, color:'var(--ink-3)' }}>{window.t('empty_wiki_sub')}</p>
        <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:18, flexWrap:'wrap' }}>
          <button onClick={()=>onAddSource(null)} style={{ ...addSrcBtn, width:'auto', display:'inline-flex', padding:'10px 16px' }}>
            <Icon name="plus" s={16}/> {window.t('add_a_source')}
          </button>
          <button onClick={()=>onCreateMap && onCreateMap()} style={wikiGhostBtn}>
            <Icon name="question" s={15}/> {window.t('create_question')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- sidebar entry row ---------- */
function EntryRow({ e, active, onClick }) {
  return (
    <button onClick={onClick} style={{ width:'100%', display:'flex', alignItems:'flex-start', gap:9, textAlign:'left',
      padding:'7px 9px', borderRadius:8, border:'none', marginBottom:1,
      background: active?'var(--card)':'transparent',
      borderLeft:'2px solid '+(active?'var(--accent)':'transparent') }}
      onMouseEnter={ev=>{ if(!active) ev.currentTarget.style.background='var(--card)'; }}
      onMouseLeave={ev=>{ if(!active) ev.currentTarget.style.background='transparent'; }}>
      <span style={{ flex:'none', marginTop:2, color: e.type==='question'?'var(--glow-coral)': e.type==='moc'?'var(--accent)':'var(--ink-4)' }}>
        <EntryGlyph type={e.type} s={13}/>
      </span>
      <span style={{ minWidth:0, display:'flex', flexDirection:'column', gap:3 }}>
        <span style={{ fontSize:13, lineHeight:1.3, color: active?'var(--ink)':'var(--ink-2)', fontWeight:active?600:400, textWrap:'pretty' }}>{e.title}</span>
        {e.type!=='concept' && <span className="mono-label" style={{ fontSize:8.5, color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}>{TYPE_LABEL[e.type]}</span>}
      </span>
    </button>
  );
}

function proposalAliasesForEntry(entry) {
  const ids = new Set([entry.id, 'entry-' + entry.id]);
  (entry.mapRefs || []).forEach(ref => {
    if(!ref || !ref.node) return;
    ids.add(ref.node);
    ids.add('entry-' + ref.node);
    if(ref.map) ids.add('stub:' + ref.map + ':' + ref.node);
  });
  if(String(entry.id).startsWith('stub:')){
    const parts = String(entry.id).split(':');
    const node = parts[2];
    if(node){ ids.add(node); ids.add('entry-' + node); }
  }
  return ids;
}

function proposalMatchesEntry(entry, proposal) {
  const ids = proposalAliasesForEntry(entry);
  const raw = String(proposal && proposal.entryId || '');
  if(ids.has(raw)) return true;
  if(raw.startsWith('entry-') && ids.has(raw.slice(6))) return true;
  return false;
}

function proposalTone(status) {
  if(status === 'accepted') return { hue:'var(--glow-teal)', label:'Accepted change' };
  if(status === 'blocked') return { hue:'var(--glow-coral)', label:'Reviewer blocked' };
  return { hue:'var(--glow-amber)', label:'Pending proposal' };
}

/* ============================================================
   ARTICLE
   ============================================================ */
function Article({ entry, litMap, opts, proposals=[], onApplyProposal, onDismissProposal }) {
  const cat = LX.CAT_BY[entry.category];
  const isQ = entry.type==='question';
  const entryProposals = (proposals || []).filter(p=>proposalMatchesEntry(entry, p));
  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <div className="mono-label" style={{ marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color:hueColor(cat.hue) }}>{cat.label}</span>
        <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--ink-4)' }}/>
        <span style={{ color: isQ?'var(--glow-coral)':'var(--ink-3)' }}>{TYPE_LABEL[entry.type]}</span>
      </div>

      {isQ && (
        <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 11px', borderRadius:20,
          border:'1px solid color-mix(in oklab, var(--glow-coral) 40%, var(--hair))', marginBottom:14,
          fontSize:12, color:'var(--ink-2)' }}>
          <Icon name="question" s={13} c="var(--glow-coral)"/> {window.t('still_gathering')}
        </div>
      )}

      <h1 style={{ margin:0, fontFamily:'var(--serif)', fontWeight:400, fontSize: isQ?38:42, lineHeight:1.06,
        letterSpacing:'-0.015em', color:'var(--ink)', textWrap:'balance' }}>{entry.title}</h1>
      <p style={{ margin:'12px 0 0', fontSize:17, lineHeight:1.5, color:'var(--ink-2)', fontFamily:'var(--serif)', fontStyle:'italic' }}>
        {entry.subtitle}
      </p>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:18, paddingBottom:22, borderBottom:'1px solid var(--hair)' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--ink-3)' }}>
          <Icon name="spark" s={14} c="var(--accent)"/> {entry.updated}
        </span>
      </div>

      <section>
        {entry.lead.map((p,i)=>(
          <p key={i} style={{ ...proseP, fontSize:i===0?19:17, color:i===0?'var(--ink)':'var(--ink-2)' }}>
            {parseInline(p, opts)}
          </p>
        ))}
      </section>

      {entryProposals.length>0 && (
        <section style={{ marginTop:28, display:'grid', gap:12 }}>
          {entryProposals.map(proposal=>(
            <WikiProposalBlock key={proposal.id} proposal={proposal} onApply={onApplyProposal} onDismiss={onDismissProposal} />
          ))}
        </section>
      )}

      {entry.sections.map(sec=>(
        <section key={sec.id} style={{ marginTop:40 }}>
          <h2 style={h2Style}>{sec.heading}</h2>
          {sec.blocks.map((b,i)=><Block key={i} b={b} opts={opts} />)}
        </section>
      ))}

      {entry.sections.length===0 && entry.type==='concept' && (
        <div style={{ marginTop:34, padding:'20px 22px', borderRadius:14, border:'1px dashed var(--hair)', background:'var(--card)' }}>
          <div className="mono-label" style={{ marginBottom:8 }}>{window.t('evergreen')}</div>
          <p style={{ margin:0, fontSize:15, lineHeight:1.6, color:'var(--ink-2)' }}>
            {window.t('young_concept')}
          </p>
        </div>
      )}
    </div>
  );
}

function WikiProposalBlock({ proposal, onApply, onDismiss }) {
  const tone = proposalTone(proposal.status);
  const canApply = proposal.status === 'pending';
  return (
    <div style={{ position:'relative', padding:'15px 16px 15px 18px', borderRadius:12,
      border:'1px solid color-mix(in oklab, '+tone.hue+' 42%, var(--hair))',
      background:'linear-gradient(90deg, color-mix(in oklab, '+tone.hue+' 13%, transparent), var(--card) 44%)',
      boxShadow:'inset 3px 0 0 '+tone.hue }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div style={{ minWidth:0 }}>
          <div className="mono-label" style={{ color:tone.hue, display:'flex', alignItems:'center', gap:7 }}>
            <Icon name={proposal.status==='accepted'?'check':proposal.status==='blocked'?'close':'spark'} s={13} c={tone.hue}/>
            {tone.label}
          </div>
          <h3 style={{ margin:'8px 0 0', fontSize:16, lineHeight:1.25, fontWeight:650, color:'var(--ink)' }}>
            {proposal.heading}
          </h3>
        </div>
        <span className="mono-label" style={{ flex:'none', color:'var(--ink-4)' }}>{proposal.patchStatus || 'append'}</span>
      </div>
      <p style={{ margin:'9px 0 0', fontSize:15.5, lineHeight:1.62, color:'var(--ink-2)' }}>
        {proposal.body}
      </p>
      {(proposal.reviewer && (proposal.reviewer.summary || proposal.reviewer.wikiReview)) && (
        <div style={{ marginTop:10, padding:'9px 10px', borderRadius:9, background:'color-mix(in oklab, '+tone.hue+' 7%, transparent)',
          fontSize:12.5, lineHeight:1.45, color:'var(--ink-3)' }}>
          {proposal.reviewer.wikiReview || proposal.reviewer.summary}
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginTop:12 }}>
        <div className="mono-label" style={{ color:'var(--ink-4)' }}>{proposal.sourceTitle}</div>
        {proposal.status==='accepted' ? (
          <span className="mono-label" style={{ color:tone.hue }}>Applied</span>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>onDismiss && onDismiss(proposal)} style={proposalGhostBtn}>Dismiss</button>
            <button disabled={!canApply} onClick={()=>onApply && onApply(proposal)}
              style={{ ...proposalApplyBtn, opacity:canApply?1:0.45 }}>
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- block renderer ---------- */
function Block({ b, opts }) {
  if (b.type==='p') return <p style={proseP}>{parseInline(b.text, opts)}</p>;
  if (b.type==='callout') return (
    <blockquote style={{ margin:'22px 0', padding:'4px 0 4px 22px', borderLeft:'2px solid '+(b.voice?'var(--glow-amber)':'var(--accent)') }}>
      <span style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }} className="mono-label">
        {b.voice && <Icon name="voice" s={13} c="var(--glow-amber)"/>}{b.voice?window.t('from_voice'):window.t('synthesis')}
      </span>
      <span style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:21, lineHeight:1.4, color:'var(--ink)' }}>
        {parseInline(b.text, opts)}
      </span>
    </blockquote>
  );
  if (b.type==='deflist') return (
    <dl style={{ margin:'18px 0', display:'flex', flexDirection:'column', gap:14 }}>
      {b.items.map((it,i)=>(
        <div key={i} style={{ display:'grid', gridTemplateColumns:'150px 1fr', gap:18, alignItems:'baseline' }}>
          <dt><a className="wikilink" onClick={(e)=>opts.onLink(it.node,e)} style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:18 }}>{it.term}</a></dt>
          <dd style={{ margin:0, fontSize:15.5, lineHeight:1.55, color:'var(--ink-2)' }}>{parseInline(it.def, opts)}</dd>
        </div>
      ))}
    </dl>
  );
  if (b.type==='open') return (
    <div style={{ margin:'18px 0', display:'flex', flexDirection:'column', gap:10 }}>
      {b.items.map((q,i)=>(
        <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)', marginTop:3 }}>0{i+1}</span>
          <span style={{ fontSize:16, lineHeight:1.5, color:'var(--ink-2)', fontFamily:'var(--serif)', fontStyle:'italic' }}>{q}</span>
        </div>
      ))}
    </div>
  );
  return null;
}

/* ============================================================
   CATEGORY INDEX  (shelf browse view)
   ============================================================ */
function CategoryIndex({ data, litByMap, catId, onOpen }) {
  const cat = LX.CAT_BY[catId];
  if(!cat) return <EmptyWiki onAddSource={()=>{}} />;
  const es = LX.wikiEntriesInCategory(catId, litByMap);
  return (
    <div style={{ maxWidth:760, margin:'0 auto' }}>
      <div className="mono-label" style={{ marginBottom:14, color:hueColor(cat.hue) }}>{window.t('category')}</div>
      <h1 style={{ margin:0, fontFamily:'var(--serif)', fontWeight:400, fontSize:44, lineHeight:1.05, letterSpacing:'-0.015em', color:'var(--ink)' }}>{cat.label}</h1>
      <p style={{ margin:'12px 0 0', fontSize:18, lineHeight:1.5, color:'var(--ink-2)', fontFamily:'var(--serif)', fontStyle:'italic' }}>{cat.note}</p>
      <div style={{ marginTop:8, paddingBottom:26, borderBottom:'1px solid var(--hair)' }}>
        <span className="mono-label">{window.t('n_entries', es.length)}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:26 }}>
        {es.map(e=>{ const srcs=LX.sourcesForEntry(e.id); return (
          <button key={e.id} onClick={()=>onOpen(e.id)} style={indexCard}
            onMouseEnter={ev=>ev.currentTarget.style.borderColor='var(--ink-4)'}
            onMouseLeave={ev=>ev.currentTarget.style.borderColor='var(--hair)'}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color: e.type==='question'?'var(--glow-coral)': e.type==='moc'?'var(--accent)':'var(--ink-4)' }}><EntryGlyph type={e.type} s={15}/></span>
              <span className="mono-label" style={{ fontSize:9, color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}>{TYPE_LABEL[e.type]}</span>
            </div>
            <div style={{ fontFamily:'var(--serif)', fontStyle: e.type==='question'?'italic':'normal', fontSize:21, lineHeight:1.15, color:'var(--ink)', marginTop:10, textWrap:'pretty' }}>{e.title}</div>
            <div style={{ fontSize:13.5, lineHeight:1.5, color:'var(--ink-3)', marginTop:7, textWrap:'pretty' }}>{e.subtitle}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:13 }} className="mono-label">
              <span style={{ fontSize:9 }}>{window.t('n_sources_low', srcs.length)}</span>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--ink-4)' }}/>
              <span style={{ fontSize:9 }}>{e.updatedShort}</span>
            </div>
          </button>
        );})}
      </div>
    </div>
  );
}

/* ============================================================
   RIGHT-RAIL metadata for an entry
   ============================================================ */
function EntryMeta({ entry, litByMap, hiCite, srcRefs, onGotoMapNode, onOpenEntry, onOpenSource, onBrowseCat }) {
  const maps = LX.mapsForEntry(entry);
  const srcs = LX.sourcesForEntry(entry.id);
  const back = (entry.backlinks||[]).map(id=>LX.ENTRY_BY[id]).filter(Boolean);
  const fwd = LX.linksFromEntry(entry);
  const cats = LX.relatedCategories(entry).filter(c=>c.id!==entry.category);
  return (
    <>
      <MapCheckPanel maps={maps} litByMap={litByMap} onGotoMapNode={onGotoMapNode} />
      <SourcesBehindPanel srcs={srcs} hiCite={hiCite} srcRefs={srcRefs} onOpenSource={onOpenSource} />

      {/* related categories */}
      {cats.length>0 && (
        <div style={{ marginTop:24 }}>
          <div className="mono-label" style={{ marginBottom:11 }}>{window.t('related_categories')}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {cats.map(c=>(
              <button key={c.id} onClick={()=>onBrowseCat&&onBrowseCat(c.id)} style={catChip}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:`radial-gradient(circle, ${hueColor(c.hue)}, transparent 72%)` }}/>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* linked entries (forward) */}
      {fwd.length>0 && (
        <div style={{ marginTop:24 }}>
          <div className="mono-label" style={{ marginBottom:10 }}>{window.t('links_from')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {fwd.map(e=>(
              <button key={e.id} onClick={()=>onOpenEntry(e.id)} style={backlinkBtn}>
                <span style={{ flex:'none', color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}><EntryGlyph type={e.type} s={12}/></span>
                {e.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* backlinks */}
      {back.length>0 && (
        <div style={{ marginTop:24 }}>
          <div className="mono-label" style={{ marginBottom:10 }}>{window.t('links_to')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {back.map(e=>(
              <button key={e.id} onClick={()=>onOpenEntry(e.id)} style={backlinkBtn}>
                <span style={{ flex:'none', color: e.type==='question'?'var(--glow-coral)':'var(--ink-4)' }}><EntryGlyph type={e.type} s={12}/></span>
                {e.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function MapCheckPanel({ maps, litByMap, onGotoMapNode }) {
  return (
    <div style={{ marginTop:22 }}>
      <div className="mono-label" style={{ marginBottom:11 }}>{window.t('map_check')}</div>
      {maps.length ? (
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {maps.map(({map,node})=>{ const n=map.nodes.find(x=>x.id===node); const e=n?effExploredW(n,(litByMap&&litByMap[map.id])||{}):0; return (
            <button key={map.id} onClick={()=>onGotoMapNode(map.id, node)} title={window.t('open_map_check')}
              style={{ ...mapMetaRow, cursor:'pointer' }}>
              <span style={{ width:9, height:9, borderRadius:'50%', flex:'none',
                background:`radial-gradient(circle, ${hueColor(map.accentHue)}, transparent 72%)` }}/>
              <span style={{ minWidth:0, flex:1, display:'flex', flexDirection:'column', gap:6, textAlign:'left' }}>
                <span style={{ fontSize:13, color:'var(--ink)', fontWeight:500, lineHeight:1.25 }}>{map.title}</span>
                <CoverageBar pct={Math.max(4, Math.round(e*100))} hue={n?n.hue:map.accentHue} height={4}/>
                <span className="mono-label" style={{ fontSize:8.5 }}>{window.t('pct_lit_show', n?n.label:'—', Math.round(e*100))}</span>
              </span>
              <span style={{ flex:'none', color:'var(--ink-4)' }}><Icon name="upright" s={13}/></span>
            </button>
          );})}
        </div>
      ) : (
        <div style={emptyRailPanel}>{window.t('no_map_check')}</div>
      )}
    </div>
  );
}

function SourcesBehindPanel({ srcs, hiCite, srcRefs, onOpenSource }) {
  return (
    <div style={{ marginTop:24 }}>
      <div className="mono-label" style={{ marginBottom:11 }}>{window.t('sources_behind_entry', srcs.length)}</div>
      {srcs.length ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {srcs.map(s=>(
            <button key={s.id} onClick={()=>onOpenSource&&onOpenSource(s.id)} ref={el=>srcRefs.current[s.n]=el} style={{
              display:'flex', gap:11, padding:'10px 11px', borderRadius:10, width:'100%', textAlign:'left',
              border:'1px solid '+(hiCite===s.n?'var(--accent)':'var(--hair-soft)'),
              background: hiCite===s.n?'var(--accent-soft)':'var(--card)',
              boxShadow: hiCite===s.n?'0 0 0 3px var(--accent-soft)':'none', transition:'all .3s' }}>
              <span style={{ width:30, height:30, borderRadius:8, flex:'none', display:'grid', placeItems:'center',
                background:'color-mix(in oklab, '+SRC_TINT[s.tint]+' 16%, transparent)', color:SRC_TINT[s.tint] }}>
                <Icon name={s.type} s={16}/>
              </span>
              <span style={{ minWidth:0, display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-4)' }}>[{s.n}]</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:9.5, letterSpacing:'.1em', textTransform:'uppercase', color:SRC_TINT[s.tint] }}>{s.type}</span>
                </span>
                <span style={{ fontSize:13, color:'var(--ink)', lineHeight:1.3, fontWeight:500, textWrap:'pretty' }}>{s.title}</span>
                <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>{s.meta}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={emptyRailPanel}>{window.t('no_sources_behind')}</div>
      )}
    </div>
  );
}

function IndexMeta({ data, litByMap, catId }) {
  const es = LX.wikiEntriesInCategory(catId, litByMap);
  const concepts = es.filter(e=>e.type==='concept').length;
  const questions = es.filter(e=>e.type==='question').length;
  return (
    <div style={{ marginTop:22 }}>
      <div className="mono-label" style={{ marginBottom:12 }}>{window.t('in_category')}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <MetaStat label={window.t('concept_pages')} n={concepts} />
        <MetaStat label={window.t('type_question')} n={questions} />
        <MetaStat label={window.t('maps_of_content')} n={es.filter(e=>e.type==='moc').length} />
      </div>
    </div>
  );
}
function MetaStat({ label, n }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', padding:'10px 13px', borderRadius:10, border:'1px solid var(--hair-soft)', background:'var(--card)' }}>
      <span style={{ fontSize:13, color:'var(--ink-2)' }}>{label}</span>
      <span style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:22, color:'var(--ink)' }}>{n}</span>
    </div>
  );
}

const proseP = { margin:'16px 0 0', fontSize:17, lineHeight:1.68, color:'var(--ink-2)', textWrap:'pretty' };
const h2Style = { margin:'0 0 4px', fontFamily:'var(--sans)', fontWeight:600, fontSize:14, letterSpacing:'.02em',
  textTransform:'uppercase', color:'var(--ink-3)' };
const backlinkBtn = { display:'flex', alignItems:'center', gap:9, textAlign:'left', border:'none', background:'transparent',
  padding:'6px 5px', fontSize:13, color:'var(--ink-2)', fontFamily:'var(--sans)', borderRadius:7, lineHeight:1.3 };
const collapseAllBtn = { display:'inline-flex', alignItems:'center', gap:5, padding:'5px 9px', borderRadius:8,
  border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-3)', fontSize:11, fontWeight:600,
  fontFamily:'var(--sans)', cursor:'pointer' };
const branchHead = { width:'100%', display:'flex', alignItems:'center', gap:8, textAlign:'left', border:'none',
  background:'transparent', padding:'7px 8px', borderRadius:8, cursor:'pointer',
  fontFamily:'var(--mono)', fontSize:10.5, letterSpacing:'.13em', textTransform:'uppercase', fontWeight:600, color:'var(--ink-2)' };
const atlasSearchW = { display:'flex', alignItems:'center', gap:8, marginTop:11, padding:'9px 12px', borderRadius:10,
  border:'1px solid var(--hair)', background:'var(--card)' };
const atlasSearchInputW = { flex:1, border:'none', background:'transparent', outline:'none', fontFamily:'var(--sans)', fontSize:13, color:'var(--ink)', minWidth:0 };
const catCaret = { border:'none', background:'transparent', padding:'6px 4px 6px 8px', display:'grid', placeItems:'center' };
const catHeader = { flex:1, display:'flex', alignItems:'center', gap:9, textAlign:'left', border:'none', background:'transparent',
  padding:'7px 8px 7px 2px', fontSize:12.5, fontWeight:600, fontFamily:'var(--sans)' };
const addSrcBtn = { width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
  padding:'12px', borderRadius:12, border:'1px dashed var(--ink-4)', background:'var(--card)',
  color:'var(--ink)', fontSize:14, fontWeight:500 };
const indexCard = { textAlign:'left', border:'1px solid var(--hair)', background:'var(--card)', borderRadius:14,
  padding:'16px 17px', transition:'border-color .2s', cursor:'pointer' };
const mapMetaRow = { display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left', padding:'9px 10px',
  borderRadius:10, border:'1px solid var(--hair-soft)', background:'var(--card)' };
const emptyRailPanel = { padding:'11px 12px', borderRadius:10, border:'1px solid var(--hair-soft)', background:'var(--card)',
  color:'var(--ink-3)', fontSize:12.5, lineHeight:1.45 };
const catChip = { display:'inline-flex', alignItems:'center', gap:7, padding:'6px 11px', borderRadius:18,
  border:'1px solid var(--hair)', background:'var(--card)', color:'var(--ink-2)', fontSize:12, fontWeight:500, cursor:'pointer' };
const wikiGhostBtn = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 14px',
  borderRadius:11, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-2)', fontSize:13.5, fontWeight:600 };
const proposalGhostBtn = { padding:'7px 11px', borderRadius:9, border:'1px solid var(--hair)',
  background:'transparent', color:'var(--ink-3)', fontSize:12.5, fontWeight:600 };
const proposalApplyBtn = { padding:'7px 12px', borderRadius:9, border:'none',
  background:'var(--ink)', color:'var(--paper)', fontSize:12.5, fontWeight:650 };

window.WikiView = WikiView;
