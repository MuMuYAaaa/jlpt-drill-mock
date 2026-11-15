// Produces the portable repository data snapshot. No user progress is read.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {validateBank} from '../lib/engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'resources');fs.mkdirSync(folder,{recursive:true});
const bankBytes=fs.readFileSync(path.join(root,'data/bank.json'));
const bank=validateBank(JSON.parse(bankBytes));
const files=[['bank.json.gz',gzipSync(bankBytes,{level:9}),bankBytes],['media-index.json',fs.readFileSync(path.join(root,'data/media-index.json'))]];
const manifest={version:1,papers:bank.papers.length,questions:bank.questions.length,files:{}};
for(const [name,bytes,unpacked] of files){
 fs.writeFileSync(path.join(folder,name),bytes);
 manifest.files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...(unpacked?{unpackedBytes:unpacked.length,unpackedSha256:createHash('sha256').update(unpacked).digest('hex')}:{})};
}
fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));
