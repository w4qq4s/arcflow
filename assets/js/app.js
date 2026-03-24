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
const BROWSER_STORE_KEY='arcflow.browserProjects.v1';
const MAX_BROWSER_PROJECTS=10;
const AUTOSAVE_DELAY=900;
const READ_ONLY_QUERY_VALUE=new URLSearchParams(window.location.search).get('readonly');
const _SHARE_URL_PARAM=new URLSearchParams(window.location.search).get('share');
const PHONE_BLOCK_MAX_SHORT_SIDE=520;
const PHONE_BLOCK_MAX_LONG_SIDE=980;
const PHONE_UA_RE=/(Android.+Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini|webOS|BlackBerry|Mobile\b)/i;

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
  readOnly:READ_ONLY_QUERY_VALUE==='1'||READ_ONLY_QUERY_VALUE==='true',
  sel:null,selT:null,
  multi:[],
  multiEdges:[],
  guides:[],
  drag:null,
  conn:null,
  wpDrag:null,
  eDrag:null,
  labelDrag:null,
  rubber:null,
  snap:true,
  alignOpen:false,
  mmVisible:true,
  clipboard:null,
  activeProjectId:null,
  savedKey:null,
  pan:{x:80,y:60},zoom:1,
  hist:[],hidx:-1,nid:1
};
let autosaveTimer=null;

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function normalizeProjectTitle(v,fallback=''){
  if(typeof v!=='string')return fallback;
  const s=v.replace(/\s+/g,' ').trim().slice(0,120);
  return s||fallback;
}
function isProbablyPhoneClient(){
  const ua=navigator.userAgent||'';
  const uaDataMobile=typeof navigator.userAgentData?.mobile==='boolean' ? navigator.userAgentData.mobile : false;
  const mobileUa=PHONE_UA_RE.test(ua);
  const coarse=window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const shortSide=Math.min(window.innerWidth||screen.width||0,window.innerHeight||screen.height||0);
  const longSide=Math.max(window.innerWidth||screen.width||0,window.innerHeight||screen.height||0);
  return !!(uaDataMobile || mobileUa || (coarse && shortSide<=PHONE_BLOCK_MAX_SHORT_SIDE && longSide<=PHONE_BLOCK_MAX_LONG_SIDE));
}
function syncPhoneGuard(){
  const blocked=isProbablyPhoneClient();
  document.body.classList.toggle('phone-blocked',blocked);
  const guard=document.getElementById('phone-guard');
  const meta=document.getElementById('phone-guard-meta');
  const app=document.getElementById('app');
  if(guard){
    guard.hidden=!blocked;
    guard.setAttribute('aria-hidden',blocked?'false':'true');
  }
  if(app)app.setAttribute('aria-hidden',blocked?'true':'false');
  if(meta){
    const size=`${Math.round(window.innerWidth||0)} × ${Math.round(window.innerHeight||0)}`;
    meta.textContent=blocked
      ? `Detected a phone-sized mobile device (${size}). Please switch to a desktop or laptop browser.`
      : '';
  }
  if(!blocked)return;
  document.getElementById('load-modal')?.classList.remove('open');
  document.getElementById('exp-modal')?.classList.remove('open');
  document.getElementById('ui-modal')?.classList.remove('open');
  document.getElementById('share-modal')?.classList.remove('open');
  document.getElementById('load-modal')?.setAttribute('aria-hidden','true');
  document.getElementById('exp-modal')?.setAttribute('aria-hidden','true');
  document.getElementById('ui-modal')?.setAttribute('aria-hidden','true');
  document.getElementById('share-modal')?.setAttribute('aria-hidden','true');
  document.activeElement?.blur?.();
}
function isReadOnly(){
  return !!S.readOnly;
}
function syncReadOnlyUrl(){
  const url=new URL(window.location.href);
  if(S.readOnly)url.searchParams.set('readonly','1');
  else url.searchParams.delete('readonly');
  history.replaceState(null,'',url.toString());
}
function syncReadOnlyUi(){
  const appEl=document.getElementById('app');
  appEl?.classList.toggle('is-readonly',S.readOnly);
  document.body.classList.toggle('read-only-mode',S.readOnly);
  const toggle=document.getElementById('breadonly');
  if(toggle){
    toggle.textContent=S.readOnly?'Read only on':'Read only off';
    toggle.classList.toggle('on',S.readOnly);
    toggle.setAttribute('aria-pressed',S.readOnly?'true':'false');
  }
  const titleInput=document.getElementById('project-title');
  if(titleInput)titleInput.readOnly=S.readOnly;
  document.querySelectorAll('#sb .nc').forEach(el=>{
    if(el.classList.contains('nc-cust'))return;
    el.draggable=!S.readOnly;
  });
  document.getElementById('bundo')?.toggleAttribute('disabled',S.readOnly);
  document.getElementById('bredo')?.toggleAttribute('disabled',S.readOnly);
  document.getElementById('blay')?.toggleAttribute('disabled',S.readOnly);
  document.getElementById('balign')?.toggleAttribute('disabled',S.readOnly);
  document.getElementById('bclear')?.toggleAttribute('disabled',S.readOnly);
  document.getElementById('snap-toggle')?.toggleAttribute('disabled',S.readOnly);
  document.querySelectorAll('[data-align]').forEach(btn=>btn.toggleAttribute('disabled',S.readOnly));
  document.getElementById('load-new')?.toggleAttribute('disabled',S.readOnly);
  if(document.getElementById('load-modal')?.classList.contains('open'))renderLoadProjects();
}
function showReadOnlyToast(action='make changes'){
  showToast(`Read-only mode is on. Turn it off to ${action}.`,'info');
}
function blockIfReadOnly(action='make changes'){
  if(!S.readOnly)return false;
  showReadOnlyToast(action);
  return true;
}
function setReadOnly(next,{syncUrl=true,toast=false}={}){
  const value=!!next;
  if(S.readOnly===value){
    syncReadOnlyUi();
    return;
  }
  S.readOnly=value;
  if(S.readOnly){
    S.alignOpen=false;
    S.drag=null;
    S.wpDrag=null;
    S.eDrag=null;
    S.labelDrag=null;
    S.rubber=null;
    S.guides=[];
    cancelConn?.();
    mst=null;
    dragMoved=false;
  }
  if(syncUrl)syncReadOnlyUrl();
  syncReadOnlyUi();
  draw();
  props();
  if(toast)showToast(S.readOnly?'Read-only mode enabled.':'Read-only mode disabled.',S.readOnly?'info':'success');
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
function normalizeLabelOffset(v){
  if(!v||typeof v!=='object')return null;
  const dx=Number.isFinite(+v.dx)?+v.dx:0;
  const dy=Number.isFinite(+v.dy)?+v.dy:0;
  if(Math.abs(dx)<0.001&&Math.abs(dy)<0.001)return null;
  return{dx,dy};
}

function deepcl(o){return JSON.parse(JSON.stringify(o));}
function snapshotState(){return{nodes:S.nodes,edges:S.edges,title:S.title,nid:S.nid};}
function snapshotKey(){return JSON.stringify(snapshotState());}
function markSavedState(){S.savedKey=snapshotKey();}
function hasUnsavedChanges(){return snapshotKey()!==S.savedKey;}
function commit({autosave=true}={}){
  S.hist.splice(S.hidx+1);
  S.hist.push(deepcl(snapshotState()));
  if(S.hist.length>120)S.hist.shift();
  S.hidx=S.hist.length-1;
  if(autosave)scheduleAutosave();
}
function undo(){
  if(S.hidx<=0)return;S.hidx--;
  const s=S.hist[S.hidx];S.nodes=deepcl(s.nodes);S.edges=deepcl(s.edges);S.title=normalizeProjectTitle(s.title,DEFAULT_PROJECT_TITLE);S.nid=Number.isFinite(+s.nid)?+s.nid:S.nid;syncProjectTitle();
  S.sel=null;S.selT=null;S.multi=[];S.multiEdges=[];draw();props();
  scheduleAutosave();
}
function redo(){
  if(S.hidx>=S.hist.length-1)return;S.hidx++;
  const s=S.hist[S.hidx];S.nodes=deepcl(s.nodes);S.edges=deepcl(s.edges);S.title=normalizeProjectTitle(s.title,DEFAULT_PROJECT_TITLE);S.nid=Number.isFinite(+s.nid)?+s.nid:S.nid;syncProjectTitle();
  S.sel=null;S.selT=null;S.multi=[];S.multiEdges=[];draw();props();
  scheduleAutosave();
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
    locked:n.locked===true,
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
    labelOffset:normalizeLabelOffset(e.labelOffset),
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

function blankProjectState(title=DEFAULT_PROJECT_TITLE){
  return{
    title:normalizeProjectTitle(title,DEFAULT_PROJECT_TITLE),
    nodes:[],
    edges:[],
    nid:1
  };
}
function resetHistory(){
  S.hist=[];
  S.hidx=-1;
}
function hasProjectContent(state=snapshotState()){
  return state.nodes.length>0 ||
    state.edges.length>0 ||
    normalizeProjectTitle(state.title,DEFAULT_PROJECT_TITLE)!==DEFAULT_PROJECT_TITLE;
}
function generateProjectId(){
  return`p${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
}
function sanitizeBrowserProject(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const id=typeof raw.id==='string'&&raw.id.trim()?raw.id.trim():null;
  if(!id)return null;
  let clean;
  try{clean=sanitizeLoad(raw);}catch{return null;}
  const updatedAt=Number.isFinite(+raw.updatedAt)?+raw.updatedAt:Date.now();
  return{
    id,
    updatedAt,
    title:clean.title||DEFAULT_PROJECT_TITLE,
    nodes:clean.nodes,
    edges:clean.edges,
    nid:clean.nid
  };
}
function readBrowserStore(){
  try{
    const raw=localStorage.getItem(BROWSER_STORE_KEY);
    if(!raw)return{activeProjectId:null,projects:[]};
    const parsed=JSON.parse(raw);
    const projects=(Array.isArray(parsed.projects)?parsed.projects:[])
      .map(sanitizeBrowserProject)
      .filter(Boolean)
      .sort((a,b)=>b.updatedAt-a.updatedAt)
      .slice(0,MAX_BROWSER_PROJECTS);
    const activeProjectId=
      typeof parsed.activeProjectId==='string'&&projects.some(p=>p.id===parsed.activeProjectId)
        ? parsed.activeProjectId
        : (projects[0]?.id||null);
    return{activeProjectId,projects};
  }catch{
    return{activeProjectId:null,projects:[]};
  }
}
function writeBrowserStore(store){
  try{
    localStorage.setItem(BROWSER_STORE_KEY,JSON.stringify({
      version:1,
      activeProjectId:store.activeProjectId||null,
      projects:(store.projects||[]).slice(0,MAX_BROWSER_PROJECTS)
    }));
    return true;
  }catch{
    showToast('Browser storage is unavailable. Recent projects could not be updated.','error');
    return false;
  }
}
function currentProjectRecord(projectId=S.activeProjectId){
  return{
    id:projectId||generateProjectId(),
    updatedAt:Date.now(),
    ...deepcl(snapshotState())
  };
}
function shouldPersistCurrentProject(){
  return !!S.activeProjectId || hasProjectContent();
}
function persistActiveProjectNow({createIfMissing=false}={}){
  if(!S.activeProjectId&&!createIfMissing)return false;
  if(!S.activeProjectId)S.activeProjectId=generateProjectId();
  const record=currentProjectRecord(S.activeProjectId);
  const store=readBrowserStore();
  store.projects=[record,...store.projects.filter(p=>p.id!==record.id)]
    .sort((a,b)=>b.updatedAt-a.updatedAt)
    .slice(0,MAX_BROWSER_PROJECTS);
  store.activeProjectId=record.id;
  if(!writeBrowserStore(store))return false;
  markSavedState();
  if(document.getElementById('load-modal')?.classList.contains('open'))renderLoadProjects();
  return true;
}
function scheduleAutosave(){
  if(!shouldPersistCurrentProject())return;
  cancelAutosave();
  autosaveTimer=setTimeout(()=>{
    autosaveTimer=null;
    if(!shouldPersistCurrentProject())return;
    persistActiveProjectNow({createIfMissing:true});
  },AUTOSAVE_DELAY);
}
function cancelAutosave(){
  if(!autosaveTimer)return;
  clearTimeout(autosaveTimer);
  autosaveTimer=null;
}
function formatProjectTime(ts){
  const diff=Math.max(0,Date.now()-ts);
  if(diff<60_000)return'Just now';
  if(diff<3_600_000)return`${Math.round(diff/60_000)} min ago`;
  if(diff<86_400_000)return`${Math.round(diff/3_600_000)} hr ago`;
  if(diff<604_800_000)return`${Math.round(diff/86_400_000)} day ago`;
  return new Date(ts).toLocaleDateString();
}
function applyProjectState(state,{projectId=null,fit=true,markClean=false}={}){
  cancelAutosave();
  S.title=normalizeProjectTitle(state.title,DEFAULT_PROJECT_TITLE);
  syncProjectTitle();
  S.nodes=deepcl(Array.isArray(state.nodes)?state.nodes:[]);
  S.edges=deepcl(Array.isArray(state.edges)?state.edges:[]);
  S.nid=Number.isFinite(+state.nid)&&+state.nid>0?+state.nid:1;
  S.activeProjectId=projectId;
  S.sel=null;S.selT=null;S.multi=[];S.multiEdges=[];S.guides=[];
  S.drag=null;S.conn=null;S.wpDrag=null;S.eDrag=null;S.labelDrag=null;S.rubber=null;
  resetHistory();
  if(fit)fitAll();else draw();
  commit({autosave:false});
  if(markClean)markSavedState();
  document.getElementById('hint').style.opacity=S.nodes.length?'0':'1';
  draw();
  props();
}
function activeProjectCountText(count){
  return count===1?'1 project':`${count} projects`;
}
function activeProjectMeta(project){
  return`${project.nodes.length} nodes · ${project.edges.length} edges`;
}
async function confirmCanvasReplacement(title='Replace current project',message='Replace the current canvas with another project? Unsaved in-memory edits newer than the last browser autosave will be lost.'){
  if(!hasUnsavedChanges())return true;
  return uiConfirm(message,title,'Replace','Cancel');
}
function renderLoadProjects(){
  const store=readBrowserStore();
  const list=document.getElementById('load-list');
  const count=document.getElementById('load-count');
  if(!list||!count)return;
  count.textContent=activeProjectCountText(store.projects.length);
  if(!store.projects.length){
    list.innerHTML=`<div class="load-empty">
      <div class="load-empty-title">No browser projects yet</div>
      <div class="load-empty-sub">Start editing or import a JSON file and ArcFlow will autosave it here.</div>
    </div>`;
    return;
  }
  list.innerHTML=store.projects.map(project=>`
    <article class="load-item${project.id===S.activeProjectId?' is-active':''}" data-load-id="${escAttr(project.id)}">
      <div class="load-item-main">
        <div class="load-item-top">
          <strong class="load-item-title">${esc(normalizeProjectTitle(project.title,DEFAULT_PROJECT_TITLE))}</strong>
          ${project.id===S.activeProjectId?'<span class="load-item-badge">Current</span>':''}
        </div>
        <div class="load-item-meta">${esc(activeProjectMeta(project))}</div>
        <div class="load-item-time">${esc(formatProjectTime(project.updatedAt))}</div>
      </div>
      <div class="load-item-actions">
        <button class="load-btn" type="button" data-load-open="${escAttr(project.id)}">${project.id===S.activeProjectId?'Open':'Open'}</button>
        <button class="load-icon-btn" type="button" data-load-del="${escAttr(project.id)}" aria-label="Delete project"${S.readOnly?' disabled':''}>✕</button>
      </div>
    </article>
  `).join('');
  list.querySelectorAll('[data-load-open]').forEach(btn=>btn.addEventListener('click',async()=>{
    const storeNow=readBrowserStore();
    const project=storeNow.projects.find(p=>p.id===btn.dataset.loadOpen);
    if(!project)return;
    if(project.id!==S.activeProjectId){
      const ok=await confirmCanvasReplacement('Open browser project','Open this browser project and replace the current canvas? Unsaved in-memory edits newer than the last autosave will be lost.');
      if(!ok)return;
    }
    applyProjectState(project,{projectId:project.id,fit:true,markClean:true});
    const nextStore=readBrowserStore();
    nextStore.activeProjectId=project.id;
    writeBrowserStore(nextStore);
    closeLoadModal();
  }));
  list.querySelectorAll('[data-load-del]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(blockIfReadOnly('delete browser projects'))return;
    const projectId=btn.dataset.loadDel;
    const storeNow=readBrowserStore();
    const project=storeNow.projects.find(p=>p.id===projectId);
    if(!project)return;
    if(projectId===S.activeProjectId&&hasUnsavedChanges()){
      const ok=await uiConfirm('Delete the current browser project? Unsaved in-memory edits newer than the last autosave will also be discarded.','Delete project','Delete','Cancel');
      if(!ok)return;
    }else{
      const ok=await uiConfirm(`Delete "${normalizeProjectTitle(project.title,DEFAULT_PROJECT_TITLE)}" from browser storage?`,'Delete project','Delete','Cancel');
      if(!ok)return;
    }
    const nextStore=readBrowserStore();
    nextStore.projects=nextStore.projects.filter(p=>p.id!==projectId);
    if(projectId===S.activeProjectId){
      const replacement=nextStore.projects[0]||null;
      nextStore.activeProjectId=replacement?.id||null;
      writeBrowserStore(nextStore);
      if(replacement){
        applyProjectState(replacement,{projectId:replacement.id,fit:true,markClean:true});
      }else{
        applyProjectState(blankProjectState(),{projectId:null,fit:true,markClean:true});
      }
    }else{
      writeBrowserStore(nextStore);
    }
    renderLoadProjects();
    showToast('Browser project deleted.','info');
  }));
}
const loadModal=document.getElementById('load-modal');
function closeLoadModal(){
  loadModal?.classList.remove('open');
  loadModal?.setAttribute('aria-hidden','true');
}
function isAppDialogOpen(){
  return ['ui-modal','load-modal','exp-modal','share-modal'].some(id=>{
    const el=document.getElementById(id);
    return !!el&&el.classList.contains('open');
  });
}
function openLoadModal(){
  if(isAppDialogOpen())return;
  renderLoadProjects();
  loadModal?.classList.add('open');
  loadModal?.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>{
    const focusTarget=(S.readOnly?document.getElementById('load-import'):document.getElementById('load-new'))||document.querySelector('[data-load-open]')||document.getElementById('load-close');
    focusTarget?.focus();
  });
}
async function createBlankBrowserProject(){
  if(blockIfReadOnly('create browser projects'))return;
  const ok=await confirmCanvasReplacement('New blank project','Create a new blank browser project and replace the current canvas? Unsaved in-memory edits newer than the last autosave will be lost.');
  if(!ok)return;
  const projectId=generateProjectId();
  applyProjectState(blankProjectState(),{projectId,fit:true,markClean:false});
  persistActiveProjectNow({createIfMissing:true});
  closeLoadModal();
  showToast('New browser project created.','success');
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
function selectedNodeIds(){
  return S.multi.length?S.multi:(S.sel&&S.selT==='node'?[S.sel]:[]);
}
function isNodeLocked(nodeOrId){
  const node=typeof nodeOrId==='string'?byId(nodeOrId):nodeOrId;
  return !!node?.locked;
}
function getSelectedNodeBuckets(){
  const unlocked=[];
  const locked=[];
  selectedNodeIds().forEach(id=>{
    const node=byId(id);
    if(!node)return;
    (node.locked?locked:unlocked).push(node);
  });
  return{unlocked,locked};
}
function showLockedSelectionToast(action){
  showToast(`Locked items cannot be ${action}. Unlock them first.`,'info');
}
function getEdgeEndpointNode(edge,kind){
  if(!edge)return null;
  return byId(kind==='from'?edge.from:edge.to);
}
function isEdgeEndpointLocked(edge,kind){
  return isNodeLocked(getEdgeEndpointNode(edge,kind));
}
function nodeTouchesLockedNeighbor(nodeId,removingIds=new Set()){
  return S.edges.some(edge=>{
    if(edge.from!==nodeId&&edge.to!==nodeId)return false;
    const otherId=edge.from===nodeId?edge.to:edge.from;
    return !removingIds.has(otherId)&&isNodeLocked(otherId);
  });
}
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
function edgeLabelPoint(edge,points){
  const mid=edgeCenterPoint(points);
  if(!mid)return null;
  const offset=normalizeLabelOffset(edge.labelOffset)||{dx:0,dy:0};
  return{x:mid.x+offset.dx,y:mid.y+offset.dy};
}
function pointInRect(point,rect){
  return point.x>=rect.left&&point.x<=rect.right&&point.y>=rect.top&&point.y<=rect.bottom;
}
function rectsOverlap(a,b){
  return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
}
function cross(a,b,c){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
function onSegment(a,b,p){
  return Math.abs(cross(a,b,p))<0.0001 &&
    p.x>=Math.min(a.x,b.x)-0.0001&&p.x<=Math.max(a.x,b.x)+0.0001&&
    p.y>=Math.min(a.y,b.y)-0.0001&&p.y<=Math.max(a.y,b.y)+0.0001;
}
function segmentsIntersect(a,b,c,d){
  const o1=cross(a,b,c),o2=cross(a,b,d),o3=cross(c,d,a),o4=cross(c,d,b);
  if((o1>0)!==(o2>0)&&(o3>0)!==(o4>0))return true;
  if(onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b))return true;
  return false;
}
function segmentIntersectsRect(a,b,rect){
  if(pointInRect(a,rect)||pointInRect(b,rect))return true;
  const corners=[
    {x:rect.left,y:rect.top},
    {x:rect.right,y:rect.top},
    {x:rect.right,y:rect.bottom},
    {x:rect.left,y:rect.bottom},
  ];
  for(let i=0;i<corners.length;i++){
    const c=corners[i],d=corners[(i+1)%corners.length];
    if(segmentsIntersect(a,b,c,d))return true;
  }
  return false;
}
function edgeLabelRect(edge,points){
  if(!edge.label)return null;
  const labelPoint=edgeLabelPoint(edge,points);
  if(!labelPoint)return null;
  const width=Math.max(edge.label.length*7.2+20,38);
  return{
    left:labelPoint.x-width/2,
    top:labelPoint.y-10,
    right:labelPoint.x+width/2,
    bottom:labelPoint.y+10,
  };
}
function edgeIntersectsSelectionRect(edge,rect){
  const fn=byId(edge.from),tn=byId(edge.to);
  if(!fn||!tn)return false;
  const fp=ports(fn)[edge.fp],tp=ports(tn)[edge.tp];
  if(!fp||!tp)return false;
  const points=edgePolylinePoints(fp,tp,edge.wps||[],edge.fp,edge.tp);
  for(let i=0;i<points.length-1;i++){
    if(segmentIntersectsRect(points[i],points[i+1],rect))return true;
  }
  const labelRect=edgeLabelRect(edge,points);
  return !!(labelRect&&rectsOverlap(rect,labelRect));
}
function mkPath(fp,tp,wps,fpSide,tpSide){
  return'M'+edgePolylinePoints(fp,tp,wps,fpSide,tpSide).map(p=>`${Math.round(p.x)} ${Math.round(p.y)}`).join('L');
}
function renderLockBadge(x,y,stroke){
  const fill=rgba(stroke,0.14);
  return`<g class="lock-badge" transform="translate(${x} ${y})" pointer-events="none">
<rect x="0" y="0" width="16" height="16" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
<path d="M5.2 7V5.8a2.8 2.8 0 0 1 5.6 0V7M4.8 7.2h6.4v4.6H4.8z" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;
}

function toSVG(cx,cy){
  const pt=document.getElementById('csvg').createSVGPoint();
  pt.x=cx;pt.y=cy;
  return pt.matrixTransform(document.getElementById('vp').getScreenCTM().inverse());
}

function updateAlignBar(){
  const appEl=document.getElementById('app');
  const button=document.getElementById('balign');
  appEl.classList.toggle('has-multi',S.multi.length>=2);
  appEl.classList.toggle('align-open',!!S.alignOpen);
  button?.classList.toggle('on',!!S.alignOpen);
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
    h+=`<g class="cont-g${sel?' sel':''}${n.locked?' locked':''}" data-nid="${escAttr(n.id)}" data-cont="1">
<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${SECTION_RX}" fill="${visuals.fill}" stroke="${visuals.stroke}" stroke-width="${sel?2:1}" stroke-dasharray="7 4"/>
<text class="nt" x="${n.x+14}" y="${n.y+17}" font-size="12" font-weight="500" font-family="${FF}" text-anchor="start" dominant-baseline="central" fill="${visuals.title}">${esc(n.title)}</text>
${n.sub?`<text class="ns" x="${n.x+14}" y="${n.y+32}" font-size="10" font-family="${FF}" text-anchor="start" dominant-baseline="central" fill="${visuals.sub}">${esc(n.sub)}</text>`:''}
${(n.locked||S.readOnly)?'':`<rect class="rz-h" x="${rx-22}" y="${ry-22}" width="22" height="22" rx="${TEXT_NODE_RX}" data-rzid="${escAttr(n.id)}" pointer-events="all"/>`}
<path d="${lpath}" fill="none" stroke="${mixHex(visuals.stroke,themeColors().bg2,0.35)}" stroke-width="${lthk}" stroke-linecap="round" pointer-events="none" opacity=".82"/>
${n.locked?renderLockBadge(n.x+n.w-26,n.y+10,visuals.stroke):''}
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
    const sel=(S.sel===e.id&&S.selT==='edge')||S.multiEdges.includes(e.id);
    h+=`<path class="ep${e.dash?' dash':''}${sel?' sel':''}" d="${d}" marker-end="url(#arr)" data-eid="${escAttr(e.id)}" stroke="${visuals.stroke}" stroke-width="${sel?3:1.5}"/>`;

    if(e.label){
      const labelPoint=edgeLabelPoint(e,pts);
      if(!labelPoint)return;
      const mx=labelPoint.x,my=labelPoint.y;
      const tw=Math.max(e.label.length*7.2+20,38);
      h+=`<rect class="elabel-hit${sel?' sel':''}" x="${mx-tw/2}" y="${my-10}" width="${tw}" height="20" rx="10" data-elblid="${escAttr(e.id)}" pointer-events="all"/>`;
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
    const btns=(isText||n.locked||S.readOnly)?'':([
      {x:cx,y:n.y,port:'top',bx:cx-r,by:n.y-r*2,bw:r*2,bh:r*2},
      {x:cx,y:n.y+n.h,port:'bottom',bx:cx-r,by:n.y+n.h,bw:r*2,bh:r*2},
      {x:n.x,y:cy,port:'left',bx:n.x-r*2,by:cy-r,bw:r*2,bh:r*2},
      {x:n.x+n.w,y:cy,port:'right',bx:n.x+n.w,by:cy-r,bw:r*2,bh:r*2},
    ].map(b=>`<g class="pb" data-port="${escAttr(b.port)}" data-nid="${escAttr(n.id)}">
<rect class="pb-bridge" x="${b.bx}" y="${b.by}" width="${b.bw}" height="${b.bh}"/>
<circle cx="${b.x}" cy="${b.y}" r="${r}"/>
<path d="M${b.x-4} ${b.y}h8M${b.x} ${b.y-4}v8" stroke="var(--acc)" stroke-width="1.8" stroke-linecap="round" fill="none" pointer-events="none"/>
</g>`).join(''));
    h+=`<g class="node-g${sel?' sel':''}${n.locked?' locked':''}" data-nid="${escAttr(n.id)}">
<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${isText?TEXT_NODE_RX:NODE_RX}" fill="${visuals.fill}" stroke="${visuals.stroke}"/>
<text class="nt" x="${cx}" y="${tY}" text-anchor="middle" dominant-baseline="central" font-size="${isText?14:13}" font-weight="${isText?400:600}" font-family="${FF}" fill="${visuals.title}">${esc(n.title||'Untitled')}</text>
${sub}${btns}${n.locked?renderLockBadge(n.x+n.w-24,n.y+8,visuals.stroke):''}</g>`;
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

  if(S.sel&&S.selT==='edge'&&!S.readOnly){
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
function renderPortButtons(kind,current,disabled=false){
  return PORT_ORDER.map(port=>`<button class="tbb tbb-half${current===port?' on':''}${disabled?' is-disabled':''}" type="button" data-${kind}port="${port}"${disabled?' disabled':''}>${PORT_LABELS[port]}</button>`).join('');
}
function nodeKindLabel(n){
  if(n.tp==='cont')return'Section';
  if(n.tp==='text')return'Text node';
  return'Node';
}
function renderFillOpacityControl(n){
  const pct=Math.round(nodeFillOpacity(n)*100);
  const accent=nodeAccent(n);
  const presets=[0,20,35,50,75];
  return`<div class="pr-fill-card" style="--fill-accent:${accent};--fill-percent:${pct}%">
    <div class="pr-fill-top">
      <span class="pr-fill-label">Section fill</span>
      <span class="pr-fill-pill" id="pfillv">${pct}%</span>
    </div>
    <input class="pr-range pr-range-rich" id="pfill" type="range" min="0" max="100" step="5" value="${pct}"/>
    <div class="pr-fill-presets">
      ${presets.map(value=>`<button class="pr-chip${pct===value?' on':''}" type="button" data-fillset="${value}">${value}%</button>`).join('')}
    </div>
  </div>`;
}
function props(){
  const prh=document.getElementById('prh');
  const prb=document.getElementById('prb');
  if(!S.sel){
    if(S.multi.length||S.multiEdges.length){
      const parts=[];
      if(S.multi.length)parts.push(`${S.multi.length} node${S.multi.length===1?'':'s'}`);
      if(S.multiEdges.length)parts.push(`${S.multiEdges.length} edge${S.multiEdges.length===1?'':'s'}`);
      prh.textContent='Selection';
      prb.innerHTML=`<div class="pempty">${parts.join(' · ')} selected<br>${S.multi.length>=2?'Use Align for node layout adjustments. ':'Use Delete to remove the current selection.'}</div>`;
      return;
    }
    prh.textContent='Properties';
    prb.innerHTML=`<div class="pempty">${S.readOnly?'Read-only mode is on<br>Select a node or edge to inspect it':'Select a node or edge<br>to edit its properties'}</div>`;
    return;
  }
  if(S.selT==='node'){
    const n=byId(S.sel);if(!n)return;
    const isCont=n.tp==='cont';
    const hasCustomColor=!!normalizeHexColor(n.customColor);
    prh.textContent=isCont?'Section properties':'Node properties';
    const outs=S.edges.filter(e=>e.from===n.id);
    const ins=S.edges.filter(e=>e.to===n.id);
    const connectionHtml=editable=>[
      ...outs.map(e=>{const t=byId(e.to);return t?`<div class="ci"><div class="cdot" style="background:${nodeAccent(t)}"></div><span class="clbl">→ ${esc(t.title)}</span>${editable?`<span class="cdel" data-deled="${escAttr(e.id)}">✕</span>`:''}</div>`:'';}),
      ...ins.map(e=>{const f=byId(e.from);return f?`<div class="ci"><div class="cdot" style="background:${nodeAccent(f)}"></div><span class="clbl">← ${esc(f.title)}</span>${editable?`<span class="cdel" data-deled="${escAttr(e.id)}">✕</span>`:''}</div>`:'';}),
    ].join('');
    if(S.readOnly){
      prh.textContent=isCont?'Section overview':'Node overview';
      prb.innerHTML=`<div class="prs">
<div class="pr-lock-card">
  <div class="pr-lock-kicker">${nodeKindLabel(n)}</div>
  <div class="pr-lock-title">${esc(n.title||'Untitled')}</div>
  <div class="pr-lock-copy">Read-only mode is on. You can inspect this ${isCont?'section':'node'}, but editing is disabled.</div>
  <div class="pr-lock-pill">Read only</div>
</div>
</div>
<div class="pdv"></div>
<div class="pstat"><span>Position</span><span>${Math.round(n.x)}, ${Math.round(n.y)}</span></div>
<div class="pstat"><span>Size</span><span>${Math.round(n.w)} × ${Math.round(n.h)}</span></div>
<div class="pstat"><span>Color</span><span>${esc(hasCustomColor?'Custom':(n.ramp==='text'?'Text':n.ramp))}</span></div>
${isCont?`<div class="pstat"><span>Fill opacity</span><span>${Math.round(nodeFillOpacity(n)*100)}%</span></div>`:`<div class="pstat"><span>Node type</span><span>${n.tp==='two'?'Two line':n.tp==='one'?'Single line':'Text'}</span></div>`}
${n.locked?`<div class="pstat"><span>Locked</span><span>Yes</span></div>`:''}
${!isCont?`<div class="pstat"><span>Connections</span><span>${outs.length+ins.length}</span></div>`:''}
${!isCont&&n.sub?`<div class="prs"><div class="prl">Subtitle</div><div class="pr-lock-note">${esc(n.sub)}</div></div>`:''}
${!isCont&&n.prompt?`<div class="prs"><div class="prl">Click prompt</div><div class="pr-lock-note">${esc(n.prompt)}</div></div>`:''}
${(outs.length||ins.length)?`<div class="prs" style="padding-bottom:2px"><div class="prl" style="margin-bottom:6px">Connections</div></div>${connectionHtml(false)}`:''}`;
      return;
    }
    if(n.locked){
      prb.innerHTML=`<div class="prs">
<div class="pr-lock-card">
  <div class="pr-lock-kicker">${nodeKindLabel(n)}</div>
  <div class="pr-lock-title">${esc(n.title||'Untitled')}</div>
  <div class="pr-lock-copy">This ${isCont?'section':'node'} is locked. Unlock it to edit its content, styling, layout, or connections.</div>
  <div class="pr-lock-pill">Locked</div>
</div>
</div>
<div class="pdv"></div>
<div class="pstat"><span>Position</span><span>${Math.round(n.x)}, ${Math.round(n.y)}</span></div>
<div class="pstat"><span>Size</span><span>${Math.round(n.w)} × ${Math.round(n.h)}</span></div>
${!isCont?`<div class="pstat"><span>Connections</span><span>${outs.length+ins.length}</span></div>`:''}
${!isCont&&n.prompt?`<div class="prs"><div class="prl">Click prompt</div><div class="pr-lock-note">${esc(n.prompt)}</div></div>`:''}
${(outs.length||ins.length)?`<div class="prs" style="padding-bottom:2px"><div class="prl" style="margin-bottom:6px">Connections</div></div>${connectionHtml(false)}`:''}
<button class="delbtn pr-secondary-btn" id="punlock">Unlock ${isCont?'section':'node'}</button>`;
      document.getElementById('punlock')?.addEventListener('pointerdown',()=>{
        n.locked=false;
        commit();
        draw();
        props();
        showToast(`${nodeKindLabel(n)} unlocked.`,'success');
      });
      return;
    }
    prb.innerHTML=`<div class="prs">
<div class="prl">Title</div>
<input class="pri" id="pt" value="${esc(n.title)}" placeholder="Label"/>
${!isCont?`<div class="prl">Subtitle</div><input class="pri" id="ps" value="${esc(n.sub||'')}" placeholder="Short description (two-line only)"/>
<div class="prl">Click prompt</div><textarea class="prta" id="pp" placeholder="Question shown when this node is clicked...">${esc(n.prompt||'')}</textarea>`:''}
<div class="prl">Color</div>
<div class="rg">${renderNodeColorGrid(n)}</div>
${hasCustomColor?`<input class="pri pr-color-input" id="ncustom" type="color" value="${normalizeHexColor(n.customColor)||nodeAccent(n)}"/>`:''}
${isCont?`<div class="prl">Fill opacity</div>
${renderFillOpacityControl(n)}
<div class="prl">Size</div>
<div class="pr-stack">
<input class="pri" id="pw" type="number" value="${Math.round(n.w)}" min="80" style="margin-bottom:0;text-align:center;" placeholder="W"/>
<input class="pri" id="ph2" type="number" value="${Math.round(n.h)}" min="50" style="margin-bottom:0;text-align:center;" placeholder="H"/>
</div>`:`<div class="prl">Node type</div>
<div class="tbg">
<button class="tbb${n.tp==='one'?' on':''}" type="button" data-ntp="one">Single line</button>
<button class="tbb${n.tp==='two'?' on':''}" type="button" data-ntp="two">Two line</button>
</div>`}
<div class="pr-aux-actions">
  <button class="tbb" type="button" id="plock">Lock ${isCont?'section':'node'}</button>
</div>
</div>
<div class="pdv"></div>
<div class="pstat"><span>Position</span><span>${Math.round(n.x)}, ${Math.round(n.y)}</span></div>
<div class="pstat"><span>Size</span><span>${Math.round(n.w)} × ${Math.round(n.h)}</span></div>
${!isCont?`<div class="pstat"><span>Connections</span><span>${outs.length+ins.length}</span></div>`:''}
${(outs.length||ins.length)?`<div class="prs" style="padding-bottom:2px"><div class="prl" style="margin-bottom:6px">Connections</div></div>${connectionHtml(true)}`:''}
<button class="delbtn" id="pdel">Delete ${isCont?'section':'node'}</button>`;

    const ti=document.getElementById('pt');
    const si=document.getElementById('ps');
    const pi=document.getElementById('pp');
    ti.addEventListener('input',e=>{n.title=e.target.value;if(!isCont)n.w=nW(n.title,n.sub);draw();scheduleAutosave();});
    ti.addEventListener('blur',commit);
    if(si){si.addEventListener('input',e=>{n.sub=e.target.value;n.w=nW(n.title,n.sub);draw();scheduleAutosave();});si.addEventListener('blur',commit);}
    if(pi){pi.addEventListener('input',e=>{n.prompt=e.target.value;scheduleAutosave();});pi.addEventListener('blur',commit);}
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
      commit();draw();props();
    });
    const fillR=document.getElementById('pfill');
    const fillV=document.getElementById('pfillv');
    if(fillR&&fillV){
      const fillCard=fillR.closest('.pr-fill-card');
      const syncFillUi=()=>{
        const pct=Math.round(nodeFillOpacity(n)*100);
        fillV.textContent=`${pct}%`;
        fillCard?.style.setProperty('--fill-percent',`${pct}%`);
        fillCard?.style.setProperty('--fill-accent',nodeAccent(n));
        document.querySelectorAll('[data-fillset]').forEach(btn=>btn.classList.toggle('on',+btn.dataset.fillset===pct));
      };
      fillR.addEventListener('input',e=>{
        n.fillOpacity=(+e.target.value||0)/100;
        syncFillUi();
        draw();
      });
      fillR.addEventListener('change',()=>{commit();props();});
      document.querySelectorAll('[data-fillset]').forEach(btn=>btn.addEventListener('pointerdown',()=>{
        n.fillOpacity=(+btn.dataset.fillset||0)/100;
        fillR.value=Math.round(n.fillOpacity*100);
        syncFillUi();
        commit();
        draw();
        props();
      }));
      syncFillUi();
    }
    document.querySelectorAll('[data-ntp]').forEach(el=>el.addEventListener('pointerdown',()=>{
      n.tp=el.dataset.ntp;
      n.h=nH(n.tp);
      n.w=nW(n.title,n.sub);
      commit();draw();props();
    }));
    document.querySelectorAll('[data-deled]').forEach(el=>el.addEventListener('pointerdown',ev=>{
      ev.stopPropagation();
      const edge=edById(el.dataset.deled);
      if(edge&&(isEdgeEndpointLocked(edge,'from')||isEdgeEndpointLocked(edge,'to'))){
        showToast('Edges connected to locked items cannot be removed here.','info');
        return;
      }
      S.edges=S.edges.filter(e=>e.id!==el.dataset.deled);
      commit();draw();props();
    }));
    document.getElementById('plock')?.addEventListener('pointerdown',()=>{
      n.locked=true;
      commit();
      draw();
      props();
      showToast(`${nodeKindLabel(n)} locked.`,'success');
    });
    document.getElementById('pdel')?.addEventListener('pointerdown',()=>{
      if(nodeTouchesLockedNeighbor(S.sel)){
        showToast('This item is connected to a locked node and cannot be deleted yet.','info');
        return;
      }
      S.nodes=S.nodes.filter(x=>x.id!==S.sel);S.edges=S.edges.filter(e=>e.from!==S.sel&&e.to!==S.sel);S.sel=null;S.selT=null;commit();draw();props();
    });
  }else if(S.selT==='edge'){
    const e=edById(S.sel);if(!e)return;
    const hasCustomColor=!!normalizeHexColor(e.customColor);
    const fromLocked=isEdgeEndpointLocked(e,'from');
    const toLocked=isEdgeEndpointLocked(e,'to');
    prh.textContent='Edge properties';
    const fn=byId(e.from),tn=byId(e.to);
    const wc=(e.wps||[]).length;
    if(S.readOnly){
      prh.textContent='Edge overview';
      prb.innerHTML=`<div class="prs">
<div class="pr-lock-card">
  <div class="pr-lock-kicker">Edge</div>
  <div class="pr-lock-title">${esc(e.label||`${fn?.title||'Unknown'} → ${tn?.title||'Unknown'}`)}</div>
  <div class="pr-lock-copy">Read-only mode is on. You can inspect this edge, but editing is disabled.</div>
  <div class="pr-lock-pill">Read only</div>
</div>
</div>
<div class="pdv"></div>
<div class="pstat"><span>From</span><span>${esc(fn?.title||'?')}</span></div>
<div class="pstat"><span>To</span><span>${esc(tn?.title||'?')}</span></div>
<div class="pstat"><span>Line style</span><span>${e.dash?'Dashed':'Solid'}</span></div>
<div class="pstat"><span>Color</span><span>${esc(hasCustomColor?'Custom':(e.col||'Default'))}</span></div>
<div class="pstat"><span>Bend points</span><span>${wc}</span></div>
${e.label?`<div class="prs"><div class="prl">Edge label</div><div class="pr-lock-note">${esc(e.label)}</div></div>`:''}
${fromLocked||toLocked?`<div class="tip">${fromLocked?'The source node is locked. ':''}${toLocked?'The target node is locked.':''}</div>`:''}`;
      return;
    }
    prb.innerHTML=`<div class="prs">
<div class="prl">Edge label</div>
<input class="pri" id="elbl" value="${esc(e.label||'')}" placeholder="e.g. triggers, blocks, 72%"/>
<div class="prl">Line style</div>
<div class="tbg">
<button class="tbb${!e.dash?' on':''}" type="button" data-estl="0">Solid</button>
<button class="tbb${e.dash?' on':''}" type="button" data-estl="1">Dashed</button>
</div>
<div class="prl">From side</div>
<div class="tbg tbg-wrap">${renderPortButtons('f',e.fp,fromLocked)}</div>
<div class="prl">To side</div>
<div class="tbg tbg-wrap">${renderPortButtons('t',e.tp,toLocked)}</div>
${fromLocked||toLocked?`<div class="tip">${fromLocked?'The source node is locked, so its connection side cannot be changed. ':''}${toLocked?'The target node is locked, so its connection side cannot be changed.':''}</div>`:''}
<div class="prl">Color</div>
<div class="tbg tbg-wrap">${renderEdgeColorButtons(e)}</div>
${hasCustomColor?`<input class="pri pr-color-input" id="ecustom" type="color" value="${normalizeHexColor(e.customColor)||edgeStrokeColor(e)}"/>`:''}
</div>
<div class="pdv"></div>
<div class="pstat"><span>From</span><span>${esc(fn?.title||'?')}</span></div>
<div class="pstat"><span>To</span><span>${esc(tn?.title||'?')}</span></div>
<div class="pstat"><span>Bend points</span><span>${wc}</span></div>
<div class="prs" style="padding-bottom:0">
  <div class="tbg tbg-wrap">
    <button class="tbb on" type="button" id="ereset">${wc>0?'Reset route':'Reroute'}</button>
    ${e.label?`<button class="tbb" type="button" id="elabelreset">Reset label position</button>`:''}
  </div>
</div>
${wc===0?`<div class="tip">Drag the line to bend it. Drag the blue handles to move bend points. Double-click a handle to delete it.</div>`:''}
<button class="delbtn" id="edel">Delete edge</button>`;

    const lblI=document.getElementById('elbl');
    lblI.addEventListener('input',ev=>{e.label=ev.target.value||null;draw();scheduleAutosave();});
    lblI.addEventListener('blur',commit);
    document.querySelectorAll('[data-estl]').forEach(el=>el.addEventListener('pointerdown',()=>{e.dash=el.dataset.estl==='1';commit();draw();props();}));
    document.querySelectorAll('[data-fport]').forEach(el=>el.addEventListener('pointerdown',()=>{
      if(fromLocked){
        showToast('The source node is locked, so its connection side cannot be changed.','info');
        return;
      }
      e.fp=el.dataset.fport;
      if(!e.wps?.length)e.wps=[];
      commit();draw();props();
    }));
    document.querySelectorAll('[data-tport]').forEach(el=>el.addEventListener('pointerdown',()=>{
      if(toLocked){
        showToast('The target node is locked, so its connection side cannot be changed.','info');
        return;
      }
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
      commit();draw();props();
    });
    document.getElementById('ereset')?.addEventListener('pointerdown',()=>{e.wps=[];commit();draw();props();});
    document.getElementById('elabelreset')?.addEventListener('pointerdown',()=>{e.labelOffset=null;commit();draw();props();});
    document.getElementById('edel')?.addEventListener('pointerdown',()=>{
      if(isEdgeEndpointLocked(e,'from')||isEdgeEndpointLocked(e,'to')){
        showToast('Edges connected to locked items cannot be deleted.','info');
        return;
      }
      S.edges=S.edges.filter(x=>x.id!==S.sel);S.sel=null;S.selT=null;commit();draw();props();
    });
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
      d.addEventListener('dragstart',e=>{
        if(blockIfReadOnly('add nodes from the sidebar')){
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('af-tmpl',JSON.stringify(tmpl));e.dataTransfer.effectAllowed='copy';
      });
      sb.appendChild(d);
    });
  });
  const div=document.createElement('div');div.className='sdiv';sb.appendChild(div);
  const cu=document.createElement('div');cu.className='nc nc-cust';
  cu.innerHTML=`<div><div class="nname">+ Custom node...</div></div>`;
  cu.addEventListener('click',async ()=>{
    if(blockIfReadOnly('create custom nodes'))return;
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
  if(isReadOnly())return;
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
    fillOpacity:isCont?DEFAULT_SECTION_OPACITY:1,
    locked:false
  });
  S.sel=id;S.selT='node';
  commit();draw();props();
  document.getElementById('hint').style.opacity='0';
}



function getUiEls(){
  return {
    modal: document.getElementById('ui-modal'),
    card: document.querySelector('#ui-modal .ui-modal-card'),
    title: document.getElementById('ui-modal-title'),
    msg: document.getElementById('ui-modal-message'),
    inputWrap: document.getElementById('ui-modal-input-wrap'),
    input: document.getElementById('ui-modal-input'),
    cancel: document.getElementById('ui-modal-cancel'),
    ok: document.getElementById('ui-modal-ok'),
    close: document.getElementById('ui-modal-close'),
  };
}
function showModalUI({title='Notice',message='',messageHtml='',mode='alert',okText='OK',cancelText='Cancel',value='',cardClass=''}={}){
  const ui=getUiEls();
  if(!ui.modal){
    if(mode==='confirm')return Promise.resolve(window.confirm(message));
    if(mode==='prompt')return Promise.resolve(window.prompt(message,value));
    window.alert(message);
    return Promise.resolve(true);
  }

  ui.title.textContent=title;
  ui.card.className='ui-modal-card';
  if(cardClass)ui.card.classList.add(...cardClass.split(/\s+/).filter(Boolean));
  if(messageHtml){
    ui.msg.innerHTML=messageHtml;
    ui.msg.classList.add('is-html');
  }else{
    ui.msg.textContent=message;
    ui.msg.classList.remove('is-html');
  }
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
      ui.card.className='ui-modal-card';
      ui.msg.classList.remove('is-html');
      ui.msg.textContent='';
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
function showToast(message,type='info',duration=2600){
  let wrap=document.getElementById('toast-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='toast-wrap';
    document.body.appendChild(wrap);
  }
  const toast=document.createElement('div');
  toast.className=`toast toast-${type}`;
  toast.textContent=message;
  wrap.appendChild(toast);
  requestAnimationFrame(()=>toast.classList.add('on'));
  window.setTimeout(()=>{
    toast.classList.remove('on');
    window.setTimeout(()=>toast.remove(),180);
  },duration);
}
const HELP_TEXT=[
  'Editing',
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
  'Escape  Cancel connection or clear selection',
  '',
  'Canvas',
  '',
  'Drag from a + handle to a target port  Connect nodes',
  'Click a target node  Fallback connection flow',
  'Drag to select nodes and edges  Box-select items',
  'Ctrl + drag or middle-mouse drag  Pan',
  'Ctrl + scroll or pinch  Zoom',
  'Snap on  Enable grid, alignment, and bend snapping',
  'Read only toggle  Inspect diagrams without editing',
  '?readonly=1  Start ArcFlow in read-only mode',
  '',
  'Align',
  '',
  'Left  Align left edges',
  'Center  Align vertical centers',
  'Right  Align right edges',
  'Top  Align top edges',
  'Middle  Align horizontal centers',
  'Bottom  Align bottom edges',
  'Distribute H  Evenly space nodes horizontally',
  'Distribute V  Evenly space nodes vertically',
  'Match width  Make selected nodes the same width',
  '',
  'Credits',
  '',
  'Built by Waqqas',
  'GitHub  https://github.com/w4qq4s',
  'LinkedIn  https://www.linkedin.com/in/waqqas-h-937a91382/',
  'License  MIT'
].join('\n');
const HELP_SECTIONS=[
  {
    title:'Editing',
    items:[
      {keys:['Ctrl / Cmd + /'],desc:'Open help'},
      {keys:['Ctrl / Cmd + A'],desc:'Select all nodes'},
      {keys:['Ctrl / Cmd + C'],desc:'Copy selection'},
      {keys:['Ctrl / Cmd + V'],desc:'Paste'},
      {keys:['Ctrl / Cmd + D'],desc:'Duplicate selection'},
      {keys:['Ctrl / Cmd + Z'],desc:'Undo'},
      {keys:['Ctrl / Cmd + Y','Ctrl / Cmd + Shift + Z'],desc:'Redo'},
      {keys:['Delete','Backspace'],desc:'Delete selection'},
      {keys:['Arrow keys'],desc:'Nudge selected nodes'},
      {keys:['Escape'],desc:'Cancel connection or clear selection'},
    ]
  },
  {
    title:'Canvas',
    items:[
      {keys:['Drag from + handle'],desc:'Drop on a target port to connect nodes'},
      {keys:['Click target node'],desc:'Fallback connection flow when connect mode is already active'},
      {keys:['Drag to select'],desc:'Box-select nodes and edges on the canvas'},
      {keys:['Ctrl + drag','Middle-mouse drag'],desc:'Pan the canvas'},
      {keys:['Ctrl + scroll','Pinch'],desc:'Zoom in or out'},
      {keys:['Snap on'],desc:'Enable grid, alignment, and bend snapping'},
      {keys:['Read only toggle'],desc:'Inspect diagrams without allowing edits'},
      {keys:['?readonly=1'],desc:'Launch ArcFlow directly in read-only mode from the URL'},
      {keys:['Align button'],desc:'Open the Align bar manually from the toolbar'},
    ]
  }
];
const ALIGN_HELP_ITEMS=[
  ['Left','Line up selected nodes by their left edges.'],
  ['Center','Align selected nodes to the same vertical center line.'],
  ['Right','Line up selected nodes by their right edges.'],
  ['Top','Line up selected nodes by their top edges.'],
  ['Middle','Align selected nodes to the same horizontal center line.'],
  ['Bottom','Line up selected nodes by their bottom edges.'],
  ['Distribute H','Spread three or more nodes evenly across the horizontal span.'],
  ['Distribute V','Spread three or more nodes evenly across the vertical span.'],
  ['Match width','Make all selected nodes use the same width as the first node.'],
];
function renderHelpKeys(keys){
  return `<div class="ui-help-keys">${keys.map(key=>`<span class="ui-help-key">${esc(key)}</span>`).join('')}</div>`;
}
function renderHelpSection(section){
  return `
    <section class="ui-help-section">
      <div class="ui-help-section-title">${esc(section.title)}</div>
      <div class="ui-help-list">
        ${section.items.map(item=>`
          <div class="ui-help-row">
            ${renderHelpKeys(item.keys)}
            <div class="ui-help-desc">${esc(item.desc)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}
function renderHelpHtml(){
  return `
    <div class="ui-help">
      <div class="ui-help-intro">Keyboard shortcuts, canvas controls, and layout tools for working faster inside ArcFlow.</div>
      <div class="ui-help-grid">
        ${HELP_SECTIONS.map(renderHelpSection).join('')}
      </div>
      <details class="ui-help-accordion">
        <summary>
          <span>Align tools</span>
          <span class="ui-help-accordion-hint">Expand</span>
        </summary>
        <div class="ui-help-align-list">
          ${ALIGN_HELP_ITEMS.map(([title,desc])=>`
            <div class="ui-help-align-item">
              <strong>${esc(title)}</strong>
              <span>${esc(desc)}</span>
            </div>
          `).join('')}
        </div>
      </details>
      <div class="ui-help-note">The Align bar opens automatically when two or more nodes are selected, and it can also be opened anytime from the toolbar.</div>
      <section class="ui-help-credits">
        <div class="ui-help-credits-title">Credits</div>
        <div class="ui-help-credits-copy">Built by Waqqas</div>
        <div class="ui-help-credit-links">
          <a class="ui-help-credit-link" href="https://github.com/w4qq4s/arcflow" target="_blank" rel="noreferrer">ArcFlow repository</a>
          <a class="ui-help-credit-link" href="https://github.com/w4qq4s" target="_blank" rel="noreferrer">GitHub</a>
          <a class="ui-help-credit-link" href="https://www.linkedin.com/in/waqqas-h-937a91382/" target="_blank" rel="noreferrer">LinkedIn</a>
          <span class="ui-help-credit-meta">MIT License</span>
        </div>
      </section>
    </div>
  `;
}
function showHelp(){
  if(isAppDialogOpen())return Promise.resolve(false);
  return showModalUI({
    title:'ArcFlow help',
    message:HELP_TEXT,
    messageHtml:renderHelpHtml(),
    mode:'alert',
    okText:'Close',
    cardClass:'help-modal'
  });
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
function clearConnHover(){
  document.querySelectorAll('.ct-hi').forEach(el=>el.classList.remove('ct-hi'));
  document.querySelectorAll('.ct-port').forEach(el=>el.classList.remove('ct-port'));
  if(S.conn){
    S.conn.hoverNodeId=null;
    S.conn.hoverPort=null;
  }
}
function setConnHover(nodeId=null,port=null){
  clearConnHover();
  if(!S.conn||!nodeId||nodeId===S.conn.fromId)return;
  const node=byId(nodeId);
  if(!node||node.locked)return;
  S.conn.hoverNodeId=nodeId;
  S.conn.hoverPort=port||null;
  const nodeEl=document.querySelector(`.node-g[data-nid="${CSS.escape(nodeId)}"]`);
  nodeEl?.classList.add('ct-hi');
  if(port){
    document.querySelector(`.pb[data-nid="${CSS.escape(nodeId)}"][data-port="${CSS.escape(port)}"]`)?.classList.add('ct-port');
  }
}
function createConnectionFromConn(targetId,targetPort=null){
  if(S.readOnly)return false;
  if(!S.conn||!targetId||targetId===S.conn.fromId)return false;
  const targetNode=byId(targetId);
  if(!targetNode)return false;
  if(targetNode.locked){
    showLockedSelectionToast('connected');
    return false;
  }
  const exists=S.edges.find(ed=>ed.from===S.conn.fromId&&ed.to===targetId);
  if(exists){
    showToast('These nodes are already connected.','info');
    return false;
  }
  const tp=targetPort||nearPort(S.conn.fromPos,targetNode);
  const eid='e'+(S.nid++);
  S.edges.push({id:eid,from:S.conn.fromId,fp:S.conn.fromPort,to:targetId,tp,dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null});
  S.sel=eid;S.selT='edge';
  commit();
  cancelConn();
  draw();
  props();
  showEdgeLabelInput(eid);
  return true;
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
  if(blockIfReadOnly('add nodes from the sidebar'))return;
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
    const n=byId(pb.dataset.nid);if(!n)return;
    if(S.readOnly){
      showReadOnlyToast('connect nodes');
      return;
    }
    if(S.conn){
      if(pb.dataset.nid===S.conn.fromId){
        cancelConn();
        return;
      }
      setConnHover(pb.dataset.nid,pb.dataset.port);
      return;
    }
    if(n.locked){
      showLockedSelectionToast('connected');
      return;
    }
    const fp=ports(n)[pb.dataset.port];
    S.conn={fromId:pb.dataset.nid,fromPort:pb.dataset.port,fromPos:{x:fp.x,y:fp.y},curPos:{x:fp.x,y:fp.y},hoverNodeId:null,hoverPort:null};
    csvg.classList.add('cmode');
    document.getElementById('connbanner').classList.add('on');
    mst='conn';return;
  }

  if(t.dataset.wpid&&t.dataset.wpdx!==undefined){
    e.stopPropagation();e.preventDefault();
    if(blockIfReadOnly('edit bend points'))return;
    S.wpDrag={eid:t.dataset.wpid,idx:+t.dataset.wpdx};
    mst='wpDrag';return;
  }

  if(t.dataset.wpadd&&t.dataset.wpi!==undefined){
    e.stopPropagation();e.preventDefault();
    if(blockIfReadOnly('reroute edges'))return;
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

  if(t.dataset.elblid){
    e.stopPropagation();e.preventDefault();
    const edge=edById(t.dataset.elblid);
    if(edge){
      const alreadySelected=S.sel===edge.id&&S.selT==='edge';
      S.multi=[];S.multiEdges=[];
      S.sel=edge.id;S.selT='edge';draw();props();
      if(!alreadySelected||S.readOnly)return;
      const pos=toSVG(e.clientX,e.clientY);
      const offset=normalizeLabelOffset(edge.labelOffset)||{dx:0,dy:0};
      S.labelDrag={eid:edge.id,startPos:{x:pos.x,y:pos.y},offset};
      mst='labelDrag';
    }
    return;
  }

  const edgeTarget=t.closest('.edge-hit,.ep');
  if(edgeTarget){
    const eid=edgeTarget.dataset.eid;const edge=edById(eid);
    if(edge){
      S.multi=[];S.multiEdges=[];
      S.sel=eid;S.selT='edge';draw();props();
      if(S.readOnly)return;
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
    if(S.readOnly){
      S.multi=[];S.multiEdges=[];
      S.sel=n.id;S.selT='node';draw();props();
      showReadOnlyToast('resize items');
      return;
    }
    if(n.locked){
      S.multi=[];S.multiEdges=[];
      S.sel=n.id;S.selT='node';draw();props();
      showLockedSelectionToast('resized');
      return;
    }
    const pos=toSVG(e.clientX,e.clientY);

    S.drag={id:n.id,resize:true,cx:pos.x,cy:pos.y,iw:n.w,ih:n.h};
    S.sel=n.id;S.selT='node';
    mst='drag';dragMoved=false;draw();props();return;
  }

  if(S.conn){
    const ng=t.closest('.node-g');
    if(ng&&ng.dataset.nid!==S.conn.fromId){
      createConnectionFromConn(ng.dataset.nid);
      return;
    }
    cancelConn();draw();props();return;
  }

  const ng=t.closest('.node-g,.cont-g');
  if(ng){
    const nid=ng.dataset.nid;
    const node=byId(nid);
    if(!node)return;

    if(S.multi.includes(nid)){
      if(S.readOnly)return;
      const pos=toSVG(e.clientX,e.clientY);
      const movable=S.multi.map(id=>byId(id)).filter(Boolean).filter(n=>!n.locked);
      if(movable.length){
        S.drag={multi:true,offsets:movable.map(n=>({id:n.id,ox:pos.x-n.x,oy:pos.y-n.y}))};
      }
    }else{
      S.multi=[];S.multiEdges=[];
      S.sel=nid;S.selT='node';draw();props();
      if(S.readOnly)return;
      if(node.locked)return;
      const pos=toSVG(e.clientX,e.clientY);
      S.drag={id:nid,ox:pos.x-node.x,oy:pos.y-node.y};
    }
    if(!S.drag)return;
    mst='drag';dragMoved=false;return;
  }

  if(e.button===0){

    S.sel=null;S.selT=null;
    const pos=toSVG(e.clientX,e.clientY);
    S.rubber={x0:pos.x,y0:pos.y,x1:pos.x,y1:pos.y};
    mst='rubber';
    if(S.multi.length||S.multiEdges.length){S.multi=[];S.multiEdges=[];draw();}else{draw();}
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
          S.drag.childOffsets=getContainerChildren(n.id).filter(c=>!c.locked).map(c=>({id:c.id,ox:c.x-n.x,oy:c.y-n.y}));
        }
        if(n.tp==='cont'&&S.drag.childOffsets){
          S.drag.childOffsets.forEach(({id,ox,oy})=>{const c=byId(id);if(c){c.x=nx+ox;c.y=ny+oy;}});
        }
        n.x=nx;n.y=ny;dragMoved=true;
      }
      draw();
    }
  }else if(mst==='labelDrag'&&S.labelDrag){
    const pos=toSVG(e.clientX,e.clientY);
    const edge=edById(S.labelDrag.eid);
    if(edge){
      edge.labelOffset=normalizeLabelOffset({
        dx:S.labelDrag.offset.dx+(pos.x-S.labelDrag.startPos.x),
        dy:S.labelDrag.offset.dy+(pos.y-S.labelDrag.startPos.y)
      });
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
    const targetPb=e.target.closest?.('.pb');
    if(targetPb&&targetPb.dataset.nid!==S.conn.fromId){
      setConnHover(targetPb.dataset.nid,targetPb.dataset.port);
    }else{
      const ng=e.target.closest?.('.node-g');
      if(ng&&ng.dataset.nid!==S.conn.fromId){
        setConnHover(ng.dataset.nid,null);
      }else{
        clearConnHover();
      }
    }
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
  if(mst==='conn'&&S.conn){
    const pos=toSVG(e.clientX,e.clientY);
    S.conn.curPos={x:pos.x,y:pos.y};
    if(S.conn.hoverNodeId&&S.conn.hoverPort){
      createConnectionFromConn(S.conn.hoverNodeId,S.conn.hoverPort);
      if(!S.conn)return;
    }
    drawOverlay();
    return;
  }
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
  if(mst==='labelDrag'&&S.labelDrag){commit();draw();}
  if(mst==='rubber'&&S.rubber){

    const rx0=Math.min(S.rubber.x0,S.rubber.x1),rx1=Math.max(S.rubber.x0,S.rubber.x1);
    const ry0=Math.min(S.rubber.y0,S.rubber.y1),ry1=Math.max(S.rubber.y0,S.rubber.y1);
    const moved=Math.hypot(rx1-rx0,ry1-ry0)>6;
    if(moved){
      const rect=rectAt(rx0,ry0,rx1-rx0,ry1-ry0);
      S.multi=S.nodes.filter(n=>{
        return n.x<rx1&&(n.x+n.w)>rx0&&n.y<ry1&&(n.y+n.h)>ry0;
      }).map(n=>n.id);
      S.multiEdges=S.edges.filter(edge=>edgeIntersectsSelectionRect(edge,rect)).map(edge=>edge.id);
      if(S.multi.length===1&&!S.multiEdges.length){
        S.sel=S.multi[0];S.selT='node';S.multi=[];props();
      }else if(!S.multi.length&&S.multiEdges.length===1){
        S.sel=S.multiEdges[0];S.selT='edge';S.multiEdges=[];props();
      }else{
        S.sel=null;S.selT=null;props();
      }
    }else{
      S.multiEdges=[];
    }
    S.rubber=null;draw();
  }
  S.drag=null;S.wpDrag=null;S.eDrag=null;S.labelDrag=null;dragMoved=false;
  const prevMst=mst;
  mst=null;panStart=null;S.guides=[];
  if(!wasPan)syncPanCursor();
  document.querySelectorAll('.ct-hi').forEach(el=>el.classList.remove('ct-hi'));

  if(prevMst==='wpDrag'||prevMst==='labelDrag')props();
  if(prevMst==='drag')draw();
});

csvg.addEventListener('dblclick',e=>{
  if(e.target.dataset.wpid&&e.target.dataset.wpdx!==undefined){
    if(blockIfReadOnly('edit bend points'))return;
    const edge=edById(e.target.dataset.wpid);
    if(edge&&edge.wps){edge.wps.splice(+e.target.dataset.wpdx,1);commit();draw();props();}
  }
});

function cancelConn(){
  S.conn=null;
  if(mst==='conn')mst=null;
  csvg.classList.remove('cmode');
  document.getElementById('connbanner').classList.remove('on');
  clearConnHover();
  drawOverlay();
}

function showEdgeLabelInput(eid){
  if(S.readOnly)return;
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
  if(document.getElementById('ui-modal')?.classList.contains('open'))return;
  if(document.getElementById('exp-modal')?.classList.contains('open'))return;
  if(document.getElementById('load-modal')?.classList.contains('open'))return;
  if((e.metaKey||e.ctrlKey)&&e.code==='Slash'){
    e.preventDefault();
    showHelp();
    return;
  }
  const tag=document.activeElement.tagName;
  const inInput=tag==='INPUT'||tag==='TEXTAREA';

  if(e.key==='Escape'){
    cancelConn();
    S.sel=null;S.selT=null;S.multi=[];S.multiEdges=[];S.rubber=null;
    draw();props();return;
  }

  if((e.key==='Delete'||e.key==='Backspace')&&!inInput){
    e.preventDefault();
    if(blockIfReadOnly('delete items'))return;

    if(S.multi.length||S.multiEdges.length){
      const {unlocked,locked}=getSelectedNodeBuckets();
      const blocked=unlocked.filter(n=>nodeTouchesLockedNeighbor(n.id));
      const removeNodeIds=new Set(unlocked.filter(n=>!blocked.some(b=>b.id===n.id)).map(n=>n.id));
      const selectedEdges=S.multiEdges.map(edById).filter(Boolean);
      const removeEdgeIds=new Set();
      let lockedEdgeCount=0;
      selectedEdges.forEach(edge=>{
        if(removeNodeIds.has(edge.from)||removeNodeIds.has(edge.to))return;
        if(isEdgeEndpointLocked(edge,'from')||isEdgeEndpointLocked(edge,'to')){
          lockedEdgeCount++;
          return;
        }
        removeEdgeIds.add(edge.id);
      });
      if(!removeNodeIds.size&&!removeEdgeIds.size){
        if(locked.length&&!S.multiEdges.length)showLockedSelectionToast('deleted');
        else if(blocked.length)showToast('Nodes connected to locked items cannot be deleted until those items are unlocked.','info');
        else if(lockedEdgeCount)showToast('Selected edges connected to locked items cannot be deleted.','info');
        return;
      }
      S.nodes=S.nodes.filter(n=>!removeNodeIds.has(n.id));
      S.edges=S.edges.filter(ed=>!removeNodeIds.has(ed.from)&&!removeNodeIds.has(ed.to)&&!removeEdgeIds.has(ed.id));
      S.multi=[];S.multiEdges=[];S.sel=null;S.selT=null;commit();draw();props();
      if(locked.length)showToast('Locked items were kept in place.','info');
      if(blocked.length)showToast('Nodes connected to locked items were skipped during delete.','info');
      if(lockedEdgeCount)showToast('Edges connected to locked items were skipped during delete.','info');
      return;
    }

    if(S.sel){
      if(S.selT==='node'){
        if(isNodeLocked(S.sel)){
          showLockedSelectionToast('deleted');
          return;
        }
        if(nodeTouchesLockedNeighbor(S.sel)){
          showToast('This node is connected to a locked item and cannot be deleted until that item is unlocked.','info');
          return;
        }
        S.nodes=S.nodes.filter(n=>n.id!==S.sel);S.edges=S.edges.filter(ed=>ed.from!==S.sel&&ed.to!==S.sel);
      }else{
        const edge=edById(S.sel);
        if(edge&&(isEdgeEndpointLocked(edge,'from')||isEdgeEndpointLocked(edge,'to'))){
          showToast('Edges connected to locked items cannot be deleted.','info');
          return;
        }
        S.edges=S.edges.filter(ed=>ed.id!==S.sel);
      }
      S.sel=null;S.selT=null;commit();draw();props();
    }
    return;
  }

  const ARROW={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]};
  if(ARROW[e.key]&&!inInput){
    e.preventDefault();
    if(blockIfReadOnly('move items'))return;
    const [dx,dy]=ARROW[e.key];
    const {unlocked,locked}=getSelectedNodeBuckets();
    unlocked.forEach(n=>{n.x+=dx;n.y+=dy;});
    if(unlocked.length){
      commit();
      draw();
    }else if(locked.length){
      showLockedSelectionToast('moved');
    }
    return;
  }

  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&!inInput){
    e.preventDefault();
    S.multi=S.nodes.map(n=>n.id);S.multiEdges=[];S.sel=null;S.selT=null;draw();return;
  }

  if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){
    e.preventDefault();
    if(blockIfReadOnly('use undo'))return;
    undo();
  }
  if((e.metaKey||e.ctrlKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))){
    e.preventDefault();
    if(blockIfReadOnly('use redo'))return;
    redo();
  }

  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'&&!inInput){
    e.preventDefault();
    if(blockIfReadOnly('duplicate items'))return;
    const {unlocked,locked}=getSelectedNodeBuckets();
    if(!unlocked.length){
      if(locked.length)showLockedSelectionToast('duplicated');
      return;
    }
    const newIds=unlocked.map(n=>{
      const nid='n'+(S.nid++);
      S.nodes.push({...deepcl(n),id:nid,x:n.x+24,y:n.y+24});
      return nid;
    }).filter(Boolean);
    S.multi=newIds.length>1?newIds:[];S.multiEdges=[];
    if(newIds.length===1){S.sel=newIds[0];S.selT='node';}
    else{S.sel=null;S.selT=null;}
    commit();draw();props();
    if(locked.length)showToast('Locked items were skipped during duplicate.','info');
    return;
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
    if(blockIfReadOnly('paste items'))return;
    const doApplyPaste=seedNodes=>{
      if(!seedNodes||!seedNodes.length)return false;
      const pasteNodes=seedNodes.map(n=>({...deepcl(n),x:n.x+32,y:n.y+32}));
      const newIds=pasteNodes.map(n=>{
        const nid='n'+(S.nid++);
        S.nodes.push({...deepcl(n),id:nid});
        return nid;
      });
      S.multi=newIds.length>1?newIds:[];S.multiEdges=[];
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

document.getElementById('bundo').addEventListener('click',()=>{if(blockIfReadOnly('use undo'))return;undo();});
document.getElementById('bredo').addEventListener('click',()=>{if(blockIfReadOnly('use redo'))return;redo();});
document.getElementById('breadonly').addEventListener('click',()=>setReadOnly(!S.readOnly,{syncUrl:true,toast:true}));
const darkToggle=document.getElementById('bdark');
darkToggle.textContent=document.body.classList.contains('dark')?'Light mode':'Dark mode';
darkToggle.addEventListener('click',function(){
  document.body.classList.toggle('dark');
  this.textContent=document.body.classList.contains('dark')?'Light mode':'Dark mode';
  draw();
});
document.getElementById('bclear').addEventListener('click',async ()=>{
  if(blockIfReadOnly('clear the canvas'))return;
  const ok=await uiConfirm('Clear all nodes and edges? This cannot be undone with a browser dialog anymore, but your normal undo history stays available until the state changes.','Clear canvas','Clear','Cancel');
  if(!ok)return;
  S.nodes=[];S.edges=[];S.sel=null;S.selT=null;S.multi=[];S.multiEdges=[];cancelConn();
  commit();draw();props();document.getElementById('hint').style.opacity='1';
});
document.getElementById('bzm').addEventListener('click',()=>AF.zoom(1/BUTTON_ZOOM_FACTOR));
document.getElementById('bzp').addEventListener('click',()=>AF.zoom(BUTTON_ZOOM_FACTOR));
document.getElementById('bzf').addEventListener('click',()=>AF.fitAll());
document.getElementById('bzmb').addEventListener('click',()=>AF.zoom(1/BUTTON_ZOOM_FACTOR));
document.getElementById('bzpb').addEventListener('click',()=>AF.zoom(BUTTON_ZOOM_FACTOR));
document.getElementById('bzfb').addEventListener('click',()=>AF.fitAll());

document.getElementById('snap-toggle').addEventListener('click',function(){
  if(blockIfReadOnly('change snap settings'))return;
  S.snap=!S.snap;
  this.textContent=S.snap?'Snap on':'Snap off';
  this.classList.toggle('on',S.snap);
});
document.getElementById('snap-toggle').textContent=S.snap?'Snap on':'Snap off';
document.getElementById('snap-toggle').classList.toggle('on',S.snap);
document.getElementById('balign').addEventListener('click',()=>{
  if(blockIfReadOnly('open alignment tools'))return;
  S.alignOpen=!S.alignOpen;
  updateAlignBar();
});
document.getElementById('helpfab').addEventListener('click',showHelp);

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
    if(blockIfReadOnly('align items'))return;
    const {unlocked,locked}=getSelectedNodeBuckets();
    if(!unlocked.length){
      if(locked.length)showLockedSelectionToast('aligned');
      return;
    }
    const ns=unlocked.slice();
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
    else{
      if((type==='hdist'||type==='vdist')&&ns.length<3){
        showToast('Select at least three unlocked nodes to distribute them.','info');
      }else if(type==='matchw'&&ns.length<2){
        showToast('Select at least two unlocked nodes to match widths.','info');
      }
      return;
    }
    commit();draw();
    if(locked.length)showToast('Locked items were skipped during alignment.','info');
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
  if(blockIfReadOnly('run auto layout'))return;
  const reg=S.nodes.filter(n=>n.tp!=='cont'&&n.tp!=='text'&&!n.locked);if(!reg.length){
    showToast('There are no unlocked flow nodes available for auto layout.','info');
    return;
  }
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
  const ok=await confirmCanvasReplacement('Load example','Replace the current canvas with the example diagram? Unsaved in-memory edits newer than the last autosave will be lost.');
  if(!ok)return;
  const nextState={
    title:'Automated security pipeline',
    nid:200,
    nodes:[
      {id:'c1',tp:'cont',ramp:'purple',x:-350,y:-40,w:740,h:720,title:'Automated security pipeline',sub:'Continuous attack surface management',customColor:null,fillOpacity:DEFAULT_SECTION_OPACITY,locked:false},
      {id:'n1',tp:'two',ramp:'purple',x:-130,y:10,w:260,h:56,title:'Coordinator agent',sub:'Manages policy & orchestration',prompt:'What does the Coordinator agent do?',customColor:null,fillOpacity:1,locked:false},
      {id:'n2',tp:'two',ramp:'teal',x:-320,y:130,w:180,h:52,title:'Discovery agent',sub:'Maps assets & roles',prompt:'How does the Discovery agent find assets?',customColor:null,fillOpacity:1,locked:false},
      {id:'n3',tp:'two',ramp:'coral',x:-110,y:130,w:190,h:52,title:'Attack path agent',sub:'Builds path model',prompt:'How does the Attack Path agent model attacker movement?',customColor:null,fillOpacity:1,locked:false},
      {id:'n4',tp:'one',ramp:'gray',x:110,y:130,w:160,h:44,title:'Memory agent',sub:'',prompt:'What does the Memory agent store?',customColor:null,fillOpacity:1,locked:false},
      {id:'n5',tp:'two',ramp:'amber',x:-150,y:244,w:300,h:56,title:'Attack path graph',sub:'Full risk map of the system',prompt:'What does the attack path graph contain?',customColor:null,fillOpacity:1,locked:false},
      {id:'n6',tp:'two',ramp:'red',x:-320,y:364,w:220,h:52,title:'Red validation',sub:'Simulates attacker paths',prompt:'How does the Red Validation agent test paths?',customColor:null,fillOpacity:1,locked:false},
      {id:'n7',tp:'two',ramp:'blue',x:10,y:364,w:220,h:52,title:'Blue defense',sub:'Applies security fixes',prompt:'How does the Blue Defense agent work?',customColor:null,fillOpacity:1,locked:false},
      {id:'n8',tp:'two',ramp:'purple',x:-160,y:480,w:320,h:56,title:'Verification agent',sub:'Confirms paths are blocked',prompt:'What does the Verification agent check?',customColor:null,fillOpacity:1,locked:false},
      {id:'n9',tp:'one',ramp:'green',x:-320,y:600,w:180,h:44,title:'System learns',sub:'',prompt:'How does the system learn from blocked paths?',customColor:null,fillOpacity:1,locked:false},
      {id:'n10',tp:'one',ramp:'red',x:10,y:600,w:180,h:44,title:'Escalate defenses',sub:'',prompt:'What does escalating defenses involve?',customColor:null,fillOpacity:1,locked:false},
      {id:'t1',tp:'text',ramp:'text',x:-130,y:680,w:260,h:36,title:'↻ Feeds back to coordinator',sub:'',prompt:'',customColor:null,fillOpacity:1,locked:false},
    ],
    edges:[
      {id:'e1',from:'n1',fp:'bottom',to:'n2',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e2',from:'n1',fp:'bottom',to:'n3',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e3',from:'n1',fp:'bottom',to:'n4',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e4',from:'n2',fp:'bottom',to:'n5',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e5',from:'n3',fp:'bottom',to:'n5',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e6',from:'n4',fp:'bottom',to:'n5',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e7',from:'n5',fp:'bottom',to:'n6',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e8',from:'n5',fp:'bottom',to:'n7',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e9',from:'n6',fp:'bottom',to:'n8',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e10',from:'n7',fp:'bottom',to:'n8',tp:'top',dash:false,col:null,wps:[],label:null,customColor:null,labelOffset:null},
      {id:'e11',from:'n8',fp:'bottom',to:'n9',tp:'top',dash:false,col:'green',wps:[],label:'path blocked',customColor:null,labelOffset:null},
      {id:'e12',from:'n8',fp:'bottom',to:'n10',tp:'top',dash:false,col:'red',wps:[],label:'still open',customColor:null,labelOffset:null},
      {id:'e13',from:'n9',fp:'right',to:'n1',tp:'left',dash:true,col:null,wps:[],label:null,customColor:null,labelOffset:null},
    ]
  };
  const projectId=S.activeProjectId||generateProjectId();
  applyProjectState(nextState,{projectId,fit:true,markClean:false});
  persistActiveProjectNow({createIfMissing:true});
  showToast('Example project loaded into browser storage.','success');
});

document.getElementById('bsave').addEventListener('click',()=>{
  const data=JSON.stringify({title:S.title,nodes:S.nodes,edges:S.edges,nid:S.nid},null,2);
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`${projectFileStem()}.json`;a.click();
  URL.revokeObjectURL(url);
  showToast('JSON file downloaded.','success');
});
document.getElementById('bload-btn').addEventListener('click',openLoadModal);
document.getElementById('load-close')?.addEventListener('click',closeLoadModal);
document.getElementById('load-new')?.addEventListener('click',createBlankBrowserProject);
document.getElementById('load-import')?.addEventListener('click',()=>document.getElementById('bload').click());
loadModal?.addEventListener('click',e=>{
  if(e.target===loadModal)closeLoadModal();
});
window.addEventListener('keydown',e=>{
  if(document.getElementById('ui-modal')?.classList.contains('open'))return;
  if(e.key==='Escape'&&loadModal?.classList.contains('open')){
    e.preventDefault();
    closeLoadModal();
  }
});
document.getElementById('bload').addEventListener('change',function(){
  const f=this.files[0];if(!f)return;
  loadFromFile(f);
  this.value='';
});

// Central load function — used by both the button and the window drag-drop handler
async function loadFromFile(file,{replaceProjectId=S.activeProjectId}={}) {
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    uiAlert('Only .json files exported from ArcFlow can be loaded.', 'Unsupported file');
    return false;
  }
  const ok=await confirmCanvasReplacement('Import JSON','Import this JSON file and replace the current canvas? Unsaved in-memory edits newer than the last autosave will be lost.');
  if(!ok){
    return false;
  }
  const text=await new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ev => resolve(String(ev.target.result||''));
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsText(file);
  }).catch(()=>null);
  if(text===null){
    uiAlert('The selected file could not be read.','Load failed');
    return false;
  }

  let raw;
  try { raw = JSON.parse(text); }
  catch { uiAlert('The file is not valid JSON.', 'Load failed'); return false; }

  let result;
  try { result = sanitizeLoad(raw); }
  catch (err) {
    uiAlert(err.message, 'Incompatible file');
    return false;
  }

  const nextState={
    title:normalizeProjectTitle(result.title, normalizeProjectTitle(file.name.replace(/\.[^.]+$/,''), DEFAULT_PROJECT_TITLE)),
    nodes:result.nodes,
    edges:result.edges,
    nid:result.nid
  };
  const projectId=replaceProjectId||generateProjectId();
  applyProjectState(nextState,{projectId,fit:true,markClean:false});
  persistActiveProjectNow({createIfMissing:true});
  closeLoadModal();
  showToast('Project imported into browser storage.','success');

  if (result.warnings.length) {
    uiAlert(
      'File loaded with the following corrections:\n\n' + result.warnings.map(function(w){ return '  - ' + w; }).join('\n'),
      'Loaded with warnings'
    );
  }
  return true;
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
  if (!file) {
    uiAlert('Only .json files exported from ArcFlow can be dropped into the app.','Unsupported file');
    return;
  }
  loadFromFile(file);
});

const EXPORT_DEFAULTS={format:'svg',scale:2,padding:50,backgroundMode:'transparent',jpgQuality:93};
const EXPORT_BG_OPTIONS={svg:['transparent','theme','white'],png:['transparent','theme','white'],jpg:['theme','white']};
let exportState={...EXPORT_DEFAULTS};

function normalizeExportOptions(options={}){
  const format=['svg','png','jpg'].includes(options.format)?options.format:EXPORT_DEFAULTS.format;
  const scale=clamp(Math.round(Number.isFinite(+options.scale)?+options.scale:EXPORT_DEFAULTS.scale),1,4);
  const padding=clamp(Math.round(Number.isFinite(+options.padding)?+options.padding:EXPORT_DEFAULTS.padding),0,400);
  const jpgQuality=clamp(Math.round(Number.isFinite(+options.jpgQuality)?+options.jpgQuality:EXPORT_DEFAULTS.jpgQuality),60,100);
  let backgroundMode=['transparent','theme','white'].includes(options.backgroundMode)?options.backgroundMode:EXPORT_DEFAULTS.backgroundMode;
  if(format==='jpg'&&backgroundMode==='transparent')backgroundMode='theme';
  return{format,scale,padding,backgroundMode,jpgQuality};
}
function exportBackgroundFill(backgroundMode,isDark=isDarkTheme()){
  if(backgroundMode==='theme')return themeColors(isDark).bg1;
  if(backgroundMode==='white')return'#FFFFFF';
  return null;
}
function buildExportSVG(options={}){
  const opts=normalizeExportOptions(options);
  const pad=opts.padding;
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
      const labelPoint=edgeLabelPoint(e,all);
      if(!labelPoint)return;
      const hw=Math.max(e.label.length*7.2+20,38)/2;
      xs.push(labelPoint.x-hw,labelPoint.x+hw);
      ys.push(labelPoint.y-9,labelPoint.y+9);
    }
  });

  const mnX=Math.min(...xs)-pad,mnY=Math.min(...ys)-pad;
  const mxX=Math.max(...xs)+pad,mxY=Math.max(...ys)+pad;
  const W=mxX-mnX,H=mxY-mnY;
  const isDark=isDarkTheme();
  const bgFill=exportBackgroundFill(opts.backgroundMode,isDark);
  const css=`.nt{font-size:13px;font-weight:500;font-family:${FF}}.ns{font-size:11px;font-family:${FF}}.elbl{font-size:11px;font-family:${FF}}`;
  const lines=[
    `<svg width="${W}" height="${H}" viewBox="${mnX} ${mnY} ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker><style>${css}</style></defs>`,
  ];
  if(bgFill)lines.push(`<rect x="${mnX}" y="${mnY}" width="${W}" height="${H}" fill="${bgFill}"/>`);
  S.nodes.filter(n=>n.tp==='cont').forEach(n=>{
    const visuals=resolveNodeVisuals(n,isDark);
    lines.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${SECTION_RX}" fill="${visuals.fill}" stroke="${visuals.stroke}" stroke-width="1" stroke-dasharray="7 4"/>`);
    lines.push(`<text class="nt" x="${n.x+14}" y="${n.y+17}" fill="${visuals.title}" dominant-baseline="central">${esc(n.title)}</text>`);
    if(n.sub)lines.push(`<text class="ns" x="${n.x+14}" y="${n.y+32}" fill="${visuals.sub}" dominant-baseline="central">${esc(n.sub)}</text>`);
  });
  S.edges.forEach(e=>{
    const fn=byId(e.from),tn=byId(e.to);if(!fn||!tn)return;
    const fp=ports(fn)[e.fp],tp=ports(tn)[e.tp];if(!fp||!tp)return;
    const points=edgePolylinePoints(fp,tp,e.wps||[],e.fp,e.tp);
    const d='M'+points.map(p=>`${Math.round(p.x)} ${Math.round(p.y)}`).join('L');
    const visuals=resolveEdgeVisuals(e,isDark);
    lines.push(`<path d="${d}" fill="none" stroke="${visuals.stroke}" stroke-width="1.5"${e.dash?' stroke-dasharray="5 4"':''} stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arr)"/>`);
    if(e.label){
      const labelPoint=edgeLabelPoint(e,points);
      if(!labelPoint)return;
      const mx=labelPoint.x,my=labelPoint.y;
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
  return{svgStr:lines.join('\n'),W,H,options:opts};
}

function doExport(options={}){
  const opts=normalizeExportOptions(options);
  if(!S.nodes.length){uiAlert('There is nothing to export yet. Add at least one node first.','Export');return;}
  const {svgStr,W,H}=buildExportSVG(opts);
  const fileStem=projectFileStem();
  if(opts.format==='svg'){
    const blob=new Blob([svgStr],{type:'image/svg+xml'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`${fileStem}.svg`;a.click();
    URL.revokeObjectURL(url);
    showToast('SVG exported.','success');
    return;
  }

  const img=new Image();
  const blob=new Blob([svgStr],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
  img.onload=()=>{
    const canvas=document.createElement('canvas');
    canvas.width=W*opts.scale;canvas.height=H*opts.scale;
    const ctx=canvas.getContext('2d');
    ctx.scale(opts.scale,opts.scale);
    ctx.drawImage(img,0,0);
    URL.revokeObjectURL(url);
    const mime=opts.format==='jpg'?'image/jpeg':'image/png';
    const q=opts.format==='jpg'?opts.jpgQuality/100:1;
    canvas.toBlob(b=>{
      if(!b){
        uiAlert(`The ${opts.format.toUpperCase()} export failed while creating the image blob.`,'Export failed');
        return;
      }
      const u=URL.createObjectURL(b);
      const a=document.createElement('a');a.href=u;a.download=`${fileStem}.${opts.format}`;a.click();
      URL.revokeObjectURL(u);
      showToast(`${opts.format.toUpperCase()} exported.`,'success');
    },mime,q);
  };
  img.onerror=()=>{
    URL.revokeObjectURL(url);
    uiAlert(`The ${opts.format.toUpperCase()} export could not be rendered from the generated SVG.`,'Export failed');
  };
  img.src=url;
}

const expModal=document.getElementById('exp-modal');
const expCloseBtn=document.getElementById('exp-close');
const expQualityGroup=document.getElementById('exp-quality')?.closest('.exp-group');
function syncExportModalUI(){
  exportState=normalizeExportOptions(exportState);
  document.querySelectorAll('#exp-modal [data-fmt]').forEach(btn=>{
    btn.classList.toggle('on',btn.dataset.fmt===exportState.format);
  });
  document.querySelectorAll('#exp-modal [data-bg]').forEach(btn=>{
    const allowed=EXPORT_BG_OPTIONS[exportState.format].includes(btn.dataset.bg);
    btn.classList.toggle('on',btn.dataset.bg===exportState.backgroundMode);
    btn.classList.toggle('is-disabled',!allowed);
    btn.disabled=!allowed;
  });
  const scaleInput=document.getElementById('exp-scale');
  const paddingInput=document.getElementById('exp-padding');
  const qualityInput=document.getElementById('exp-quality');
  const qualityValue=document.getElementById('exp-quality-value');
  if(scaleInput)scaleInput.value=String(exportState.scale);
  if(paddingInput)paddingInput.value=String(exportState.padding);
  if(qualityInput){
    qualityInput.value=String(exportState.jpgQuality);
    qualityInput.disabled=exportState.format!=='jpg';
  }
  if(qualityValue)qualityValue.textContent=`${exportState.jpgQuality}%`;
  expQualityGroup?.classList.toggle('is-disabled',exportState.format!=='jpg');
  document.getElementById('exp-file-preview').textContent=`${projectFileStem()}.${exportState.format}`;
}
function closeExportModal(){
  expModal.classList.remove('open');
  expModal.setAttribute('aria-hidden','true');
}
function openExportModal(){
  if(isAppDialogOpen())return;
  if(!S.nodes.length){uiAlert('There is nothing to export yet. Add at least one node first.','Export');return;}
  syncExportModalUI();
  expModal.classList.add('open');
  expModal.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>{
    expModal.querySelector(`[data-fmt="${exportState.format}"]`)?.focus();
  });
}
document.getElementById('bexp').addEventListener('click',openExportModal);
document.getElementById('exp-cancel').addEventListener('click',closeExportModal);
document.getElementById('exp-confirm').addEventListener('click',()=>{
  const opts=normalizeExportOptions(exportState);
  closeExportModal();
  doExport(opts);
});
expCloseBtn.addEventListener('click',closeExportModal);
document.querySelectorAll('#exp-modal [data-fmt]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    exportState.format=btn.dataset.fmt;
    if(exportState.format==='jpg'&&exportState.backgroundMode==='transparent'){
      exportState.backgroundMode='theme';
    }
    syncExportModalUI();
  });
});
document.querySelectorAll('#exp-modal [data-bg]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(btn.disabled)return;
    exportState.backgroundMode=btn.dataset.bg;
    syncExportModalUI();
  });
});
document.getElementById('exp-scale')?.addEventListener('change',e=>{
  exportState.scale=+e.target.value||EXPORT_DEFAULTS.scale;
  syncExportModalUI();
});
document.getElementById('exp-padding')?.addEventListener('input',e=>{
  exportState.padding=clamp(+e.target.value||0,0,400);
  syncExportModalUI();
});
document.getElementById('exp-quality')?.addEventListener('input',e=>{
  exportState.jpgQuality=clamp(+e.target.value||EXPORT_DEFAULTS.jpgQuality,60,100);
  syncExportModalUI();
});
expModal.addEventListener('click',e=>{
  if(e.target===e.currentTarget)closeExportModal();
});
window.addEventListener('keydown',e=>{
  if(document.getElementById('ui-modal')?.classList.contains('open'))return;
  if(e.key==='Escape'&&expModal.classList.contains('open')){
    e.preventDefault();
    closeExportModal();
  }
});

window.AF={zoom:doZoom,fitAll};

window.addEventListener('beforeunload',e=>{
  if(!hasUnsavedChanges())return;
  e.preventDefault();
  e.returnValue='';
});
window.addEventListener('pagehide',()=>{
  if(shouldPersistCurrentProject()){
    persistActiveProjectNow({createIfMissing:true});
  }
});

buildSidebar();
syncPhoneGuard();
window.addEventListener('resize',syncPhoneGuard,{passive:true});
window.addEventListener('orientationchange',syncPhoneGuard);
window.visualViewport?.addEventListener('resize',syncPhoneGuard);
syncProjectTitle();
syncReadOnlyUi();
const projectTitleInput=document.getElementById('project-title');
projectTitleInput?.addEventListener('input',e=>{
  if(S.readOnly)return;
  S.title=normalizeProjectTitle(e.target.value,'');
  syncProjectTitle(false);
  scheduleAutosave();
});
projectTitleInput?.addEventListener('keydown',e=>{
  if(e.key==='Enter')e.currentTarget.blur();
});
projectTitleInput?.addEventListener('blur',e=>{
  if(S.readOnly){
    syncProjectTitle();
    return;
  }
  const nextTitle=normalizeProjectTitle(e.target.value,DEFAULT_PROJECT_TITLE);
  if(nextTitle!==S.title){
    S.title=nextTitle;
    syncProjectTitle();
    commit();
    return;
  }
  syncProjectTitle();
});
const initialStore=readBrowserStore();
const initialProject=initialStore.projects.find(p=>p.id===initialStore.activeProjectId)||initialStore.projects[0]||null;
if(initialProject){
  applyProjectState(initialProject,{projectId:initialProject.id,fit:true,markClean:true});
  const syncedStore=readBrowserStore();
  syncedStore.activeProjectId=initialProject.id;
  writeBrowserStore(syncedStore);
}else{
  commit({autosave:false});
  markSavedState();
  draw();
  props();
}

// Empty-state shortcut → triggers the toolbar example loader
document.getElementById('empty-example-btn')?.addEventListener('click',()=>{
  document.getElementById('bex').click();
});

// Auto-fade hint bar after 9 seconds on initial empty canvas
setTimeout(()=>{
  const h=document.getElementById('hint');
  if(h&&!S.nodes.length)h.style.opacity='0';
},9000);


const _SHARE_EXCELLENT=4096;   // < 4 KB: safe everywhere
const _SHARE_WARN=16384;       // 4–16 KB: allowed with warning
                                // > 16 KB: blocked, recommend JSON export
const _SHARE_ZOOM_MIN=0.12;
const _SHARE_ZOOM_MAX=5;

function _b64uEncode(bytes){
  const CHUNK=8192;let binary='';
  for(let i=0;i<bytes.length;i+=CHUNK)binary+=String.fromCharCode(...bytes.subarray(i,i+CHUNK));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function _b64uDecode(str){
  const b64=str.replace(/-/g,'+').replace(/_/g,'/');
  const padded=b64+'='.repeat((4-(b64.length%4))%4);
  const binary=atob(padded);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}

// ── Compression (deflate-raw via CompressionStream) ───────────────────────────
async function _compress(str){
  if(typeof CompressionStream!=='function'){
    throw new Error('Share links are not supported in this browser because CompressionStream is unavailable. Use JSON export instead.');
  }
  const input=new TextEncoder().encode(str);
  let cs;
  try{cs=new CompressionStream('deflate-raw');}
  catch{
    throw new Error('This browser cannot create ArcFlow share links with the required compression format. Use JSON export instead.');
  }
  const w=cs.writable.getWriter();w.write(input);w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function _decompress(bytes){
  if(typeof DecompressionStream!=='function'){
    throw new Error('This browser cannot open ArcFlow share links because DecompressionStream is unavailable. Open the link in a current supported browser, or ask for a JSON export instead.');
  }
  let ds;
  try{ds=new DecompressionStream('deflate-raw');}
  catch{
    throw new Error('This browser cannot decode the compression format used in ArcFlow share links. Ask for a JSON export instead.');
  }
  const w=ds.writable.getWriter();w.write(bytes);w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}


function _buildSharePayload(){
  return{
    version:1,
    title:S.title,
    nodes:deepcl(S.nodes),
    edges:deepcl(S.edges),
    nid:S.nid,
    view:{pan:{x:S.pan.x,y:S.pan.y},zoom:S.zoom},
  };
}

async function _encodeShare(){
  const json=JSON.stringify(_buildSharePayload());
  const compressed=await _compress(json);
  const encoded=_b64uEncode(compressed);
  const url=new URL(window.location.href);
  url.searchParams.set('share','v1.'+encoded);
  url.searchParams.delete('readonly');
  const urlStr=url.toString();
  return{url:urlStr,urlBytes:urlStr.length,payloadBytes:compressed.length};
}

async function _decodeShare(param){
  if(typeof param!=='string'||!param.startsWith('v1.'))
    throw new Error('Unsupported share link format. Expected a "v1." prefix. The link may be truncated or from a newer version of ArcFlow.');
  const encoded=param.slice('v1.'.length);
  if(!encoded)throw new Error('Share link payload is empty.');
  let bytes;
  try{bytes=_b64uDecode(encoded);}
  catch{throw new Error('Share link contains invalid base64 data. It may be corrupted or truncated.');}
  let json;
  try{json=await _decompress(bytes);}
  catch{throw new Error('Share link could not be decompressed. It may be corrupted.');}
  let raw;
  try{raw=JSON.parse(json);}
  catch{throw new Error('Share link payload is not valid JSON.');}
  return raw;
}

function _sanitizeShareView(raw){
  if(!raw||typeof raw!=='object')return null;
  const{pan,zoom}=raw;
  if(!pan||typeof pan!=='object')return null;
  const px=Number.isFinite(+pan.x)?+pan.x:null;
  const py=Number.isFinite(+pan.y)?+pan.y:null;
  const z=Number.isFinite(+zoom)?clamp(+zoom,_SHARE_ZOOM_MIN,_SHARE_ZOOM_MAX):null;
  if(px===null||py===null||z===null)return null;
  return{pan:{x:px,y:py},zoom:z};
}

function _sanitizeShareLoad(raw){
  const base=sanitizeLoad(raw); 
  const view=_sanitizeShareView(raw?.view);
  return{...base,view};
}

function _applyShareState(result){
  const projectId=generateProjectId();
  if(result.view){
    S.pan={...result.view.pan};
    S.zoom=result.view.zoom;
    applyProjectState(result,{projectId,fit:false,markClean:false});
  }else{
    applyProjectState(result,{projectId,fit:true,markClean:false});
  }
  persistActiveProjectNow({createIfMissing:true});
}

async function _handleShareUrl(){
  if(!_SHARE_URL_PARAM)return false;

  let raw;
  try{raw=await _decodeShare(_SHARE_URL_PARAM);}
  catch(err){
    uiAlert(err?.message||'The shared link could not be decoded.','Shared link error');
    return false;
  }

  if(typeof raw?.version==='number'&&raw.version>1){
    const proceed=await uiConfirm(
      'This link was created with a newer version of ArcFlow and may not open correctly. Try anyway?',
      'Version mismatch','Open anyway','Cancel'
    );
    if(!proceed)return false;
  }

  let result;
  try{result=_sanitizeShareLoad(raw);}
  catch(err){
    uiAlert(err?.message||'The shared diagram is not a valid ArcFlow file.','Shared link error');
    return false;
  }

  if(hasProjectContent()){
    const ok=await uiConfirm(
      `Open shared diagram "${normalizeProjectTitle(result.title,'Untitled')}"?\n\nThis will replace the current canvas. Unsaved in-memory edits newer than the last autosave will be lost.`,
      'Open shared diagram','Open','Cancel'
    );
    if(!ok)return false;
  }

  _applyShareState(result);
  const cleanUrl=new URL(window.location.href);
  cleanUrl.searchParams.delete('share');
  history.replaceState(null,'',cleanUrl.toString());

  if(result.warnings.length){
    uiAlert(
      'Opened with the following corrections:\n\n'+result.warnings.map(w=>'  — '+w).join('\n'),
      'Opened with warnings'
    );
  }else{
    showToast('Shared diagram opened.','success');
  }
  return true;
}

function _closeShareModal(){
  const modal=document.getElementById('share-modal');
  if(!modal)return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

function _initShareModal(){
  if(document.getElementById('share-modal'))return;
  const el=document.createElement('div');
  el.id='share-modal';
  el.setAttribute('aria-hidden','true');
  el.innerHTML=`
<div class="share-box" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
  <button class="share-close" id="share-close-btn" type="button" aria-label="Close share dialog">✕</button>
  <div class="share-kicker">Share</div>
  <div class="share-title" id="share-dialog-title">Share diagram</div>
  <div class="share-sub">Generate a link that opens this exact diagram and viewport in supported modern browsers. Links encode the full graph with lossless compression — no server, no storage.</div>
  <div id="share-modal-body"><div class="share-loading">Building share link…</div></div>
  <div class="share-actions">
    <button class="share-json-btn" id="share-export-json-btn" type="button">Export JSON instead</button>
    <button class="share-done-btn" id="share-done-btn" type="button">Done</button>
  </div>
</div>`;
  document.body.appendChild(el);
  el.addEventListener('click',e=>{if(e.target===el)_closeShareModal();});
  document.getElementById('share-close-btn').addEventListener('click',_closeShareModal);
  document.getElementById('share-done-btn').addEventListener('click',_closeShareModal);
  document.getElementById('share-export-json-btn').addEventListener('click',()=>{
    _closeShareModal();
    document.getElementById('bsave').click();
  });
}

async function _openShareModal(){
  if(isAppDialogOpen())return;
  if(!S.nodes.length){uiAlert('Add at least one node before sharing.','Nothing to share');return;}
  _initShareModal();
  const modal=document.getElementById('share-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');

  const body=document.getElementById('share-modal-body');
  body.innerHTML='<div class="share-loading">Building share link…</div>';

  let result;
  try{result=await _encodeShare();}
  catch(err){
    body.innerHTML=`<div class="share-status share-status-block">Failed to build share link — ${esc(err?.message||'compression unavailable')}</div>`;
    return;
  }

  const{url,urlBytes,payloadBytes}=result;
  const isBlocked=urlBytes>_SHARE_WARN;
  const isWarn=!isBlocked&&urlBytes>_SHARE_EXCELLENT;
  const urlKB=(urlBytes/1024).toFixed(1);
  const payKB=(payloadBytes/1024).toFixed(1);

  let statusClass,statusMsg;
  if(isBlocked){
    statusClass='share-status-block';
    statusMsg=`This diagram is too large for reliable URL sharing (${urlKB} KB). Some apps silently truncate long links. Export JSON instead for lossless sharing.`;
  }else if(isWarn){
    statusClass='share-status-warn';
    statusMsg=`Link is ${urlKB} KB — it will work in most browsers, but may be truncated in some chat apps or email clients.`;
  }else{
    statusClass='share-status-ok';
    statusMsg=`Link is ${urlKB} KB — short enough to survive copy/paste and messaging reliably.`;
  }

  const displayUrl=isBlocked?'(diagram too large — use JSON export instead)':url;
  body.innerHTML=`
    <div class="share-url-row">
      <input class="share-url-input" id="share-url-field" type="text" readonly value="${esc(displayUrl)}" aria-label="Share URL"/>
      <button class="share-copy-btn" id="share-copy-btn" type="button"${isBlocked?' disabled':''}>Copy link</button>
    </div>
    <div class="share-stats">
      <div class="share-stat"><span>Nodes</span><span class="share-stat-val">${S.nodes.length}</span></div>
      <div class="share-stat"><span>Edges</span><span class="share-stat-val">${S.edges.length}</span></div>
      <div class="share-stat"><span>Compressed</span><span class="share-stat-val">${payKB} KB</span></div>
      <div class="share-stat"><span>URL length</span><span class="share-stat-val">${urlKB} KB</span></div>
    </div>
    <div class="share-status ${statusClass}">${statusMsg}</div>`;

  if(!isBlocked){
    document.getElementById('share-copy-btn').addEventListener('click',async()=>{
      const btn=document.getElementById('share-copy-btn');
      try{
        await navigator.clipboard.writeText(url);
        if(btn)btn.textContent='✓ Copied!';
        showToast('Share link copied to clipboard.','success');
      }catch{
        const field=document.getElementById('share-url-field');
        if(field){field.select();document.execCommand('copy');}
        if(btn)btn.textContent='✓ Copied!';
        showToast('Share link copied.','success');
      }
      setTimeout(()=>{const b=document.getElementById('share-copy-btn');if(b)b.textContent='Copy link';},2000);
    });
    requestAnimationFrame(()=>document.getElementById('share-copy-btn')?.focus());
  }
}

window.addEventListener('keydown',e=>{
  if(document.getElementById('ui-modal')?.classList.contains('open'))return;
  const modal=document.getElementById('share-modal');
  if(e.key==='Escape'&&modal?.classList.contains('open')){e.preventDefault();_closeShareModal();}
});

window.addEventListener('keydown',e=>{
  if(document.getElementById('ui-modal')?.classList.contains('open'))return;
  const tag=document.activeElement?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='s'){
    e.preventDefault();_openShareModal();
  }
});

(function(){
  if(document.getElementById('bshare'))return;
  const expBtn=document.getElementById('bexp');
  if(!expBtn)return;
  const btn=document.createElement('button');
  btn.id='bshare';btn.type='button';
  btn.className='tbtn tbtn-share';
  btn.textContent='Share';
  btn.title='Share diagram via URL (Ctrl+Shift+S)';
  expBtn.parentElement.insertBefore(btn,expBtn);
  btn.addEventListener('click',_openShareModal);
})();

_handleShareUrl();


})();
