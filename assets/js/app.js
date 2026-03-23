(function(){
'use strict';

const RMAP={purple:'#8893C8',teal:'#5A9EA3',coral:'#C27D59',red:'#C16B77',amber:'#B99257',blue:'#6E9ABD',green:'#739171',gray:'#8A919D',pink:'#A3758B'};
const EDGE_PRESET_COLORS={red:RMAP.red,green:RMAP.green,blue:RMAP.blue,purple:RMAP.purple,amber:RMAP.amber};
const RNAMES=Object.keys(RMAP);
const FF=`-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
const THEME_COLORS={
  light:{bg1:'#F5F7FA',bg2:'#EDF1F4',bg3:'#E3E8ED',t1:'#161C23',t2:'#596675',t3:'#8693A0',acc:'#4F7088'},
  dark:{bg1:'#151A20',bg2:'#1B2128',bg3:'#242C35',t1:'#E6EBF1',t2:'#AAB6C2',t3:'#728090',acc:'#7F9AAF'}
};
const DEFAULT_SECTION_OPACITY=0.28;
const NODE_RX=5;
const TEXT_NODE_RX=2;
const SECTION_RX=8;
const HEX_COLOR_RE=/^#[0-9a-fA-F]{6}$/;
const DEFAULT_PROJECT_TITLE='Untitled project';
const PORT_DIRS={
  top:{x:0,y:-1,axis:'v'},
  right:{x:1,y:0,axis:'h'},
  bottom:{x:0,y:1,axis:'v'},
  left:{x:-1,y:0,axis:'h'}
};
const PORT_ORDER=['top','right','bottom','left'];
const PORT_LABELS={top:'Top',right:'Right',bottom:'Bottom',left:'Left'};
const AUTO_ROUTE_GAP=22;
const ALIGN_SNAP_SCREEN_PX=10;

const PAL=[
  {cat:'Orchestration',items:[
    {ramp:'purple',tp:'two',title:'Coordinator',sub:'Policy & orchestration'},
    {ramp:'purple',tp:'one',title:'Policy engine',sub:''},
    {ramp:'purple',tp:'two',title:'Session manager',sub:'Active session'},
  ]},
  {cat:'Analysis',items:[
    {ramp:'teal',tp:'two',title:'Scanner',sub:'Detects vulnerabilities'},
    {ramp:'teal',tp:'two',title:'Evaluation',sub:'Trust score check'},
    {ramp:'teal',tp:'one',title:'Verification',sub:''},
  ]},
  {cat:'Attack & risk',items:[
    {ramp:'coral',tp:'two',title:'Attack path',sub:'Builds path model'},
    {ramp:'red',tp:'one',title:'High-risk node',sub:''},
    {ramp:'amber',tp:'two',title:'Warning node',sub:'Elevated risk'},
  ]},
  {cat:'Defense',items:[
    {ramp:'blue',tp:'two',title:'Blue defense',sub:'Applies security fixes'},
    {ramp:'teal',tp:'two',title:'Mitigation',sub:'Controls applied'},
  ]},
  {cat:'Outcomes',items:[
    {ramp:'green',tp:'one',title:'Allow',sub:''},
    {ramp:'red',tp:'one',title:'Block',sub:''},
    {ramp:'gray',tp:'one',title:'Neutral',sub:''},
    {ramp:'pink',tp:'two',title:'Memory store',sub:'Patterns & history'},
  ]},
  {cat:'Sections & groups',items:[
    {ramp:'gray',tp:'cont',title:'Section',sub:'Group label'},
    {ramp:'purple',tp:'cont',title:'Phase',sub:'Phase label'},
    {ramp:'teal',tp:'cont',title:'Zone',sub:'Zone label'},
    {ramp:'red',tp:'cont',title:'Attack surface',sub:''},
    {ramp:'amber',tp:'cont',title:'Warning area',sub:''},
  ]},
  {cat:'Annotations',items:[
    {ramp:'text',tp:'text',title:'Annotation',sub:'Free text note'},
    {ramp:'text',tp:'text',title:'Note',sub:''},
  ]},
];

const S={
  nodes:[],edges:[],
  title:DEFAULT_PROJECT_TITLE,
  sel:null,selT:null,
  multi:[],
  guides:[],
  drag:null,
  conn:null,
  wpDrag:null,
  eDrag:null,
  rubber:null,
  snap:false,
  mmVisible:true,
  clipboard:null,
  pan:{x:80,y:60},zoom:1,
  hist:[],hidx:-1,nid:1
};

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function normalizeProjectTitle(v,fallback=''){
  if(typeof v!=='string')return fallback;
  const s=v.replace(/\s+/g,' ').trim().slice(0,120);
  return s||fallback;
}
function projectFileStem(){
  const base=normalizeProjectTitle(S.title,'arcflow-diagram')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g,' ')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'')
    .toLowerCase();
  return base||'arcflow-diagram';
}
function syncProjectTitle(syncInput=true){
  const title=normalizeProjectTitle(S.title,DEFAULT_PROJECT_TITLE);
  S.title=title;
  document.title=`${title} · ArcFlow`;
  if(syncInput){
    const input=document.getElementById('project-title');
    if(input&&input.value!==title)input.value=title;
  }
}
function normalizeHexColor(v){
  if(typeof v!=='string')return null;
  const s=v.trim();
  return HEX_COLOR_RE.test(s)?s.toUpperCase():null;
}

function deepcl(o){return JSON.parse(JSON.stringify(o));}
function snapshotState(){return{nodes:S.nodes,edges:S.edges,title:S.title};}
function commit(){
  S.hist.splice(S.hidx+1);
  S.hist.push(deepcl(snapshotState()));
  if(S.hist.length>120)S.hist.shift();
  S.hidx=S.hist.length-1;
}
function undo(){
  if(S.hidx<=0)return;S.hidx--;
  const s=S.hist[S.hidx];S.nodes=deepcl(s.nodes);S.edges=deepcl(s.edges);S.title=normalizeProjectTitle(s.title,DEFAULT_PROJECT_TITLE);syncProjectTitle();
  S.sel=null;S.selT=null;draw();props();
}
function redo(){
  if(S.hidx>=S.hist.length-1)return;S.hidx++;
  const s=S.hist[S.hidx];S.nodes=deepcl(s.nodes);S.edges=deepcl(s.edges);S.title=normalizeProjectTitle(s.title,DEFAULT_PROJECT_TITLE);syncProjectTitle();
  S.sel=null;S.selT=null;draw();props();
}

// ── ArcFlow file schema & validation ─────────────────────────────────────────
const _VALID_RAMPS = new Set(['purple','teal','coral','red','amber','blue','green','gray','pink','text']);
const _VALID_TPS   = new Set(['one','two','cont','text']);
const _VALID_PORTS = new Set(['top','bottom','left','right']);
const _VALID_COLS  = new Set([null,'red','green','blue','purple','amber']);

// Returns true when the raw parsed object looks like it could be an ArcFlow file.
// Deliberately lenient — full validation happens in sanitizeLoad.
function isArcFlowJSON(raw) {
  return raw !== null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray(raw.nodes) &&
    Array.isArray(raw.edges);
}

function _sanitizeNode(n) {
  if (!n || typeof n !== 'object') return null;
  const id = typeof n.id === 'string' && n.id.trim() ? n.id.trim() : null;
  if (!id) return null;
  const fillOpacity=Number.isFinite(+n.fillOpacity)?clamp(+n.fillOpacity,0,1):(n.tp==='cont'?DEFAULT_SECTION_OPACITY:1);
  return {
    id,
    tp    : _VALID_TPS.has(n.tp)    ? n.tp    : 'one',
    ramp  : _VALID_RAMPS.has(n.ramp)? n.ramp  : 'gray',
    x     : Number.isFinite(+n.x)   ? +n.x    : 0,
    y     : Number.isFinite(+n.y)   ? +n.y    : 0,
    w     : (Number.isFinite(+n.w) && +n.w > 0) ? +n.w : 160,
    h     : (Number.isFinite(+n.h) && +n.h > 0) ? +n.h : 44,
    title : typeof n.title  === 'string' ? n.title.slice(0, 300)  : '',
    sub   : typeof n.sub    === 'string' ? n.sub.slice(0, 300)    : '',
    prompt: typeof n.prompt === 'string' ? n.prompt.slice(0, 4000): '',
    customColor:normalizeHexColor(n.customColor),
    fillOpacity,
  };
}

function _sanitizeEdge(e, nodeIds) {
  if (!e || typeof e !== 'object') return null;
  const id   = typeof e.id   === 'string' && e.id.trim()   ? e.id.trim()   : null;
  const from = typeof e.from === 'string' && e.from.trim() ? e.from.trim() : null;
  const to   = typeof e.to   === 'string' && e.to.trim()   ? e.to.trim()   : null;
  // Must have valid id and both endpoints must resolve to existing nodes
  if (!id || !from || !to) return null;
  if (!nodeIds.has(from) || !nodeIds.has(to)) return null;
  const wps = Array.isArray(e.wps)
    ? e.wps
        .filter(p => p && Number.isFinite(+p.x) && Number.isFinite(+p.y))
        .map(p => ({ x: +p.x, y: +p.y }))
        .slice(0, 100)
    : [];
  return {
    id, from, to,
    fp   : _VALID_PORTS.has(e.fp) ? e.fp : 'bottom',
    tp   : _VALID_PORTS.has(e.tp) ? e.tp : 'top',
    dash : e.dash === true,
    col  : _VALID_COLS.has(e.col) ? e.col : null,
    wps,
    label: typeof e.label === 'string' ? e.label.slice(0, 200) : null,
    customColor:normalizeHexColor(e.customColor),
  };
}

// Full validation + sanitisation of a parsed JSON object.
// Throws a descriptive Error on any structural incompatibility.
// Silently drops individual nodes/edges that fail field validation.
function sanitizeLoad(raw) {
  if (!isArcFlowJSON(raw))
    throw new Error('Not a valid ArcFlow file. Expected a JSON object with "nodes" and "edges" arrays.');
  const title=normalizeProjectTitle(raw.title,'');

  // ── Nodes ──
  const seenNodeIds = new Set();
  const duplicateNodeIds = [];
  const nodes = [];
  for (const n of raw.nodes) {
    const clean = _sanitizeNode(n);
    if (!clean) continue;
    if (seenNodeIds.has(clean.id)) {
      duplicateNodeIds.push(clean.id);
      continue; // drop duplicate — first occurrence wins
    }
    seenNodeIds.add(clean.id);
    nodes.push(clean);
  }
  if (!nodes.length && raw.nodes.length)
    throw new Error('No valid nodes found. The file may be from an incompatible application.');

  const nodeIds = new Set(nodes.map(n => n.id));

  // ── Edges ──
  const seenEdgeIds = new Set();
  const duplicateEdgeIds = [];
  const droppedEdges = [];
  const edges = [];
  for (const e of raw.edges) {
    const clean = _sanitizeEdge(e, nodeIds);
    if (!clean) {
      if (e && typeof e.id === 'string') droppedEdges.push(e.id);
      continue;
    }
    if (seenEdgeIds.has(clean.id)) {
      duplicateEdgeIds.push(clean.id);
      continue; // drop duplicate edge
    }
    seenEdgeIds.add(clean.id);
    edges.push(clean);
  }

  // ── nid counter ──
  const rawNid = Number.isFinite(+raw.nid) && +raw.nid > 0 ? Math.floor(+raw.nid) : 200;
  // Must be strictly higher than every existing numeric id suffix to prevent collisions
  const maxNumericId = [...nodeIds, ...seenEdgeIds].reduce((max, id) => {
    const n = parseInt(id.replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, rawNid - 1);
  const nid = Math.max(rawNid, maxNumericId + 1);

  // ── Build a human-readable warning summary ──
  const warnings = [];
  if (duplicateNodeIds.length)
    warnings.push(`Duplicate node IDs removed (kept first): ${duplicateNodeIds.join(', ')}`);
  if (duplicateEdgeIds.length)
    warnings.push(`Duplicate edge IDs removed (kept first): ${duplicateEdgeIds.join(', ')}`);
  if (droppedEdges.length)
    warnings.push(`Edges referencing unknown nodes were removed: ${droppedEdges.join(', ')}`);

  return { title, nodes, edges, nid, warnings };
}

// Validate a clipboard payload — same rules but returns null instead of throwing
// when the text doesn't look like ArcFlow at all (e.g. plain text copy).
function sanitizeClipboardNodes(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const sourceNodes=
    raw.kind==='arcflow/nodes'&&Array.isArray(raw.nodes)
      ? raw.nodes
      : (isArcFlowJSON(raw)?raw.nodes:null);
  if(!sourceNodes)return null;
  const seenIds = new Set();
  const nodes = [];
  for (const n of sourceNodes) {
    const clean = _sanitizeNode(n);
    if (!clean || seenIds.has(clean.id)) continue;
    seenIds.add(clean.id);
    nodes.push(clean);
  }
  return nodes.length ? nodes : null;
}
// ── End schema validation ──────────────────────────────────────────────────────


const byId=id=>S.nodes.find(n=>n.id===id);
const edById=id=>S.edges.find(e=>e.id===id);
function nW(t,s){return Math.max(164,Math.max((t||'').length*8.5+56,(s||'').length*7.2+56));}
function nH(tp){return tp==='two'?56:44;}
function snapV(v){return S.snap?Math.round(v/8)*8:v;}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return esc(String(s??'')).replace(/'/g,'&#39;');}
function isDarkTheme(){return document.body.classList.contains('dark');}
function themeColors(isDark=isDarkTheme()){return isDark?THEME_COLORS.dark:THEME_COLORS.light;}
function hexToRgb(hex){
  const c=normalizeHexColor(hex);
  if(!c)return null;
  return{
    r:parseInt(c.slice(1,3),16),
    g:parseInt(c.slice(3,5),16),
    b:parseInt(c.slice(5,7),16),
  };
}
function rgbToHex(r,g,b){
  const toHex=v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0').toUpperCase();
  return`#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function mixHex(a,b,t){
  const ca=hexToRgb(a),cb=hexToRgb(b);
  if(!ca||!cb)return a||b||'#000000';
  const p=clamp(t,0,1);
  return rgbToHex(
    ca.r+(cb.r-ca.r)*p,
    ca.g+(cb.g-ca.g)*p,
    ca.b+(cb.b-ca.b)*p
  );
}
function rgba(hex,alpha){
  const c=hexToRgb(hex)||{r:0,g:0,b:0};
  return`rgba(${c.r},${c.g},${c.b},${clamp(alpha,0,1)})`;
}
function channelToLinear(v){
  const c=v/255;
  return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
}
function relativeLuminance(hex){
  const c=hexToRgb(hex)||{r:0,g:0,b:0};
  return 0.2126*channelToLinear(c.r)+0.7152*channelToLinear(c.g)+0.0722*channelToLinear(c.b);
}
function contrastRatio(a,b){
  const l1=relativeLuminance(a),l2=relativeLuminance(b);
  const hi=Math.max(l1,l2),lo=Math.min(l1,l2);
  return(hi+0.05)/(lo+0.05);
}
function pickReadableText(bgHex,isDark=isDarkTheme()){
  const theme=themeColors(isDark);
  return contrastRatio(bgHex,theme.t1)>=contrastRatio(bgHex,theme.bg1)?theme.t1:theme.bg1;
}
function nodeAccent(n,isDark=isDarkTheme()){
  return normalizeHexColor(n.customColor)||(n.tp==='text'||n.ramp==='text'?themeColors(isDark).t2:RMAP[n.ramp])||RMAP.gray;
}
function nodeFillOpacity(n){
  return n.tp==='cont'
    ? clamp(Number.isFinite(+n.fillOpacity)?+n.fillOpacity:DEFAULT_SECTION_OPACITY,0,1)
    : 1;
}
function edgeStrokeColor(e,isDark=isDarkTheme()){
  const theme=themeColors(isDark);
  return normalizeHexColor(e.customColor)||EDGE_PRESET_COLORS[e.col]||theme.t2;
}
function resolveNodeVisuals(n,isDark=isDarkTheme()){
  const theme=themeColors(isDark);
  const accent=nodeAccent(n,isDark);
  if(n.tp==='text'){
    return{
      fill:'transparent',
      stroke:'transparent',
      title:accent,
      sub:mixHex(accent,theme.bg2,isDark?0.3:0.45),
    };
  }
  if(n.tp==='cont'){
    const fillAlpha=nodeFillOpacity(n);
    const fillPreview=mixHex(theme.bg2,accent,Math.max(0.18,fillAlpha*(isDark?0.65:0.45)));
    const title=pickReadableText(fillPreview,isDark);
    return{
      fill:rgba(accent,fillAlpha),
      stroke:accent,
      title,
      sub:mixHex(title,theme.bg2,isDark?0.22:0.48),
    };
  }
  const fill=mixHex(theme.bg2,accent,isDark?0.28:0.18);
  const title=pickReadableText(fill,isDark);
  return{
    fill,
    stroke:accent,
    title,
    sub:mixHex(title,theme.bg2,isDark?0.24:0.48),
  };
}
function resolveEdgeVisuals(e,isDark=isDarkTheme()){
  const theme=themeColors(isDark);
  return{
    stroke:edgeStrokeColor(e,isDark),
    labelBg:rgba(theme.bg1,isDark?0.92:0.94),
    labelText:theme.t2,
  };
}

function ports(n){
  const cx=n.x+n.w/2,cy=n.y+n.h/2;
  return{top:{x:cx,y:n.y},bottom:{x:cx,y:n.y+n.h},left:{x:n.x,y:cy},right:{x:n.x+n.w,y:cy}};
}
function nearPort(from,n){
  const ps=ports(n);let best='top',bd=1e9;
  for(const[k,p]of Object.entries(ps)){const d=Math.hypot(p.x-from.x,p.y-from.y);if(d<bd){bd=d;best=k;}}
  return best;
}
function rectAt(x,y,w,h){
  return{left:x,top:y,right:x+w,bottom:y+h,cx:x+w/2,cy:y+h/2,w,h};
}
function shiftRect(rect,dx,dy){
  return{...rect,left:rect.left+dx,right:rect.right+dx,cx:rect.cx+dx,top:rect.top+dy,bottom:rect.bottom+dy,cy:rect.cy+dy};
}
function smartAlignRect(movingRect,excludeIds){
  if(!S.snap)return{x:movingRect.left,y:movingRect.top,guides:[]};
  const threshold=ALIGN_SNAP_SCREEN_PX/Math.max(S.zoom,0.001);
  let bestX=null,bestY=null;
  S.nodes.forEach(other=>{
    if(excludeIds.has(other.id))return;
    const rect=rectAt(other.x,other.y,other.w,other.h);
    [['left','left'],['cx','cx'],['right','right']].forEach(([mKey,oKey])=>{
      const delta=rect[oKey]-movingRect[mKey];
      const dist=Math.abs(delta);
      if(dist<=threshold&&(!bestX||dist<bestX.dist)){
        bestX={delta,dist,coord:rect[oKey],rect};
      }
    });
    [['top','top'],['cy','cy'],['bottom','bottom']].forEach(([mKey,oKey])=>{
      const delta=rect[oKey]-movingRect[mKey];
      const dist=Math.abs(delta);
      if(dist<=threshold&&(!bestY||dist<bestY.dist)){
        bestY={delta,dist,coord:rect[oKey],rect};
      }
    });
  });
  const dx=bestX?bestX.delta:0;
  const dy=bestY?bestY.delta:0;
  const snapped=shiftRect(movingRect,dx,dy);
  const guides=[];
  if(bestX){
    guides.push({
      axis:'v',
      x:bestX.coord,
      y1:Math.min(snapped.top,bestX.rect.top)-18,
      y2:Math.max(snapped.bottom,bestX.rect.bottom)+18,
    });
  }
  if(bestY){
    guides.push({
      axis:'h',
      y:bestY.coord,
      x1:Math.min(snapped.left,bestY.rect.left)-18,
      x2:Math.max(snapped.right,bestY.rect.right)+18,
    });
  }
  return{x:snapped.left,y:snapped.top,guides};
}
function snapWaypointPosition(edge,idx,pos){
  if(!S.snap)return{x:pos.x,y:pos.y,guides:[]};
  const fn=byId(edge.from),tn=byId(edge.to);
  if(!fn||!tn)return{x:pos.x,y:pos.y,guides:[]};
  const fp=ports(fn)[edge.fp],tp=ports(tn)[edge.tp];
  const wps=edge.wps||[];
  const prev=idx>0?wps[idx-1]:fp;
  const next=idx<wps.length-1?wps[idx+1]:tp;
  const threshold=ALIGN_SNAP_SCREEN_PX/Math.max(S.zoom,0.001);
  let x=pos.x,y=pos.y;
  let snapXSource=null,snapYSource=null;

  const corners=[
    {x:prev.x,y:next.y},
    {x:next.x,y:prev.y},
  ];
  let bestCorner=null;
  corners.forEach(corner=>{
    const dist=Math.hypot(pos.x-corner.x,pos.y-corner.y);
    if(dist<=threshold*1.4&&(!bestCorner||dist<bestCorner.dist))bestCorner={...corner,dist};
  });

  if(bestCorner){
    x=bestCorner.x;
    y=bestCorner.y;
    snapXSource=bestCorner.x===prev.x?prev:next;
    snapYSource=bestCorner.y===prev.y?prev:next;
  }else{
    const xCandidates=[prev.x,next.x].map(value=>({value,dist:Math.abs(pos.x-value)})).sort((a,b)=>a.dist-b.dist);
    const yCandidates=[prev.y,next.y].map(value=>({value,dist:Math.abs(pos.y-value)})).sort((a,b)=>a.dist-b.dist);
    if(xCandidates[0].dist<=threshold){
      x=xCandidates[0].value;
      snapXSource=x===prev.x?prev:next;
    }
    if(yCandidates[0].dist<=threshold){
      y=yCandidates[0].value;
      snapYSource=y===prev.y?prev:next;
    }
  }

  const guides=[];
  if(snapXSource){
    guides.push({
      axis:'v',
      x,
      y1:Math.min(prev.y,next.y,y)-18,
      y2:Math.max(prev.y,next.y,y)+18,
    });
  }
  if(snapYSource){
    guides.push({
      axis:'h',
      y,
      x1:Math.min(prev.x,next.x,x)-18,
      x2:Math.max(prev.x,next.x,x)+18,
    });
  }
  return{x,y,guides};
}
function pushRoutePoint(route,point,insertIndex){
  const prev=route.points[route.points.length-1];
  if(prev&&prev.x===point.x&&prev.y===point.y)return;
  route.points.push({x:point.x,y:point.y});
  route.insertIndices.push(insertIndex);
}
function portStubPoint(port,anchor,side){
  const dir=PORT_DIRS[side]||PORT_DIRS.bottom;
  return dir.axis==='v'
    ? {x:port.x,y:anchor.y}
    : {x:anchor.x,y:port.y};
}
function buildEdgeRoute(fp,tp,wps,fpSide,tpSide){
  if(!wps||wps.length===0){
    const points=autoRoutePoints(fp,tp,fpSide,tpSide);
    return{points,insertIndices:Array(Math.max(0,points.length-1)).fill(0)};
  }
  const route={points:[{x:fp.x,y:fp.y}],insertIndices:[]};
  const first=wps[0];
  pushRoutePoint(route,portStubPoint(fp,first,fpSide),0);
  wps.forEach((wp,i)=>pushRoutePoint(route,wp,i));
  const last=wps[wps.length-1];
  pushRoutePoint(route,portStubPoint(tp,last,tpSide),wps.length);
  pushRoutePoint(route,tp,wps.length);
  return route;
}

function compactPolyline(points){
  const out=[];
  points.forEach(p=>{
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    const prev=out[out.length-1];
    if(!prev||prev.x!==p.x||prev.y!==p.y)out.push({x:p.x,y:p.y});
  });
  for(let i=1;i<out.length-1;){
    const a=out[i-1],b=out[i],c=out[i+1];
    if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)){out.splice(i,1);continue;}
    i++;
  }
  return out;
}
function autoRoutePoints(fp,tp,fpSide,tpSide){
  const fd=PORT_DIRS[fpSide]||PORT_DIRS.bottom;
  const td=PORT_DIRS[tpSide]||PORT_DIRS.top;
  const fs={x:fp.x+fd.x*AUTO_ROUTE_GAP,y:fp.y+fd.y*AUTO_ROUTE_GAP};
  const ts={x:tp.x+td.x*AUTO_ROUTE_GAP,y:tp.y+td.y*AUTO_ROUTE_GAP};
  const pts=[fp,fs];
  if(fd.axis===td.axis){
    if(fd.axis==='v'){
      const my=Math.round((fs.y+ts.y)/2);
      pts.push({x:fs.x,y:my},{x:ts.x,y:my});
    }else{
      const mx=Math.round((fs.x+ts.x)/2);
      pts.push({x:mx,y:fs.y},{x:mx,y:ts.y});
    }
  }else if(fd.axis==='v'&&td.axis==='h'){
    pts.push({x:fs.x,y:ts.y});
  }else{
    pts.push({x:ts.x,y:fs.y});
  }
  pts.push(ts,tp);
  return compactPolyline(pts);
}
function edgePolylinePoints(fp,tp,wps,fpSide,tpSide){
  return buildEdgeRoute(fp,tp,wps,fpSide,tpSide).points;
}
function edgeCenterPoint(points){
  if(!points||points.length<2)return null;
  const mi=Math.floor((points.length-1)/2);
  return{x:(points[mi].x+points[mi+1].x)/2,y:(points[mi].y+points[mi+1].y)/2};
}
function mkPath(fp,tp,wps,fpSide,tpSide){
  return'M'+edgePolylinePoints(fp,tp,wps,fpSide,tpSide).map(p=>`${Math.round(p.x)} ${Math.round(p.y)}`).join('L');
}

