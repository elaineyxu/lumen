/* ============================================================
   LUMEN — Settings
   Language · Appearance · Reading voice · Knowledge base · About
   Deliberately small: the essentials, no clutter.
   ============================================================ */
const { useMemo: useMemoSet } = React;

function SettingsRow({ label, note, children }) {
  return (
    <div style={setRow}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
        {note && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5, textWrap: 'pretty' }}>{note}</div>}
      </div>
      <div style={{ flex: 'none' }}>{children}</div>
    </div>
  );
}

function SettingsCard({ title, note, children }) {
  return (
    <section style={setCard}>
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{title}</h2>
        {note && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>{note}</p>}
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  );
}

function MiniSlider({ value, min, max, step, onChange }) {
  return (
    <input type="range" value={value} min={min} max={max} step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: 168, accentColor: 'var(--accent)' }} />
  );
}

function Settings({ data, litByMap, inbox, t: tw, setTweak }) {
  const stats = LX.globalStats();
  const lang = window.LANG;
  const [workflow, setWorkflow] = React.useState(()=>window.LumenWorkflow ? window.LumenWorkflow.readConfig() : { mode:'backend', provider:'openai', modelPreset:'balanced', model:'auto', stages:{}, endpoint:'', apiKey:'' });
  const [saved, setSaved] = React.useState(false);

  React.useEffect(()=>{
    let cancelled = false;
    if(!window.LumenApi) return undefined;
    window.LumenApi.getAiSettings()
      .then(payload=>{
        if(cancelled || !payload.settings) return;
        setWorkflow(prev=>({ ...prev, ...payload.settings }));
      })
      .catch(()=>{});
    return ()=>{ cancelled = true; };
  },[]);

  const LANGS = [
    { id: 'zh', label: t('lang_zh'), sub: t('lang_zh_sub') },
    { id: 'en', label: t('lang_en'), sub: t('lang_en_sub') },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--paper)' }}>
      <GlowField blobs={[
        { x: 16, y: 14, r: 42, hue: 'violet', o: 0.08, dur: 38 },
        { x: 88, y: 84, r: 40, hue: 'teal', o: 0.07, dur: 34 },
      ]} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto', padding: '52px 40px 100px' }}>
        <div className="mono-label" style={{ marginBottom: 14 }}>{t('settings')}</div>
        <h1 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 38, lineHeight: 1.12, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {t('settings_sub')}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 38 }}>

          {/* LANGUAGE */}
          <SettingsCard title={t('set_language')} note={t('set_language_note')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {LANGS.map((l) => {
                const on = lang === l.id;
                return (
                  <button key={l.id} onClick={() => { if (!on) window.setLang(l.id); }} style={{ ...langCard,
                    borderColor: on ? 'var(--accent)' : 'var(--hair)',
                    background: on ? 'var(--accent-soft)' : 'var(--card)',
                    boxShadow: on ? '0 0 0 3px var(--accent-soft)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{l.label}</span>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
                        border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--ink-4)'),
                        background: on ? 'var(--accent)' : 'transparent', color: 'var(--paper)' }}>
                        {on && <Icon name="check" s={11} />}
                      </span>
                    </div>
                    <div className="mono-label" style={{ marginTop: 8, fontSize: 9 }}>{l.sub}</div>
                  </button>
                );
              })}
            </div>
          </SettingsCard>

          {/* APPEARANCE */}
          <SettingsCard title={t('set_appearance')} note={t('set_appearance_note')}>
            <SettingsRow label={t('set_glow')}>
              <MiniSlider value={tw.glow} min={0.3} max={1.7} step={0.05} onChange={(v) => setTweak('glow', v)} />
            </SettingsRow>
            <SettingsRow label={t('set_grain')}>
              <MiniSlider value={tw.grain} min={0} max={1} step={0.05} onChange={(v) => setTweak('grain', v)} />
            </SettingsRow>
            <SettingsRow label={t('set_voice_label')} note={t('set_voice_note')}>
              <div style={voiceSeg}>
                {['Editorial', 'Quiet sans'].map((v) => {
                  const on = tw.type === v;
                  return (
                    <button key={v} onClick={() => setTweak('type', v)} style={{ ...voiceSegBtn,
                      background: on ? 'var(--card-solid)' : 'transparent',
                      color: on ? 'var(--ink)' : 'var(--ink-3)', fontWeight: on ? 600 : 500,
                      boxShadow: on ? '0 1px 3px oklch(0.3 0.04 280 / 0.12), 0 0 0 1px var(--hair)' : 'none' }}>
                      {v === 'Editorial' ? t('tw_editorial') : t('tw_quiet')}
                    </button>
                  );
                })}
              </div>
            </SettingsRow>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => { setTweak('glow', 1.1); setTweak('grain', 0.5); setTweak('type', 'Editorial'); }} style={resetBtn}>
                {t('reset_atmosphere')}
              </button>
            </div>
          </SettingsCard>

          {/* AI WORKFLOW */}
          <SettingsCard title="Lumen AI Workflow" note="只需要接入 API。模型选择和每个工作流模块的路由由 Lumen 内部自动处理。">
            <SettingsRow label="LLM provider" note="Lumen 使用官方 OpenAI Responses API；source parsing、chunking、wiki、graph、map 和 feedback 会自动选择合适模型。">
              <div className="mono-label" style={{ color:'var(--ink)' }}>OpenAI Responses API</div>
            </SettingsRow>
            <SettingsRow label="API key" note="保存后 Add Source 会直接使用 Lumen 内部 AI workflow。也可以在 server 环境里设置 OPENAI_API_KEY。">
              <input value={workflow.apiKey||''} onChange={e=>{ setWorkflow({ ...workflow, apiKey:e.target.value }); setSaved(false); }}
                placeholder="sk-..." type="password" style={workflowInput} />
            </SettingsRow>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginTop:14 }}>
              <div className="mono-label" style={{ color:saved?'var(--accent)':'var(--ink-3)' }}>
                {saved ? 'Saved · Add Source will use AI workflow' : 'Models are routed automatically'}
              </div>
              <button onClick={()=>{ window.LumenWorkflow && window.LumenWorkflow.saveConfig({ ...workflow, endpoint:'' }); setSaved(true); }} style={resetBtn}>
                保存 API
              </button>
            </div>
          </SettingsCard>

          {/* ABOUT */}
          <SettingsCard title={t('set_about')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ flex: 'none', marginTop: -3, marginLeft: -3 }}><HorizonMark s={38}/></span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', textWrap: 'pretty' }}>{t('set_about_note')}</p>
            </div>
          </SettingsCard>

        </div>
      </div>
    </div>
  );
}

