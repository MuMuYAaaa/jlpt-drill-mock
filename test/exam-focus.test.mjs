import test from 'node:test';
import assert from 'node:assert/strict';
import {StudyEngine} from '../lib/engine.mjs';
import {createApp} from '../server.mjs';

function setup() {
  let now = 1000000;
  const bank = {papers:[{id:'p',level:'N2',title:'全屏验收',sections:[
    {id:'r',title:'阅读',durationSeconds:120},
    {id:'l',title:'听力',durationSeconds:60,restBeforeSeconds:600,audioPlan:{version:1,completionPolicy:'audio_end',items:[{audioId:'a',src:'/media/a',questionIds:['l'],durationMs:30000,gapAfterMs:5000}],totalDurationMs:35000}}
  ]}],questions:['r','l'].map((id,i)=>({id,paperId:'p',level:'N2',sectionId:id,type:i?401:301,stem:'验收题',options:[{id:'1',text:'一'},{id:'2',text:'二'}],answer:'1'}))};
  const engine = new StudyEngine({bank,now:()=>now});
  const {id} = engine.createSession({mode:'exam',level:'N2',paperId:'p'});
  return {engine,id,advance:ms=>{now+=ms;}};
}

test('阅读切屏冻结计时、拒绝作答和切科，重复通知不延长暂停起点，恢复延后同等时间',()=>{
  const {engine:e,id,advance}=setup();advance(17000);
  const before=e.getSession(id);const paused=e.pauseExamFocus(id,{reason:'blur'});
  assert.equal(paused.focus.remainingMs,103000);assert.equal(paused.focus.interruptions,1);
  advance(200000);e.pauseExamFocus(id,{reason:'hidden'});
  assert.equal(e.getSession(id).focus.remainingMs,103000);assert.equal(e.getSession(id).activeSectionIndex,0);
  assert.throws(()=>e.answer(id,{questionId:'r',optionId:'1'}),/全屏/);
  assert.throws(()=>e.nextSection(id),/全屏/);
  assert.equal(e.getSession(id).focus.interruptions,1);
  const resumed=e.resumeExamFocus(id);assert.equal(resumed.focus.paused,false);assert.equal(resumed.sectionDeadline,before.sectionDeadline+200000);
  e.answer(id,{questionId:'r',optionId:'1'});advance(3000);assert.equal(e.getSession(id).focus.remainingMs,100000);
});

test('休息切屏冻结十分钟倒计时；恢复后不会提前进入听力',()=>{
  const {engine:e,id,advance}=setup();e.nextSection(id);advance(10000);
  const before=e.getSession(id);e.pauseExamFocus(id,{reason:'fullscreen'});advance(700000);
  assert.equal(e.getSession(id).phase,'break');assert.equal(e.getSession(id).focus.remainingMs,590000);
  assert.throws(()=>e.startListening(id),/全屏/);
  const resumed=e.resumeExamFocus(id);assert.equal(resumed.breakDeadline,before.breakDeadline+700000);
  assert.equal(resumed.phase,'break');advance(590000);assert.equal(e.getSession(id).listening.elapsedMs,0);
});

test('听力切屏冻结录音位置，往返保持同一段与偏移，提前交卷清理暂停状态',()=>{
  const {engine:e,id,advance}=setup();e.nextSection(id);e.startListening(id);advance(3200);
  const before=e.getSession(id);e.pauseExamFocus(id,{reason:'navigation'});advance(180000);
  const frozen=e.getSession(id);assert.equal(frozen.listening.elapsedMs,3200);assert.equal(frozen.listening.paused,true);
  assert.throws(()=>e.resumeListening(id),/全屏/);
  const resumed=e.resumeExamFocus(id);assert.equal(resumed.listening.elapsedMs,3200);assert.equal(resumed.listening.paused,false);
  assert.equal(resumed.listening.startedAt,before.listening.startedAt+180000);
  advance(800);e.pauseExamFocus(id,{reason:'refresh'});advance(60000);
  e.finish(id);assert.equal(e.getSession(id).status,'finished');assert.equal(e.findSession(id).focusPausedAt,undefined);
  assert.equal(e.findSession(id).listeningPausedAt,undefined);assert.equal(e.getSession(id).listening.elapsedMs,4000);
});

test('音频故障的独立暂停不会被恢复全屏误解除；备份保存暂停记录',()=>{
  const {engine:e,id,advance}=setup();e.nextSection(id);e.startListening(id);advance(2000);e.pauseListening(id);
  advance(500);e.pauseExamFocus(id,{reason:'blur'});advance(20000);
  e.validateState(e.state);
  const resumed=e.resumeExamFocus(id);assert.equal(resumed.listening.paused,true);assert.equal(resumed.listening.elapsedMs,2000);
  e.resumeListening(id);assert.equal(e.getSession(id).listening.elapsedMs,2000);
  assert.throws(()=>e.pauseExamFocus(id,null),/格式/);assert.throws(()=>e.pauseExamFocus(id,{reason:'other'}),/原因/);
});

test('全屏暂停与恢复 HTTP 接口可用，跨站请求不能修改考试',async()=>{
  const {engine,id}=setup();const {server}=createApp({root:process.cwd(),port:0,engine});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const url=base+`/api/sessions/${id}`;
    const post=(action,body,origin=base)=>fetch(url+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
    const blocked=await post('pause-focus',{reason:'hidden'},'https://other.invalid');assert.equal(blocked.status,403);
    const p=await post('pause-focus',{reason:'hidden'});assert.equal(p.status,200);assert.equal((await p.json()).focus.paused,true);
    const r=await post('resume-focus',{});assert.equal(r.status,200);assert.equal((await r.json()).focus.paused,false);
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
});