function toSVG(cx,cy){
  const pt=document.getElementById('csvg').createSVGPoint();
  pt.x=cx;pt.y=cy;
  return pt.matrixTransform(document.getElementById('vp').getScreenCTM().inverse());
}

function updateAlignBar(){
  // Show alignment bar only when 2+ nodes are multi-selected
  document.getElementById('app').classList.toggle('has-multi',S.multi.length>=2);
}
function updateEmptyState(){
  // Toggle .has-nodes on canvas to hide empty state when content exists
  document.getElementById('cw').classList.toggle('has-nodes',S.nodes.length>0);
}

function draw(){
  const vp=document.getElementById('vp');
  vp.setAttribute('transform',`translate(${S.pan.x},${S.pan.y}) scale(${S.zoom})`);
  syncGrid();
  document.getElementById('zdsp').textContent=Math.round(S.zoom*100)+'%';
  drawContainers();drawEdges();drawNodes();drawOverlay();
  updateMinimap();
  updateAlignBar();
  updateEmptyState();
}

function drawContainers(){
  let h='';
  S.nodes.filter(n=>n.tp==='cont').forEach(n=>{
    const sel=S.sel===n.id&&S.selT==='node';
    const rx=n.x+n.w, ry=n.y+n.h;
    const visuals=resolveNodeVisuals(n);
    const lsz=10, lthk=2.5;
    const lpath=`M${rx-lsz} ${ry-lthk/2}L${rx-lthk/2} ${ry-lthk/2}L${rx-lthk/2} ${ry-lsz}`;
    h+=`<g class="cont-g${sel?' sel':''}" data-nid="${escAttr(n.id)}" data-cont="1">
<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${SECTION_RX}" fill="${visuals.fill}" stroke="${visuals.stroke}" stroke-width="${sel?2:1}" stroke-dasharray="7 4"/>
<text class="nt" x="${n.x+14}" y="${n.y+17}" font-size="12" font-weight="500" font-family="${FF}" text-anchor="start" dominant-baseline="central" fill="${visuals.title}">${esc(n.title)}</text>
${n.sub?`<text class="ns" x="${n.x+14}" y="${n.y+32}" font-size="10" font-family="${FF}" text-anchor="start" dominant-baseline="central" fill="${visuals.sub}">${esc(n.sub)}</text>`:''}
<rect class="rz-h" x="${rx-22}" y="${ry-22}" width="22" height="22" rx="${TEXT_NODE_RX}" data-rzid="${escAttr(n.id)}" pointer-events="all"/>
<path d="${lpath}" fill="none" stroke="${mixHex(visuals.stroke,themeColors().bg2,0.35)}" stroke-width="${lthk}" stroke-linecap="round" pointer-events="none" opacity=".82"/>
</g>`;
  });
  document.getElementById('lay-c').innerHTML=h;
}

