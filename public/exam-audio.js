(function(global){
 'use strict';
 function position(plan,elapsed){
  let start=0;
  for(let i=0;i<plan.items.length;i++){
   const item=plan.items[i],end=start+item.durationMs,gapEnd=end+item.gapAfterMs;
   if(elapsed<end)return {phase:'audio',itemIndex:i,item,offsetMs:Math.max(0,elapsed-start),elapsedMs:elapsed};
   if(elapsed<gapEnd)return {phase:'gap',itemIndex:i,item,offsetMs:item.durationMs,gapRemainingMs:gapEnd-elapsed,elapsedMs:elapsed};
   start=gapEnd;
  }
  return {phase:'complete',itemIndex:plan.items.length,elapsedMs:plan.totalDurationMs};
 }
 class ExamAudioPlayer{
  constructor(callbacks={}){
   this.callbacks=callbacks;this.audio=document.createElement('audio');this.audio.id='exam-continuous-audio';this.audio.preload='auto';this.audio.hidden=true;document.body.append(this.audio);
   const volume=Number(localStorage.getItem('jlpt-exam-volume')??0.8);this.audio.volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0.8;this.clockOffset=0;this.lastServerNow=null;this.key=null;this.itemIndex=-1;this.token=0;
   this.audio.addEventListener('error',()=>{if(this.active&&!this.paused&&!this.error){this.error=true;this.callbacks.onError?.('离线音频未能播放，考试已暂停。请重试继续。');}});
   this.audio.addEventListener('loadedmetadata',()=>{if(this.active&&!this.paused){this.align();this.play();}});
   this.timer=setInterval(()=>this.tick(),150);
  }
  configure(session){
   const section=session?.sections?.[session.activeSectionIndex];
   if(session?.mode!=='exam'||session.status!=='active'||session.phase==='break'||!section?.audioPlan){this.stop();return;}
   const key=session.id+':'+section.id;
   if(key!==this.key){this.stop();this.key=key;this.itemIndex=-1;this.completed=false;this.error=false;this.blocked=false;}
   if(session.serverNow!==this.lastServerNow){this.clockOffset=(session.serverNow??Date.now())-Date.now();this.lastServerNow=session.serverNow;}
   this.active=true;this.plan=section.audioPlan;this.startedAt=session.listening?.startedAt??section.startedAt;
   this.paused=!!session.listening?.paused||!!session.focus?.paused||!!this.focusPaused;this.frozenElapsed=session.listening?.elapsedMs??0;
   if(this.paused)this.audio.pause();
   this.tick();
  }
  getPosition(){
   if(!this.active||!this.plan)return null;
   const elapsed=this.paused?this.frozenElapsed:Math.max(0,Date.now()+this.clockOffset-this.startedAt);
   return {...position(this.plan,elapsed),paused:this.paused,blocked:this.blocked,error:this.error,totalDurationMs:this.plan.totalDurationMs};
  }
  tick(){
   const p=this.getPosition();if(!p)return;this.current=p;this.callbacks.onState?.(p);
   if(this.paused||this.error||this.blocked){this.audio.pause();return;}
   if(p.phase==='complete'){this.audio.pause();if(!this.completed){this.completed=true;this.callbacks.onComplete?.();}return;}
   if(p.phase==='gap'){this.audio.pause();return;}
   if(this.itemIndex!==p.itemIndex){
    this.itemIndex=p.itemIndex;this.token++;this.audio.src=p.item.src;this.audio.load();this.play();return;
   }
   this.align();if(this.audio.paused&&!this.starting)this.play();
  }
  align(){
   const p=this.getPosition();if(!p||p.phase!=='audio'||this.audio.readyState<1)return;
   const target=Math.min(p.offsetMs/1000,Math.max(0,this.audio.duration-0.025));
   if(Number.isFinite(target)&&Math.abs(this.audio.currentTime-target)>0.9){try{this.audio.currentTime=target;}catch{}}
   this.audio.playbackRate=1;
  }
  async play(){
   if(!this.active||this.paused||this.error||this.blocked||this.starting)return;
   const token=this.token;this.starting=true;
   try{this.align();await this.audio.play();}
   catch(e){if(token!==this.token||!this.active||this.paused||e.name==='AbortError')return;
    if(e.name==='NotAllowedError'){this.blocked=true;this.callbacks.onBlocked?.();}
    else if(!this.error){this.error=true;this.callbacks.onError?.('离线音频未能播放，考试已暂停。请重试继续。');}
   }finally{this.starting=false;}
  }
  retry(){this.error=false;this.blocked=false;this.itemIndex=-1;this.token++;}
  setVolume(value){this.audio.volume=Math.max(0,Math.min(1,Number(value)));localStorage.setItem('jlpt-exam-volume',String(this.audio.volume));}
  stop(){
   this.active=false;this.key=null;this.plan=null;this.current=null;this.paused=false;this.token++;this.itemIndex=-1;this.starting=false;
   this.audio.pause();if(this.audio.hasAttribute('src')){this.audio.removeAttribute('src');this.audio.load();}
  }
 }
 global.ExamAudioPlayer=ExamAudioPlayer;global.examAudioPosition=position;
})(window);
