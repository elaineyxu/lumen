/* ============================================================
   LUMEN — shared components  (exports to window)
   ============================================================ */
const { useState, useRef, useEffect, useMemo } = React;

const HUE = {
  blue:'var(--glow-blue)', teal:'var(--glow-teal)', amber:'var(--glow-amber)',
  coral:'var(--glow-coral)', violet:'var(--glow-violet)', dim:'var(--glow-dim)',
};
function hueColor(h){ return HUE[h] || HUE.blue; }

/* ---------- film grain ---------- */
function Grain(){ return React.createElement('div', { className:'grain' }); }

/* ---------- atmospheric glow field (background) ---------- */
function GlowField({ blobs }) {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      {blobs.map((b,i)=>(
        <div key={i} style={{
          position:'absolute', left:b.x+'%', top:b.y+'%',
          width:b.r+'vmax', height:b.r+'vmax', transform:'translate(-50%,-50%)',
          borderRadius:'50%',
          background:`radial-gradient(circle at 50% 50%, ${hueColor(b.hue)} 0%, transparent 68%)`,
          opacity:`calc(${b.o} * var(--glow-strength))`,
          filter:'blur(8px)',
          '--dx':(b.dx||'2%'), '--dy':(b.dy||'-3%'),
          animation:`drift ${b.dur||26}s ease-in-out ${i*-3}s infinite`,
        }}/>
      ))}
    </div>
  );
}

/* ---------- frosted card ---------- */
function Frost({ className='', style={}, children, ...rest }) {
  return <div className={'frost '+className} style={style} {...rest}>{children}</div>;
}

/* ============================================================
   NODE BLOB — a glowing concept node on the Expert Map
   brightness scales with `explored` (your understanding)
   ============================================================ */
function NodeBlob({ node, lit, active, dimmed, onClick, onHover, lineStyle }) {
  // lit overrides explored when a node was just illuminated
  const explored = Math.min(1, node.explored + (lit||0));
  const isOn = explored > 0.18;
  const hue = isOn ? hueColor(node.hue) : HUE.dim;
  // halo opacity & spread grow with understanding
  const o = (0.12 + explored * 0.5);
  const spread = node.size * (0.9 + explored*0.5);

  return (
    <div
      data-map-node
      onClick={onClick}
      onPointerDown={(e)=>e.stopPropagation()}
      onMouseEnter={()=>onHover&&onHover(node.id)}
      onMouseLeave={()=>onHover&&onHover(null)}
      style={{
        position:'absolute', left:node.x+'%', top:node.y+'%',
        transform:'translate(-50%,-50%)', cursor:'pointer',
        zIndex: active?30: (node.hub?12:10),
        opacity: dimmed?0.32:1, transition:'opacity .4s ease',
      }}
    >
      {/* halo */}
      <div style={{
        position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
        width:spread, height:spread, borderRadius:'50%',
        background:`radial-gradient(circle at 50% 45%, ${hue} 0%, transparent 70%)`,
        opacity:`calc(${o} * var(--glow-strength))`,
        filter:`blur(${isOn? 3:5}px) saturate(${isOn?1.15:0.6})`,
        transition:'all .8s cubic-bezier(.2,.7,.2,1)',
        animation: lit? 'haloIn .9s cubic-bezier(.2,.8,.2,1)':'none',
      }}/>
      {/* active ring */}
      {active && (
        <div style={{
          position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
          width:node.size*0.62, height:node.size*0.62, borderRadius:'50%',
          border:'1px solid '+hue, opacity:0.6,
        }}/>
      )}
      {/* centre dot */}
      <div style={{
        position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
        width: node.hub?9:7, height:node.hub?9:7, borderRadius:'50%',
        background: isOn? 'var(--ink)' : 'var(--ink-4)',
        boxShadow: active? '0 0 0 4px '+hue.replace(')',' / 0.18)') : 'none',
        transition:'all .3s ease',
      }}/>
      {/* label */}
      <div style={{
        position:'absolute', left:'50%', top: node.size*0.30 + 10, transform:'translateX(-50%)',
        whiteSpace:'nowrap', textAlign:'center',
        fontFamily:'var(--sans)', fontSize: node.hub?13.5:12,
        fontWeight: node.hub?600:500,
        letterSpacing:'.005em',
        color: isOn? 'var(--ink)' : 'var(--ink-4)',
        opacity: dimmed?0.5:1,
        textShadow:'0 1px 8px var(--paper), 0 0 16px var(--paper)',
      }}>
        {node.label}
        {!isOn && <span style={{ display:'block', marginTop:2 }} className="mono-label">{window.t('unexplored')}</span>}
      </div>
    </div>
  );
}