function drawEdges(){
  let h='';
  S.edges.forEach(e=>{
    const fn=byId(e.from),tn=byId(e.to);if(!fn||!tn)return;
    const fp=ports(fn)[e.fp],tp=ports(tn)[e.tp];if(!fp||!tp)return;
    const pts=edgePolylinePoints(fp,tp,e.wps||[],e.fp,e.tp);
    const d='M'+pts.map(p=>`${Math.round(p.x)} ${Math.round(p.y)}`).join('L');
    const visuals=resolveEdgeVisuals(e);
    h+=`<path class="edge-hit" d="${d}" data-eid="${escAttr(e.id)}"/>`;
    const sel=S.sel===e.id&&S.selT==='edge';
    h+=`<path class="ep${e.dash?' dash':''}${sel?' sel':''}" d="${d}" marker-end="url(#arr)" data-eid="${escAttr(e.id)}" stroke="${visuals.stroke}" stroke-width="${sel?3:1.5}"/>`;

    if(e.label){
      const mid=edgeCenterPoint(pts);
      if(!mid)return;
      const mx=mid.x,my=mid.y;
      const tw=Math.max(e.label.length*7.2+20,38);
      h+=`<rect class="elabel-bg" x="${mx-tw/2}" y="${my-8}" width="${tw}" height="16" rx="8" fill="${visuals.labelBg}"/>`;
      h+=`<text class="elabel" x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" fill="${visuals.labelText}">${esc(e.label)}</text>`;
    }
  });
  document.getElementById('lay-e').innerHTML=h;
}

function drawNodes(){
  let h='';
  S.nodes.filter(n=>n.tp!=='cont').forEach(n=>{
    const isText=n.tp==='text';
    const cx=n.x+n.w/2,cy=n.y+n.h/2;
    const sel=S.sel===n.id&&S.selT==='node';
    const tY=(n.tp==='two'||isText)?n.y+16:cy;
    const visuals=resolveNodeVisuals(n);
    const sub=(n.tp==='two'||isText)&&n.sub?`<text class="ns" x="${cx}" y="${n.y+n.h-13}" text-anchor="middle" dominant-baseline="central" font-size="11" font-family="${FF}" fill="${visuals.sub}">${esc(n.sub)}</text>`:'';
    const r=10;
    const btns=isText?'':([
      {x:cx,y:n.y,port:'top',bx:cx-r,by:n.y-r*2,bw:r*2,bh:r*2},
      {x:cx,y:n.y+n.h,port:'bottom',bx:cx-r,by:n.y+n.h,bw:r*2,bh:r*2},
      {x:n.x,y:cy,port:'left',bx:n.x-r*2,by:cy-r,bw:r*2,bh:r*2},
      {x:n.x+n.w,y:cy,port:'right',bx:n.x+n.w,by:cy-r,bw:r*2,bh:r*2},
    ].map(b=>`<g class="pb" data-port="${escAttr(b.port)}" data-nid="${escAttr(n.id)}">
<rect class="pb-bridge" x="${b.bx}" y="${b.by}" width="${b.bw}" height="${b.bh}"/>
<circle cx="${b.x}" cy="${b.y}" r="${r}"/>
<path d="M${b.x-4} ${b.y}h8M${b.x} ${b.y-4}v8" stroke="var(--acc)" stroke-width="1.8" stroke-linecap="round" fill="none" pointer-events="none"/>
</g>`).join(''));
    h+=`<g class="node-g${sel?' sel':''}" data-nid="${escAttr(n.id)}">
<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${isText?TEXT_NODE_RX:NODE_RX}" fill="${visuals.fill}" stroke="${visuals.stroke}"/>
<text class="nt" x="${cx}" y="${tY}" text-anchor="middle" dominant-baseline="central" font-size="${isText?14:13}" font-weight="${isText?400:600}" font-family="${FF}" fill="${visuals.title}">${esc(n.title||'Untitled')}</text>
${sub}${btns}</g>`;
  });
  document.getElementById('lay-n').innerHTML=h;
}

function drawOverlay(){
  let h='';

  if(S.rubber){
    const rx=Math.min(S.rubber.x0,S.rubber.x1),ry=Math.min(S.rubber.y0,S.rubber.y1);
    const rw=Math.abs(S.rubber.x1-S.rubber.x0),rh=Math.abs(S.rubber.y1-S.rubber.y0);
    h+=`<rect class="rband" x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="3"/>`;
  }

  S.multi.forEach(id=>{
    const n=byId(id);if(!n)return;
    h+=`<rect class="msel-ring" x="${n.x-3}" y="${n.y-3}" width="${n.w+6}" height="${n.h+6}" rx="${n.tp==='cont'?SECTION_RX+2:(n.tp==='text'?TEXT_NODE_RX+2:NODE_RX+2)}"/>`;
  });

  if(S.conn&&S.conn.curPos){
    const f=S.conn.fromPos,c=S.conn.curPos;
    h+=`<path d="M${f.x} ${f.y}L${c.x} ${c.y}" fill="none" stroke="${themeColors().acc}" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/>`;
  }

  (S.guides||[]).forEach(g=>{
    if(g.axis==='h'){
      h+=`<line class="align-guide" x1="${g.x1}" y1="${g.y}" x2="${g.x2}" y2="${g.y}"/>`;
    }else if(g.axis==='v'){
      h+=`<line class="align-guide" x1="${g.x}" y1="${g.y1}" x2="${g.x}" y2="${g.y2}"/>`;
    }
  });

  if(S.sel&&S.selT==='edge'){
    const e=edById(S.sel);
    if(e){
      const fn=byId(e.from),tn=byId(e.to);
      if(fn&&tn){
        const fp=ports(fn)[e.fp],tp=ports(tn)[e.tp];
        const wps=e.wps||[];
        const route=buildEdgeRoute(fp,tp,wps,e.fp,e.tp);
        const pts=route.points;
        for(let i=0;i<pts.length-1;i++){
          const mx=(pts[i].x+pts[i+1].x)/2,my=(pts[i].y+pts[i+1].y)/2;
          h+=`<circle class="wp-add" cx="${mx}" cy="${my}" r="5" data-wpadd="${escAttr(e.id)}" data-wpi="${route.insertIndices[i]??wps.length}" pointer-events="all"/>`;
        }
        wps.forEach((wp,i)=>{
          h+=`<circle class="wp-dot" cx="${wp.x}" cy="${wp.y}" r="6" data-wpid="${escAttr(e.id)}" data-wpdx="${i}" pointer-events="all"/>`;
        });
      }
    }
  }
  document.getElementById('lay-o').innerHTML=h;
}

function updateMinimap(){
  const mm=document.getElementById('minimap');
  if(!S.mmVisible){mm.style.display='none';return;}
  mm.style.display='block';
  if(!S.nodes.length){document.getElementById('mm-svg').innerHTML='';return;}
  const theme=themeColors();
  const W=160,H=110,pad=8;
  const xs=S.nodes.flatMap(n=>[n.x,n.x+n.w]),ys=S.nodes.flatMap(n=>[n.y,n.y+n.h]);
  const mnX=Math.min(...xs),mnY=Math.min(...ys),mxX=Math.max(...xs),mxY=Math.max(...ys);
  const dw=mxX-mnX||1,dh=mxY-mnY||1;
  const sc=Math.min((W-pad*2)/dw,(H-pad*2)/dh);
  const ox=pad+(W-pad*2-dw*sc)/2-mnX*sc;
  const oy=pad+(H-pad*2-dh*sc)/2-mnY*sc;
  let h='';
  S.nodes.filter(n=>n.tp==='cont').forEach(n=>{
    const visuals=resolveNodeVisuals(n);
    h+=`<rect x="${n.x*sc+ox}" y="${n.y*sc+oy}" width="${n.w*sc}" height="${n.h*sc}" rx="2" fill="${visuals.fill}" stroke="${visuals.stroke}" stroke-width=".5" stroke-dasharray="3 2"/>`;
  });
  S.edges.forEach(e=>{
    const fn=byId(e.from),tn=byId(e.to);if(!fn||!tn)return;
    const fp=ports(fn)[e.fp],tp=ports(tn)[e.tp];if(!fp||!tp)return;
    h+=`<line x1="${fp.x*sc+ox}" y1="${fp.y*sc+oy}" x2="${tp.x*sc+ox}" y2="${tp.y*sc+oy}" stroke="${edgeStrokeColor(e)}" stroke-width=".8" opacity=".8"/>`;
  });
  S.nodes.filter(n=>n.tp!=='cont').forEach(n=>{
    const visuals=resolveNodeVisuals(n);
    h+=`<rect x="${n.x*sc+ox}" y="${n.y*sc+oy}" width="${n.w*sc}" height="${n.h*sc}" rx="${n.tp==='text'?1:2}" fill="${visuals.fill}" stroke="${visuals.stroke}" stroke-width=".5"/>`;
  });

  const cw=document.getElementById('cw');
  const vr=cw.getBoundingClientRect();
  const vx=(-S.pan.x/S.zoom)*sc+ox, vy=(-S.pan.y/S.zoom)*sc+oy;
  const vw=(vr.width/S.zoom)*sc, vh=(vr.height/S.zoom)*sc;
  h+=`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${rgba(theme.acc,0.14)}" stroke="${theme.acc}" stroke-width="1" rx="1"/>`;
  document.getElementById('mm-svg').innerHTML=h;
}

