/* ============================================================
   LUMEN — Add Source flow (modal)
   ============================================================ */
const { useState:useStateA, useEffect:useEffectA, useRef:useRefA } = React;

const SRC_TYPES = [
  { type:'link',  label:window.t('t_link'),  tint:'teal',   ph:window.t('tph_link'), sample:'https://plato.stanford.edu/entries/consciousness/' },
  { type:'paper', label:window.t('t_paper'), tint:'blue',   ph:window.t('tph_paper'), sample:'arXiv:2308.08708 — Consciousness in Artificial Intelligence', drop:true },
  { type:'video', label:window.t('t_video'), tint:'coral',  ph:window.t('tph_video'), sample:'youtu.be/lecture — “Can AI be sentient?”' },
  { type:'image', label:window.t('t_image'), tint:'violet', ph:window.t('tph_image'), drop:true },
  { type:'chat',  label:window.t('t_chat'),  tint:'amber',  ph:window.t('tph_chat'), area:true },
  { type:'voice', label:window.t('t_voice'), tint:'amber',  ph:window.t('tph_voice'), drop:true, mic:true },
  { type:'note',  label:window.t('t_note'),  tint:'blue',   ph:window.t('tph_note'), area:true },
];

function AddSource({ map, presetNode, targetEntryId, onClose, onApply, onProposal }) {
  const NODES = map.nodes;
  const byId = Object.fromEntries(NODES.map(n=>[n.id,n]));
  const [step, setStep] = useStateA('choose');   // choose | input | compiling | done
  const [sel, setSel] = useStateA(presetNode ? SRC_TYPES[1] : null);
  const [val, setVal] = useStateA('');
  const [progress, setProgress] = useStateA(0);
  const [compileResult, setCompileResult] = useStateA(null);
  const [compileError, setCompileError] = useStateA(null);
  const [compiledSource, setCompiledSource] = useStateA(null);
  const [filePayload, setFilePayload] = useStateA(null);
  const [fileError, setFileError] = useStateA('');
  const fileInputRef = useRefA(null);

  const COMPILE = [window.t('comp_read'), window.t('comp_extract'), window.t('comp_link'), window.t('comp_weave')];
  const urlRe = /^https?:\/\/[^\s<>"']+$/i;
  const fileAccept = sel && sel.type === 'paper' ? '.pdf,.txt,.md,.html,.htm,.doc,.docx,application/pdf,text/*'
    : sel && sel.type === 'image' ? 'image/*'
    : sel && sel.type === 'voice' ? 'audio/*,.m4a,.mp3,.wav,.webm'
    : '*/*';

  const readFile = (file)=>new Promise((resolve, reject)=>{
    if(!file) return resolve(null);
    if(file.size > 8_000_000) return reject(new Error('文件超过 8MB，请先粘贴正文、摘要或使用更小的文件。'));
    const textLike = /^text\//.test(file.type) || /(\.txt|\.md|\.markdown|\.html|\.htm|\.json|\.csv|\.xml)$/i.test(file.name);
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('读取文件失败'));
    reader.onload = ()=>resolve({
      name:file.name,
      mimeType:file.type || 'application/octet-stream',
      size:file.size,
      text:textLike ? String(reader.result || '') : '',
      dataUrl:textLike ? '' : String(reader.result || ''),
    });
    if(textLike) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });

  const pickFile = (file)=>{
    setFileError('');
    readFile(file)
      .then(payload=>setFilePayload(payload))
      .catch(err=>{ setFilePayload(null); setFileError(err && err.message ? err.message : String(err)); });
  };

  const sourceFromInput = ()=>{
    const raw = (val||'').trim();
    const firstLine = raw.split('\n')[0];
    const url = urlRe.test(raw) ? raw : '';
    const fileTitle = filePayload && filePayload.name;
    const title = fileTitle || firstLine || (sel ? sel.label : 'New source');
    const source = {
      id:'source-'+Date.now(),
      type:sel ? sel.type : 'note',
      title,
      text:url ? '' : raw,
      url,
    };
    if(sel && (sel.type === 'chat' || sel.type === 'note')) source.text = raw;
    if(sel && sel.type === 'voice' && raw) source.transcript = raw;
    if(sel && sel.type === 'image' && raw) source.description = raw;
    if(filePayload) {
      source.file = {
        ...filePayload,
        description: sel && sel.type === 'image' ? raw : '',
        transcript: sel && sel.type === 'voice' ? raw : '',
        ocrText: sel && sel.type === 'image' ? raw : '',
      };
    }
    return source;
  };

  useEffectA(()=>{
    if(step!=='compiling') return;
    setProgress(0);
    setCompileResult(null);
    setCompileError(null);
    setCompiledSource(null);
    let cancelled=false;
    let i=0;
    const t=setInterval(()=>{ i=Math.min(i+1, COMPILE.length-1); setProgress(i); }, 620);
    const source = sourceFromInput();
    setCompiledSource(source);
    window.LumenWorkflow.compileSource({ source, map, boosts, targetEntryId })
      .then(result=>{
        if(cancelled) return;
        clearInterval(t);
        setProgress(COMPILE.length);
        setCompileResult(result);
        if(onProposal) onProposal({ result, source, mapId:map.id, boosts });
        setTimeout(()=>{ if(!cancelled) setStep('done'); }, 420);
      })
      .catch(err=>{
        if(cancelled) return;
        clearInterval(t);
        setProgress(COMPILE.length);
        setCompileError(err && err.message ? err.message : String(err));
        setTimeout(()=>{ if(!cancelled) setStep('done'); }, 420);
      });
    return ()=>{ cancelled=true; clearInterval(t); };
  },[step]);

  // choose nodes to illuminate within THIS map
  const boosts = React.useMemo(()=>{
    if(!sel) return {};
    const b = {};
    if(presetNode && byId[presetNode]){
      b[presetNode] = 0.45;
      // brighten one or two dim neighbours
      (map.links||[]).forEach(([a,c])=>{
        const other = a===presetNode?c : c===presetNode?a : null;
        if(other && byId[other] && byId[other].explored<0.6 && Object.keys(b).length<3) b[other] = 0.3;
      });
    } else {
      // pick the 2-3 least-explored nodes
      [...NODES].sort((x,y)=>x.explored-y.explored).slice(0,3).forEach((n,i)=>{ b[n.id] = i===0?0.5:0.32; });
    }
    return b;
  },[sel, presetNode, map.id]);
  const litIds = Object.keys(boosts);
  const claims = compileResult && compileResult.claims ? compileResult.claims.length : 2 + litIds.length;
  const reviewer = compileResult && compileResult.feedback;
  const reviewRejected = reviewer && reviewer.recommendation === 'reject';

  const finish = (destination)=>{ onApply(boosts, { type:sel.type, claims, lit:litIds, compileResult, source:compiledSource, destination, targetEntryId }); };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, display:'grid', placeItems:'center',
      background:'oklch(0.3 0.02 280 / 0.18)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)', animation:'fadeUp .25s ease' }}>
      <Frost onClick={e=>e.stopPropagation()} style={{ width:580, maxWidth:'92vw', maxHeight:'88vh', overflow:'auto', padding:0 }}>
        {/* header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 0' }}>
          <div className="mono-label">{window.t('addsrc_title')}</div>
          <button onClick={onClose} style={{ ...iconBtnA }}><Icon name="close" s={16}/></button>
        </div>

        {/* STEP: choose */}
        {step==='choose' && (
          <div style={{ padding:'14px 24px 26px' }}>
            <h2 style={modalTitle}>{window.t('what_adding')}</h2>
            <p style={modalSub}>{window.t('addsrc_sub')}</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:18 }}>
              {SRC_TYPES.map(t=>(
                <button key={t.type} onClick={()=>{ setSel(t); setVal(t.sample||''); setFilePayload(null); setFileError(''); setStep('input'); }}
                  style={{ ...typeCard }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--ink-4)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--hair)'}>
                  <span style={{ width:34, height:34, borderRadius:9, display:'grid', placeItems:'center', flex:'none',
                    background:'color-mix(in oklab, '+SRC_TINT[t.tint]+' 16%, transparent)', color:SRC_TINT[t.tint] }}>
                    <Icon name={t.type} s={18}/>
                  </span>
                  <span style={{ fontSize:14.5, fontWeight:500, color:'var(--ink)' }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP: input */}
        {step==='input' && sel && (
          <div style={{ padding:'14px 24px 24px' }}>
            <button onClick={()=>setStep('choose')} style={backLink}><Icon name="back" s={14}/> {window.t('all_types')}</button>
            <div style={{ display:'flex', alignItems:'center', gap:11, marginTop:12 }}>
              <span style={{ width:36, height:36, borderRadius:10, display:'grid', placeItems:'center', flex:'none',
                background:'color-mix(in oklab, '+SRC_TINT[sel.tint]+' 16%, transparent)', color:SRC_TINT[sel.tint] }}>
                <Icon name={sel.type} s={19}/>
              </span>
              <h2 style={{ ...modalTitle, margin:0 }}>{sel.label}</h2>
            </div>

            {sel.drop ? (
              <>
              <div style={dropZone}
                onClick={()=>fileInputRef.current&&fileInputRef.current.click()}
                onDragOver={e=>{ e.preventDefault(); e.currentTarget.style.borderColor='var(--accent)'; }}
                onDragLeave={e=>{ e.currentTarget.style.borderColor='var(--ink-4)'; }}
                onDrop={e=>{ e.preventDefault(); e.currentTarget.style.borderColor='var(--ink-4)'; pickFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
                <input ref={fileInputRef} type="file" accept={fileAccept} style={{ display:'none' }}
                  onChange={e=>pickFile(e.target.files && e.target.files[0])}/>
                <Icon name={sel.mic?'voice':sel.type} s={26} c="var(--ink-4)"/>
                <div style={{ fontSize:14, color:'var(--ink-2)', marginTop:10 }}>{filePayload ? filePayload.name : sel.ph}</div>
                <div className="mono-label" style={{ marginTop:6 }}>{filePayload ? Math.round((filePayload.size||0)/1024)+' KB loaded' : (sel.mic?window.t('addsrc_drop_mic'):window.t('addsrc_drop_file'))}</div>
                {sel.sample && <div style={{ marginTop:14, fontSize:12.5, color:'var(--ink-3)', fontStyle:'italic', fontFamily:'var(--serif)' }}>{window.t('example_pre')}{sel.sample}</div>}
              </div>
              {fileError && <div style={{ marginTop:10, fontSize:12.5, color:'var(--glow-coral)', lineHeight:1.45 }}>{fileError}</div>}
              <textarea value={val} onChange={e=>setVal(e.target.value)}
                placeholder={sel.type==='image'?'可选：粘贴 OCR 文本、图片说明，或让文件元数据先入库':sel.type==='voice'?'可选：粘贴转录文本；音频文件会作为来源附件入库':sel.ph}
                style={{ ...inputBase, minHeight:86, resize:'vertical' }}/>
              </>
            ) : sel.area ? (
              <textarea value={val} onChange={e=>setVal(e.target.value)} placeholder={sel.ph} style={{ ...inputBase, minHeight:120, resize:'vertical' }}/>
            ) : (
              <input value={val} onChange={e=>setVal(e.target.value)} placeholder={sel.ph} style={inputBase}/>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 }}>
              <button onClick={onClose} style={btnGhostA}>{window.t('cancel')}</button>
              <button onClick={()=>setStep('compiling')} style={btnSolidA}>
                <Icon name="spark" s={15}/> {window.t('compile_with')}
              </button>
            </div>
          </div>
        )}

        {/* STEP: compiling */}
        {step==='compiling' && (
          <div style={{ padding:'26px 24px 30px' }}>
            <h2 style={{ ...modalTitle, fontFamily:'var(--serif)', fontStyle:'italic', fontWeight:400 }}>{window.t('lumen_reading')}</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:22 }}>
              {COMPILE.map((c,i)=>{ const dn=i<progress, on=i===progress; return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, opacity: i<=progress?1:0.4, transition:'opacity .4s' }}>
                  <span style={{ width:22, height:22, borderRadius:'50%', flex:'none', display:'grid', placeItems:'center',
                    border:'1px solid '+(dn?'transparent':'var(--hair)'), background: dn?'var(--accent)':'transparent', color:'var(--paper)' }}>
                    {dn ? <Icon name="check" s={13}/> : on ? <span style={spinDot}/> : null}
                  </span>
                  <span style={{ fontSize:15, color: dn?'var(--ink)':'var(--ink-2)' }}>{c}</span>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* STEP: done */}
        {step==='done' && (
          <div style={{ padding:'26px 24px 28px', textAlign:'center' }}>
            <div style={{ width:54, height:54, borderRadius:'50%', margin:'0 auto', display:'grid', placeItems:'center',
              background:'radial-gradient(circle, var(--glow-blue), transparent 72%)' }}>
              <Icon name="spark" s={24} c="var(--ink)"/>
            </div>
            <h2 style={{ ...modalTitle, marginTop:14, textAlign:'center' }}>{window.t('woven_in')}</h2>
            <p style={{ ...modalSub, textAlign:'center' }}>
              {compileError ? window.t('done_unavailable') : (compileResult ? compileResult.sourceSummary : window.t('understanding_grew'))}
            </p>
            {compileError && (
              <div style={{ margin:'14px auto 0', maxWidth:440, padding:'10px 12px', borderRadius:12,
                border:'1px solid color-mix(in oklab, var(--glow-coral) 35%, var(--hair))',
                background:'color-mix(in oklab, var(--glow-coral) 12%, transparent)', color:'var(--ink-2)', fontSize:12.5, lineHeight:1.5 }}>
                {compileError}
              </div>
            )}

            {/* compact stats — the numbers users scan */}
            {!compileError && (
              <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:18, flexWrap:'wrap' }}>
                <Stat n={claims} label={window.t('new_claims')} />
                <Stat n={compileResult && compileResult.mapUpdates ? compileResult.mapUpdates.length : litIds.length} label={window.t('nodes_brightened')} />
                <Stat n={compileResult && compileResult.wikiPatches ? compileResult.wikiPatches.length : 1} label={window.t('done_wiki_props')} />
              </div>
            )}

            {/* reviewer — one-line verdict; only surface risk flags, and only when they block apply */}
            {reviewer && reviewer.summary && (
              <div style={{ marginTop:16, textAlign:'left', padding:'12px 13px', borderRadius:12,
                border:'1px solid var(--hair-soft)', background:'var(--card)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                  <div className="mono-label">{window.t('done_reviewer')}</div>
                  <span style={{ padding:'3px 8px', borderRadius:999, border:'1px solid var(--hair)',
                    fontSize:11, color:reviewRejected?'var(--glow-coral)':'var(--ink-3)' }}>
                    {reviewer.recommendation || 'review'}
                  </span>
                </div>
                <div style={{ marginTop:7, fontSize:13.5, lineHeight:1.45, color:'var(--ink-2)' }}>{reviewer.summary}</div>
                {reviewRejected && (reviewer.riskFlags||[]).length>0 && (
                  <div style={{ marginTop:9, display:'grid', gap:5 }}>
                    {(reviewer.riskFlags||[]).slice(0,2).map((risk,i)=>(
                      <div key={'risk-'+i} style={{ display:'flex', gap:7, alignItems:'flex-start', fontSize:12.5, color:'var(--ink-2)', lineHeight:1.45 }}>
                        <Icon name="spark" s={12} c="var(--glow-coral)"/><span>{risk}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* what will be written — heading + a clamped preview, at most two */}
            {compileResult && compileResult.wikiPatches && compileResult.wikiPatches.length>0 && (
              <div style={{ marginTop:16, textAlign:'left', display:'grid', gap:8 }}>
                <div className="mono-label">{window.t('done_wiki_props')}</div>
                {compileResult.wikiPatches.slice(0,2).map((patch,i)=>(
                  <div key={patch.entryId+'-'+i} style={{ padding:'11px 12px', borderRadius:12, border:'1px solid var(--hair-soft)', background:'var(--card)' }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)' }}>{patch.heading}</div>
                    <div style={{ marginTop:5, fontSize:12.5, lineHeight:1.45, color:'var(--ink-3)',
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{patch.body}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:24 }}>
              <button onClick={onClose} style={btnGhostA}>{window.t('done_hold')}</button>
              <button disabled={!compileResult || compileError || reviewRejected} onClick={()=>finish('wiki')} style={{ ...btnSolidA, opacity:(!compileResult || compileError || reviewRejected)?0.45:1 }}>
                <Icon name="check" s={15}/> {reviewRejected ? window.t('done_reviewer_hold') : window.t('done_confirm')}
              </button>
            </div>
          </div>
        )}
      </Frost>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div style={{ minWidth:96, padding:'12px 16px', borderRadius:12, border:'1px solid var(--hair)', background:'var(--card)' }}>
      <div style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:30, lineHeight:1, color:'var(--ink)' }}>{n}</div>
      <div className="mono-label" style={{ marginTop:6 }}>{label}</div>
    </div>
  );
}

const iconBtnA = { width:30, height:30, borderRadius:8, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-3)', display:'grid', placeItems:'center' };
const modalTitle = { margin:'10px 0 0', fontFamily:'var(--sans)', fontWeight:600, fontSize:23, letterSpacing:'-0.01em', color:'var(--ink)' };
const modalSub = { margin:'8px 0 0', fontSize:14.5, lineHeight:1.5, color:'var(--ink-3)' };
const typeCard = { display:'flex', alignItems:'center', gap:12, padding:'14px 14px', borderRadius:12,
  border:'1px solid var(--hair)', background:'var(--card)', textAlign:'left', transition:'border-color .2s' };
const dropZone = { marginTop:18, padding:'34px 20px', borderRadius:14, border:'1.5px dashed var(--ink-4)',
  background:'var(--card)', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' };
const inputBase = { width:'100%', marginTop:18, padding:'14px 16px', borderRadius:12, border:'1px solid var(--hair)',
  background:'var(--card-solid)', fontFamily:'var(--sans)', fontSize:15, color:'var(--ink)', outline:'none' };
const backLink = { display:'inline-flex', alignItems:'center', gap:5, border:'none', background:'transparent', color:'var(--ink-3)', fontSize:12.5, fontFamily:'var(--mono)' };
const btnSolidA = { display:'inline-flex', alignItems:'center', gap:7, padding:'11px 18px', borderRadius:11, border:'none', background:'var(--ink)', color:'var(--paper)', fontSize:14, fontWeight:500 };
const btnGhostA = { padding:'11px 18px', borderRadius:11, border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-2)', fontSize:14, fontWeight:500 };
const spinDot = { width:8, height:8, borderRadius:'50%', background:'var(--accent)', animation:'haloIn .6s ease-in-out infinite alternate' };

window.AddSource = AddSource;
