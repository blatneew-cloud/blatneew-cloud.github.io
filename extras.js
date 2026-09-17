(()=>{
const SHEET_ID='1027gJD_afI4HIJpS7tEDEwN_lcgyMPrc7T0e6-G-dS4';
const COMPLETE_OVERRIDES=new Set(['20251010_Penn State_30']);
let cache=null,cacheAt=0,charts=[],contextScope='complete';

const css=`
.context-note{padding:12px 14px;border-radius:10px;background:#fbf8ed;border:1px solid #eadfac;color:#615733;margin:10px 0 16px;line-height:1.45}
.progress-shell{height:9px;background:#e8eeeb;border-radius:999px;overflow:hidden;margin-top:6px}.progress-fill{height:100%;background:var(--green);border-radius:999px}.progress-fill.partial{background:var(--gold)}
.comp-row{display:grid;grid-template-columns:1.4fr .55fr .55fr .8fr;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #edf0ee}.comp-row:last-child{border-bottom:0}.comp-title{font-weight:800}.comp-status{text-align:right;font-weight:800}
.badge-good,.badge-warn{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:.72rem;font-weight:800}.badge-good{background:#e3f3eb;color:var(--good)}.badge-warn{background:#fbf1d1;color:#7b5b12}
.extra-loading{text-align:center;padding:46px 20px;background:#fff;border:1px dashed #ccd5d0;border-radius:12px;color:var(--muted)}
@media(max-width:760px){.comp-row{grid-template-columns:1.2fr .6fr .7fr}}
`;
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);

function jsonp(sheet){
  return new Promise((resolve,reject)=>{
    const cb='__cu_'+sheet.replace(/[^a-z0-9]/gi,'_')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const s=document.createElement('script');
    const timer=setTimeout(()=>finish(new Error('Timed out loading '+sheet)),7000);
    function finish(err,data){clearTimeout(timer);try{delete window[cb]}catch(e){};s.remove();err?reject(err):resolve(data)}
    window[cb]=data=>finish(null,data);
    const q=new URLSearchParams({sheet,tqx:'responseHandler:'+cb});
    s.src=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${q}`;
    s.onerror=()=>finish(new Error('Unable to load '+sheet));
    document.head.appendChild(s);
  });
}
function helper(resp){
  if(!resp?.table?.cols) throw new Error('Invalid Google Sheets response');
  const labels=resp.table.cols.map(c=>c.label||c.id||''),idx=Object.fromEntries(labels.map((x,i)=>[x,i]));
  const raw=(r,k)=>{const i=idx[k],c=i===undefined?null:r.c?.[i];return c?.v??null};
  const text=(r,k)=>{const i=idx[k],c=i===undefined?null:r.c?.[i];return String(c?.f??c?.v??'').trim()};
  const num=(r,k)=>{const n=Number(raw(r,k));return Number.isFinite(n)?n:0};
  const yes=(r,k)=>['yes','true','1'].includes(text(r,k).toLowerCase());
  return {rows:resp.table.rows||[],raw,text,num,yes};
}
function dateISO(v,f){
  const a=String(v??'').match(/Date\((\d+),(\d+),(\d+)\)/);if(a)return `${a[1]}-${String(+a[2]+1).padStart(2,'0')}-${String(a[3]).padStart(2,'0')}`;
  const t=String(f??v??'').trim(),m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return `${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(t)?t:t;
}
function parseGames(resp){
  const {rows,raw,text,num,yes}=helper(resp),out=[];
  for(const r of rows){
    const goalie=text(r,'Goalie'),season=text(r,'Season'),opponent=text(r,'Opponent');if(!goalie||!season||!opponent)continue;
    const date=dateISO(raw(r,'Date'),text(r,'Date')),gameId=text(r,'Game ID')||`${date.replace(/-/g,'')}_${opponent}_${(goalie.match(/#(\d+)/)||[])[1]||''}`;
    const gradesSA={'A+':num(r,'A+ SA'),A:num(r,'A SA'),B:num(r,'B SA'),C:num(r,'C SA')};
    const gradesGA={'A+':num(r,'A+ GA'),A:num(r,'A GA'),B:num(r,'B GA'),C:num(r,'C GA')};
    const sog=Object.values(gradesSA).reduce((a,b)=>a+b,0),ga=Object.values(gradesGA).reduce((a,b)=>a+b,0),sv=sog-ga;
    const toi=text(r,'TOI'),p=toi.split(':').map(Number),toiMin=(p[0]||0)+(p[1]||0)/60,xGA=num(r,'xGA');
    out.push({game:num(r,'Game #')||out.length+1,gameId,goalie,season,opponent,date,result:text(r,'Result'),b2b:yes(r,'B2B?'),toi,sog,ga,sv,svp:sog?sv/sog:null,xGA,gsax:xGA-ga,gaa:toiMin?ga*60/toiMin:null});
  }
  return out;
}
function parseContext(resp,games){
  const {rows,text}=helper(resp),map=new Map(games.map(g=>[g.gameId,g])),out=[];
  for(const r of rows){
    const gameId=text(r,'Game ID');if(!gameId)continue;const g=map.get(gameId);
    out.push({gameId,goalie:g?.goalie||text(r,'Goalie'),season:g?.season||'',opponent:g?.opponent||text(r,'Opponent'),date:g?.date||text(r,'Date'),day:text(r,'Day'),b2b:g?.b2b??['yes','true','1'].includes(text(r,'B2B').toLowerCase()),period:text(r,'Period'),timeRemaining:text(r,'Time Remaining'),scoreState:text(r,'Score State'),shotContext:text(r,'Shot Context'),traffic:text(r,'Traffic'),result:text(r,'Result'),reboundOutcome:text(r,'Rebound Outcome')||null,shotGrade:text(r,'Shot Grade')||null});
  }
  return out;
}
async function loadData(force=false){
  if(!force&&cache&&Date.now()-cacheAt<30000)return cache;
  const [g,c]=await Promise.all([jsonp('Games'),jsonp('Shot Context')]);
  const games=parseGames(g),context=parseContext(c,games);cache={games,context};cacheAt=Date.now();return cache;
}
function destroy(){charts.forEach(c=>{try{c.destroy()}catch(e){}});charts=[]}
function fmtPct(v,d=3){return Number.isFinite(v)?v.toFixed(d).replace(/^0/,''):'—'}
function fixed(v,d=2){return Number.isFinite(v)?v.toFixed(d):'—'}
function signed(v,d=2){return Number.isFinite(v)?`${v>0?'+':''}${v.toFixed(d)}`:'—'}
function sum(a){return a.reduce((x,y)=>x+(Number(y)||0),0)}
function mean(a){const x=a.filter(Number.isFinite);return x.length?sum(x)/x.length:null}
function sd(a){const x=a.filter(Number.isFinite);if(!x.length)return null;const m=mean(x);return Math.sqrt(sum(x.map(v=>(v-m)**2))/x.length)}
function metric(label,value,sub=''){return `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-sub">${sub}</div></div>`}
function dateLabel(iso){const d=new Date(iso+'T00:00:00');return isNaN(d)?iso:d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function chart(id,config){if(!window.Chart)return;const n=document.getElementById(id);if(n)charts.push(new Chart(n,config))}
function opts(title){return {responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{x:{grid:{display:false}},y:{grid:{color:'#edf0ee'},title:{display:!!title,text:title}}}}}
function selected(){return {goalie:document.getElementById('goalieSelect')?.value||'#30 Soderwall',season:document.getElementById('seasonSelect')?.value||'2025-26'}}
function bucket(t){const m=Number(String(t||'').split(':')[0]);return m>=15?'20:00–15:01':m>=10?'15:00–10:01':m>=5?'10:00–5:01':'5:00–0:00'}
function stats(events){const shots=events.length,saves=events.filter(e=>e.result==='Save').length,goals=events.filter(e=>e.result==='Goal').length;return {shots,saves,goals,svp:shots?saves/shots:null}}
function grouped(events,key){const m=new Map;events.forEach(e=>{const k=key(e)||'Unknown';if(!m.has(k))m.set(k,[]);m.get(k).push(e)});return [...m].map(([label,ev])=>({label,...stats(ev)}))}
function splitTable(rows){return `<div class="table-wrap"><table><thead><tr><th>Split</th><th>Shots</th><th>Saves</th><th>Goals</th><th>SV%</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${r.shots}</td><td>${r.saves}</td><td>${r.goals}</td><td>${fmtPct(r.svp)}</td></tr>`).join('')}</tbody></table></div>`}
function completions(games,events){return games.map(g=>{const n=events.filter(e=>e.gameId===g.gameId).length,override=COMPLETE_OVERRIDES.has(g.gameId);return {...g,n,pct:g.sog?n/g.sog:0,complete:override||(g.sog>0&&n===g.sog),override}}).filter(g=>g.n>0)}

async function renderContext(){
  const app=document.getElementById('app');app.innerHTML='<div class="extra-loading">Loading live shot-context data…</div>';destroy();
  try{
    const {games,context}=await loadData(),sel=selected(),gs=games.filter(g=>g.goalie===sel.goalie&&g.season===sel.season),all=context.filter(e=>e.goalie===sel.goalie&&e.season===sel.season),comp=completions(gs,all),completeIds=new Set(comp.filter(g=>g.complete).map(g=>g.gameId)),ev=contextScope==='complete'?all.filter(e=>completeIds.has(e.gameId)):all,s=stats(ev);
    const byType=grouped(ev,e=>e.shotContext),byTraffic=grouped(ev,e=>e.traffic),byScore=grouped(ev,e=>e.scoreState),byTime=grouped(ev,e=>bucket(e.timeRemaining)),byDay=grouped(ev,e=>e.day),byB2B=grouped(ev,e=>e.b2b?'B2B':'Not B2B');
    const rush=byType.find(x=>x.label==='Rush')||{},zone=byType.find(x=>x.label==='In-Zone')||{},traffic=byTraffic.find(x=>x.label==='Traffic')||{};
    const completeCount=comp.filter(g=>g.complete).length,partials=comp.filter(g=>!g.complete);
    app.innerHTML=`<div class="page-head"><div><div class="kicker">${sel.season}</div><h2>Shot Context</h2><p>Live manual event context from the logger.</p></div><div class="toolbar"><button class="btn ${contextScope==='complete'?'active':''}" id="ctxComplete">Complete Games Only</button><button class="btn ${contextScope==='all'?'active':''}" id="ctxAll">All Logged Shots</button></div></div>
    <div class="context-note"><strong>Context sample:</strong> ${completeCount} complete game${completeCount===1?'':'s'} included.${partials.length?' Partial: '+partials.map(g=>`${g.opponent} ${g.n}/${g.sog}`).join(' · ')+'.':''}</div>
    <div class="metric-grid">${metric('Context Shots',s.shots,`${s.saves} saves · ${s.goals} goals`)}${metric('Context SV%',fmtPct(s.svp),contextScope==='complete'?'complete games only':'all logged events')}${metric('Complete Games',completeCount,`${comp.length} with any context`)}${metric('Traffic SV%',fmtPct(traffic.svp),`${traffic.shots||0} traffic shots`)}${metric('Rush SV%',fmtPct(rush.svp),`${rush.shots||0} rush shots`)}${metric('In-Zone SV%',fmtPct(zone.svp),`${zone.shots||0} in-zone shots`)}</div>
    <div class="grid-2"><section class="panel"><h3 class="section-title">Shot Context Performance</h3><div class="chart-wrap"><canvas id="ctxType"></canvas></div></section><section class="panel"><h3 class="section-title">Score-State Performance</h3><div class="chart-wrap"><canvas id="ctxScore"></canvas></div></section></div>
    <div class="grid-2"><section class="panel"><h3 class="section-title">Traffic</h3>${splitTable(byTraffic)}</section><section class="panel"><h3 class="section-title">Time in Period</h3>${splitTable(byTime)}</section></div>
    <div class="grid-2"><section class="panel"><h3 class="section-title">Game Day</h3>${splitTable(byDay)}</section><section class="panel"><h3 class="section-title">Back-to-Back</h3>${splitTable(byB2B)}</section></div>
    <div class="grid-2"><section class="panel"><h3 class="section-title">Rebound Outcome</h3>${splitTable(grouped(ev.filter(e=>e.reboundOutcome),e=>e.reboundOutcome))}</section><section class="panel"><h3 class="section-title">SIG Grade by Context</h3>${splitTable(grouped(ev.filter(e=>e.shotGrade),e=>e.shotGrade))}</section></div>
    <section class="panel"><h3 class="section-title">Context Logging Completeness</h3>${comp.map(g=>{const p=Math.min(100,g.pct*100);return `<div class="comp-row"><div><div class="comp-title">${dateLabel(g.date)} · ${g.opponent}</div><div class="small">${g.gameId}</div></div><div>${g.n}/${g.sog}</div><div>${g.override?'Marked':fixed(p,0)+'%'}</div><div class="comp-status"><span class="${g.complete?'badge-good':'badge-warn'}">${g.complete?(g.override?'Complete*':'Complete'):'Partial'}</span><div class="progress-shell"><div class="progress-fill ${g.complete?'':'partial'}" style="width:${p}%"></div></div></div></div>`}).join('')}</section>`;
    document.getElementById('ctxComplete').onclick=()=>{contextScope='complete';renderContext()};document.getElementById('ctxAll').onclick=()=>{contextScope='all';renderContext()};
    const c=getComputedStyle(document.documentElement),green=c.getPropertyValue('--green').trim(),gold=c.getPropertyValue('--gold').trim();
    chart('ctxType',{type:'bar',data:{labels:byType.map(r=>r.label),datasets:[{label:'SV%',data:byType.map(r=>r.svp),backgroundColor:green}]},options:{...opts('Save Percentage'),scales:{x:{grid:{display:false}},y:{min:0,max:1,grid:{color:'#edf0ee'}}}}});
    chart('ctxScore',{type:'bar',data:{labels:byScore.map(r=>r.label),datasets:[{label:'SV%',data:byScore.map(r=>r.svp),backgroundColor:gold}]},options:{...opts('Save Percentage'),scales:{x:{grid:{display:false}},y:{min:0,max:1,grid:{color:'#edf0ee'}}}}});
  }catch(e){app.innerHTML=`<div class="empty-state">Unable to load live Shot Context data. ${e.message||e}</div>`}
}

async function renderConsistency(){
  const app=document.getElementById('app');app.innerHTML='<div class="extra-loading">Loading live consistency data…</div>';destroy();
  try{
    const {games}=await loadData(),sel=selected(),g=games.filter(x=>x.goalie===sel.goalie&&x.season===sel.season);if(!g.length){app.innerHTML='<div class="empty-state">No games logged for this goalie and season.</div>';return}
    const avgSv=mean(g.map(x=>x.svp)),sdSv=sd(g.map(x=>x.svp)),avgGaa=mean(g.map(x=>x.gaa)),sdGaa=sd(g.map(x=>x.gaa)),avgGsax=mean(g.map(x=>x.gsax)),sdGsax=sd(g.map(x=>x.gsax));
    const above=g.filter(x=>x.svp>avgSv).length,below=g.filter(x=>x.svp<avgSv).length,better=g.filter(x=>x.gaa<avgGaa).length,worse=g.filter(x=>x.gaa>avgGaa).length,withinSv=g.filter(x=>Math.abs(x.svp-avgSv)<=sdSv).length,withinGaa=g.filter(x=>Math.abs(x.gaa-avgGaa)<=sdGaa).length,pos=g.filter(x=>x.gsax>0).length,neg=g.filter(x=>x.gsax<0).length;
    app.innerHTML=`<div class="page-head"><div><div class="kicker">${sel.season}</div><h2>Consistency</h2><p>Game-to-game spread around this goalie's own season average.</p></div></div><div class="context-note">Standard deviation measures game-to-game spread. A smaller number means results are clustered more tightly around the goalie's average.</div>
    <div class="metric-grid">${metric('Avg Game SV%',fmtPct(avgSv),`${above} above · ${below} below average`)}${metric('SV% Standard Dev.',fixed(sdSv*100,1)+' pts',`${withinSv}/${g.length} within 1 SD`)}${metric('Avg Game GAA',fixed(avgGaa,2),`${better} better · ${worse} worse`)}${metric('GAA Standard Dev.',fixed(sdGaa,2),`${withinGaa}/${g.length} within 1 SD`)}${metric('Avg GSAx / Game',signed(avgGsax,2),`${pos} positive · ${neg} negative`)}${metric('GSAx Standard Dev.',fixed(sdGsax,2),'game-to-game spread')}</div>
    <div class="grid-2"><section class="panel"><h3 class="section-title">SV% vs Personal Average</h3><div class="chart-wrap"><canvas id="consSv"></canvas></div></section><section class="panel"><h3 class="section-title">GAA vs Personal Average</h3><div class="chart-wrap"><canvas id="consGaa"></canvas></div></section></div>
    <section class="panel"><h3 class="section-title">Game-by-Game Consistency</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Date</th><th>Opponent</th><th>SV%</th><th>vs Avg</th><th>SV% z</th><th>GAA</th><th>vs Avg</th><th>GAA z</th><th>GSAx</th></tr></thead><tbody>${g.map(x=>`<tr><td>${x.game}</td><td>${dateLabel(x.date)}</td><td>${x.opponent}</td><td>${fmtPct(x.svp)}</td><td>${signed(x.svp-avgSv,3)}</td><td>${fixed(sdSv?(x.svp-avgSv)/sdSv:0,2)}</td><td>${fixed(x.gaa,2)}</td><td>${signed(x.gaa-avgGaa,2)}</td><td>${fixed(sdGaa?(x.gaa-avgGaa)/sdGaa:0,2)}</td><td>${signed(x.gsax,2)}</td></tr>`).join('')}</tbody></table></div></section>`;
    const c=getComputedStyle(document.documentElement),green=c.getPropertyValue('--green').trim(),gold=c.getPropertyValue('--gold').trim(),labels=g.map(x=>'G'+x.game);
    chart('consSv',{type:'line',data:{labels,datasets:[{label:'Game SV%',data:g.map(x=>x.svp),borderColor:green,backgroundColor:green,pointRadius:5},{label:'Average',data:g.map(()=>avgSv),borderColor:gold,borderDash:[6,5],pointRadius:0},{label:'+1 SD',data:g.map(()=>avgSv+sdSv),borderColor:'#98a69f',borderDash:[3,4],pointRadius:0},{label:'-1 SD',data:g.map(()=>avgSv-sdSv),borderColor:'#98a69f',borderDash:[3,4],pointRadius:0}]},options:opts('Save Percentage')});
    chart('consGaa',{type:'line',data:{labels,datasets:[{label:'Game GAA',data:g.map(x=>x.gaa),borderColor:green,backgroundColor:green,pointRadius:5},{label:'Average',data:g.map(()=>avgGaa),borderColor:gold,borderDash:[6,5],pointRadius:0},{label:'+1 SD',data:g.map(()=>avgGaa+sdGaa),borderColor:'#98a69f',borderDash:[3,4],pointRadius:0},{label:'-1 SD',data:g.map(()=>Math.max(0,avgGaa-sdGaa)),borderColor:'#98a69f',borderDash:[3,4],pointRadius:0}]},options:opts('GAA')});
  }catch(e){app.innerHTML=`<div class="empty-state">Unable to load live consistency data. ${e.message||e}</div>`}
}

function renderExtra(){const r=location.hash.replace('#','');if(r==='context')renderContext();else if(r==='consistency')renderConsistency();else destroy()}
window.addEventListener('goalie-extra-route',renderExtra);window.addEventListener('hashchange',()=>{if(!['context','consistency'].includes(location.hash.replace('#','')))destroy()});
setTimeout(renderExtra,0);
})();