function renderNodeColorGrid(n){
  const customOn=!!normalizeHexColor(n.customColor);
  const customValue=normalizeHexColor(n.customColor)||nodeAccent(n);
  return`${RNAMES.map(r=>`<button class="rs${!customOn&&n.ramp===r?' on':''}" type="button" style="background:${RMAP[r]}" data-ramp="${r}" title="${r}"></button>`).join('')}
<button class="rs rs-custom${customOn?' on':''}" type="button" data-ramp="custom" title="Custom color">
<span class="rs-custom-chip" style="background:${customValue}"></span>
<span class="rs-custom-label">Custom</span>
</button>`;
}
function renderEdgeColorButtons(e){
  const current=e.customColor?'custom':(e.col||'df');
  return['df','red','green','blue','purple','amber','custom'].map(c=>{
    if(c==='custom'){
      return`<button class="tbb tbb-color${current==='custom'?' on':''}" type="button" data-ecol="custom"><span class="tbb-chip" style="background:${normalizeHexColor(e.customColor)||edgeStrokeColor(e)}"></span>Custom</button>`;
    }
    const label=c==='df'?'Default':c[0].toUpperCase()+c.slice(1);
    const chip=c==='df'?themeColors().t2:EDGE_PRESET_COLORS[c];
    return`<button class="tbb tbb-color${current===c?' on':''}" type="button" data-ecol="${c}"><span class="tbb-chip" style="background:${chip}"></span>${label}</button>`;
  }).join('');
}
function renderPortButtons(kind,current){
  return PORT_ORDER.map(port=>`<button class="tbb tbb-half${current===port?' on':''}" type="button" data-${kind}port="${port}">${PORT_LABELS[port]}</button>`).join('');
}
function props(){
  const prh=document.getElementById('prh');
  const prb=document.getElementById('prb');
  if(!S.sel){
    prh.textContent='Properties';
    prb.innerHTML=`<div class="pempty">Select a node or edge<br>to edit its properties</div>`;
    return;
  }
  if(S.selT==='node'){
    const n=byId(S.sel);if(!n)return;
    const isCont=n.tp==='cont';
    const hasCustomColor=!!normalizeHexColor(n.customColor);
    prh.textContent=isCont?'Section properties':'Node properties';
    const outs=S.edges.filter(e=>e.from===n.id);
    const ins=S.edges.filter(e=>e.to===n.id);
    const cH=[...outs.map(e=>{const t=byId(e.to);return t?`<div class="ci"><div class="cdot" style="background:${nodeAccent(t)}"></div><span class="clbl">→ ${esc(t.title)}</span><span class="cdel" data-deled="${escAttr(e.id)}">✕</span></div>`:'';}),...ins.map(e=>{const f=byId(e.from);return f?`<div class="ci"><div class="cdot" style="background:${nodeAccent(f)}"></div><span class="clbl">← ${esc(f.title)}</span><span class="cdel" data-deled="${escAttr(e.id)}">✕</span></div>`:'';}),].join('');
    prb.innerHTML=`<div class="prs">
<div class="prl">Title</div>
<input class="pri" id="pt" value="${esc(n.title)}" placeholder="Label"/>
${!isCont?`<div class="prl">Subtitle</div><input class="pri" id="ps" value="${esc(n.sub||'')}" placeholder="Short description (two-line only)"/>
<div class="prl">Click prompt</div><textarea class="prta" id="pp" placeholder="Question shown when this node is clicked...">${esc(n.prompt||'')}</textarea>`:''}
<div class="prl">Color</div>
<div class="rg">${renderNodeColorGrid(n)}</div>
${hasCustomColor?`<input class="pri pr-color-input" id="ncustom" type="color" value="${normalizeHexColor(n.customColor)||nodeAccent(n)}"/>`:''}
${isCont?`<div class="prl">Fill opacity</div>
<div class="pr-range-row">
<input class="pr-range" id="pfill" type="range" min="0" max="100" step="5" value="${Math.round(nodeFillOpacity(n)*100)}"/>
<span class="pr-range-value" id="pfillv">${Math.round(nodeFillOpacity(n)*100)}%</span>
</div>
<div class="prl">Size</div>
<div class="pr-stack">
<input class="pri" id="pw" type="number" value="${Math.round(n.w)}" min="80" style="margin-bottom:0;text-align:center;" placeholder="W"/>
<input class="pri" id="ph2" type="number" value="${Math.round(n.h)}" min="50" style="margin-bottom:0;text-align:center;" placeholder="H"/>
</div>`:`<div class="prl">Node type</div>
<div class="tbg">
<button class="tbb${n.tp==='one'?' on':''}" type="button" data-ntp="one">Single line</button>
<button class="tbb${n.tp==='two'?' on':''}" type="button" data-ntp="two">Two line</button>
</div>`}
</div>
<div class="pdv"></div>
<div class="pstat"><span>Position</span><span>${Math.round(n.x)}, ${Math.round(n.y)}</span></div>
<div class="pstat"><span>Size</span><span>${Math.round(n.w)} × ${Math.round(n.h)}</span></div>
${!isCont?`<div class="pstat"><span>Connections</span><span>${outs.length+ins.length}</span></div>`:''}
${cH?`<div class="prs" style="padding-bottom:2px"><div class="prl" style="margin-bottom:6px">Connections</div></div>${cH}`:''}
<button class="delbtn" id="pdel">Delete ${isCont?'section':'node'}</button>`;

    const ti=document.getElementById('pt');
    const si=document.getElementById('ps');
    const pi=document.getElementById('pp');
    ti.addEventListener('input',e=>{n.title=e.target.value;if(!isCont)n.w=nW(n.title,n.sub);draw();});
    ti.addEventListener('blur',commit);
    if(si){si.addEventListener('input',e=>{n.sub=e.target.value;n.w=nW(n.title,n.sub);draw();});si.addEventListener('blur',commit);}
    if(pi){pi.addEventListener('input',e=>{n.prompt=e.target.value;});pi.addEventListener('blur',commit);}
    const wi=document.getElementById('pw'),hi=document.getElementById('ph2');
    if(wi){wi.addEventListener('change',e=>{n.w=Math.max(80,+e.target.value||80);draw();commit();props();});}
    if(hi){hi.addEventListener('change',e=>{n.h=Math.max(50,+e.target.value||50);draw();commit();props();});}
    document.querySelectorAll('[data-ramp]').forEach(el=>el.addEventListener('pointerdown',()=>{
      if(el.dataset.ramp==='custom'){
        n.customColor=normalizeHexColor(n.customColor)||nodeAccent(n);
      }else{
        n.ramp=el.dataset.ramp;
        n.customColor=null;
      }
      commit();draw();props();
    }));
    document.getElementById('ncustom')?.addEventListener('input',e=>{
      n.customColor=normalizeHexColor(e.target.value)||nodeAccent(n);
      commit();draw();
    });
    const fillR=document.getElementById('pfill');
    const fillV=document.getElementById('pfillv');
    if(fillR&&fillV){
      fillR.addEventListener('input',e=>{
        n.fillOpacity=(+e.target.value||0)/100;
        fillV.textContent=`${Math.round(n.fillOpacity*100)}%`;
        draw();
      });
      fillR.addEventListener('change',()=>{commit();props();});
    }
    document.querySelectorAll('[data-ntp]').forEach(el=>el.addEventListener('pointerdown',()=>{
      n.tp=el.dataset.ntp;
      n.h=nH(n.tp);
      n.w=nW(n.title,n.sub);
      commit();draw();props();
    }));
    document.querySelectorAll('[data-deled]').forEach(el=>el.addEventListener('pointerdown',ev=>{ev.stopPropagation();S.edges=S.edges.filter(e=>e.id!==el.dataset.deled);commit();draw();props();}));
    document.getElementById('pdel')?.addEventListener('pointerdown',()=>{S.nodes=S.nodes.filter(x=>x.id!==S.sel);S.edges=S.edges.filter(e=>e.from!==S.sel&&e.to!==S.sel);S.sel=null;S.selT=null;commit();draw();props();});
  }else if(S.selT==='edge'){
    const e=edById(S.sel);if(!e)return;
    const hasCustomColor=!!normalizeHexColor(e.customColor);
    prh.textContent='Edge properties';
    const fn=byId(e.from),tn=byId(e.to);
    const wc=(e.wps||[]).length;
    prb.innerHTML=`<div class="prs">
<div class="prl">Edge label</div>
<input class="pri" id="elbl" value="${esc(e.label||'')}" placeholder="e.g. triggers, blocks, 72%"/>
<div class="prl">Line style</div>
<div class="tbg">
<button class="tbb${!e.dash?' on':''}" type="button" data-estl="0">Solid</button>
<button class="tbb${e.dash?' on':''}" type="button" data-estl="1">Dashed</button>
</div>
<div class="prl">From side</div>
<div class="tbg tbg-wrap">${renderPortButtons('f',e.fp)}</div>
<div class="prl">To side</div>
<div class="tbg tbg-wrap">${renderPortButtons('t',e.tp)}</div>
<div class="prl">Color</div>
<div class="tbg tbg-wrap">${renderEdgeColorButtons(e)}</div>
${hasCustomColor?`<input class="pri pr-color-input" id="ecustom" type="color" value="${normalizeHexColor(e.customColor)||edgeStrokeColor(e)}"/>`:''}
</div>
<div class="pdv"></div>
<div class="pstat"><span>From</span><span>${esc(fn?.title||'?')}</span></div>
<div class="pstat"><span>To</span><span>${esc(tn?.title||'?')}</span></div>
<div class="pstat"><span>Bend points</span><span>${wc}</span></div>
${wc>0?`<div class="prs" style="padding-bottom:0"><button class="tbb on" type="button" id="ereset" style="width:100%;margin-bottom:8px">Reset to auto-route</button></div>`:`<div class="tip">Drag the line to bend it. Drag the blue handles to move bend points. Double-click a handle to delete it.</div>`}
<button class="delbtn" id="edel">Delete edge</button>`;

    const lblI=document.getElementById('elbl');
    lblI.addEventListener('input',ev=>{e.label=ev.target.value||null;draw();});
    lblI.addEventListener('blur',commit);
    document.querySelectorAll('[data-estl]').forEach(el=>el.addEventListener('pointerdown',()=>{e.dash=el.dataset.estl==='1';commit();draw();props();}));
    document.querySelectorAll('[data-fport]').forEach(el=>el.addEventListener('pointerdown',()=>{
      e.fp=el.dataset.fport;
      if(!e.wps?.length)e.wps=[];
      commit();draw();props();
    }));
    document.querySelectorAll('[data-tport]').forEach(el=>el.addEventListener('pointerdown',()=>{
      e.tp=el.dataset.tport;
      if(!e.wps?.length)e.wps=[];
      commit();draw();props();
    }));
    document.querySelectorAll('[data-ecol]').forEach(el=>el.addEventListener('pointerdown',()=>{
      if(el.dataset.ecol==='custom'){
        e.customColor=normalizeHexColor(e.customColor)||edgeStrokeColor(e);
      }else{
        e.col=el.dataset.ecol==='df'?null:el.dataset.ecol;
        e.customColor=null;
      }
      commit();draw();props();
    }));
    document.getElementById('ecustom')?.addEventListener('input',ev=>{
      e.customColor=normalizeHexColor(ev.target.value)||edgeStrokeColor(e);
      commit();draw();
    });
    document.getElementById('ereset')?.addEventListener('pointerdown',()=>{e.wps=[];commit();draw();props();});
    document.getElementById('edel')?.addEventListener('pointerdown',()=>{S.edges=S.edges.filter(x=>x.id!==S.sel);S.sel=null;S.selT=null;commit();draw();props();});
  }
}

function buildSidebar(){
  const sb=document.getElementById('sb');sb.innerHTML='';
  PAL.forEach(grp=>{
    const cat=document.createElement('div');cat.className='scat';cat.textContent=grp.cat;sb.appendChild(cat);
    grp.items.forEach(tmpl=>{
      const d=document.createElement('div');d.className='nc';d.draggable=true;
      const isCont=tmpl.tp==='cont';
      // Set node color as CSS custom property for left border + hover styling
      if(RMAP[tmpl.ramp])d.style.setProperty('--nc-color',RMAP[tmpl.ramp]);
      d.innerHTML=`<div class="ndot" style="${isCont?`background:transparent;border:1.5px dashed ${RMAP[tmpl.ramp]}`:`background:${RMAP[tmpl.ramp]}`}"></div><div><div class="nname">${tmpl.title}</div><div class="ntype">${tmpl.ramp} · ${isCont?'section':tmpl.tp==='two'?'2-line':'single'}</div></div>`;
      d.addEventListener('dragstart',e=>{e.dataTransfer.setData('af-tmpl',JSON.stringify(tmpl));e.dataTransfer.effectAllowed='copy';});
      sb.appendChild(d);
    });
  });
  const div=document.createElement('div');div.className='sdiv';sb.appendChild(div);
  const cu=document.createElement('div');cu.className='nc nc-cust';
  cu.innerHTML=`<div><div class="nname">+ Custom node...</div></div>`;
  cu.addEventListener('click',async ()=>{
    const t=await uiPrompt('Enter the node title.',{title:'Create custom node',value:'New node',okText:'Create'});
    if(t===null)return;
    const title=(t||'').trim();
    if(!title){
      await uiAlert('Please enter a node title.','Create custom node');
      return;
    }
    const s=await uiPrompt('Enter an optional subtitle. Leave it empty for a single-line node.',{title:'Create custom node',value:'',okText:'Continue'});
    if(s===null)return;
    addNode({ramp:'gray',tp:s?'two':'one',title,sub:(s||'').trim()});
  });
  sb.appendChild(cu);
}

