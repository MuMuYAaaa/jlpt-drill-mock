import test from 'node:test';
import assert from 'node:assert/strict';
import {StudyEngine,validateBank} from '../lib/engine.mjs';
import {listeningPosition,validateAudioPlan} from '../lib/exam-timeline.mjs';
import {createApp} from '../server.mjs';

function plan({firstGap=5000,lastGap=35000}={}) {
  return {version:1,completionPolicy:'audio_end',items:[
    {audioId:'shared',src:'/media/shared',questionIds:['l1','l2'],durationMs:1000,gapAfterMs:firstGap},
    {audioId:'last',src:'/media/last',questionIds:['l3'],durationMs:2000,gapAfterMs:lastGap}
  ],totalDurationMs:3000+firstGap+lastGap};
}
function fixture(options={}) {
  const audioPlan=plan(options);
  const questions=[['v1','reading',101],['l1','listen',405],['l2','listen',405],['l3','listen',401]].map(([id,sectionId,type],i)=>({
    id,paperId:'p',level:'N2',sectionId,sectionTitle:sectionId==='listen'?'听力':'语言知识与阅读',order:i,number:String(i+1),type,stem:'题目 '+id,
    options:[{id:'1',text:'一'},{id:'2',text:'二'}],answer:'1',explanation:'仅交卷后可见',...(sectionId==='listen'?{audio:'/media/'+(id==='l3'?'last':'shared')}:{})
  }));
  return {papers:[{id:'p',title:'测试卷',level:'N2',sections:[
    {id:'reading',title:'语言知识与阅读',durationSeconds:120},
    {id:'listen',title:'听力',durationSeconds:3600,restBeforeSeconds:600,audioPlan}
  ]}],questions};
}
function setup(options={}) {
  let now=1000000;
  const engine=new StudyEngine({bank:fixture(options),now:()=>now});
  const session=engine.createSession({mode:'exam',level:'N2',paperId:'p'});
  return {engine,id:session.id,now:()=>now,advance:ms=>{now+=ms;}};
}

test('原计划间隔和共享音轨：音轨只播一次，间隔边界无重播，末尾答题时间结束才完成',()=>{
  const p=validateAudioPlan(plan());
  assert.equal(p.totalDurationMs,43000);
  assert.deepEqual(listeningPosition(p,500).questionIds,['l1','l2']);
  assert.equal(listeningPosition(p,500).itemOffsetMs,500);
  assert.equal(listeningPosition(p,1000).phase,'gap');
  assert.equal(listeningPosition(p,1000).gapRemainingMs,5000);
  assert.equal(listeningPosition(p,5999).itemIndex,0);
  assert.equal(listeningPosition(p,6000).itemIndex,1);
  assert.equal(listeningPosition(p,6000).itemOffsetMs,0);
  assert.equal(listeningPosition(p,8000).phase,'gap');
  assert.equal(listeningPosition(p,8000).gapRemainingMs,35000);
  assert.equal(listeningPosition(p,42999).phase,'gap');
  assert.equal(listeningPosition(p,43000).phase,'complete');
  const noInterTrackGap=plan({firstGap:0,lastGap:30000});
  assert.equal(listeningPosition(noInterTrackGap,1000).audio,'/media/last');
  assert.equal(listeningPosition(noInterTrackGap,32999).phase,'gap');
  assert.equal(listeningPosition(noInterTrackGap,33000).phase,'complete');
});

test('交前科后进入10分钟休息，不能答题；立即开始及重复请求不重置计时',()=>{
  const {engine:e,id,advance,now}=setup();
  advance(10000);
  const rest=e.nextSection(id);
  assert.equal(rest.phase,'break');assert.equal(rest.breakDeadline,now()+600000);
  assert.equal(rest.listening,null);assert.equal(rest.sectionDeadline,rest.breakDeadline);
  assert.throws(()=>e.answer(id,{questionId:'l1',optionId:'1'}),/休息中不能作答/);
  assert.throws(()=>e.checkpoint(id,{currentIndex:2}),/休息中不能切换/);
  assert.throws(()=>e.pauseListening(id),/没有正在播放/);
  advance(1000);
  const started=e.startListening(id),start=now();
  assert.equal(started.phase,'section');assert.equal(started.breakDeadline,undefined);
  assert.equal(started.listening.startedAt,start);assert.equal(started.listening.elapsedMs,0);
  assert.equal(started.deadline,start+43000);
  advance(700);
  const again=e.startListening(id);
  assert.equal(again.listening.startedAt,start);assert.equal(again.listening.elapsedMs,700);
  assert.equal(again.deadline,start+43000);
  assert.ok(again.questions.every(q=>!Object.hasOwn(q,'answer')&&!Object.hasOwn(q,'explanation')));
  assert.deepEqual(again.feedback,{});
});

test('自然休息结束和关闭页面后跨多段追赶，按音频+末尾间隔自动交卷，不等名义时限',()=>{
  const {engine:e,id,advance}=setup();
  e.answer(id,{questionId:'v1',optionId:'1'});
  advance(120000+600000+500);
  let s=e.getSession(id);
  assert.equal(s.activeSectionIndex,1);assert.equal(s.phase,'section');
  assert.equal(s.listening.startedAt,1720000);assert.equal(s.listening.elapsedMs,500);
  assert.equal(s.listening.phase,'audio');
  e.answer(id,{questionId:'l1',optionId:'2'});
  advance(42499);s=e.getSession(id);
  assert.equal(s.status,'active');assert.equal(s.listening.phase,'gap');
  advance(1);s=e.getSession(id);
  assert.equal(s.status,'finished');assert.equal(s.result.correct,1);
  assert.equal(s.result.wrong,1);assert.equal(s.result.unanswered,2);
  assert.equal(e.findSession(id).finishedAt,1763000);
  assert.equal(e.state.events.length,2);
  e.getSession(id);e.finish(id);assert.equal(e.state.events.length,2);
});

