import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const root=path.dirname(fileURLToPath(import.meta.url));
const evidence=path.join(root,'evidence'),mediaDir=path.join(root,'media');fs.mkdirSync(mediaDir,{recursive:true});
const indexPath=path.join(root,'data/media-index.json');const index=JSON.parse(fs.readFileSync(indexPath));
const rawByPath=new Map();
for(const file of fs.readdirSync(evidence).filter(f=>/^jlpt_n[1-5]_v\d+\.db$/.test(f))){
 const d=new DatabaseSync(path.join(evidence,file),{readOnly:true});
 for(const a of d.prepare('SELECT audio_id,pack_id,paper_id,section_id,group_id,remote_path,sha256,file_size,duration_ms FROM audio_resource WHERE enabled=1').all()){
  const old=rawByPath.get(a.remote_path);if(old&&old.sha256!==a.sha256)throw new Error('Source hash conflict: '+a.remote_path);
  rawByPath.set(a.remote_path,a);
 }d.close();
}
const tracks=[];
for(const [id,entry] of Object.entries(index)){
 if(entry.mime!=='audio/mpeg')continue;
 const remotePath=new URL(entry.url).pathname.slice(1);
 const source=rawByPath.get(remotePath)??{remote_path:remotePath,sha256:entry.sha256,file_size:entry.fileSize,duration_ms:entry.durationMs};
 if(!/^[a-f0-9]{64}$/.test(source.sha256??'')||!Number.isSafeInteger(source.file_size)||source.file_size<=0)throw new Error('Unknown source audio: '+id);
 const file=path.join(mediaDir,createHash('sha256').update(id).digest('hex')+'.cache');
 entry.sha256=source.sha256;entry.fileSize=source.file_size;entry.durationMs=source.duration_ms;
 tracks.push({id,...source,url:entry.url,file});
}
fs.writeFileSync(indexPath,JSON.stringify(index));
const total=tracks.length,totalBytes=tracks.reduce((n,t)=>n+t.file_size,0);
const result={startedAt:new Date().toISOString(),total,totalBytes,completed:0,downloaded:0,resumed:0,verifiedBytes:0,failed:[],source:'已安装无痛日语2.2.0的audio_resource记录',items:[]};
const statusPath=path.join(evidence,'audio-download-status.json');const reportPath=path.join(evidence,'audio-download-report.json');
function status(){fs.writeFileSync(statusPath,JSON.stringify({...result,items:undefined}));}
function verify(t){if(!fs.existsSync(t.file))return false;const stat=fs.statSync(t.file);if(stat.size!==t.file_size)return false;return createHash('sha256').update(fs.readFileSync(t.file)).digest('hex')===t.sha256;}
async function fetchTrack(t){
 const tmp=t.file+'.'+randomUUID()+'.part';
 try{
  const res=await fetch(t.url,{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!res.ok||!res.body)throw new Error('HTTP '+res.status);
  let count=0;const hash=createHash('sha256');
  const measure=new Transform({transform(chunk,encoding,callback){count+=chunk.length;if(count>t.file_size+1024){callback(new Error('Too many bytes'));return;}hash.update(chunk);callback(null,chunk);}});
  await pipeline(Readable.fromWeb(res.body),measure,fs.createWriteStream(tmp,{flags:'wx'}));
  if(count!==t.file_size)throw new Error('Size mismatch '+count+' / '+t.file_size);
  if(hash.digest('hex')!==t.sha256)throw new Error('SHA256 mismatch');
  fs.renameSync(tmp,t.file);
 }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
let cursor=0;
async function worker(){while(cursor<total){const t=tracks[cursor++];let failure=null;const resumed=verify(t);
 if(!resumed){for(let attempt=1;attempt<=4;attempt++){try{await fetchTrack(t);failure=null;break;}catch(e){failure=e.message+(e.cause?.code?' '+e.cause.code:'');if(attempt<4)await new Promise(r=>setTimeout(r,attempt*500));}}}
 if(failure)result.failed.push({id:t.id,url:t.url,error:failure});else{result.completed++;result.verifiedBytes+=t.file_size;if(resumed)result.resumed++;else result.downloaded++;result.items.push({id:t.id,sha256:t.sha256,bytes:t.file_size,durationMs:t.duration_ms});}
 if(result.completed%50===0||failure){status();console.log(JSON.stringify({completed:result.completed,total,downloaded:result.downloaded,resumed:result.resumed,failed:result.failed.length,MiB:Math.round(result.verifiedBytes/1048576)}));}
}}
console.log(JSON.stringify({start:true,total,totalBytes,GiB:totalBytes/1073741824}));status();
const heartbeat=setInterval(status,10000);
try{await Promise.all(Array.from({length:6},()=>worker()));}finally{clearInterval(heartbeat);result.finishedAt=new Date().toISOString();status();fs.writeFileSync(reportPath,JSON.stringify(result,null,2));}
if(!result.failed.length)fs.writeFileSync(path.join(root,'data/offline-audio.json'),JSON.stringify({complete:true,files:total,bytes:result.verifiedBytes,verifiedAt:result.finishedAt,sha256Verified:true,source:result.source},null,2));
console.log(JSON.stringify({done:true,completed:result.completed,total,failed:result.failed.length,verifiedBytes:result.verifiedBytes}));if(result.failed.length)process.exitCode=1;