function addNode(tmpl,x,y){
  const id='n'+(S.nid++);
  const isCont=tmpl.tp==='cont';
  const isText=tmpl.tp==='text';
  const w=isCont?300:isText?180:nW(tmpl.title,tmpl.sub||'');
  const h=isCont?180:isText?40:nH(tmpl.tp);
  const nx=snapV((x||300)-w/2), ny=snapV((y||200)-h/2);
  S.nodes.push({
    id,tp:tmpl.tp,x:nx,y:ny,w,h,
    ramp:isText?'text':tmpl.ramp,
    title:tmpl.title,sub:tmpl.sub||'',prompt:'',
    customColor:null,
    fillOpacity:isCont?DEFAULT_SECTION_OPACITY:1
  });
  S.sel=id;S.selT='node';
  commit();draw();props();
  document.getElementById('hint').style.opacity='0';
}



function getUiEls(){
  return {
    modal: document.getElementById('ui-modal'),
    title: document.getElementById('ui-modal-title'),
    msg: document.getElementById('ui-modal-message'),
    inputWrap: document.getElementById('ui-modal-input-wrap'),
    input: document.getElementById('ui-modal-input'),
    cancel: document.getElementById('ui-modal-cancel'),
    ok: document.getElementById('ui-modal-ok'),
    close: document.getElementById('ui-modal-close'),
  };
}
function showModalUI({title='Notice',message='',mode='alert',okText='OK',cancelText='Cancel',value=''}={}){
  const ui=getUiEls();
  if(!ui.modal){
    if(mode==='confirm')return Promise.resolve(window.confirm(message));
    if(mode==='prompt')return Promise.resolve(window.prompt(message,value));
    window.alert(message);
    return Promise.resolve(true);
  }

  ui.title.textContent=title;
  ui.msg.textContent=message;
  ui.ok.textContent=okText;
  ui.cancel.textContent=cancelText;
  ui.inputWrap.style.display=mode==='prompt'?'block':'none';
  ui.cancel.style.display=(mode==='confirm'||mode==='prompt')?'':'none';
  ui.input.value=value ?? '';
  ui.modal.classList.add('open');
  ui.modal.setAttribute('aria-hidden','false');

  return new Promise(resolve=>{
    let done=false;

    const finish=(result)=>{
      if(done)return;
      done=true;
      ui.modal.classList.remove('open');
      ui.modal.setAttribute('aria-hidden','true');
      ui.ok.removeEventListener('click',onOk);
      ui.cancel.removeEventListener('click',onCancel);
      ui.close.removeEventListener('click',onCancel);
      ui.modal.removeEventListener('click',onBackdrop);
      window.removeEventListener('keydown',onKey,true);
      resolve(result);
    };

    const onOk=()=>finish(mode==='prompt' ? ui.input.value : true);
    const onCancel=()=>finish(mode==='prompt' ? null : false);
    const onBackdrop=(e)=>{ if(e.target===ui.modal) onCancel(); };
    const onKey=(e)=>{
      if(!ui.modal.classList.contains('open'))return;
      if(e.key==='Escape'){
        e.preventDefault();
        onCancel();
      }else if(e.key==='Enter' && (mode!=='prompt' || document.activeElement===ui.input)){
        e.preventDefault();
        onOk();
      }
    };

    ui.ok.addEventListener('click',onOk);
    ui.cancel.addEventListener('click',onCancel);
    ui.close.addEventListener('click',onCancel);
    ui.modal.addEventListener('click',onBackdrop);
    window.addEventListener('keydown',onKey,true);

    requestAnimationFrame(()=>{
      if(mode==='prompt') ui.input.focus();
      else ui.ok.focus();
    });
  });
}
const uiAlert=(message,title='Notice')=>showModalUI({title,message,mode:'alert',okText:'OK'});
const uiConfirm=(message,title='Confirm',okText='Continue',cancelText='Cancel')=>showModalUI({title,message,mode:'confirm',okText,cancelText});
const uiPrompt=(message,{title='Input',value='',okText='Save',cancelText='Cancel'}={})=>showModalUI({title,message,mode:'prompt',value,okText,cancelText});
const HELP_TEXT=[
  'Shortcuts',
  '',
  'Ctrl / Cmd + /  Show this help',
  'Ctrl / Cmd + A  Select all nodes',
  'Ctrl / Cmd + C  Copy selection',
  'Ctrl / Cmd + V  Paste',
  'Ctrl / Cmd + D  Duplicate selection',
  'Ctrl / Cmd + Z  Undo',
  'Ctrl / Cmd + Y  Redo',
  'Ctrl / Cmd + Shift + Z  Redo',
  'Delete / Backspace  Delete selection',
  'Arrow keys  Nudge selected nodes',
  'Escape  Cancel connection / clear selection',
  '',
  'Canvas',
  '',
  'Ctrl + drag or middle-mouse drag  Pan',
  'Ctrl + scroll or pinch  Zoom',
  'Snap on  Enable grid, alignment, and bend snapping'
].join('\n');
function showHelp(){
  const ui=getUiEls();
  if(ui.modal?.classList.contains('open'))return Promise.resolve(false);
  return uiAlert(HELP_TEXT,'ArcFlow help');
}

const app=document.getElementById('app');
const cw=document.getElementById('cw');
const csvg=document.getElementById('csvg');
const grid=document.getElementById('grid');
let mst=null,panStart=null,dragMoved=false,panKeyDown=false,activePointerId=null;
const WHEEL_PAN_FACTOR=0.72;
const WHEEL_PAN_MAX=72;
const WHEEL_ZOOM_SENSITIVITY=0.002;
const WHEEL_ZOOM_MAX=140;
const BUTTON_ZOOM_FACTOR=1.2;
cw.style.touchAction='none';
csvg.style.touchAction='none';

function isTextEditingTarget(el){
  return !!el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable);
}
function isPanModifierKey(ev){
  return ev.key==='Control'||ev.code==='ControlLeft'||ev.code==='ControlRight';
}
function syncGrid(){
  if(!grid)return;
  const base=24;
  const size=Math.max(base*S.zoom,4);
  const gx=((S.pan.x%size)+size)%size;
  const gy=((S.pan.y%size)+size)%size;
  grid.style.backgroundSize=`${size}px ${size}px`;
  grid.style.backgroundPosition=`${gx}px ${gy}px`;
}
function syncPanCursor(){
  const cursor=mst==='pan'?'grabbing':panKeyDown?'grab':'';
  cw.style.cursor=cursor;
  csvg.style.cursor=cursor;
  document.body.classList.toggle('space-pan',panKeyDown||mst==='pan');
  document.body.classList.toggle('space-panning',mst==='pan');
}
function clampAbs(v,max){
  return Math.max(-max,Math.min(max,v));
}
function panBy(dx,dy){
  S.pan.x-=dx;
  S.pan.y-=dy;
  draw();
}
function zoomAt(f,mx,my){
  const nz=Math.max(.12,Math.min(5,S.zoom*f));
  if(Math.abs(nz-S.zoom)<0.0001)return;
  S.pan.x=mx-(mx-S.pan.x)*(nz/S.zoom);
  S.pan.y=my-(my-S.pan.y)*(nz/S.zoom);
  S.zoom=nz;
  draw();
}
function endPan(pointerId){
  if(activePointerId!==null){
    try{cw.releasePointerCapture(activePointerId);}catch{}
    activePointerId=null;
  }
  if(mst==='pan'){
    mst=null;
    panStart=null;
  }
  syncPanCursor();
}
function beginPan(e){
  e.preventDefault();
  mst='pan';
  dragMoved=false;
  S.drag=null;   // clear any stale drag
  S.rubber=null; // clear any stale rubber-band
  activePointerId=e.pointerId??null;
  panStart={mx:e.clientX,my:e.clientY,px:S.pan.x,py:S.pan.y};
  if(activePointerId!==null){
    try{cw.setPointerCapture(activePointerId);}catch{}
  }
  syncPanCursor();
}
window.addEventListener('keydown',ev=>{
  if(!isPanModifierKey(ev)||ev.repeat||isTextEditingTarget(document.activeElement))return;
  panKeyDown=true;
  syncPanCursor();
},{capture:true});
window.addEventListener('keyup',ev=>{
  if(!isPanModifierKey(ev))return;
  panKeyDown=false;
  syncPanCursor();
},{capture:true});
window.addEventListener('blur',()=>{
  endPan();
  panKeyDown=false;
  syncPanCursor();
});
window.addEventListener('pointercancel',e=>{
  endPan(e.pointerId??null);
});
window.addEventListener('dragstart',e=>{
  if((panKeyDown||mst==='pan')&&app.contains(e.target))e.preventDefault();
},{capture:true});
window.addEventListener('selectstart',e=>{
  if((panKeyDown||mst==='pan')&&app.contains(e.target))e.preventDefault();
},{capture:true});

cw.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
cw.addEventListener('drop',e=>{
  e.preventDefault();
  const str=e.dataTransfer.getData('af-tmpl');if(!str)return;
  const pos=toSVG(e.clientX,e.clientY);
  addNode(JSON.parse(str),pos.x,pos.y);
});

cw.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1)return;
  if(e.button===1||(e.button===0&&(panKeyDown||e.ctrlKey))){
    beginPan(e);return;
  }
  const t=e.target;

  const pb=t.closest('.pb');
  if(pb){
    e.stopPropagation();e.preventDefault();
    if(S.conn){cancelConn();return;}
    const n=byId(pb.dataset.nid);if(!n)return;
    const fp=ports(n)[pb.dataset.port];
    S.conn={fromId:pb.dataset.nid,fromPort:pb.dataset.port,fromPos:{x:fp.x,y:fp.y},curPos:{x:fp.x,y:fp.y}};
    csvg.classList.add('cmode');
    document.getElementById('connbanner').classList.add('on');
    mst='conn';return;
  }

  if(t.dataset.wpid&&t.dataset.wpdx!==undefined){
    e.stopPropagation();e.preventDefault();
    S.wpDrag={eid:t.dataset.wpid,idx:+t.dataset.wpdx};
    mst='wpDrag';return;
  }

  if(t.dataset.wpadd&&t.dataset.wpi!==undefined){
    e.stopPropagation();e.preventDefault();
    const pos=toSVG(e.clientX,e.clientY);
    const edge=edById(t.dataset.wpadd);
    if(edge){
      if(!edge.wps)edge.wps=[];
      const idx=+t.dataset.wpi;
      edge.wps.splice(idx,0,{x:pos.x,y:pos.y});
      S.wpDrag={eid:edge.id,idx};mst='wpDrag';drawOverlay();
    }
    return;
  }

  const edgeTarget=t.closest('.edge-hit,.ep');
  if(edgeTarget){
    const eid=edgeTarget.dataset.eid;const edge=edById(eid);
    if(edge){
      S.sel=eid;S.selT='edge';draw();props();
      const pos=toSVG(e.clientX,e.clientY);
      S.eDrag={eid,startPos:{x:pos.x,y:pos.y},moved:false};
      mst='eDrag';
    }
    return;
  }

  const rzEl=t.closest('[data-rzid]')||( t.dataset.rzid ? t : null );
  if(rzEl&&rzEl.dataset.rzid){
    e.stopPropagation();e.preventDefault();
    const n=byId(rzEl.dataset.rzid);if(!n)return;
    const pos=toSVG(e.clientX,e.clientY);

    S.drag={id:n.id,resize:true,cx:pos.x,cy:pos.y,iw:n.w,ih:n.h};
    S.sel=n.id;S.selT='node';
    mst='drag';dragMoved=false;draw();props();return;
  }

  if(S.conn){
    const ng=t.closest('.node-g');
    if(ng&&ng.dataset.nid!==S.conn.fromId){
      const tn=byId(ng.dataset.nid);
      if(tn){
        const tport=nearPort(S.conn.fromPos,tn);
        const exists=S.edges.find(ed=>ed.from===S.conn.fromId&&ed.to===ng.dataset.nid);
        if(!exists){
          const eid='e'+(S.nid++);
          S.edges.push({id:eid,from:S.conn.fromId,fp:S.conn.fromPort,to:ng.dataset.nid,tp:tport,dash:false,col:null,wps:[],label:null});
          S.sel=eid;S.selT='edge';commit();
          cancelConn();draw();props();
          showEdgeLabelInput(eid);
          return;
        }
      }
    }
    cancelConn();draw();props();return;
  }

  const ng=t.closest('.node-g,.cont-g');
  if(ng){
    const nid=ng.dataset.nid;

    if(S.multi.includes(nid)){

      const pos=toSVG(e.clientX,e.clientY);
      S.drag={multi:true,offsets:S.multi.map(id=>{const n=byId(id);return{id,ox:pos.x-n.x,oy:pos.y-n.y};})};
    }else{
      S.multi=[];
      S.sel=nid;S.selT='node';draw();props();
      const n=byId(nid);if(!n)return;
      const pos=toSVG(e.clientX,e.clientY);
      S.drag={id:nid,ox:pos.x-n.x,oy:pos.y-n.y};
    }
    mst='drag';dragMoved=false;return;
  }

  if(e.button===0){

    S.sel=null;S.selT=null;
    const pos=toSVG(e.clientX,e.clientY);
    S.rubber={x0:pos.x,y0:pos.y,x1:pos.x,y1:pos.y};
    mst='rubber';
    if(S.multi.length){S.multi=[];draw();}else{draw();}
  }
});

