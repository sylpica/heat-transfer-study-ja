import {Actor} from './actor.mjs';
const valueCount=(value,seen=new WeakSet())=>{if(typeof value==='number')return 1;if(!value||typeof value!=='object'||seen.has(value))return 0;seen.add(value);if(ArrayBuffer.isView(value))return value.length||0;if(Array.isArray(value)&&typeof value[0]==='number')return value.length;return Object.values(value).reduce((sum,v)=>sum+valueCount(v,seen),0);};

// Ephemeral, model-independent playback. Transport owns individual rollback;
// this controller owns the transaction across at most two models.
export class Experiment{
 constructor({actorFactory=options=>new Actor(options),changed=()=>{},maxFrames=500,maxValues=2e6}={}){
  if(!Number.isSafeInteger(maxFrames)||maxFrames<2||maxFrames>500||!Number.isSafeInteger(maxValues)||maxValues<2)throw Error('履歴上限が不正です。');
  this.actorFactory=actorFactory;this.changed=changed;this.maxFrames=maxFrames;this.maxValues=maxValues;this.actors=[];this.states=[];this.initialStates=[];this.meshes=[];this.fluxes=[];this.configs=[];this.history=[];this.index=0;this.epoch=0;this.ready=false;this.busy=false;this.playing=false;this.error=null;this.timer=null;
 }
 emit(type){this.changed({type,experiment:this});}
 group(){while(this.actors.length<this.configs.length)this.actors.push(this.actorFactory({progress:f=>{this.progress=f;this.emit('progress');},fatal:error=>{this.ready=false;this.fail(error);}}));return this.actors.slice(0,this.configs.length);}
 fail(error){this.error=error;this.playing=false;clearTimeout(this.timer);this.emit('error');}
 invalidate(error=null){this.pause();this.ready=false;this.error=null;if(error)this.fail(error);this.emit('controls');}
 pause(){this.playing=false;clearTimeout(this.timer);this.epoch++;this.actors.forEach(a=>a.cancel());this.busy=false;this.progress=0;this.emit('paused');}
 accept(responses){this.states=responses.map(r=>r.snapshot);this.fluxes=responses.map(r=>r.flux);}
 record(){const count=this.states.reduce((sum,s)=>sum+valueCount(s),0),seed=this.initialStates.reduce((sum,s)=>sum+valueCount(s),0),limit=Math.min(this.maxFrames,Math.floor((this.maxValues-seed)/count));if(limit<2)throw Error('初期状態と2コマを保持するメモリー上限を超えています。格子を減らしてください。');this.history=this.history.slice(0,this.index+1);this.history.push(this.states);while(this.history.length>limit)this.history.shift();this.index=this.history.length-1;}
 async initialize({kind='thermal',configs}){
  this.pause();this.ready=false;this.busy=true;this.error=null;const token=this.epoch;this.emit('initializing');
  try{if(!Array.isArray(configs)||configs.length<1||configs.length>2)throw Error('同時比較は1〜2条件です。');this.configs=structuredClone(configs);this.kind=kind;const result=await Promise.all(this.group().map((a,i)=>a.request('init',{kind,config:this.configs[i]})));if(token!==this.epoch)return false;this.accept(result);this.initialStates=this.states;this.meshes=result.map(r=>r.mesh);this.history=[];this.index=0;this.record();this.ready=true;this.emit('state');this.emit('ready');return true;
  }catch(error){if(token===this.epoch)this.fail(error);return false;}finally{if(token===this.epoch){this.busy=false;this.emit('controls');}}
 }
 async restoreCurrent(group=this.group()){return Promise.all(group.map((a,i)=>a.request('restore',{snapshot:this.states[i]})));}
 async advance({duration,dt}={}){
  if(!this.ready||this.busy)return false;this.busy=true;this.error=null;const token=this.epoch,group=this.group();this.emit('calculating');
  try{
   if(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0)throw Error('進行時間は正の有限値です。');
   await this.restoreCurrent(group);if(token!==this.epoch)return false;const result=await Promise.all(group.map(a=>a.request('advance',{duration,dt})));if(token!==this.epoch)return false;
   const times=result.map(r=>r.snapshot.time),expected=this.states.map(s=>s.time+duration),tolerance=32*Number.EPSILON*Math.max(1,...expected.map(Math.abs));if(times.some((t,i)=>!Number.isFinite(t)||expected[i]<=this.states[i].time||Math.abs(t-expected[i])>tolerance)||Math.max(...times)-Math.min(...times)>tolerance)throw Error('比較の物理時刻が一致しないため、表示前の状態へ戻しました。');
   // Check history capacity before accepting the new physical state.
   if(2*result.reduce((sum,r)=>sum+valueCount(r.snapshot),0)+this.initialStates.reduce((sum,s)=>sum+valueCount(s),0)>this.maxValues)throw Error('状態のメモリー上限を超えました。');
   this.accept(result);this.record();this.emit('state');this.emit('advanced');return true;
  }catch(error){if(token===this.epoch){group.forEach(a=>a.cancel());const restored=await Promise.allSettled(group.map((a,i)=>a.request('restore',{snapshot:this.states[i]})));if(token===this.epoch){if(restored.some(r=>r.status==='rejected'))this.ready=false;this.fail(error);}}return false;
  }finally{if(token===this.epoch){this.busy=false;this.progress=0;this.emit('controls');}}
 }
 async restoreStates(states,index,reset=false){
  if(!this.ready||!states?.length)return false;this.pause();this.error=null;this.busy=true;const token=this.epoch;this.emit('rewinding');
  try{const result=await Promise.all(this.group().map((a,i)=>a.request('restore',{snapshot:states[i]})));if(token!==this.epoch)return false;this.accept(result);if(reset){this.history=[];this.index=0;this.record();}else this.index=index;this.emit('state');this.emit('rewound');return true;}catch(error){if(token===this.epoch){this.ready=false;this.fail(error);}return false;}finally{if(token===this.epoch){this.busy=false;this.emit('controls');}}
 }
 async advanceSamples({duration,spacing,dt}={}){
  if(!this.ready||this.busy)return false;
  if(![duration,spacing].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0))throw Error('記録時間と記録間隔は正の有限値です。');
  const count=Math.ceil(duration/spacing),start=this.states[0].time;
  if(!Number.isSafeInteger(count)||count<1||count>=this.maxFrames)throw Error('記録するコマ数が履歴上限を超えています。');
  const targets=Array.from({length:count},(_,i)=>start+Math.min(duration,(i+1)*spacing));
  if(targets.some((t,i)=>!Number.isFinite(t)||t<=(i?targets[i-1]:start)))throw Error('記録する時刻を浮動小数点で区別できません。');
  this.pause();const token=this.epoch;
  for(const target of targets){if(token!==this.epoch||!await this.advance({duration:target-this.states[0].time,dt}))return false;}
  return token===this.epoch;
 }
 rewind(index){return Number.isInteger(index)&&this.history[index]?this.restoreStates(this.history[index],index):Promise.resolve(false);}
 restart(){return this.restoreStates(this.initialStates,0,true);}
 play(parameters){if(!this.ready||this.busy||this.playing)return;this.playing=true;const tick=async()=>{if(!this.playing)return;try{const ok=await this.advance(parameters());if(ok&&this.playing)this.timer=setTimeout(tick,80);}catch(error){this.fail(error);}};tick();}
 close(){this.pause();this.actors.forEach(a=>a.close());this.actors=[];this.ready=false;}
}
