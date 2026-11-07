import test from 'node:test';import assert from 'node:assert/strict';
import {Experiment} from '../dynamic/experiment.mjs';import {createThermal} from '../dynamic/thermal.mjs';
const config=(source=1)=>({nx:1,ny:1,width:1,height:1,depth:1,materials:[{k:1,rho:1,cp:1}],initial:300,source});
function harness(options={}){
 const actors=[],events=[],experiment=new Experiment({...options,changed:({type})=>events.push(type),actorFactory:hooks=>{
  const actor={hooks,model:null,hold:false,pending:null,failure:null,skew:0,async request(type,data){
   if(type==='init'){this.model=createThermal(data.config);return {snapshot:this.model.snapshot(),mesh:this.model.mesh};}
   if(type==='restore')return {snapshot:this.model.restore(data.snapshot)};
   if(type==='advance'){const before=this.model.snapshot(),advance=()=>{this.model.step(data.duration);if(this.failure){const error=this.failure;this.failure=null;throw error;}const snapshot=this.model.snapshot();snapshot.time+=this.skew;return {snapshot};};if(!this.hold)return advance();this.hold=false;return new Promise((resolve,reject)=>{this.pending={before,reject,release:()=>{this.pending=null;try{resolve(advance());}catch(error){reject(error);}}};});}
  },cancel(){if(this.pending){const p=this.pending;this.pending=null;this.model.restore(p.before);p.reject(Error('cancelled'));}},close(){this.cancel();}};actors.push(actor);return actor;
 }});return {actors,events,experiment};
}
const nextTurn=()=>new Promise(resolve=>setTimeout(resolve,0));
test('two-model advance failure rolls back the successful actor and permits a synchronized retry',async()=>{
 const {actors,experiment:e}=harness();assert.equal(await e.initialize({configs:[config(1),config(2)]}),true);const before=e.states;actors[1].failure=Error('independent B calculation failure');assert.equal(await e.advance({duration:.1}),false);assert.equal(e.error.message,'independent B calculation failure');assert.deepEqual(e.states,before);actors.forEach((a,i)=>assert.deepEqual(a.model.snapshot(),before[i]));assert.equal(e.ready,true);assert.equal(await e.advance({duration:.1}),true);assert.deepEqual(e.states.map(s=>s.time),[.1,.1]);
});
test('pausing after one actor finishes never lets its unshown future leak into the next advance',async()=>{
 const {actors,experiment:e}=harness();await e.initialize({configs:[config(1),config(2)]});actors[1].hold=true;const advance=e.advance({duration:.1});await nextTurn();assert.equal(actors[0].model.time,.1);assert.equal(actors[1].model.time,0);e.pause();assert.equal(await advance,false);assert.deepEqual(e.states.map(s=>s.time),[0,0]);assert.equal(await e.advance({duration:.1}),true);assert.deepEqual(e.states.map(s=>s.time),[.1,.1]);assert.equal(e.states[0].temperature[0],300.1);
});
test('failed initialization disables old actors until both new conditions are valid',async()=>{
 const {experiment:e}=harness();await e.initialize({configs:[config()]});assert.equal(await e.initialize({configs:[config(),{...config(),initial:0}]}),false);assert.equal(e.ready,false);assert.equal(await e.advance({duration:.1}),false);assert.equal(await e.initialize({configs:[config(),config()]}),true);assert.equal(await e.advance({duration:.1}),true);
});
test('bounded transient history rewinds actual states and truncates the future when branching',async()=>{
 const {experiment:e}=harness({maxFrames:3});await e.initialize({configs:[config()]});for(let i=0;i<4;i++)assert.equal(await e.advance({duration:.1}),true);assert.equal(e.history.length,3);assert.ok(Math.abs(e.history[0][0].time-.2)<1e-15);assert.equal(await e.rewind(0),true);assert.ok(Math.abs(e.states[0].time-.2)<1e-15);assert.equal(await e.advance({duration:.05}),true);assert.equal(e.history.length,2);assert.ok(Math.abs(e.states[0].time-.25)<1e-15);assert.ok(Math.abs(e.states[0].temperature[0]-300.25)<1e-12);assert.equal(await e.restart(),true);assert.equal(e.states[0].time,0);assert.equal(e.states[0].temperature[0],300);assert.equal(e.history.length,1);
});
test('wrong physical time is rejected before acceptance and both underlying models are restored',async()=>{
 const {actors,experiment:e}=harness();await e.initialize({configs:[config(),config()]});actors[1].skew=.01;assert.equal(await e.advance({duration:.1}),false);assert.match(e.error.message,/物理時刻/);assert.deepEqual(e.states.map(s=>s.time),[0,0]);assert.deepEqual(actors.map(a=>a.model.time),[0,0]);
});
test('resource and transport failure leave a reviewable stopped state rather than an active control',async()=>{
 const {experiment:small}=harness({maxValues:2});assert.equal(await small.initialize({configs:[config()]}),false);assert.equal(small.ready,false);assert.match(small.error.message,/メモリー/);const {actors,experiment:e}=harness();await e.initialize({configs:[config()]});actors[0].hooks.fatal(Error('worker unavailable'));assert.equal(e.ready,false);assert.equal(e.error.message,'worker unavailable');
});
test('sampled advances record real synchronized intermediate states at fixed physical targets',async()=>{
 const {experiment:e}=harness();await e.initialize({configs:[config(1),config(2)]});assert.equal(await e.advanceSamples({duration:.4,spacing:.1}),true);assert.equal(e.history.length,5);
 for(let i=0;i<5;i++){assert.ok(Math.abs(e.history[i][0].time-i*.1)<1e-15);assert.equal(e.history[i][0].time,e.history[i][1].time);assert.ok(Math.abs(e.history[i][0].temperature[0]-(300+i*.1))<1e-12);assert.ok(Math.abs(e.history[i][1].temperature[0]-(300+i*.2))<1e-12);}
 assert.equal(await e.rewind(2),true);assert.ok(Math.abs(e.states[0].time-.2)<1e-15);
});
test('cancelling a sampled series preserves its last accepted frame and cannot leak an unshown actor future',async()=>{
 const {actors,experiment:e}=harness();await e.initialize({configs:[config(1),config(2)]});const changed=e.changed;e.changed=event=>{changed(event);if(event.type==='advanced'&&e.states[0].time===.1)actors[1].hold=true;};
 const pending=e.advanceSamples({duration:.4,spacing:.1});await nextTurn();assert.ok(actors[1].pending);e.pause();assert.equal(await pending,false);assert.deepEqual(e.states.map(s=>s.time),[.1,.1]);
 assert.equal(await e.advanceSamples({duration:.2,spacing:.1}),true);assert.ok(Math.abs(e.states[0].time-.3)<1e-15);assert.ok(Math.abs(e.states[0].temperature[0]-300.3)<1e-12);assert.ok(Math.abs(e.states[1].temperature[0]-300.6)<1e-12);
});
test('invalid sampled schedules fail before changing state, history or cancellation generation',async()=>{
 const {experiment:e}=harness({maxFrames:3});await e.initialize({configs:[config()]});const before=structuredClone(e.states),epoch=e.epoch;
 for(const parameters of [{duration:1,spacing:0},{duration:1,spacing:NaN},{duration:1,spacing:.1},{duration:'1',spacing:1}])await assert.rejects(e.advanceSamples(parameters));
 assert.deepEqual(e.states,before);assert.equal(e.history.length,1);assert.equal(e.epoch,epoch);
});
