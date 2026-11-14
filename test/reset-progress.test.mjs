import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {StudyEngine} from '../lib/engine.mjs';
import {createApp} from '../server.mjs';

function fixture(){return {papers:['N2','N3'].map(level=>({id:level,title:level+' 测试卷',level})),questions:['N2','N3'].map(level=>({id:'q'+level,paperId:level,level,type:101,stem:'日本',options:[{id:'1',text:'にほん'},{id:'2',text:'にちほん'}],answer:'1',explanation:'日本读作にほん'}))};}
function seed(e){for(const level of ['N2','N3']){const s=e.createSession({mode:'practice',level,count:'all'});e.answer(s.id,{questionId:'q'+level,optionId:'2'});e.favorite('q'+level);e.finish(s.id);}}

test('重置要求明确确认，清空全部等级的记录并持久化，保留题库与音频且备份可恢复',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-reset-'));
 try{
  const bankPath=path.join(root,'bank.json'),statePath=path.join(root,'progress.json'),audioPath=path.join(root,'audio.mp3');
  fs.writeFileSync(bankPath,JSON.stringify(fixture()));fs.writeFileSync(audioPath,'ID3-existing-offline-audio');
  const bankBefore=fs.readFileSync(bankPath),audioBefore=fs.readFileSync(audioPath);
  const e=new StudyEngine({bankPath,statePath});seed(e);const backup=e.exportState(),before=structuredClone(e.state);
  for(const input of [undefined,{}, {confirmation:false},{confirmation:'wrong'}])assert.throws(()=>e.resetProgress(input),/请先确认/);
  assert.deepEqual(e.state,before);assert.deepEqual(JSON.parse(fs.readFileSync(statePath)),before);
  assert.equal(e.resetProgress({confirmation:'reset-all-progress'}).reset,true);
  assert.deepEqual(e.state,{version:1,sessions:{},favorites:{},wrong:{},events:[]});
  const restarted=new StudyEngine({bankPath,statePath});assert.deepEqual(restarted.state,e.state);
  for(const level of ['N1','N2','N3','N4','N5']){const c=restarted.catalog(level);assert.equal(c.stats.answered,0);assert.equal(c.stats.wrong,0);assert.equal(c.stats.favorites,0);assert.equal(c.active.length,0);}
  assert.deepEqual(fs.readFileSync(bankPath),bankBefore);assert.deepEqual(fs.readFileSync(audioPath),audioBefore);
  restarted.restore(backup);assert.equal(restarted.catalog('N2').stats.answered,1);assert.equal(restarted.review('favorites','N3').items.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('磁盘写入失败时不会先清空内存中的学习记录',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-reset-fail-'));
 try{const e=new StudyEngine({bank:fixture()});seed(e);const before=structuredClone(e.state);e.statePath=root;assert.throws(()=>e.resetProgress({confirmation:'reset-all-progress'}));assert.deepEqual(e.state,before);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('HTTP重置仅接受同源POST及确认标记，查看和未确认请求不会重置',async()=>{
 const engine=new StudyEngine({bank:fixture()});seed(engine);const before=structuredClone(engine.state);
 const {server}=createApp({port:0,engine});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/api/reset-progress`;
 const post=(data,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 try{
  assert.equal((await fetch(url)).status,405);assert.equal((await post({})).status,400);
  assert.equal((await post({confirmation:'reset-all-progress'},{Origin:'https://example.com'})).status,403);assert.deepEqual(engine.state,before);
  const result=await post({confirmation:'reset-all-progress'});assert.equal(result.status,200);assert.equal((await result.json()).reset,true);assert.equal(engine.state.events.length,0);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