const setCard = { padding: '20px 22px', borderRadius: 18, border: '1px solid var(--hair)', background: 'var(--card)',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' };
const setRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
  padding: '13px 0', borderTop: '1px solid var(--hair-soft)' };
const langCard = { textAlign: 'left', padding: '15px 16px', borderRadius: 14, border: '1px solid var(--hair)',
  background: 'var(--card)', transition: 'all .18s', cursor: 'pointer' };
const voiceSeg = { display: 'inline-flex', padding: 4, gap: 3, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--hair)' };
const voiceSegBtn = { padding: '7px 14px', borderRadius: 8, border: 'none', background: 'transparent',
  fontSize: 13, fontFamily: 'var(--sans)', transition: 'all .15s' };
const resetBtn = { padding: '8px 14px', borderRadius: 10, border: '1px solid var(--hair)', background: 'var(--card)',
  color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 500 };
const workflowInput = { width: 320, maxWidth:'42vw', padding:'9px 11px', borderRadius:10, border:'1px solid var(--hair)',
  background:'var(--card-solid)', color:'var(--ink)', outline:'none', fontSize:12.5 };
const kbCell = { position: 'relative', overflow: 'hidden', padding: '15px 15px 13px', borderRadius: 14,
  border: '1px solid var(--hair-soft)', background: 'var(--card)' };

window.Settings = Settings;