window.addEventListener('pointermove',e=>{
  if(mst==='drag'&&S.drag){
    const pos=toSVG(e.clientX,e.clientY);
    if(S.drag.multi){
      S.guides=[];
      S.drag.offsets.forEach(({id,ox,oy})=>{const n=byId(id);if(n){n.x=snapV(pos.x-ox);n.y=snapV(pos.y-oy);}});
      dragMoved=true;draw();
    }else{
      const n=byId(S.drag.id);if(!n)return;
      if(S.drag.resize){
        S.guides=[];
        const dx=pos.x-S.drag.cx, dy=pos.y-S.drag.cy;
        n.w=Math.max(80,snapV(S.drag.iw+dx));
        n.h=Math.max(50,snapV(S.drag.ih+dy));
      }else{
        let nx=snapV(pos.x-S.drag.ox),ny=snapV(pos.y-S.drag.oy);
        const aligned=smartAlignRect(rectAt(nx,ny,n.w,n.h),new Set([n.id]));
        nx=aligned.x;ny=aligned.y;S.guides=aligned.guides;

        if(n.tp==='cont'&&dragMoved===false){
          S.drag.childOffsets=getContainerChildren(n.id).map(c=>({id:c.id,ox:c.x-n.x,oy:c.y-n.y}));
        }
        if(n.tp==='cont'&&S.drag.childOffsets){
          S.drag.childOffsets.forEach(({id,ox,oy})=>{const c=byId(id);if(c){c.x=nx+ox;c.y=ny+oy;}});
        }
        n.x=nx;n.y=ny;dragMoved=true;
      }
      draw();
    }
  }else if(mst==='pan'&&panStart){
    S.guides=[];
    S.pan.x=panStart.px+(e.clientX-panStart.mx);
    S.pan.y=panStart.py+(e.clientY-panStart.my);
    draw();
  }else if(mst==='conn'&&S.conn){
    S.guides=[];
    const pos=toSVG(e.clientX,e.clientY);
    S.conn.curPos={x:pos.x,y:pos.y};
    document.querySelectorAll('.ct-hi').forEach(el=>el.classList.remove('ct-hi'));
    const ng=e.target.closest?.('.node-g');
    if(ng&&ng.dataset.nid!==S.conn.fromId)ng.classList.add('ct-hi');
    drawOverlay();
  }else if(mst==='wpDrag'&&S.wpDrag){
    S.guides=[];
    const pos=toSVG(e.clientX,e.clientY);
    const edge=edById(S.wpDrag.eid);
    if(edge&&edge.wps&&edge.wps[S.wpDrag.idx]){
      const snapped=snapWaypointPosition(edge,S.wpDrag.idx,pos);
      edge.wps[S.wpDrag.idx]={x:snapped.x,y:snapped.y};
      S.guides=snapped.guides;
      draw();
    }
  }else if(mst==='eDrag'&&S.eDrag){
    S.guides=[];
    const pos=toSVG(e.clientX,e.clientY);
    const d=Math.hypot(pos.x-S.eDrag.startPos.x,pos.y-S.eDrag.startPos.y);
    if(!S.eDrag.moved&&d>4){
      const edge=edById(S.eDrag.eid);
      if(edge){
        if(!edge.wps)edge.wps=[];
        const fn=byId(edge.from),tn=byId(edge.to);
        if(fn&&tn){
          const fp=ports(fn)[edge.fp],tp=ports(tn)[edge.tp];
          const route=buildEdgeRoute(fp,tp,edge.wps||[],edge.fp,edge.tp);
          const all=route.points;
          let bestSeg=0,bestD=1e9;
          for(let i=0;i<all.length-1;i++){
            const mx=(all[i].x+all[i+1].x)/2,my=(all[i].y+all[i+1].y)/2;
            const dd=Math.hypot(S.eDrag.startPos.x-mx,S.eDrag.startPos.y-my);
            if(dd<bestD){bestD=dd;bestSeg=i;}
          }
          const insertIdx=route.insertIndices[bestSeg]??edge.wps.length;
          edge.wps.splice(insertIdx,0,{...S.eDrag.startPos});
          S.wpDrag={eid:edge.id,idx:insertIdx};
          S.eDrag.moved=true;mst='wpDrag';draw();
        }
      }
    }
  }else if(mst==='rubber'&&S.rubber){
    S.guides=[];
    const pos=toSVG(e.clientX,e.clientY);
    S.rubber.x1=pos.x;S.rubber.y1=pos.y;
    drawOverlay();
  }
});

window.addEventListener('pointerup',e=>{
  const wasPan=mst==='pan';
  if(wasPan)endPan(e.pointerId??null);
  if(mst==='drag'&&S.drag){
    if(dragMoved||S.drag.resize)commit();
    if(!dragMoved && !S.drag.resize && S.drag.id){
      const n=byId(S.drag.id);
      if(n&&n.prompt&&!S.multi.length){
        uiAlert(n.prompt,n.title||'Node');
      }
    }
    if(S.drag.resize){

      const wi=document.getElementById('pw'),hi=document.getElementById('ph2');
      const n=byId(S.drag.id);
      if(wi&&n)wi.value=Math.round(n.w);
      if(hi&&n)hi.value=Math.round(n.h);
    }
  }
  if(mst==='wpDrag'&&S.wpDrag){commit();draw();}
  if(mst==='rubber'&&S.rubber){

    const rx0=Math.min(S.rubber.x0,S.rubber.x1),rx1=Math.max(S.rubber.x0,S.rubber.x1);
    const ry0=Math.min(S.rubber.y0,S.rubber.y1),ry1=Math.max(S.rubber.y0,S.rubber.y1);
    const moved=Math.hypot(rx1-rx0,ry1-ry0)>6;
    if(moved){
      S.multi=S.nodes.filter(n=>{
        return n.x<rx1&&(n.x+n.w)>rx0&&n.y<ry1&&(n.y+n.h)>ry0;
      }).map(n=>n.id);
      if(S.multi.length===1){S.sel=S.multi[0];S.selT='node';S.multi=[];props();}
      else if(S.multi.length>1){S.sel=null;S.selT=null;}
    }
    S.rubber=null;draw();
  }
  S.drag=null;S.wpDrag=null;S.eDrag=null;dragMoved=false;
  const prevMst=mst;
  mst=null;panStart=null;S.guides=[];
  if(!wasPan)syncPanCursor();
  document.querySelectorAll('.ct-hi').forEach(el=>el.classList.remove('ct-hi'));

  if(prevMst==='wpDrag')props();
  if(prevMst==='drag')draw();
});

csvg.addEventListener('dblclick',e=>{
  if(e.target.dataset.wpid&&e.target.dataset.wpdx!==undefined){
    const edge=edById(e.target.dataset.wpid);
    if(edge&&edge.wps){edge.wps.splice(+e.target.dataset.wpdx,1);commit();draw();props();}
  }
});

function cancelConn(){
  S.conn=null;csvg.classList.remove('cmode');
  document.getElementById('connbanner').classList.remove('on');
  document.querySelectorAll('.ct-hi').forEach(el=>el.classList.remove('ct-hi'));
  drawOverlay();
}

function showEdgeLabelInput(eid){
  const e=edById(eid);
  if(!e)return;
  const fn=byId(e.from),tn=byId(e.to);
  if(!fn||!tn)return;

  // Compute SVG midpoint of the edge
  const fp=ports(fn)[e.fp],tp=ports(tn)[e.tp];
  const mid=edgeCenterPoint(edgePolylinePoints(fp,tp,e.wps||[],e.fp,e.tp));
  if(!mid)return;
  const mx=mid.x;
  const my=mid.y;

  // Convert SVG coords to screen coords
  const svgEl=document.getElementById('csvg');
  const vp=document.getElementById('vp');
  const svgPt=svgEl.createSVGPoint();
  svgPt.x=mx;svgPt.y=my;
  const screen=svgPt.matrixTransform(vp.getScreenCTM());
  const cwRect=document.getElementById('cw').getBoundingClientRect();

  // Build floating pill input
  const inp=document.createElement('input');
  inp.type='text';
  inp.placeholder='Label… (Enter to save, Esc to skip)';
  inp.style.cssText=[
    'position:absolute',
    `left:${screen.x-cwRect.left}px`,
    `top:${screen.y-cwRect.top}px`,
    'transform:translate(-50%,-50%)',
    'z-index:50',
    'height:28px',
    'padding:0 10px',
    'font-size:11px',
    'font-family:inherit',
    'color:var(--t1)',
    'background:var(--bg1)',
    'border:1px solid var(--b2)',
    'border-radius:4px',
    'outline:none',
    'min-width:172px',
    'box-shadow:0 12px 28px rgba(0,0,0,.18)',
    'caret-color:var(--acc)',
  ].join(';');

  document.getElementById('cw').appendChild(inp);
  requestAnimationFrame(()=>inp.focus());

  let finished=false;
  const finish=(save)=>{
    if(finished)return;
    finished=true;
    const val=inp.value.trim();
    inp.remove();
    if(save&&val){
      const edge=edById(eid);
      if(edge){edge.label=val;commit();draw();props();}
    }
  };

  inp.addEventListener('keydown',ev=>{
    ev.stopPropagation(); // block canvas shortcuts while typing
    if(ev.key==='Enter'){ev.preventDefault();finish(true);}
    else if(ev.key==='Escape'){ev.preventDefault();finish(false);}
  });
  inp.addEventListener('blur',()=>finish(true));
}

function wheelDeltaPx(e){
  let dx = e.deltaX;
  let dy = e.deltaY;

  // normalize non-pixel wheel events
  if(e.deltaMode === 1){ // lines
    dx *= 16;
    dy *= 16;
  }else if(e.deltaMode === 2){ // pages
    const r = cw.getBoundingClientRect();
    dx *= r.width;
    dy *= r.height;
  }

  return { dx, dy };
}

cw.addEventListener('wheel', e=>{
  e.preventDefault();

  const { dx:rawDx, dy:rawDy } = wheelDeltaPx(e);
  const dx=clampAbs(rawDx*WHEEL_PAN_FACTOR,WHEEL_PAN_MAX);
  const dy=clampAbs(rawDy*WHEEL_PAN_FACTOR,WHEEL_PAN_MAX);

  if(e.ctrlKey || e.metaKey){
    const zoomDelta=clampAbs(rawDy,WHEEL_ZOOM_MAX);
    const f=Math.exp(-zoomDelta*WHEEL_ZOOM_SENSITIVITY);
    const r = cw.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    zoomAt(f,mx,my);
    return;
  }

  panBy(dx,dy);
},{ passive:false });