/* ============================================================
   inline markup parser
   [[id||Label]] · ((n)) · __em__ · **bold**
   ============================================================ */
function parseInline(text, { onLink, onCite } = {}) {
  const out = [];
  const re = /\[\[([^\]|]+)\|\|([^\]]+)\]\]|\(\(([0-9]+)\)\)|__([^_]+)__|\*\*([^*]+)\*\*/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const id = m[1], label = m[2];
      out.push(<a key={k++} className="wikilink" onClick={(e)=>{e.preventDefault(); onLink&&onLink(id, e);}}>{label}</a>);
    } else if (m[3]) {
      const n = parseInt(m[3],10);
      out.push(<sup key={k++} className="cite" onClick={()=>onCite&&onCite(n)}>{n}</sup>);
    } else if (m[4]) {
      out.push(<em key={k++} className="serif-em">{m[4]}</em>);
    } else if (m[5]) {
      out.push(<strong key={k++} style={{ fontWeight:600, color:'var(--ink)' }}>{m[5]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ============================================================
   ICONS  (simple stroke, 1.5)
   ============================================================ */
const IC = (p) => ({ width:p.s||16, height:p.s||16, viewBox:'0 0 24 24', fill:'none',
  stroke:p.c||'currentColor', strokeWidth:p.w||1.6, strokeLinecap:'round', strokeLinejoin:'round' });

function Icon({ name, s=16, c, w }) {
  const a = IC({ s, c, w });
  const paths = {
    paper:   <g><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h6M10 16h6"/></g>,
    link:    <g><path d="M9 15l6-6"/><path d="M8 8.5l-2 2a3.5 3.5 0 005 5l2-2"/><path d="M16 15.5l2-2a3.5 3.5 0 00-5-5l-2 2"/></g>,
    video:   <g><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></g>,
    image:   <g><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/></g>,
    chat:    <g><path d="M4 5h16v11H9l-4 3v-3H4z"/></g>,
    voice:   <g><path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2"/></g>,
    note:    <g><path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/><path d="M8 13h6M8 16h4"/></g>,
    map:     <g><path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/></g>,
    wiki:    <g><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></g>,
    plus:    <g><path d="M12 5v14M5 12h14"/></g>,
    spark:   <g><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></g>,
    arrow:   <g><path d="M5 12h14M13 6l6 6-6 6"/></g>,
    back:    <g><path d="M19 12H5M11 6l-6 6 6 6"/></g>,
    search:  <g><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></g>,
    close:   <g><path d="M6 6l12 12M18 6L6 18"/></g>,
    check:   <g><path d="M5 12l5 5L20 6"/></g>,
    dot:     <circle cx="12" cy="12" r="3"/>,
    layers:  <g><path d="M12 4l8 4-8 4-8-4 8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/></g>,
    home:    <g><path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/></g>,
    atlas:   <g><path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/><circle cx="12" cy="11" r="1.6"/></g>,
    library: <g><path d="M5 5h4v14H5zM10 5h4v14h-4z"/><path d="M16 5.6l3 .8L16 19l-2.4-.6"/></g>,
    folder:  <g><path d="M4 7a1 1 0 011-1h4l2 2h8a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1z"/></g>,
    question:<g><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.4 2.4 0 114 1.8c-1 .8-1.6 1.2-1.6 2.2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></g>,
    index:   <g><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/><path d="M6 4v16"/></g>,
    clock:   <g><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></g>,
    connect: <g><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.1 11l7.8-4M8.1 13l7.8 4"/></g>,
    compass: <g><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></g>,
    upright: <g><path d="M7 17L17 7M9 7h8v8"/></g>,
    inbox:   <g><path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h4l1.5 2.5h5L16 13h4"/></g>,
    pen:     <g><path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M14 7l3 3"/></g>,
    trash:   <g><path d="M5 7h14"/><path d="M10 7V5h4v2"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></g>,
    settings:<g><path d="M4 8h9"/><path d="M19 8h1"/><circle cx="15" cy="8" r="2.2"/><path d="M4 16h5"/><path d="M15 16h5"/><circle cx="11" cy="16" r="2.2"/></g>,
  };
  return <svg {...a}>{paths[name]||paths.dot}</svg>;
}

const SRC_TINT = { blue:'var(--glow-blue)', teal:'var(--glow-teal)', amber:'var(--glow-amber)', coral:'var(--glow-coral)', violet:'var(--glow-violet)' };

/* ============================================================
   MAP THUMB — tiny glowing preview of a map (for cards)
   ============================================================ */
function MapThumb({ map, height=120, lit={}, faded=false }) {
  const eff = (n)=>Math.min(1, n.explored + (lit[n.id]||0));
  const byId = Object.fromEntries(map.nodes.map(n=>[n.id,n]));
  return (
    <div style={{ position:'relative', width:'100%', height, borderRadius:12, overflow:'hidden',
      background:'var(--paper-deep)', border:'1px solid var(--hair-soft)', opacity:faded?0.6:1 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
        {map.links.map(([a,b],i)=>{ const na=byId[a], nb=byId[b]; if(!na||!nb) return null;
          return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="var(--ink-2)" strokeWidth="0.3" opacity="0.18"/>; })}
      </svg>
      {map.nodes.map(n=>{ const e=eff(n); const on=e>0.18; const c=on?hueColor(n.hue):HUE.dim;
        const r = 5 + (n.size/132)*16;
        return (
          <div key={n.id} style={{ position:'absolute', left:n.x+'%', top:n.y+'%', transform:'translate(-50%,-50%)',
            width:r, height:r, borderRadius:'50%',
            background:`radial-gradient(circle at 45% 40%, ${c} 0%, transparent 70%)`,
            opacity:`calc(${0.25 + e*0.6} * var(--glow-strength))`, filter:'blur(1px)' }}/>
        ); })}
    </div>
  );
}

/* ---------- coverage bar ---------- */
function CoverageBar({ pct, hue='blue', height=5 }) {
  return (
    <div style={{ height, borderRadius:height, background:'var(--hair)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:Math.max(3,pct)+'%', borderRadius:height,
        background:`linear-gradient(90deg, ${hueColor(hue)}, ${hueColor(hue==='blue'?'violet':hue)})`,
        transition:'width .9s cubic-bezier(.2,.8,.2,1)' }}/>
    </div>
  );
}

/* ---------- entry type glyph ---------- */
function EntryGlyph({ type, s=15, c }) {
  const name = type==='question' ? 'question' : type==='moc' ? 'index' : 'wiki';
  return <Icon name={name} s={s} c={c}/>;
}

/* ============================================================
   HORIZON MARK — brand logo (sun rising over a horizon line).
   A single point of light = understanding; the line = the field
   you're surveying. Shrinks to a pure sun at favicon sizes.
   ============================================================ */
let _hzN = 0;
function HorizonMark({ s = 24, c = '#C67B33', sunOnly = false }) {
  const gid = React.useMemo(() => 'hz' + (++_hzN), []);
  return (
    <svg viewBox="0 0 120 120" width={s} height={s} style={{ flex: 'none', display: 'block' }} aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="50%" cy="45%">
          <stop offset="0%" stopColor={c} stopOpacity="0.55" />
          <stop offset="34%" stopColor={c} stopOpacity="0.22" />
          <stop offset="70%" stopColor={c} stopOpacity="0.045" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      {sunOnly
        ? <React.Fragment>
            <circle cx="60" cy="60" r="56" fill={`url(#${gid})`} />
            <circle cx="60" cy="58" r="17" fill={c} />
          </React.Fragment>
        : <React.Fragment>
            <circle cx="60" cy="54" r="54" fill={`url(#${gid})`} />
            <line x1="22" y1="84" x2="98" y2="84" stroke={c} strokeWidth="3.6" strokeLinecap="round" opacity="0.55" />
            <circle cx="60" cy="54" r="12" fill={c} />
          </React.Fragment>}
    </svg>
  );
}

Object.assign(window, {
  HUE, hueColor, Grain, GlowField, Frost, NodeBlob,
  parseInline, Icon, SRC_TINT, MapThumb, CoverageBar, EntryGlyph, HorizonMark,
});
