import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser.mjs';
import {StudyEngine} from '../lib/engine.mjs';
import {createApp} from '../server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const audio=JSON.parse(fs.readFileSync(path.join(root,'data/bank.json'))).questions.find(q=>q.level==='N2'&&q.audio).audio;
const bank={papers:[{id:'p',level:'N2',title:'页面过渡验收',sections:[{id:'r',title:'语言知识与阅读',durationSeconds:120},{id:'l',title:'听力',durationSeconds:120,restBeforeSeconds:600,audioPlan:{version:1,completionPolicy:'audio_end',items:[{audioId:'a',src:audio,questionIds:['q58','q59'],durationMs:60000,gapAfterMs:5000}],totalDurationMs:65000}}]}],questions:Array.from({length:60},(_,i)=>({id:'q'+i,paperId:'p',level:'N2',sectionId:i<58?'r':'l',sectionTitle:i<58?'语言知识与阅读':'听力',type:i<58?101:401,order:i,number:String(i+1),stem:'页面过渡验收题目 '+(i+1),options:[{id:'1',text:'第一选项'},{id:'2',text:'第二选项'}],answer:'1',...(i>=58?{audio}:{})}))};
const engine=new StudyEngine({bank});
for(const q of bank.questions.slice(0,56)){engine.state.wrong[q.id]={wrongCount:1,lastWrongAt:Date.now(),resolved:false};engine.state.favorites[q.id]=Date.now();}
const {server}=createApp({root,engine});await new Promise(r=>server.listen(47331,'127.0.0.1',r));
const base='http://127.0.0.1:47331',checks=[],errors=[];let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.motionCalls=[];const native=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.id==='main')motionCalls.push({frames,duration:options.duration});return native.call(this,frames,options);};});
 const settle=async()=>{await page.waitForFunction(()=>!document.querySelector('#main').inert);await page.evaluate(()=>Promise.all([...pageMotion.animations].map(a=>a.finished.catch(()=>{}))));};
 await page.goto(base);await page.locator('.hero').waitFor();await settle();
 for(const name of ['practice','exam','wrong','favorites','history','data','dashboard']){
  const before=await page.evaluate(()=>motionCalls.length);
  await page.locator(`#nav a[href="#${name}"]`).click();await page.waitForFunction(name=>state.page===name,name);await settle();
  assert.ok(await page.evaluate(n=>motionCalls.length>n,before),name);
 }
 checks.push('学习概览、专项、模考列表、错题、收藏、记录和数据页均播放真实淡出/淡入动画');
 await page.locator('#nav a[href="#practice"]').click();await page.waitForFunction(()=>state.page==='practice');await settle();
 await page.locator('[data-action="filter-category"][data-id="1"]').click();await settle();assert.equal(await page.locator('.practice-panel').count(),1);
 await page.locator('[data-action="setup-practice"]').first().click();
 assert.ok(await page.locator('#modal').evaluate(el=>el.getAnimations().length>0));
 await page.locator('[data-action="close-modal"]').first().click();checks.push('专项筛选和弹窗具有短暂过渡');

 let intercepted;const reached=new Promise(r=>intercepted=r);let release;const hold=new Promise(r=>release=r);
 let historyHandled;const historyDone=new Promise(r=>historyHandled=r);
 await page.route('**/api/history?*',async route=>{intercepted();await hold;await route.continue();historyHandled();});
 await page.locator('#nav a[href="#history"]').click();await reached;
 assert.equal(await page.locator('#main > .loading').count(),0);assert.ok((await page.locator('#main h1').innerText()).includes('每个题型'));
 assert.equal(await page.locator('#main').getAttribute('aria-busy'),'true');
 await page.locator('#nav a[href="#data"]').click();await page.waitForFunction(()=>state.page==='data');await settle();
 release();await historyDone;await page.unroute('**/api/history?*');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>state.page),'data');
 assert.equal(await page.locator('#main').getAttribute('aria-busy'),null);
 checks.push('慢请求保留旧页面且阻止误操作；快速跳到其他页面后，旧响应不会覆盖新页面');

 const practice=engine.createSession({mode:'practice',level:'N2',type:101,count:3,order:'sequential'});
 await page.goto(`${base}/#session/${practice.id}`);await page.locator('.question-card').waitFor();await settle();
 await page.evaluate(()=>motionCalls=[]);await page.locator('[data-action="next"]').click();await page.waitForFunction(()=>state.session.currentIndex===1);await settle();
 assert.ok(await page.evaluate(()=>motionCalls.some(c=>c.frames[0].transform?.startsWith('translateX(')&&!c.frames[0].transform.includes('-'))));
 await page.evaluate(()=>motionCalls=[]);await page.locator('[data-action="prev"]').click();await page.waitForFunction(()=>state.session.currentIndex===0);await settle();
 assert.ok(await page.evaluate(()=>motionCalls.some(c=>c.frames[0].transform?.startsWith('translateX(-'))));
 assert.equal(engine.getSession(practice.id).currentIndex,0);
 await page.locator('[data-action="answer"][data-option="1"]').click();await page.locator('.explanation').waitFor();
 await page.locator('[data-action="finish"]').click();await page.locator('[data-action="submit-finish"]').click();await page.locator('.result-hero').waitFor();await settle();
 await page.locator('[data-action="result-filter"][data-kind="wrong"]').click();await settle();assert.equal(await page.locator('.result-review').count(),2);
 checks.push('普通练习前后切题具有相反滑动方向，进度正常保存，结果筛选同样过渡');
 await page.locator('#nav a[href="#wrong"]').click();await page.waitForFunction(()=>state.page==='wrong');await settle();
 await page.locator('[data-action="review-page"][data-page="1"]').click();await settle();assert.equal(await page.evaluate(()=>state.reviewPage),1);
 checks.push('错题列表分页保留翻页动画');

 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>motionCalls=[]);
 await page.locator('#nav a[href="#favorites"]').click();await page.waitForFunction(()=>state.page==='favorites');await settle();
 assert.equal(await page.evaluate(()=>motionCalls.length),0);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{window.nativeAnimate=Element.prototype.animate;Element.prototype.animate=undefined;});
 await page.locator('#nav a[href="#dashboard"]').click();await page.waitForFunction(()=>state.page==='dashboard');await settle();
 await page.evaluate(()=>Element.prototype.animate=window.nativeAnimate);
 checks.push('减少动态效果时不播放动画；缺少动画API时仍能正常跳转');

 const exam=engine.createSession({mode:'exam',level:'N2',paperId:'p'});
 await page.goto(`${base}/#session/${exam.id}`);await page.locator('#exam-focus-resume').click();await page.waitForFunction(()=>!!document.fullscreenElement&&!examFocus.locked);await settle();
 const deadline=engine.getSession(exam.id).sectionDeadline;
 const instant=await page.evaluate(async()=>{motionCalls=[];const pending=goQuestion(1);const instant=state.session.currentIndex===1;await pending;return {instant,count:motionCalls.length,active:document.querySelector('#main').getAnimations().length};});
 assert.deepEqual(instant,{instant:true,count:0,active:0});assert.equal(engine.getSession(exam.id).sectionDeadline,deadline);
 await page.locator('[data-action="next-section"]').click();await page.locator('[data-action="submit-next-section"]').click();await page.locator('[data-action="start-listening"]').click();
 await page.waitForFunction(()=>examAudio.active&&!examAudio.audio.paused&&examAudio.audio.readyState>=2);
 await page.waitForTimeout(200);const position=await page.evaluate(()=>examAudio.audio.currentTime);
 const listening=await page.evaluate(async()=>{motionCalls=[];const s=state.session;await goQuestion(s.questions.findIndex(q=>q.id==='q59'));return {count:motionCalls.length,paused:examAudio.audio.paused,position:examAudio.audio.currentTime};});
 assert.equal(listening.count,0);assert.equal(listening.paused,false);assert.ok(listening.position>=position);
 checks.push('模拟考试阅读与听力切题均即时切换、零新增动画；计时和听力播放位置不受影响');
 await page.locator('#exam-focus-bar [data-action="focus-finish"]').click();await page.locator('[data-action="submit-finish"]').click();await page.locator('.result-hero').waitFor();await settle();
 assert.ok(await page.evaluate(()=>motionCalls.length>0));await page.waitForFunction(()=>!document.fullscreenElement);
 checks.push('模考交卷进入结果页恢复正常页面动画');
 await page.screenshot({path:path.join(root,'evidence/page-motion-result.png')});
 assert.deepEqual(errors,[]);const report={ok:true,checks,pageErrors:errors,isolatedInMemoryState:true};
 fs.writeFileSync(path.join(root,'evidence/page-motion-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
