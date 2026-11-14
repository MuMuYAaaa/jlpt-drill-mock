// Imports the user's existing local installation; no login, purchase or entitlement changes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createDecipheriv,createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {attachExamAudioPlans} from './prepare-exam-audio.mjs';

const base=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(base,'evidence');
const keys=JSON.parse(fs.readFileSync(path.join(source,'local_keys.json'),'utf8')).keys;
const keyMap=new Map(keys.map(k=>[k.pack_id,Buffer.from(k.key_base64,'base64')]));
const typeNames={101:'汉字读法',102:'汉字表记',103:'词语构成',104:'前后关系',105:'近义替换',106:'用法',201:'语法形式',202:'句子组织',203:'文章语法',301:'短篇阅读',302:'中篇阅读',303:'长篇阅读',304:'综合理解',305:'论点理解',306:'信息检索',401:'课题理解',402:'要点理解',403:'概要理解',404:'即时应答',405:'综合理解',406:'发话表达'};
const bank={version:1,source:'本机已安装应用的本地题库',papers:[],questions:[]};
const media={};const report={importedAt:new Date().toISOString(),sourcePackage:'tech.xiangzi.painlessjp',sourceVersion:'2.2.0',levels:{},integrity:{gzipChecked:0,gcmAuthenticated:0},sources:[],warnings:[]};
let aadTemplate=null;
const aadFile=path.join(source,'format-report.json');
if(fs.existsSync(aadFile)){const f=JSON.parse(fs.readFileSync(aadFile));aadTemplate=f.aadTemplate??null;}
function decode(row){
 const raw=Buffer.from(row.payload_enc),key=keyMap.get(row.pack_id);
 if(!key)throw new Error('Missing local key for '+row.pack_id);
 const d=createDecipheriv('aes-256-gcm',key,row.nonce);d.setAuthTag(raw.subarray(-16));
 if(aadTemplate){const s=aadTemplate.replace(/\{(\w+)\}/g,(_,k)=>String(row[k]??(k==='id'?(row.question_id??row.material_id):'')));d.setAAD(Buffer.from(s));}
 const plain=d.update(raw.subarray(0,-16));
 if(aadTemplate){d.final();report.integrity.gcmAuthenticated++;}
 const json=JSON.parse(gunzipSync(plain).toString('utf8'));report.integrity.gzipChecked++;return json;
}
function mediaUrl(value,mime){
 if(typeof value!=='string')return value;
 let url;if(value.startsWith('https://image.xiangzi.tech/'))url=value;
 else if(/^\/?jlpt\//.test(value))url='https://image.xiangzi.tech/'+value.replace(/^\//,'');
 else return value;
 const id=createHash('sha256').update(url).digest('hex');
 media[id]={url,mime:mime??(/\.mp3(?:$|\?)/.test(url)?'audio/mpeg':/\.png(?:$|\?)/.test(url)?'image/png':'image/webp')};
 return '/media/'+id;
}
function compact(v){
 if(v==null||typeof v!=='object')return v;
 if(Array.isArray(v))return v.map(compact);
 const out={};for(const [k,x]of Object.entries(v)){
  if(['lookup_units','lookup_metadata','content_hash','text_hash','document_id','provenance'].includes(k)||k.endsWith('_provenance'))continue;
  if(['src','url','path','remote_path'].includes(k)&&typeof x==='string')out[k]=mediaUrl(x);
  else out[k]=compact(x);
 }return out;
}
function text(doc){
 if(!doc)return '';if(typeof doc==='string')return doc;if(Array.isArray(doc))return doc.map(text).filter(Boolean).join('\n');
 if(doc.type==='image')return '';
 if(doc.text)return doc.text;
 if(doc.spans)return doc.spans.map(s=>s.text??'').join('');
 if(doc.blocks)return text(doc.blocks);
 if(doc.rows)return doc.rows.map(r=>text(r.cells??r)).join('\n');
 if(doc.cells)return doc.cells.map(text).join(' | ');
 if(doc.document)return text(doc.document);
 return '';
}
function findImages(v,out=[]){if(!v||typeof v!=='object')return out;if(v.type==='image'){const src=v.src??v.url??v.path;if(src)out.push(src);}for(const [k,x]of Object.entries(v))if(k!=='review'&&x&&typeof x==='object')findImages(x,out);return [...new Set(out)];}
const files=fs.readdirSync(source).filter(s=>/^jlpt_n[1-5]_v\d+\.db$/.test(s)).sort();
for(const file of files){
 const full=path.join(source,file);const db=new DatabaseSync(full,{readOnly:true});
 const mats=new Map(db.prepare('SELECT * FROM material WHERE enabled=1').all().map(r=>[r.material_id,decode(r)]));
 const groups=new Map(db.prepare('SELECT * FROM question_group WHERE enabled=1').all().map(r=>[r.group_id,r]));
 const sections=new Map(db.prepare('SELECT * FROM exam_section WHERE enabled=1 ORDER BY sort_order').all().map(r=>[r.section_id,r]));
 const audios=db.prepare('SELECT * FROM audio_resource WHERE enabled=1 ORDER BY sort_order').all();
 const groupAudio=new Map();for(const a of audios){if(!groupAudio.has(a.group_id))groupAudio.set(a.group_id,a);}
 const planAudio=new Map();for(const s of sections.values()){if(!s.audio_plan_json)continue;try{const p=JSON.parse(s.audio_plan_json);for(const a of p.items??[])for(const qid of a.question_ids??[])planAudio.set(qid,a.audio_id);}catch{}}
 const byAudio=new Map(audios.map(a=>[a.audio_id,a]));
 const papers=db.prepare('SELECT * FROM exam_paper WHERE enabled=1 ORDER BY sort_order DESC').all();
 for(const p of papers){const ss=[...sections.values()].filter(s=>s.paper_id===p.paper_id);bank.papers.push({id:p.paper_id,level:'N'+p.level,title:p.title,questionCount:0,sourceQuestionCount:p.total_questions,durationSeconds:ss.reduce((a,s)=>a+s.duration_seconds,0),mockEnabled:!!p.mock_enabled,sections:ss.map(s=>({id:s.section_id,title:s.title,durationSeconds:s.duration_seconds,questionCount:0}))});}
 const start=bank.questions.length;
 for(const r of db.prepare('SELECT * FROM question WHERE enabled=1 ORDER BY paper_id,sort_order').all()){
  const q=decode(r),g=groups.get(r.group_id),mat=mats.get(g?.material_id),inst=mats.get(g?.instruction_material_id),s=sections.get(r.section_id);
  if(!Array.isArray(q.options)||!Number.isInteger(q.answer_index)||q.answer_index<0||q.answer_index>=q.options.length)throw new Error('Invalid answer '+r.question_id);
  const stemDocument=compact(q.stem);const passageDocument=compact(mat?.document);const review=q.review?.['zh-Hans']??{};const matReview=mat?.review?.['zh-Hans']??{};
  let explanation=text(review.explanation)||review.explanation_structured?.correct_reason||'原题库暂无文字解析。';
  const trans=text(review.translation);const transcript=text(matReview.transcript);const materialTrans=text(matReview.translation);
  if(trans)explanation+='\n\n题目译文\n'+trans;
  if(transcript)explanation+='\n\n听力原文\n'+transcript;
  if(materialTrans)explanation+='\n\n材料译文\n'+materialTrans;
  const audio=byAudio.get(planAudio.get(r.question_id))??groupAudio.get(r.group_id);
  const normalized={id:r.question_id,paperId:r.paper_id,level:'N'+r.level,type:r.question_type,typeTitle:typeNames[r.question_type]??'其他题型',sectionId:r.section_id,sectionTitle:s?.title??'',number:r.display_number,order:r.sort_order,stem:text(q.stem)||((r.question_type>=400)?'请听录音，选择正确答案。':r.question_type===203?'请选择文中第 '+r.display_number+' 空的正确选项。':'请选择正确答案。'),stemDocument,passage:text(mat?.document),passageDocument,groupId:r.group_id,instruction:text(inst?.document),options:q.options.map((o,i)=>({id:String(i+1),text:text(o.document??o)||String(i+1),document:compact(o.document)})),answer:String(q.answer_index+1),explanation};
  if(audio)normalized.audio=mediaUrl(audio.remote_path,'audio/mpeg');
  if(r.question_type>=400&&!audio)normalized.mediaMissing=true;
  normalized.images=findImages({stemDocument,passageDocument});
  bank.questions.push(normalized);
 }
 const level='N'+papers[0]?.level;report.levels[level]={papers:papers.length,questions:bank.questions.length-start,audio:audios.length,materials:mats.size};
 report.sources.push({file,bytes:fs.statSync(full).size,sha256:createHash('sha256').update(fs.readFileSync(full)).digest('hex')});
 db.close();console.log(level,report.levels[level]);
}
const counts=new Map();for(const q of bank.questions){counts.set(q.paperId,(counts.get(q.paperId)??0)+1);counts.set(q.sectionId,(counts.get(q.sectionId)??0)+1);}
const paperTitles=new Map(bank.papers.map(p=>[p.id,p.title]));for(const q of bank.questions)q.paperTitle=paperTitles.get(q.paperId);
const sourceAnswerWarnings=new Set(['jlpt:n4-2014.07-聴解-53-1','jlpt:q:8c1f73e81449a30f34d8cb521116b455']);
for(const q of bank.questions)if(sourceAnswerWarnings.has(q.id)){
 q.sourceWarning='原题库答案待核：本题与另一套试卷使用同一录音、相同原文，却标注不同答案。此处保留原库标注，请勿仅凭本题结果判断掌握程度。';
 q.explanation='【原题库答案待核】'+q.sourceWarning+'\n\n'+q.explanation;
}
for(const p of bank.papers){p.questionCount=counts.get(p.id)??0;for(const s of p.sections)s.questionCount=counts.get(s.id)??0;}
if(!aadTemplate)report.warnings.push('本地记录已通过gzip CRC与JSON结构校验；AES-GCM AAD格式尚未恢复，因此未宣称通过GCM认证标签校验。');
report.totalQuestions=bank.questions.length;report.totalPapers=bank.papers.length;report.mediaCount=Object.keys(media).length;
report.examAudioPlans=attachExamAudioPlans(bank,base);
fs.mkdirSync(path.join(base,'data'),{recursive:true});
fs.writeFileSync(path.join(base,'data/bank.json'),JSON.stringify(bank));
fs.writeFileSync(path.join(base,'data/media-index.json'),JSON.stringify(media));
fs.writeFileSync(path.join(source,'import-report.json'),JSON.stringify(report,null,2));
console.log('Import complete',report.totalPapers,report.totalQuestions,report.mediaCount);
