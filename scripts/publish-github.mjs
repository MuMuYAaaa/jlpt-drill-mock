// GitHub publishing with the user's existing Git credential helper.
// Credentials stay in process memory and are sent only to GitHub over HTTPS.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const repository=arg('--repo'),directory=arg('--release-dir');
if(!/^[\w.-]+\/[\w.-]+$/.test(repository??'')||!directory)throw new Error('用法：node scripts/publish-github.mjs --repo OWNER/REPO --release-dir PATH');
const [owner,repo]=repository.split('/'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'release-manifest.json'),'utf8').replace(/^\uFEFF/,''));
const tag='v'+manifest.Version;
let token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
if(!token){
 const credential=spawnSync('git',['-c','credential.interactive=never','credential','fill'],{input:`protocol=https\nhost=github.com\nusername=${owner}\n\n`,cwd:os.tmpdir(),encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
 if(credential.status!==0)throw new Error('GitHub 推送凭据不可用，请先通过 Git Credential Manager 登录。');
 const fields=Object.fromEntries(credential.stdout.trim().split(/\r?\n/).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
 token=fields.password;credential.stdout='';
}
if(!token)throw new Error('未取得 GitHub 凭据');
function request(method,url,{json,file,label}={}){
 const u=new URL(url);
 if(u.protocol!=='https:'||!['api.github.com','uploads.github.com'].includes(u.hostname))throw new Error('拒绝向非 GitHub 地址发送凭据');
 return new Promise((resolve,reject)=>{
  const bytes=json===undefined?null:Buffer.from(JSON.stringify(json));
  const size=file?fs.statSync(file).size:bytes?.length;
  const headers={'User-Agent':'jlpt-drill-mock-publisher','Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2026-03-10'};
  if(size!==undefined){headers['Content-Length']=String(size);headers['Content-Type']=file?'application/octet-stream':'application/json';}
  const req=https.request(u,{method,headers},res=>{
   let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;if(body.length>8*1024*1024)req.destroy(new Error('GitHub 响应过大'));});
   res.on('end',()=>{let data;try{data=body?JSON.parse(body):null;}catch{data={message:'GitHub 返回了非 JSON 响应'};}if(res.statusCode<200||res.statusCode>=300){const error=new Error(`GitHub HTTP ${res.statusCode}: ${data?.message??'请求失败'}`);error.status=res.statusCode;reject(error);}else resolve(data);});
  });
  req.setTimeout(180000,()=>req.destroy(new Error('GitHub 连接长时间未传输数据')));req.on('error',reject);
  if(file){
   const stream=fs.createReadStream(file,{highWaterMark:1024*1024});let sent=0,last=0;const started=Date.now();
   stream.on('data',chunk=>{sent+=chunk.length;if(Date.now()-last>=10000||sent===size){last=Date.now();console.log(JSON.stringify({upload:label,readMiB:Math.round(sent/1048576),totalMiB:Math.round(size/1048576),percent:Math.round(sent*100/size),MiBps:Math.round(sent/1048576/Math.max(.1,(Date.now()-started)/1000)*10)/10}));}});
   stream.on('error',e=>req.destroy(e));req.on('error',()=>stream.destroy());stream.pipe(req);
  }else req.end(bytes);
 });
}
const api='https://api.github.com';
const user=process.env.GITHUB_ACTIONS==='true'?{login:'github-actions'}:await request('GET',api+'/user');
console.log(JSON.stringify({authenticatedAs:user.login,repository}));
const project=await request('GET',`${api}/repos/${repository}`);
// Installation tokens do not express user membership through repository.permissions.
// Actions uses its explicitly scoped contents:write token; GitHub enforces it on every write.
if(process.env.GITHUB_ACTIONS==='true'){
 if(process.env.GITHUB_REPOSITORY!==repository)throw new Error('Actions 发布令牌只能用于当前仓库');
}else if(!project.permissions?.push)throw new Error('当前 GitHub 凭据没有目标仓库的写入权限');
if(project.private)throw new Error('目标仓库当前是私有仓库，不能将其声称为公开开源项目');
if(process.argv.includes('--check-only')){console.log(JSON.stringify({ok:true,authenticatedAs:user.login,repository:project.html_url,canPush:true}));process.exit(0);}
let release;
if(arg('--release-id')){if(!/^\d+$/.test(arg('--release-id')))throw new Error('Release ID 无效');release=await request('GET',`${api}/repos/${repository}/releases/${arg('--release-id')}`);if(release.tag_name!==tag)throw new Error('Release 版本与待上传文件不一致');}
const statePath=path.join(root,'evidence/github-release-state.json');
if(!release&&fs.existsSync(statePath)){const saved=JSON.parse(fs.readFileSync(statePath));if(saved.repository===repository&&saved.tag===tag){release=await request('GET',`${api}/repos/${repository}/releases/${saved.releaseId}`);}}
if(!release)try{release=await request('GET',`${api}/repos/${repository}/releases/tags/${tag}`);}catch(e){if(e.status!==404)throw e;}
if(!release){release=await request('POST',`${api}/repos/${repository}/releases`,{json:{tag_name:tag,target_commitish:'main',name:'日语研习室 '+manifest.Version,body:fs.readFileSync(path.join(root,'RELEASE_NOTES.md'),'utf8'),draft:true,prerelease:false}});}
console.log(JSON.stringify({releaseId:release.id,url:release.html_url,draft:release.draft}));
fs.mkdirSync(path.join(root,'evidence'),{recursive:true});
fs.writeFileSync(path.join(root,'evidence/github-release-state.json'),JSON.stringify({repository,releaseId:release.id,tag,url:release.html_url}));
const assets=[
 {file:manifest.Installer.File,name:`jlpt-desk-${manifest.Version}-windows-x64-setup.exe`,sha:manifest.Installer.SHA256,label:'Windows x64 安装包 · 完整离线听力'},
 {file:manifest.Portable.File,name:`jlpt-desk-${manifest.Version}-windows-x64-portable.zip`,sha:manifest.Portable.SHA256,label:'Windows x64 免安装版 · 完整离线听力'}
];
const sums=Buffer.from(assets.map(x=>x.sha+'  '+x.name).join('\n')+'\n');
const sumsPath=path.join(directory,'SHA256SUMS.txt');fs.writeFileSync(sumsPath,sums);
assets.push({file:'SHA256SUMS.txt',name:'SHA256SUMS.txt',sha:createHash('sha256').update(sums).digest('hex'),label:'SHA-256 校验值'});
const existing=await request('GET',`${api}/repos/${repository}/releases/${release.id}/assets?per_page=100`);
for(const asset of assets){
 if(arg('--only')&&!asset.name.includes(arg('--only')))continue;
 const file=path.join(directory,asset.file),size=fs.statSync(file).size;
 const before=existing.find(x=>x.name===asset.name);
 if(before){if(before.size!==size||before.digest!=='sha256:'+asset.sha)throw new Error('远端已有不匹配的同名资源：'+asset.name);console.log(JSON.stringify({alreadyUploaded:asset.name}));continue;}
 const uploaded=await request('POST',`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(asset.name)}&label=${encodeURIComponent(asset.label)}`,{file,label:asset.name});
 if(uploaded.size!==size||uploaded.state!=='uploaded'||(uploaded.digest&&uploaded.digest!=='sha256:'+asset.sha))throw new Error('上传后的文件校验不一致：'+asset.name);
 console.log(JSON.stringify({uploaded:uploaded.name,bytes:uploaded.size,digest:uploaded.digest,url:uploaded.browser_download_url}));
}
if(process.argv.includes('--defer-publish')){console.log(JSON.stringify({ok:true,draft:release.draft,releaseId:release.id,publicationDeferred:true}));process.exit(0);}
if(release.draft)release=await request('PATCH',`${api}/repos/${repository}/releases/${release.id}`,{json:{draft:false,tag_name:tag,target_commitish:release.target_commitish}});
const verified=await request('GET',`${api}/repos/${repository}/releases/${release.id}`);
if(verified.draft||assets.some(x=>!verified.assets.some(a=>a.name===x.name&&a.state==='uploaded')))throw new Error('Release 发布状态未通过核验');
const result={ok:true,repository:project.html_url,release:verified.html_url,assets:verified.assets.map(x=>({name:x.name,bytes:x.size,digest:x.digest,url:x.browser_download_url}))};
fs.writeFileSync(path.join(root,'evidence/github-publish-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
