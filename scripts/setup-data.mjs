import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {validateBank} from '../lib/engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const i=process.argv.indexOf('--destination');
const destination=i>=0?path.resolve(process.argv[i+1]??''):root;
if(i>=0&&!process.argv[i+1])throw new Error('--destination 缺少路径');
const resources=path.join(root,'resources'),manifest=JSON.parse(fs.readFileSync(path.join(resources,'manifest.json')));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const created=[],preserved=[];
fs.mkdirSync(path.join(destination,'data'),{recursive:true});
fs.mkdirSync(path.join(destination,'media'),{recursive:true});
for(const [resource,targetName] of [['bank.json.gz','bank.json'],['media-index.json','media-index.json']]){
 const target=path.join(destination,'data',targetName);
 if(fs.existsSync(target)){preserved.push(targetName);continue;}
 const bytes=fs.readFileSync(path.join(resources,resource)),expected=manifest.files[resource];
 if(bytes.length!==expected.bytes||digest(bytes)!==expected.sha256)throw new Error('仓库资源校验失败：'+resource);
 const content=resource.endsWith('.gz')?gunzipSync(bytes):bytes;
 if(expected.unpackedSha256&&(content.length!==expected.unpackedBytes||digest(content)!==expected.unpackedSha256))throw new Error('解压后的题库校验失败');
 if(targetName==='bank.json')validateBank(JSON.parse(content));
 const temp=target+'.'+randomUUID()+'.tmp';
 try{fs.writeFileSync(temp,content,{flag:'wx'});fs.renameSync(temp,target);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 created.push(targetName);
}
console.log(JSON.stringify({created,preserved,papers:manifest.papers,questions:manifest.questions,message:'数据已就绪；现有题库和学习记录不会覆盖。听力可从完整离线版复制 media 文件夹，或运行 npm run download-audio 下载。'}));
