// Open dialog-audit.html through localhost in a real browser. No mock layout engine.
const frame=document.querySelector('#game'),output=document.querySelector('#result');
const results=[];
const run=source=>frame.contentWindow.eval(source);
const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const check=(ok,message)=>{if(!ok)throw new Error(message)};
async function reset(){
  run("if(typeof dialogTasks!=='undefined')dialogTasks.length=0;document.querySelectorAll('dialog[open]').forEach(d=>d.close());choiceHandlers=null;currentRoadEvent=null;S=fresh();refreshContracts();save=()=>{};showGame();setSpeed(0)");
  await settle();
}
function escort(){run("openDispatch(S.contracts[0].id);startEscort();setSpeed(0)")}
function inspect(id){
  const w=frame.contentWindow,d=w.document.getElementById(id),body=d.querySelector('.dbody'),r=d.getBoundingClientRect(),b=body.getBoundingClientRect();
  check(d.open,`${id}: 未打开`);
  check(r.top>=-1&&r.bottom<=w.innerHeight+1&&r.left>=-1&&r.right<=w.innerWidth+1,`${id}: 超出视口 ${JSON.stringify(r)}`);
  const fixed=[...d.children].filter(e=>e!==body).reduce((sum,e)=>sum+e.getBoundingClientRect().height,2);
  check(r.height<=fixed+b.height+3,`${id}: 短内容弹窗存在多余空白`);
  const style=w.getComputedStyle(w.document.documentElement),safeTop=parseFloat(style.getPropertyValue('--safe-top'))||0,safeBottom=parseFloat(style.getPropertyValue('--safe-bottom'))||0,safeLeft=parseFloat(style.getPropertyValue('--safe-left'))||0,safeRight=parseFloat(style.getPropertyValue('--safe-right'))||0;
  check(r.top>=safeTop-1&&r.bottom<=w.innerHeight-safeBottom+1,`${id}: 侵入上下安全区`);
  check(r.left>=safeLeft-1&&r.right<=w.innerWidth-safeRight+1,`${id}: 侵入左右安全区`);
  const available=Math.min(w.innerHeight*.89,w.innerHeight-24-safeTop-safeBottom)-fixed;
  check(b.height>=Math.min(body.scrollHeight,available)-3,`${id}: 正文被压缩到 ${b.height}px，可用 ${available}px，内容 ${body.scrollHeight}px`);
  check(body.scrollWidth<=body.clientWidth+1,`${id}: 正文横向溢出 ${body.scrollWidth}/${body.clientWidth}`);
  check(d.scrollWidth<=d.clientWidth+1,`${id}: 弹窗横向溢出`);
  check(body.scrollTop<=1,`${id}: 打开时正文未从顶部展示`);
  const foot=d.querySelector('.dfoot');
  if(foot)check(foot.getBoundingClientRect().bottom<=r.bottom+1,`${id}: 页脚被裁切`);
  const last=body.lastElementChild;
  if(last){last.scrollIntoView({block:'end'});const end=last.getBoundingClientRect();check(end.bottom<=body.getBoundingClientRect().bottom+1,`${id}: 最后一项不可达`)}
  return {height:Math.round(r.height),body:Math.round(b.height),scroll:body.scrollHeight>body.clientHeight+1};
}
async function execute(label,action,id){
  try{await reset();action();await settle();const metrics=inspect(id);results.push({label,pass:true,...metrics})}
  catch(e){results.push({label,pass:false,error:e.message})}
}
const profiles=[
  [320,480],[320,568],[360,640],[393,600],[393,852],[430,932],[667,375],[844,390],[760,800],[761,800],[768,1024],[1101,800],[1241,800],[1280,800],
  [393,852,{top:59,bottom:34,left:0,right:0}],[844,390,{top:0,bottom:21,left:44,right:44}],[393,852,null,24]
];
async function audit(){
  document.querySelector('#run').disabled=true;results.length=0;
  for(const [width,height,safe,font] of profiles){
    frame.width=width;frame.height=height;await settle();
    for(const side of ['top','right','bottom','left'])frame.contentDocument.documentElement.style.setProperty('--safe-'+side,(safe?.[side]||0)+'px');
    frame.contentDocument.body.style.fontSize=(font||16)+'px';
    const prefix=`${width}×${height}${safe?' safe-area':''}${font?' large-text':''}`;
    const ids=run('roadEvents.map(e=>e.id)');
    for(const id of ids)await execute(`${prefix} road:${id}`,()=>{escort();run(`presentRoadEvent(roadEvents.find(e=>e.id===${JSON.stringify(id)}))`)},'eventDialog');
    await execute(`${prefix} nemesis`,()=>{escort();run("spawnNemesis('near','');presentRoadEvent(nemesisEvent(S.nemeses[0]))")},'eventDialog');
    for(const method of ['poachAttempt(S.rivals[0])','gymChallenge(S.rivals[0])','yearMeeting()'])await execute(`${prefix} ${method}`,()=>run(method),'eventDialog');
    await execute(`${prefix} help`,()=>run("openDialog('helpDialog')"),'helpDialog');
    await execute(`${prefix} dispatch`,()=>run('openDispatch(S.contracts[0].id)'),'dispatchDialog');
    await execute(`${prefix} person`,()=>run('openPerson(1)'),'personDialog');
    await execute(`${prefix} report`,()=>{escort();run('resolveEscort()')},'reportDialog');
    await execute(`${prefix} long text`,()=>run("presentChoice('长标题与长正文的显示检查'.repeat(3),'长篇剧情。'.repeat(240),[{label:'最后一个选项',small:'确认可以滚动到这里',fn:()=>{}}])"),'eventDialog');
    for(const page of ['home','contracts','staff','jianghu','strategy']){
      try{await reset();run(`spawnNemesis('near','');showPage('${page}')`);await settle();const d=frame.contentDocument.documentElement;check(d.scrollWidth<=d.clientWidth+1,`页面横向溢出 ${d.scrollWidth}/${d.clientWidth}`);results.push({label:`${prefix} page:${page}`,pass:true})}
      catch(e){results.push({label:`${prefix} page:${page}`,pass:false,error:e.message})}
    }
    output.textContent=`已完成 ${results.length} 项，失败 ${results.filter(r=>!r.pass).length} 项…`;
  }
  frame.contentDocument.body.style.fontSize='16px';
  for(const side of ['top','right','bottom','left'])frame.contentDocument.documentElement.style.setProperty('--safe-'+side,'0px');
  // Reopening must reset scroll, including when the same element is reused.
  await execute('reopen resets scroll',()=>{run("openDialog('helpDialog');$('helpDialog').querySelector('.dbody').scrollTop=9999;closeDialog('helpDialog');openDialog('helpDialog')")},'helpDialog');
  async function behavior(label,fn){try{await reset();await fn();results.push({label,pass:true})}catch(e){results.push({label,pass:false,error:e.message})}}
  await behavior('cancel cannot dismiss unanswered event',async()=>{escort();run("presentRoadEvent(roadEvents.find(e=>e.id==='fog-fork'))");check(run("!$('eventDialog').dispatchEvent(new Event('cancel',{cancelable:true}))"),'cancel 未被阻止');check(run("!!S.pendingEvent&&$('eventDialog').open"),'决策丢失')});
  await behavior('queued choices preserve handlers and order',async()=>{
    run("window.resolved=[];presentChoice('第一件事','第一段正文',[{label:'一',fn:()=>window.resolved.push(1)}]);presentChoice('第二件事','第二段正文',[{label:'二',fn:()=>window.resolved.push(2)}])");
    check(run("$('eventTitle').textContent==='第一件事'"),'未答复的弹窗被覆盖');run("$('eventBody').querySelector('button').click()");await settle();
    check(run("$('eventTitle').textContent==='第二件事'&&$('eventDialog').open"),'后续弹窗没有展示');run("$('eventBody').querySelector('button').click()");await settle();check(run("JSON.stringify(window.resolved)==='[1,2]'"),'处理函数被覆盖');
  });
  await behavior('road event waits behind rival choice',async()=>{
    escort();run("presentChoice('同行先到','同行事件',[{label:'应答',fn:()=>{}}]);presentRoadEvent(roadEvents.find(e=>e.id==='fog-fork'))");
    check(run("$('eventTitle').textContent==='同行先到'"),'同行事件被路遇覆盖');run("$('eventBody').querySelector('button').click()");await settle();check(run("$('eventTitle').textContent==='晨雾吞没三岔口'"),'路遇未接续');run("$('eventBody').querySelector('button:last-child').click()");check(run('S.pendingEvent===null&&S.escort.eventLog.length===1'),'末项选择未结算');
  });
  await behavior('queued road event survives save restoration',async()=>{
    escort();run("presentChoice('同行先到','同行事件',[{label:'应答',fn:()=>{}}]);presentRoadEvent(roadEvents.find(e=>e.id==='fog-fork'))");check(run("S.pendingEvent?.eventId==='fog-fork'"),'排队中的路遇未进入存档');
    run("dialogTasks.length=0;document.querySelectorAll('dialog[open]').forEach(d=>d.close());S=normalizeState(JSON.parse(JSON.stringify(S)));currentRoadEvent=null;showGame()");await settle();check(run("$('eventDialog').open&&$('eventTitle').textContent==='晨雾吞没三岔口'"),'恢复存档后路遇未重新展示');
  });
  await behavior('manual pause survives a decision',async()=>{run("setSpeed(0);gymChallenge(S.rivals[0]);resolveChoice(1)");check(run('speed===0'),'手动暂停被恢复为自动推进')});
  await behavior('insufficient funds notice stays above modal backdrop',async()=>{
    escort();run("spawnNemesis('near','');presentRoadEvent(nemesisEvent(S.nemeses[0]));S.money=0;resolveRoad(1)");await settle();
    check(run("$('eventDialog').contains($('toast'))&&$('toast').classList.contains('show')"),'提示被原生弹窗遮挡');
    const notice=frame.contentDocument.querySelector('#toast').getBoundingClientRect(),dialog=frame.contentDocument.querySelector('#eventDialog').getBoundingClientRect();check(notice.height>0&&notice.top>=dialog.top&&notice.bottom<=dialog.bottom,'提示超出弹窗可见区域');
  });
  await behavior('last choice reachable after resize',async()=>{frame.width=393;frame.height=852;escort();run("presentRoadEvent(roadEvents.find(e=>e.id==='fog-fork'))");frame.width=667;frame.height=320;await settle();inspect('eventDialog');run("$('eventBody').querySelector('button:last-child').click()");check(run('S.pendingEvent===null&&S.escort.eventLog.length===1'),'旋转屏幕后末项不可操作')});
  output.textContent=JSON.stringify({total:results.length,failed:results.filter(r=>!r.pass),passed:results.filter(r=>r.pass).length},null,2);
  window.auditResults=results;document.querySelector('#run').disabled=false;
}
async function preview(){frame.width=393;frame.height=852;await reset();escort();run("presentRoadEvent(roadEvents.find(e=>e.id==='fog-fork'))");await settle();output.textContent='393×852 · 晨雾吞没三岔口';}
frame.addEventListener('load',()=>{run('save=()=>{}');output.textContent='就绪。点击运行全部检查。'},{once:true});
frame.src='../index.html?dialog-audit='+Date.now();
document.querySelector('#run').onclick=audit;document.querySelector('#preview').onclick=preview;
