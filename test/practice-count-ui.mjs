import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './browser.mjs';
import {fileURLToPath} from 'node:url';
import {StudyEngine} from '../lib/engine.mjs';
import {createApp} from '../server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const engine=new StudyEngine({bankPath:path.join(root,'data/bank.json')});
const {server}=createApp({root,port:47325,engine});await new Promise(r=>server.listen(47325,'127.0.0.1',r));
let browser;const checks=[],errors=[];
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:47325/#practice');await page.locator('[data-type="101"]').waitFor();await page.locator('[data-type="101"]').click();
 const available=engine.bank.questions.filter(q=>q.level==='N2'&&q.type===101).length;
 assert.equal(await page.locator('[data-action="count-choice"]').count(),6);
 await page.locator('[data-count="custom"]').click();const input=page.locator('#practice-custom-count'),start=page.locator('[data-action="create-practice"]');
 assert.equal(await input.getAttribute('max'),String(available));
 for(const invalid of ['','0','-1','1.5',String(available+1)]){await input.fill(invalid);assert.equal(await start.isDisabled(),true);assert.equal(await page.locator('#practice-count-error').isVisible(),true);}
 await input.fill('7');assert.equal(await start.isEnabled(),true);assert.equal(await page.locator('#practice-count-error').isVisible(),false);assert.match(await page.locator('#practice-count-hint').innerText(),/本组将练习 7 题/);
 await page.screenshot({path:path.join(root,'evidence/pc-custom-count.png')});await start.click();await page.locator('.question-card').waitFor();
 let id=page.url().split('/').pop();assert.equal(engine.findSession(id).questions.length,7);checks.push('自定义7题成功，空值/零/负数/小数/超量均禁止开始');
 await page.locator('a[href="#practice"]').first().click();await page.locator('[data-type="101"]').click();await page.locator('[data-count="all"]').click();
 assert.equal(await page.locator('#custom-count-field').isVisible(),false);assert.match(await page.locator('#practice-count-hint').innerText(),new RegExp(`本组将练习 ${available} 题（全部）`));
 await start.click();await page.locator('.question-card').waitFor();id=page.url().split('/').pop();
 assert.equal(engine.findSession(id).questions.length,available);assert.ok(engine.findSession(id).questions.every(q=>q.type===101&&q.level==='N2'));checks.push(`专项全部取出当前等级和题型的${available}题`);
 await page.locator('a[href="#practice"]').first().click();await page.locator('[data-action="setup-practice"]:not([data-type])').click();await page.locator('[data-count="all"]').click();await start.click();await page.locator('.question-card').waitFor();id=page.url().split('/').pop();
 const total=engine.bank.questions.filter(q=>q.level==='N2').length;assert.equal(engine.findSession(id).questions.length,total);assert.equal(await page.locator('.answer-dot').count(),total);checks.push(`综合全部载入${total}题，答题卡完整且界面正常`);
 const favorite=engine.bank.questions.find(q=>q.level==='N2');engine.favorite(favorite.id);engine.favorite(engine.bank.questions.find(q=>q.level==='N3').id);
 await page.locator('a[href="#favorites"]').first().click();await page.locator('[data-action="setup-review"]').click();await page.locator('[data-count="all"]').click();await start.click();await page.locator('.question-card').waitFor();id=page.url().split('/').pop();assert.deepEqual(engine.findSession(id).questions.map(q=>q.id),[favorite.id]);checks.push('收藏全部只选当前等级的收藏题');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'evidence/practice-count-verification.json'),JSON.stringify({at:new Date().toISOString(),checks,pageErrors:errors,usesInMemoryState:true},null,2));console.log(JSON.stringify({ok:true,checks},null,2));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
