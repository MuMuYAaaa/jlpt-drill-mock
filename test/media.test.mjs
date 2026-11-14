import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createApp} from '../server.mjs';

test('媒体联网被拒时提示服务权限，恢复网络后可重新下载并缓存',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-media-'));
 fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'data/media-index.json'),JSON.stringify({sample:{url:'https://image.xiangzi.tech/jlpt/sample.mp3',mime:'audio/mpeg'}}));
 const {server}=createApp({root,port:0,engine:{bank:{questions:[]}}});
 const original=globalThis.fetch;let allowed=false,downloads=0;
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://image.xiangzi.tech/')){downloads++;if(!allowed)throw new TypeError('fetch failed',{cause:Object.assign(new Error(),{code:'EACCES'})});return new Response(Buffer.from('ID3audio'),{status:200,headers:{'Content-Type':'audio/mpeg'}});}
  return original(url,options);
 };
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/media/sample`;
  let response=await original(url);assert.equal(response.status,502);assert.match((await response.json()).error,/联网权限受限/);
  allowed=true;response=await original(url,{headers:{Range:'bytes=0-2'}});assert.equal(response.status,206);assert.equal(await response.text(),'ID3');
  response=await original(url);assert.equal(await response.text(),'ID3audio');assert.equal(downloads,2);
 }finally{globalThis.fetch=original;server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});

test('完整离线模式只读本地音频，缺失或损坏明确报错且不尝试联网',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jlpt-offline-'));
 fs.mkdirSync(path.join(root,'data'));fs.mkdirSync(path.join(root,'media'));
 const bytes=Buffer.from('ID3offline'),sha256=createHash('sha256').update(bytes).digest('hex');
 const entry={url:'https://image.xiangzi.tech/jlpt/offline.mp3',mime:'audio/mpeg',sha256,fileSize:bytes.length};
 fs.writeFileSync(path.join(root,'data/media-index.json'),JSON.stringify({present:entry,missing:entry,corrupt:entry}));
 fs.writeFileSync(path.join(root,'data/offline-audio.json'),JSON.stringify({complete:true}));
 const file=id=>path.join(root,'media',createHash('sha256').update(id).digest('hex')+'.cache');
 fs.writeFileSync(file('present'),bytes);fs.writeFileSync(file('corrupt'),'broken');
 const {server}=createApp({root,port:0,engine:{bank:{questions:[]}}});const original=globalThis.fetch;let outbound=0;
 globalThis.fetch=async()=>{outbound++;throw new Error('network disabled');};
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  let response=await original(base+'/media/present',{headers:{Range:'bytes=0-2'}});assert.equal(response.status,206);assert.equal(await response.text(),'ID3');
  response=await original(base+'/media/missing');assert.equal(response.status,404);assert.match((await response.json()).error,/离线音频缺失/);
  response=await original(base+'/media/corrupt');assert.equal(response.status,422);assert.match((await response.json()).error,/校验失败/);
  assert.equal(outbound,0);
 }finally{globalThis.fetch=original;server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