test('答题、手动切题、标记、刷新与备份恢复都不改变正在播的音轨',()=>{
  const {engine:e,id,advance,now}=setup();e.nextSection(id);e.startListening(id);advance(300);
  const before=e.getSession(id).listening;
  e.checkpoint(id,{currentIndex:3,flags:['l2']});e.answer(id,{questionId:'l3',optionId:'1'});
  assert.deepEqual(e.getSession(id).listening,before);
  const restarted=new StudyEngine({bank:fixture(),now});restarted.restore(e.exportState());
  assert.equal(restarted.getSession(id).currentIndex,3);assert.deepEqual(restarted.getSession(id).listening,before);
  advance(6000);
  const resumed=restarted.getSession(id);
  assert.equal(resumed.currentIndex,3);assert.equal(resumed.listening.itemIndex,1);assert.equal(resumed.listening.itemOffsetMs,300);
});

test('播放失败/退出暂停冻结时间线，重复暂停或继续幂等，恢复不重播或跳过',()=>{
  const {engine:e,id,advance,now}=setup();e.nextSection(id);e.startListening(id);advance(1500);
  const paused=e.pauseListening(id),pauseAt=now();
  assert.equal(paused.listening.phase,'gap');assert.equal(paused.listening.elapsedMs,1500);
  assert.equal(paused.listening.paused,true);assert.equal(paused.listening.pausedAt,pauseAt);
  assert.throws(()=>e.answer(id,{questionId:'l1',optionId:'1'}),/听力已暂停/);
  assert.throws(()=>e.nextSection(id),/听力已暂停/);
  advance(3600000);
  const repeated=e.pauseListening(id);assert.equal(repeated.listening.elapsedMs,1500);assert.equal(repeated.listening.pausedAt,pauseAt);
  const restart=new StudyEngine({bank:fixture(),now});restart.restore(e.exportState());
  assert.equal(restart.getSession(id).status,'active');assert.equal(restart.getSession(id).listening.elapsedMs,1500);
  const resumed=restart.resumeListening(id),deadline=resumed.deadline,start=resumed.listening.startedAt;
  assert.equal(resumed.listening.paused,false);assert.equal(resumed.listening.pausedAt,null);
  assert.equal(resumed.listening.elapsedMs,1500);assert.equal(deadline-now(),41500);
  advance(100);const duplicate=restart.resumeListening(id);
  assert.equal(duplicate.deadline,deadline);assert.equal(duplicate.listening.startedAt,start);assert.equal(duplicate.listening.elapsedMs,1600);
  restart.answer(id,{questionId:'l1',optionId:'1'});
  advance(41400);assert.equal(restart.getSession(id).status,'finished');
});

test('无播放计划的既有试卷与旧会话仍使用旧科目时限',()=>{
  let now=1000000;const bank=fixture();delete bank.papers[0].sections[1].audioPlan;
  const e=new StudyEngine({bank,now:()=>now}),s=e.createSession({mode:'exam',paperId:'p',level:'N2'});
  const backup=e.exportState();delete backup.sessions[s.id].phase;
  const restored=new StudyEngine({bank,now:()=>now});restored.restore(backup);
  const next=restored.nextSection(s.id);assert.equal(next.listening,null);assert.equal(next.phase,'section');assert.equal(next.deadline,4600000);
  assert.throws(()=>restored.pauseListening(s.id),/没有正在播放/);
  now+=3600000;assert.equal(restored.getSession(s.id).status,'finished');
});

test('错误/漏题/重复题播放计划会在导入前拒绝',()=>{
  const wrongTotal=fixture();wrongTotal.papers[0].sections[1].audioPlan.totalDurationMs++;
  assert.throws(()=>validateBank(wrongTotal),/总时长/);
  const wrongScope=fixture();wrongScope.papers[0].sections[1].audioPlan.items[0].questionIds=['v1'];
  assert.throws(()=>validateBank(wrongScope),/引用了无效题目/);
  const missing=fixture();missing.papers[0].sections[1].audioPlan.items[0].questionIds=['l1'];
  assert.throws(()=>validateBank(missing),/遗漏题目/);
  const repeated=fixture();repeated.papers[0].sections[1].audioPlan.items[1].questionIds.push('l1');
  assert.throws(()=>validateBank(repeated),/重复引用/);
  const empty=plan();empty.items[0].questionIds=[];assert.throws(()=>validateAudioPlan(empty),/无效/);
});

test('HTTP开始/暂停/继续只使用服务器时钟，客户端位置参数不会重置音频',async()=>{
  const {engine:e,id,advance,now}=setup();
  const {server}=createApp({port:0,engine:e});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/api/sessions/${id}`;
  const post=async(action,data={})=>{const r=await fetch(base+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
  try{
    await post('next-section');const start=await post('start-listening',{elapsedMs:99999,startedAt:0});
    assert.equal(start.status,200);assert.equal(start.data.listening.startedAt,now());assert.equal(start.data.listening.elapsedMs,0);
    advance(200);assert.equal((await post('pause-listening')).data.listening.elapsedMs,200);
    advance(20000);const resumed=await post('resume-listening',{elapsedMs:99999,startedAt:0});
    assert.equal(resumed.status,200);assert.equal(resumed.data.listening.elapsedMs,200);assert.equal(resumed.data.listening.paused,false);
    assert.equal(resumed.data.questions[0].answer,undefined);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
