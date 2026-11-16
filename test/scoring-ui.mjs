import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from './browser.mjs';
import {StudyEngine} from '../lib/engine.mjs';
import {createApp} from '../server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'evidence'),{recursive:true});
const bank=JSON.parse(fs.readFileSync(path.join(root,'data/bank.json')));
for(const level of ['N1','N3','N4','N5']){
 const id='result-rule-'+level;
 bank.papers.push({id,level,title:level+' 模考计分验收',durationSeconds:60});
 for(const type of [201,203,301,401])bank.questions.push({id:id+'-'+type,paperId:id,level,type,order:type,stem:'模考计分验收',options:[{id:'1',text:'正确选项'},{id:'2',text:'错误选项'}],answer:'1'});
}
const engine=new StudyEngine({bank});
const {server}=createApp({root,port:47329,engine});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(47329,'127.0.0.1',resolve);});
const base='http://127.0.0.1:47329',checks=[],errors=[],paperId='jlpt:N2:2026-07';
const correctTypes=new Set([101,106,201,301,304,401,404]);
function answerSection(s,questions){
 for(const q of questions)engine.answer(s.id,{questionId:q.id,optionId:correctTypes.has(q.type)?q.answer:q.options.find(o=>o.id!==q.answer).id});
}
let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1250}});
 page.on('pageerror',e=>errors.push(e.message));
 const settle=async id=>{
  await page.waitForFunction(id=>state.page==='result'&&state.session?.id===id&&!document.querySelector('#main').inert,id);
  await page.evaluate(()=>Promise.all([...pageMotion.animations].map(a=>a.finished.catch(()=>{}))));
 };
 const show=async id=>{await page.goto(base+'/#result/'+id);await settle(id);};
 const finishPractice=async id=>{
  await page.goto(base+'/#session/'+id);
  await page.waitForFunction(id=>state.page==='session'&&state.session?.id===id&&!document.querySelector('#main').inert,id);
  await page.locator('[data-action="finish"]').click();
  await page.locator('[data-action="submit-finish"]').click();await settle(id);
 };
 async function assertPractice(accuracy){
  assert.equal(await page.locator('[data-result-mode="practice"]').count(),1);
  assert.equal(await page.locator('#page-title').innerText(),'刷题结果');
  assert.equal((await page.locator('.accuracy-ring strong').innerText()).replace(/\s/g,''),accuracy+'%');
  assert.equal(await page.locator('.result-scoring,[data-total-score],[data-score-section],.result-score-weights').count(),0);
  assert.ok(!(await page.locator('#main').innerText()).includes('加权'));
  assert.ok(!(await page.locator('#main').innerText()).includes('参考总分'));
  assert.ok(!(await page.locator('#main').innerText()).includes('/ 60 分'));
 }
 async function assertExam(){
  assert.equal(await page.locator('[data-result-mode="exam"]').count(),1);
  assert.equal(await page.locator('#page-title').innerText(),'模考结果');
  assert.match(await page.locator('[data-total-score]').innerText(),/70\.2\s*\/ 180 分/);
  assert.equal(await page.locator('[data-score-section]').count(),3);
  for(const [part,score,accuracy] of [['language','28.9','43.1%'],['reading','17.1','35.0%'],['listening','24.2','53.3%']]){
   const card=page.locator('[data-score-section="'+part+'"]');
   assert.ok((await card.locator('[data-section-score]').innerText()).includes(score));
   assert.ok((await card.locator('[data-section-accuracy]').innerText()).includes(accuracy));
  }
 }
 const empty=engine.createSession({mode:'practice',level:'N2',type:101,count:20});
 await finishPractice(empty.id);await assertPractice(0);
 assert.match(await page.locator('.result-numbers>div').nth(0).innerText(),/0\s*\/ 20/);
 assert.equal(await page.locator('.result-numbers>div').nth(2).locator('strong').innerText(),'20');
 await page.screenshot({path:path.join(root,'evidence/pc-practice-result-only-accuracy.png')});
 checks.push('复现截图中的20题专项全部未答：仅显示0%正确率与20题未答，不出现分数、公式或模考分项卡片');

 const mixed=engine.createSession({mode:'practice',level:'N2',type:101,count:3,order:'sequential'});
 const qs=engine.findSession(mixed.id).questions;
 engine.answer(mixed.id,{questionId:qs[0].id,optionId:qs[0].answer});
 engine.answer(mixed.id,{questionId:qs[1].id,optionId:qs[1].options.find(o=>o.id!==qs[1].answer).id});
 await finishPractice(mixed.id);await assertPractice(33);
 assert.equal(await page.locator('.result-numbers>div').nth(1).locator('strong').innerText(),'1');
 assert.equal(await page.locator('.result-numbers>div').nth(2).locator('strong').innerText(),'1');
 await page.locator('[data-action="result-filter"][data-kind="wrong"]').click();
 await page.waitForFunction(()=>!document.querySelector('#main').inert);
 await assertPractice(33);assert.equal(await page.locator('.result-review').count(),2);
 checks.push('专项有答对、答错、漏答时正确率及题数正确，筛选错题后仍为刷题结果');

 for(const mode of ['wrong','favorites']){
  if(mode==='favorites')engine.favorite(qs[0].id);
  const s=engine.createSession({mode,level:'N2',type:101,count:1});
  const q=engine.findSession(s.id).questions[0];
  engine.answer(s.id,{questionId:q.id,optionId:q.answer});
  await finishPractice(s.id);await assertPractice(100);
 }
 const comprehensive=engine.createSession({mode:'practice',level:'N2',paperId,count:'all'});
 answerSection(comprehensive,engine.findSession(comprehensive.id).questions);engine.finish(comprehensive.id);
 await show(comprehensive.id);await assertPractice(45);
 assert.equal(engine.getSession(comprehensive.id).result.scoring.score,70.2);
 checks.push('综合练习即使包含整张试卷也不显示模考分数，错题与收藏练习同样只展示正确率');

 const events=structuredClone(engine.state.events);
 engine.restore(engine.exportState());await page.reload();await settle(comprehensive.id);await assertPractice(45);
 assert.deepEqual(engine.state.events,events);
 checks.push('旧刷题记录/备份保留参考分字段时也按刷题显示，刷新不改变原答题或学习统计');

 const exam=engine.createSession({mode:'exam',level:'N2',paperId});
 const s=engine.findSession(exam.id);
 answerSection(s,s.questions.filter(q=>q.type<400));engine.nextSection(s.id);engine.startListening(s.id);
 answerSection(s,s.questions.filter(q=>q.type>=400));
 await page.goto(base+'/#session/'+exam.id);
 await page.locator('#exam-focus-resume').click();
 await page.waitForFunction(()=>!!document.fullscreenElement&&!examFocus.locked);
 await page.locator('#exam-focus-bar [data-action="focus-finish"]').click();
 await page.locator('[data-action="submit-finish"]').click();await settle(exam.id);await assertExam();
 await page.waitForFunction(()=>!document.fullscreenElement);
 await page.screenshot({path:path.join(root,'evidence/pc-exam-result-scores.png')});
 checks.push('真实N2模考全屏交卷后保留70.2/180总分、28.9/17.1/24.2三项分数及各项正确率');

 await page.locator('#theme-button').click();await assertExam();
 await page.setViewportSize({width:390,height:844});await page.locator('.result-score-grid').scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(root,'evidence/pc-exam-result-scores-narrow.png')});
 await page.setViewportSize({width:1440,height:1250});await page.locator('#theme-button').click();
 await page.locator('[data-action="result-filter"][data-kind="wrong"]').click();
 await page.waitForFunction(()=>!document.querySelector('#main').inert);await assertExam();
 assert.equal(await page.locator('.result-review').count(),56);
 checks.push('模考结果在深色、窄屏及错题筛选后仍保留正确分数');

 await show(empty.id);await page.goto(base+'/#history');
 await page.waitForFunction(()=>state.page==='history'&&!document.querySelector('#main').inert);
 await page.locator('a[href="#result/'+empty.id+'"]').click();await settle(empty.id);await assertPractice(0);
 await page.goto(base+'/#history');await page.waitForFunction(()=>state.page==='history'&&!document.querySelector('#main').inert);
 await page.locator('a[href="#result/'+exam.id+'"]').click();await settle(exam.id);await assertExam();
 await page.reload();await settle(exam.id);await assertExam();
 checks.push('从历史记录分别打开刷题和模考，或刷新旧模考记录，都使用对应结果展示');

 for(const level of ['N1','N3','N4','N5']){
  const trial=engine.createSession({mode:'exam',level,paperId:'result-rule-'+level});
  for(const q of engine.findSession(trial.id).questions)engine.answer(trial.id,{questionId:q.id,optionId:q.type===201?'2':'1'});
  engine.finish(trial.id);await show(trial.id);
  assert.ok((await page.locator('[data-total-score]').innerText()).includes(level==='N1'?'160.0':'150.0'));
  await page.locator('.result-score-weights summary').click();
  assert.ok((await page.locator('.result-score-method .tiny-tag').innerText()).includes(level==='N1'?'N1 参考':'N3 参考'));
 }
 checks.push('N1/N3模考使用独立规则，N4/N5继续沿用N3计分');
 assert.deepEqual(errors,[]);
 const report={ok:true,checks,pageErrors:errors,isolatedInMemoryState:true};
 fs.writeFileSync(path.join(root,'evidence/scoring-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{
 if(browser)await browser.close();
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
