import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

export function attachExamAudioPlans(bank,root){
 const plans=new Map();
 for(const file of fs.readdirSync(path.join(root,'evidence')).filter(x=>/^jlpt_n[1-5]_v\d+\.db$/.test(x))){
  const db=new DatabaseSync(path.join(root,'evidence',file),{readOnly:true});
  const audio=new Map(db.prepare('SELECT * FROM audio_resource WHERE enabled=1').all().map(a=>[a.audio_id,a]));
  for(const section of db.prepare('SELECT * FROM exam_section WHERE audio_plan_json IS NOT NULL AND enabled=1').all()){
   const original=JSON.parse(section.audio_plan_json);
   const items=original.items.map(item=>{
    const a=audio.get(item.audio_id);if(!a)throw new Error('Missing source audio: '+item.audio_id);
    const url='https://image.xiangzi.tech/'+a.remote_path.replace(/^\//,'');
    const id=createHash('sha256').update(url).digest('hex');
    return {audioId:a.audio_id,src:'/media/'+id,questionIds:item.question_ids,durationMs:a.duration_ms,gapAfterMs:item.gap_after_ms??0};
   });
   plans.set(section.section_id,{version:1,completionPolicy:'audio_end',items,totalDurationMs:items.reduce((sum,a)=>sum+a.durationMs+a.gapAfterMs,0)});
  }db.close();
 }
 let count=0,tracks=0;const missing=[];
 for(const paper of bank.papers)for(const section of paper.sections??[]){
  const plan=plans.get(section.id);if(!plan)continue;
  const ids=new Set(bank.questions.filter(q=>q.paperId===paper.id&&q.sectionId===section.id).map(q=>q.id));
  const planned=new Set(plan.items.flatMap(a=>a.questionIds));
  if(ids.size!==planned.size||[...ids].some(id=>!planned.has(id)))throw new Error('Incomplete listening plan: '+section.id);
  section.audioPlan=plan;section.restBeforeSeconds=600;count++;tracks+=plan.items.length;
  for(const a of plan.items){const id=a.src.slice(7);const file=path.join(root,'media',createHash('sha256').update(id).digest('hex')+'.cache');if(!fs.existsSync(file))missing.push(id);}
 }
 return {sections:count,tracks,missing:[...new Set(missing)]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const root=path.dirname(fileURLToPath(import.meta.url));const file=path.join(root,'data/bank.json');
 const bank=JSON.parse(fs.readFileSync(file));const result=attachExamAudioPlans(bank,root);
 if(result.missing.length)throw new Error('Offline tracks missing: '+result.missing.length);
 fs.writeFileSync(file+'.tmp',JSON.stringify(bank));fs.renameSync(file+'.tmp',file);
 console.log(JSON.stringify(result));
}