window.addEventListener('keydown',e=>{
  if(isPanModifierKey(e))return;
  if(document.getElementById('exp-modal')?.classList.contains('open'))return;
  if((e.metaKey||e.ctrlKey)&&e.code==='Slash'){
    e.preventDefault();
    showHelp();
    return;
  }
  const tag=document.activeElement.tagName;
  const inInput=tag==='INPUT'||tag==='TEXTAREA';

  if(e.key==='Escape'){
    cancelConn();
    S.sel=null;S.selT=null;S.multi=[];S.rubber=null;
    draw();props();return;
  }

  if((e.key==='Delete'||e.key==='Backspace')&&!inInput){
    e.preventDefault();

    if(S.multi.length){
      const ids=new Set(S.multi);
      S.nodes=S.nodes.filter(n=>!ids.has(n.id));
      S.edges=S.edges.filter(ed=>!ids.has(ed.from)&&!ids.has(ed.to));
      S.multi=[];S.sel=null;S.selT=null;commit();draw();props();return;
    }

    if(S.sel){
      if(S.selT==='node'){S.nodes=S.nodes.filter(n=>n.id!==S.sel);S.edges=S.edges.filter(ed=>ed.from!==S.sel&&ed.to!==S.sel);}
      else S.edges=S.edges.filter(ed=>ed.id!==S.sel);
      S.sel=null;S.selT=null;commit();draw();props();
    }
    return;
  }

  const ARROW={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]};
  if(ARROW[e.key]&&!inInput){
    e.preventDefault();
    const [dx,dy]=ARROW[e.key];
    const ids=S.multi.length?S.multi:(S.sel&&S.selT==='node'?[S.sel]:[]);
    ids.forEach(id=>{const n=byId(id);if(n){n.x+=dx;n.y+=dy;}});
    if(ids.length)draw();
    return;
  }

  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&!inInput){
    e.preventDefault();
    S.multi=S.nodes.map(n=>n.id);S.sel=null;S.selT=null;draw();return;
  }

  if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
  if((e.metaKey||e.ctrlKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){e.preventDefault();redo();}

  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'&&!inInput){
    e.preventDefault();
    const ids=S.multi.length?S.multi:(S.sel&&S.selT==='node'?[S.sel]:[]);
    if(!ids.length)return;
    const map={};
    const newIds=ids.map(id=>{
      const n=byId(id);if(!n)return null;
      const nid='n'+(S.nid++);
      map[id]=nid;
      S.nodes.push({...deepcl(n),id:nid,x:n.x+24,y:n.y+24});
      return nid;
    }).filter(Boolean);
    S.multi=newIds.length>1?newIds:[];
    if(newIds.length===1){S.sel=newIds[0];S.selT='node';}
    else{S.sel=null;S.selT=null;}
    commit();draw();props();return;
  }

  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='c'&&!inInput){
    e.preventDefault();
    const ids=S.multi.length?S.multi:(S.sel&&S.selT==='node'?[S.sel]:[]);
    if(!ids.length)return;
    const nodes=ids.map(id=>deepcl(byId(id))).filter(Boolean);
    if(!nodes.length)return;
    S.clipboard={nodes:deepcl(nodes)};
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(JSON.stringify({kind:'arcflow/nodes',version:1,nodes})).catch(()=>{});
    }
    return;
  }

  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='v'&&!inInput){
    e.preventDefault();
    const doApplyPaste=seedNodes=>{
      if(!seedNodes||!seedNodes.length)return false;
      const pasteNodes=seedNodes.map(n=>({...deepcl(n),x:n.x+32,y:n.y+32}));
      const newIds=pasteNodes.map(n=>{
        const nid='n'+(S.nid++);
        S.nodes.push({...deepcl(n),id:nid});
        return nid;
      });
      S.multi=newIds.length>1?newIds:[];
      if(newIds.length===1){S.sel=newIds[0];S.selT='node';}
      else{S.sel=null;S.selT=null;}
      S.clipboard={nodes:deepcl(pasteNodes)};
      commit();draw();props();
      return true;
    };

    if(S.clipboard&&Array.isArray(S.clipboard.nodes)&&S.clipboard.nodes.length){
      doApplyPaste(deepcl(S.clipboard.nodes));
      return;
    }
    if(!(navigator.clipboard&&navigator.clipboard.readText)){
      uiAlert('No ArcFlow clipboard data is available to paste. Copy inside ArcFlow first, or allow clipboard access to paste from another tab.','Paste unavailable');
      return;
    }
    navigator.clipboard.readText().then(text=>{
      let nodes=null;
      try{
        nodes=sanitizeClipboardNodes(JSON.parse(text));
      }catch{}
      if(doApplyPaste(nodes))return;
      uiAlert('The system clipboard does not contain ArcFlow data that can be pasted here.','Paste unavailable');
    }).catch(()=>{
      uiAlert('Clipboard access was blocked, and there is no in-app ArcFlow copy buffer to paste from.','Paste unavailable');
    });
    return;
  }
});

document.getElementById('bundo').addEventListener('click',undo);
document.getElementById('bredo').addEventListener('click',redo);
const darkToggle=document.getElementById('bdark');
darkToggle.textContent=document.body.classList.contains('dark')?'Light mode':'Dark mode';
darkToggle.addEventListener('click',function(){
  document.body.classList.toggle('dark');
  this.textContent=document.body.classList.contains('dark')?'Light mode':'Dark mode';
  draw();
});
document.getElementById('bclear').addEventListener('click',async ()=>{
  const ok=await uiConfirm('Clear all nodes and edges? This cannot be undone with a browser dialog anymore, but your normal undo history stays available until the state changes.','Clear canvas','Clear','Cancel');
  if(!ok)return;
  S.nodes=[];S.edges=[];S.sel=null;S.selT=null;S.multi=[];cancelConn();
  commit();draw();props();document.getElementById('hint').style.opacity='1';
});
document.getElementById('bzm').addEventListener('click',()=>AF.zoom(1/BUTTON_ZOOM_FACTOR));
document.getElementById('bzp').addEventListener('click',()=>AF.zoom(BUTTON_ZOOM_FACTOR));
document.getElementById('bzf').addEventListener('click',()=>AF.fitAll());
document.getElementById('bzmb').addEventListener('click',()=>AF.zoom(1/BUTTON_ZOOM_FACTOR));
document.getElementById('bzpb').addEventListener('click',()=>AF.zoom(BUTTON_ZOOM_FACTOR));
document.getElementById('bzfb').addEventListener('click',()=>AF.fitAll());

document.getElementById('snap-toggle').addEventListener('click',function(){
  S.snap=!S.snap;
  this.textContent=S.snap?'Snap on':'Snap off';
  this.classList.toggle('on',S.snap);
});

document.getElementById('mmtoggle').addEventListener('click',()=>{
  S.mmVisible=!S.mmVisible;
  updateMinimap();
});

document.getElementById('bzoom-sel').addEventListener('click',()=>{
  const ids=S.multi.length?S.multi:(S.sel&&S.selT==='node'?[S.sel]:[]);
  if(!ids.length){AF.fitAll();return;}
  const ns=ids.map(byId).filter(Boolean);
  const xs=ns.flatMap(n=>[n.x,n.x+n.w]),ys=ns.flatMap(n=>[n.y,n.y+n.h]);
  const mnX=Math.min(...xs),mnY=Math.min(...ys),mxX=Math.max(...xs),mxY=Math.max(...ys);
  const W=mxX-mnX||50,H=mxY-mnY||50;
  const r=cw.getBoundingClientRect(),p=80;
  S.zoom=Math.min((r.width-p*2)/W,(r.height-p*2)/H,3);
  S.pan.x=p-mnX*S.zoom+(r.width-p*2-W*S.zoom)/2;
  S.pan.y=p-mnY*S.zoom+(r.height-p*2-H*S.zoom)/2;
  draw();
});

document.querySelectorAll('[data-align]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const ids=S.multi.length?S.multi:(S.sel&&S.selT==='node'?[S.sel]:[]);
    if(ids.length<1)return;
    const ns=ids.map(byId).filter(Boolean);
    const type=btn.dataset.align;
    if(type==='left'){const v=Math.min(...ns.map(n=>n.x));ns.forEach(n=>n.x=v);}
    else if(type==='right'){const v=Math.max(...ns.map(n=>n.x+n.w));ns.forEach(n=>n.x=v-n.w);}
    else if(type==='center'){const v=(Math.min(...ns.map(n=>n.x))+Math.max(...ns.map(n=>n.x+n.w)))/2;ns.forEach(n=>n.x=v-n.w/2);}
    else if(type==='top'){const v=Math.min(...ns.map(n=>n.y));ns.forEach(n=>n.y=v);}
    else if(type==='bottom'){const v=Math.max(...ns.map(n=>n.y+n.h));ns.forEach(n=>n.y=v-n.h);}
    else if(type==='middle'){const v=(Math.min(...ns.map(n=>n.y))+Math.max(...ns.map(n=>n.y+n.h)))/2;ns.forEach(n=>n.y=v-n.h/2);}
    else if(type==='hdist'&&ns.length>2){
      ns.sort((a,b)=>a.x-b.x);
      const gap=(ns[ns.length-1].x-ns[0].x-ns[0].w)/(ns.length-1);
      let cx=ns[0].x+ns[0].w;
      for(let i=1;i<ns.length-1;i++){ns[i].x=cx+gap-(ns[i].w-ns[i].w);cx+=gap+ns[i-1].w;}

      const totalW=ns.reduce((s,n)=>s+n.w,0);
      const span=ns[ns.length-1].x+ns[ns.length-1].w-ns[0].x;
      const sp=(span-totalW)/(ns.length-1);
      let ox=ns[0].x+ns[0].w;
      for(let i=1;i<ns.length-1;i++){ns[i].x=ox+sp;ox=ns[i].x+ns[i].w;}
    }
    else if(type==='vdist'&&ns.length>2){
      ns.sort((a,b)=>a.y-b.y);
      const totalH=ns.reduce((s,n)=>s+n.h,0);
      const span=ns[ns.length-1].y+ns[ns.length-1].h-ns[0].y;
      const sp=(span-totalH)/(ns.length-1);
      let oy=ns[0].y+ns[0].h;
      for(let i=1;i<ns.length-1;i++){ns[i].y=oy+sp;oy=ns[i].y+ns[i].h;}
    }
    else if(type==='matchw'&&ns.length>1){const v=ns[0].w;ns.forEach(n=>n.w=v);}
    commit();draw();
  });
});

const _origNodeDrag=S;
function getContainerChildren(contId){
  const c=byId(contId);if(!c||c.tp!=='cont')return[];
  return S.nodes.filter(n=>n.id!==contId&&n.tp!=='cont'&&
    n.x>=c.x&&n.x+n.w<=c.x+c.w&&n.y>=c.y&&n.y+n.h<=c.y+c.h);
}

function doZoom(f){
  const r=cw.getBoundingClientRect();
  const mx=r.width/2,my=r.height/2;
  zoomAt(f,mx,my);
}
function fitAll(){
  if(!S.nodes.length){S.pan={x:80,y:60};S.zoom=1;draw();return;}
  const r=cw.getBoundingClientRect();
  const xs=S.nodes.flatMap(n=>[n.x,n.x+n.w]),ys=S.nodes.flatMap(n=>[n.y,n.y+n.h]);
  const mnX=Math.min(...xs),mnY=Math.min(...ys),mxX=Math.max(...xs),mxY=Math.max(...ys);
  const W=mxX-mnX,H=mxY-mnY;if(!W||!H)return;
  const p=56;S.zoom=Math.min((r.width-p*2)/W,(r.height-p*2)/H,2.5);
  S.pan.x=p-mnX*S.zoom+(r.width-p*2-W*S.zoom)/2;
  S.pan.y=p-mnY*S.zoom+(r.height-p*2-H*S.zoom)/2;
  draw();
}

document.getElementById('blay').addEventListener('click',()=>{
  const reg=S.nodes.filter(n=>n.tp!=='cont'&&n.tp!=='text');if(!reg.length)return;
  const inD={},outE={};
  reg.forEach(n=>{inD[n.id]=0;outE[n.id]=[];});
  S.edges.forEach(e=>{if(inD[e.to]!==undefined)inD[e.to]++;if(outE[e.from])outE[e.from].push(e.to);});
  const lyr={},tmpD={...inD};
  let cur=reg.filter(n=>inD[n.id]===0).map(n=>n.id);
  let l=0;const vis=new Set();
  while(cur.length){
    cur.forEach(id=>{if(!vis.has(id)){lyr[id]=l;vis.add(id);}});
    const nx=[];cur.forEach(id=>{(outE[id]||[]).forEach(t=>{tmpD[t]--;if(!tmpD[t])nx.push(t);});});
    l++;cur=nx;
  }
  reg.forEach(n=>{if(lyr[n.id]===undefined)lyr[n.id]=l;});
  const byl={};reg.forEach(n=>{const ll=lyr[n.id];if(!byl[ll])byl[ll]=[];byl[ll].push(n);});
  Object.entries(byl).forEach(([ll,ns])=>{
    const tw=ns.reduce((s,n)=>s+n.w,0)+(ns.length-1)*36;let x=-tw/2;
    ns.forEach(n=>{n.x=x;n.y=+ll*100;x+=n.w+36;});
  });
  S.edges.forEach(e=>{e.wps=[];});
  fitAll();commit();draw();
});

