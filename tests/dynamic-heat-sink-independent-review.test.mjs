import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeatSink} from '../dynamic/dev/heat-sink.mjs';

// Independent external heat accounting and dimensional similarity. The
// production conductance/rate assembly and its Python matrix are not reused.
const base={baseWidth:.1,baseDepth:.1,baseThickness:.005,finLength:.05,finThickness:.002,finCount:8,finCells:12,k:200,rho:2700,cp:900,h:20,ambient:300,initialBase:330,initialFin:Array.from({length:12},(_,i)=>290+Math.sin(i)),power:7,contactResistance:.02};
const sum=a=>a.reduce((s,v)=>s+v,0);
const geometry=c=>({baseCapacity:c.rho*c.cp*c.baseWidth*c.baseDepth*c.baseThickness,oneFinCellCapacity:c.rho*c.cp*c.finThickness*c.baseDepth*c.finLength/c.finCells,exposedBaseArea:c.baseDepth*(c.baseWidth-c.finCount*c.finThickness),oneFinSideCellArea:2*(c.finThickness+c.baseDepth)*c.finLength/c.finCells});
function storedChange(c,s,zero){const g=geometry(c);return g.baseCapacity*(s.baseTemperature-zero.baseTemperature)+c.finCount*g.oneFinCellCapacity*sum(s.finTemperature.map((v,i)=>v-zero.finTemperature[i]));}
function outwardHeat(c,s){const g=geometry(c);return c.h*(g.exposedBaseArea*(s.baseTemperature-c.ambient)+c.finCount*g.oneFinSideCellArea*sum(s.finTemperature.map(v=>v-c.ambient)));}
const nearRelative=(a,b,tol=2e-12)=>assert.ok(Math.abs(a-b)<=tol*Math.max(Math.abs(a),Math.abs(b),1e-12),`${a} != ${b}`);

test('source minus independently integrated base and all-fin convection equals actual total stored energy, including heat entering cold fins',()=>{
 const m=createHeatSink(base),zero=m.snapshot();let state=zero,input=0;assert.ok(outwardHeat(base,state)<0,'cold lateral faces must receive heat in this fixture');
 for(let i=0;i<300;i++){
  const dt=.85*m.safeDt;input+=dt*(base.power-outwardHeat(base,state));state=m.step(dt);
  assert.ok(Math.abs(storedChange(base,state,zero)-input)<2e-8);assert.ok(Math.abs(state.netInput-input)<2e-9);
 }
 assert.ok(Math.abs(storedChange(base,state,zero))>1,'the accounting test must exercise finite heat storage');
});

test('with h zero, source heat changes the full-capacity mean exactly while internal contact only redistributes heat',()=>{
 for(const contactResistance of [0,.02]){
  const c={...base,h:0,contactResistance},m=createHeatSink(c),zero=m.snapshot(),g=geometry(c),capacity=g.baseCapacity+c.finCount*c.finCells*g.oneFinCellCapacity;
  const mean=s=>(g.baseCapacity*s.baseTemperature+c.finCount*g.oneFinCellCapacity*sum(s.finTemperature))/capacity;
  for(let i=0;i<300;i++)m.step(.8*m.safeDt,false);const s=m.snapshot();
  assert.equal(s.baseConvectionOutwardW,0);assert.equal(s.finTotalConvectionOutwardW,0);
  assert.ok(Math.abs(storedChange(c,s,zero)-c.power*s.time)<2e-8);assert.ok(Math.abs(mean(s)-mean(zero)-c.power*s.time/capacity)<2e-12);
 }
});

test('all-length lambda, h/lambda, area contact resistance times lambda, source times lambda and time times lambda squared preserve temperature histories',()=>{
 const control=createHeatSink(base),scaled=[.25,2,5].map(lambda=>({lambda,model:createHeatSink({...base,baseWidth:base.baseWidth*lambda,baseDepth:base.baseDepth*lambda,baseThickness:base.baseThickness*lambda,finLength:base.finLength*lambda,finThickness:base.finThickness*lambda,h:base.h/lambda,contactResistance:base.contactResistance*lambda,power:base.power*lambda})}));
 for(const {lambda,model}of scaled){nearRelative(model.safeDt,control.safeDt*lambda**2);nearRelative(model.snapshot().transverseBiot,control.snapshot().transverseBiot);nearRelative(model.snapshot().contactResistancePerFinKPerW,control.snapshot().contactResistancePerFinKPerW/lambda);}
 for(let i=0;i<50;i++){
  const s=control.step(.6*control.safeDt);
  for(const {lambda,model}of scaled){const t=model.step(.6*control.safeDt*lambda**2);assert.ok(Math.abs(t.baseTemperature-s.baseTemperature)<2e-12);t.finTemperature.forEach((v,j)=>assert.ok(Math.abs(v-s.finTemperature[j])<2e-12));nearRelative(t.time,s.time*lambda**2);nearRelative(t.energy,s.energy*lambda**3);nearRelative(t.netInput,s.netInput*lambda**3);}
 }
});
