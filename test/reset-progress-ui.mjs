import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './browser.mjs';
import {fileURLToPath} from 'node:url';
import {StudyEngine} from '../lib/engine.mjs';
import {createApp} from '../server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture={papers:['N2','N3'].map(level=>({id:level,title:level+' 验收卷',level})),questions:['N2','N3'].map(level=>({id:'q'+level,paperId:level,level,type:101,typeTitle:'汉字读法',stem:'日本',options:[{id:'1',text:'にほん'},{id:'2',text:'にちほん'}],answer:'1',explanation:'日本读作にほん'}))};
const engine=new StudyEngine({bank:fixture});let last;
for(const level of ['N2','N3']){last=engine.createSession({mode:'practice',level,count:'all'});engine.answer(last.id,{questionId:'q'+level,optionId:'2'});engine.favorite('q'+level);}
const before=structuredClone(engine.state),bankBefore=structuredClone(engine.bank);
const {server}=createApp({root,port:47326,engine});await new Promise(r=>server.listen(47326,'127.0.0.1',r));
let browser;const errors=[],checks=[];
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1050}});const page=await context.newPage(),other=await context.newPage();
 for(const p of [page,other])p.on('pageerror',e=>errors.push(e.message));
 await other.goto('http://127.0.0.1:47326/#session/'+last.id);await other.locator('.question-card').waitFor();
 await page.goto('http://127.0.0.1:47326/#data');await page.locator('[data-action="reset-progress"]').waitFor();
 await page.evaluate(()=>localStorage.setItem('jlpt-last-session','test-practice'));
 const color=await page.locator('[data-action="reset-progress"]').evaluate(b=>getComputedStyle(b).backgroundColor);assert.equal(color,'rgb(181, 68, 53)');
 await page.screenshot({path:path.join(root,'evidence/pc-reset-progress-button.png'),fullPage:true});
 await page.locator('[data-action="reset-progress"]').click();await page.locator('[data-action="confirm-reset-progress"]').waitFor();assert.deepEqual(engine.state,before);
 assert.match(await page.locator('#modal-content').innerText(),/N1–N5/);assert.match(await page.locator('#modal-content').innerText(),/收藏/);
 await page.getByRole('button',{name:'取消',exact:true}).click();assert.deepEqual(engine.state,before);checks.push('红色按钮先打开确认框，取消不会修改任何进度');
 await page.locator('[data-action="reset-progress"]').click();await page.screenshot({path:path.join(root,'evidence/pc-reset-progress-confirm.png')});
 await page.locator('[data-action="confirm-reset-progress"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 await other.waitForURL('**/#data');await other.locator('[data-action="reset-progress"]').waitFor();
 assert.deepEqual(engine.state,{version:1,sessions:{},favorites:{},wrong:{},events:[]});assert.deepEqual(engine.bank,bankBefore);
 assert.equal(await page.evaluate(()=>localStorage.getItem('jlpt-last-session')),null);assert.equal(await other.evaluate(()=>state.session),null);
 checks.push('确认后清空全部等级记录、统计、错题和收藏，题库保留');checks.push('同步清除另一窗口的旧练习状态和继续练习入口');
 await page.reload();await page.locator('[data-action="reset-progress"]').waitFor();assert.equal((await page.evaluate(async()=>fetch('/api/history?level=N2').then(r=>r.json()))).items.length,0);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'evidence/reset-progress-verification.json'),JSON.stringify({at:new Date().toISOString(),checks,pageErrors:errors,testDataOnly:true,productionResetCalled:false},null,2));console.log(JSON.stringify({ok:true,checks,testDataOnly:true},null,2));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