document.getElementById('bex').addEventListener('click',async ()=>{
  if(S.nodes.length){
    const ok=await uiConfirm('Replace the current canvas with the example diagram?','Load example','Replace','Cancel');
    if(!ok)return;
  }
  S.title='Automated security pipeline';
  S.nodes=[];S.edges=[];S.nid=200;
  S.nodes=[
    {id:'c1',tp:'cont',ramp:'purple',x:-350,y:-40,w:740,h:720,title:'Automated security pipeline',sub:'Continuous attack surface management'},
    {id:'n1',tp:'two',ramp:'purple',x:-130,y:10, w:260,h:56,title:'Coordinator agent',   sub:'Manages policy & orchestration',  prompt:'What does the Coordinator agent do?'},
    {id:'n2',tp:'two',ramp:'teal',  x:-320,y:130,w:180,h:52,title:'Discovery agent',     sub:'Maps assets & roles',             prompt:'How does the Discovery agent find assets?'},
    {id:'n3',tp:'two',ramp:'coral', x:-110,y:130,w:190,h:52,title:'Attack path agent',   sub:'Builds path model',               prompt:'How does the Attack Path agent model attacker movement?'},
    {id:'n4',tp:'one',ramp:'gray',  x: 110,y:130,w:160,h:44,title:'Memory agent',        sub:'',                                prompt:'What does the Memory agent store?'},
    {id:'n5',tp:'two',ramp:'amber', x:-150,y:244,w:300,h:56,title:'Attack path graph',   sub:'Full risk map of the system',     prompt:'What does the attack path graph contain?'},
    {id:'n6',tp:'two',ramp:'red',   x:-320,y:364,w:220,h:52,title:'Red validation',      sub:'Simulates attacker paths',        prompt:'How does the Red Validation agent test paths?'},
    {id:'n7',tp:'two',ramp:'blue',  x:  10,y:364,w:220,h:52,title:'Blue defense',        sub:'Applies security fixes',          prompt:'How does the Blue Defense agent work?'},
    {id:'n8',tp:'two',ramp:'purple',x:-160,y:480,w:320,h:56,title:'Verification agent',  sub:'Confirms paths are blocked',      prompt:'What does the Verification agent check?'},
    {id:'n9',tp:'one',ramp:'green', x:-320,y:600,w:180,h:44,title:'System learns',       sub:'',                                prompt:'How does the system learn from blocked paths?'},
    {id:'n10',tp:'one',ramp:'red',  x:  10,y:600,w:180,h:44,title:'Escalate defenses',  sub:'',                                prompt:'What does escalating defenses involve?'},
    {id:'t1',tp:'text',ramp:'text', x:-130,y:680,w:260,h:36,title:'↻ Feeds back to coordinator',sub:'',prompt:''},
  ];
  S.edges=[
    {id:'e1', from:'n1',fp:'bottom',to:'n2', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e2', from:'n1',fp:'bottom',to:'n3', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e3', from:'n1',fp:'bottom',to:'n4', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e4', from:'n2',fp:'bottom',to:'n5', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e5', from:'n3',fp:'bottom',to:'n5', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e6', from:'n4',fp:'bottom',to:'n5', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e7', from:'n5',fp:'bottom',to:'n6', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e8', from:'n5',fp:'bottom',to:'n7', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e9', from:'n6',fp:'bottom',to:'n8', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e10',from:'n7',fp:'bottom',to:'n8', tp:'top',   dash:false,col:null,   wps:[],label:null},
    {id:'e11',from:'n8',fp:'bottom',to:'n9', tp:'top',   dash:false,col:'green',wps:[],label:'path blocked'},
    {id:'e12',from:'n8',fp:'bottom',to:'n10',tp:'top',   dash:false,col:'red',  wps:[],label:'still open'},
    {id:'e13',from:'n9',fp:'right', to:'n1', tp:'left',  dash:true, col:null,   wps:[],label:null},
  ];
  syncProjectTitle();
  S.sel=null;S.selT=null;fitAll();commit();draw();props();
  document.getElementById('hint').style.opacity='0';
});

document.getElementById('bsave').addEventListener('click',()=>{
  const data=JSON.stringify({title:S.title,nodes:S.nodes,edges:S.edges,nid:S.nid},null,2);
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`${projectFileStem()}.json`;a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('bload-btn').addEventListener('click',()=>document.getElementById('bload').click());
document.getElementById('bload').addEventListener('change',function(){
  const f=this.files[0];if(!f)return;
  loadFromFile(f);
  this.value='';
});

// Central load function — used by both the button and the window drag-drop handler
function loadFromFile(file) {
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    uiAlert('Only .json files exported from ArcFlow can be loaded.', 'Unsupported file');
    return;
  }
  const r = new FileReader();
  r.onload = ev => {
    let raw;
    try { raw = JSON.parse(ev.target.result); }
    catch { uiAlert('The file is not valid JSON.', 'Load failed'); return; }

    let result;
    try { result = sanitizeLoad(raw); }
    catch (err) {
      uiAlert(err.message, 'Incompatible file');
      return;
    }

    const { title, nodes, edges, nid, warnings } = result;
    S.title = normalizeProjectTitle(title, normalizeProjectTitle(file.name.replace(/\.[^.]+$/,''), DEFAULT_PROJECT_TITLE));
    syncProjectTitle();
    S.nodes = nodes; S.edges = edges; S.nid = nid;
    S.sel = null; S.selT = null; S.multi = [];
    fitAll(); commit(); draw(); props();
    document.getElementById('hint').style.opacity = '0';

    if (warnings.length) {
      // Show a non-blocking summary of what was fixed during import
      uiAlert(
        'File loaded with the following corrections:\n\n' + warnings.map(function(w){ return '  - ' + w; }).join('\n'),
        'Loaded with warnings'
      );
    }
  };
  r.readAsText(file);
}

// Allow dragging a .json file onto the browser window (not just the canvas)
window.addEventListener('dragover', e => {
  if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});
window.addEventListener('drop', e => {
  if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const file = [...e.dataTransfer.files].find(f => f.name.endsWith('.json'));
  if (!file) return;
  loadFromFile(file);
});

function buildExportSVG(){
  const pad=50;
  const boundsNodes=S.nodes.some(n=>n.tp!=='text')?S.nodes.filter(n=>n.tp!=='text'):S.nodes.slice();
  const xs=boundsNodes.flatMap(n=>[n.x,n.x+n.w]);
  const ys=boundsNodes.flatMap(n=>[n.y,n.y+n.h]);

  S.edges.forEach(e=>{
    const fn=byId(e.from),tn=byId(e.to);
    if(!fn||!tn)return;
    const fp=ports(fn)[e.fp],tp=ports(tn)[e.tp];
    if(!fp||!tp)return;

    const all=edgePolylinePoints(fp,tp,e.wps||[],e.fp,e.tp);
    all.forEach(p=>{xs.push(p.x);ys.push(p.y);});

    if(e.label){
      const mid=edgeCenterPoint(all);
      if(!mid)return;
      const mx=mid.x;
      const my=mid.y;
      const hw=Math.max(e.label.length*7.2+20,38)/2;
      xs.push(mx-hw,mx+hw);
      ys.push(my-9,my+9);
    }
  });

  const mnX=Math.min(...xs)-pad,mnY=Math.min(...ys)-pad;
  const mxX=Math.max(...xs)+pad,mxY=Math.max(...ys)+pad;
  const W=mxX-mnX,H=mxY-mnY;
  const isDark=isDarkTheme();
  const css=`.nt{font-size:13px;font-weight:500;font-family:${FF}}.ns{font-size:11px;font-family:${FF}}.elbl{font-size:11px;font-family:${FF}}`;
  const lines=[
    `<svg width="${W}" height="${H}" viewBox="${mnX} ${mnY} ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker><style>${css}</style></defs>`,
  ];
  S.nodes.filter(n=>n.tp==='cont').forEach(n=>{
    const visuals=resolveNodeVisuals(n,isDark);
    lines.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${SECTION_RX}" fill="${visuals.fill}" stroke="${visuals.stroke}" stroke-width="1" stroke-dasharray="7 4"/>`);
    lines.push(`<text class="nt" x="${n.x+14}" y="${n.y+17}" fill="${visuals.title}" dominant-baseline="central">${esc(n.title)}</text>`);
    if(n.sub)lines.push(`<text class="ns" x="${n.x+14}" y="${n.y+32}" fill="${visuals.sub}" dominant-baseline="central">${esc(n.sub)}</text>`);
  });
  S.edges.forEach(e=>{
    const fn=byId(e.from),tn=byId(e.to);if(!fn||!tn)return;
    const fp=ports(fn)[e.fp],tp=ports(tn)[e.tp];if(!fp||!tp)return;
    const d=mkPath(fp,tp,e.wps||[],e.fp,e.tp);
    const visuals=resolveEdgeVisuals(e,isDark);
    lines.push(`<path d="${d}" fill="none" stroke="${visuals.stroke}" stroke-width="1.5"${e.dash?' stroke-dasharray="5 4"':''} stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arr)"/>`);
    if(e.label){
      const mid=edgeCenterPoint(edgePolylinePoints(fp,tp,e.wps||[],e.fp,e.tp));
      if(!mid)return;
      const mx=mid.x,my=mid.y;
      const tw=Math.max(e.label.length*7.2+20,38);
      lines.push(`<rect x="${mx-tw/2}" y="${my-8}" width="${tw}" height="16" rx="8" fill="${visuals.labelBg}"/>`);
      lines.push(`<text class="elbl" x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" fill="${visuals.labelText}">${esc(e.label)}</text>`);
    }
  });
  S.nodes.filter(n=>n.tp!=='cont').forEach(n=>{
    const isText=n.tp==='text';
    const cx=n.x+n.w/2,tY=(n.tp==='two'||isText)?n.y+16:n.y+n.h/2;
    const visuals=resolveNodeVisuals(n,isDark);
    lines.push('<g>');
    if(n.prompt)lines.push(`<title>${esc(n.prompt)}</title>`);
    if(!isText)lines.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${isText?TEXT_NODE_RX:NODE_RX}" fill="${visuals.fill}" stroke="${visuals.stroke}" stroke-width=".5"/>`);
    lines.push(`<text class="nt" x="${cx}" y="${tY}" text-anchor="middle" dominant-baseline="central" fill="${visuals.title}" font-weight="${isText?400:500}" font-size="${isText?14:13}">${esc(n.title)}</text>`);
    if((n.tp==='two'||isText)&&n.sub)lines.push(`<text class="ns" x="${cx}" y="${n.y+n.h-13}" text-anchor="middle" dominant-baseline="central" fill="${visuals.sub}">${esc(n.sub)}</text>`);
    lines.push('</g>');
  });
  lines.push('</svg>');
  return{svgStr:lines.join('\n'),W,H};
}

function doExport(fmt){
  if(!S.nodes.length){uiAlert('There is nothing to export yet. Add at least one node first.','Export');return;}
  const {svgStr,W,H}=buildExportSVG();
  const fileStem=projectFileStem();
  if(fmt==='svg'){
    const blob=new Blob([svgStr],{type:'image/svg+xml'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`${fileStem}.svg`;a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const scale=2;
  const img=new Image();
  const blob=new Blob([svgStr],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
  img.onload=()=>{
    const canvas=document.createElement('canvas');
    canvas.width=W*scale;canvas.height=H*scale;
    const ctx=canvas.getContext('2d');
    // JPG has no alpha — fill background. SVG & PNG stay transparent.
    if(fmt==='jpg'){
      const isDark=document.body.classList.contains('dark');
      ctx.fillStyle=isDark?'#1b1b19':'#ffffff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    ctx.scale(scale,scale);
    ctx.drawImage(img,0,0);
    URL.revokeObjectURL(url);
    const mime=fmt==='jpg'?'image/jpeg':'image/png';
    const q=fmt==='jpg'?0.93:1;
    canvas.toBlob(b=>{
      if(!b){
        uiAlert(`The ${fmt.toUpperCase()} export failed while creating the image blob.`,'Export failed');
        return;
      }
      const u=URL.createObjectURL(b);
      const a=document.createElement('a');a.href=u;a.download=`${fileStem}.${fmt}`;a.click();
      URL.revokeObjectURL(u);
    },mime,q);
  };
  img.onerror=()=>{
    URL.revokeObjectURL(url);
    uiAlert(`The ${fmt.toUpperCase()} export could not be rendered from the generated SVG.`,'Export failed');
  };
  img.src=url;
}

const expModal=document.getElementById('exp-modal');
const expCloseBtn=document.getElementById('exp-close');
function closeExportModal(){
  expModal.classList.remove('open');
  expModal.setAttribute('aria-hidden','true');
}
function openExportModal(){
  if(!S.nodes.length){uiAlert('There is nothing to export yet. Add at least one node first.','Export');return;}
  expModal.classList.add('open');
  expModal.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>{
    expModal.querySelector('[data-fmt="svg"]')?.focus();
  });
}
document.getElementById('bexp').addEventListener('click',openExportModal);
document.getElementById('exp-cancel').addEventListener('click',closeExportModal);
expCloseBtn.addEventListener('click',closeExportModal);
document.querySelectorAll('[data-fmt]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    closeExportModal();
    doExport(btn.dataset.fmt);
  });
});
expModal.addEventListener('click',e=>{
  if(e.target===e.currentTarget)closeExportModal();
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&expModal.classList.contains('open')){
    e.preventDefault();
    closeExportModal();
  }
});

window.AF={zoom:doZoom,fitAll};

buildSidebar();
syncProjectTitle();
const projectTitleInput=document.getElementById('project-title');
projectTitleInput?.addEventListener('input',e=>{
  S.title=normalizeProjectTitle(e.target.value,'');
  syncProjectTitle(false);
});
projectTitleInput?.addEventListener('keydown',e=>{
  if(e.key==='Enter')e.currentTarget.blur();
});
projectTitleInput?.addEventListener('blur',e=>{
  const nextTitle=normalizeProjectTitle(e.target.value,DEFAULT_PROJECT_TITLE);
  if(nextTitle!==S.title){
    S.title=nextTitle;
    syncProjectTitle();
    commit();
    return;
  }
  syncProjectTitle();
});
commit();
draw();
props();

// Empty-state shortcut → triggers the toolbar example loader
document.getElementById('empty-example-btn')?.addEventListener('click',()=>{
  document.getElementById('bex').click();
});

// Auto-fade hint bar after 9 seconds on initial empty canvas
setTimeout(()=>{
  const h=document.getElementById('hint');
  if(h&&!S.nodes.length)h.style.opacity='0';
},9000);

})();
