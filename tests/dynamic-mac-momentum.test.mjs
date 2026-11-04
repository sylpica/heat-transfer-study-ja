import test from 'node:test';
import assert from 'node:assert/strict';
import {createMacMomentumStencil} from '../dynamic/dev/mac-momentum.mjs';
import {manufacturedCavity} from '../dynamic/dev/manufactured-cavity.mjs';
import {createCavity} from '../dynamic/dev/cavity.mjs';
const rms = a => Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
const cfg = n => ({nx:n,ny:n,width:1,height:1,rho:1,cp:1,nu:1,alpha:.2,initial:300,leftTemperature:300,rightTemperature:300,scalarScheme:'central',pressurePreconditioner:'multigrid',pressureTolerance:1e-12,maxPressureIterations:4000,momentumScheme:'polynomial4'});

test('high-order wall stencils reproduce shear and quadratic tangential profiles on a rectangular grid',()=>{
 const nx=12,ny=16,dx=.03,dy=.04,H=ny*dy,op=createMacMomentumStencil({nx,ny,dx,dy});
 // Local polynomial patch test: normal boundary samples are supplied too.
 // This checks derivatives, not a closed-cavity physical solution.
 for(const lid of [0,1]){
  const u=Float64Array.from({length:(nx+1)*ny},(_,n)=>{const y=(Math.floor(n/(nx+1))+.5)*dy/H;return lid?y:y*(1-y);}),v=new Float64Array(nx*(ny+1)),s=op.evaluate(u,v,lid);
  for(let j=0;j<ny;j++)for(let i=1;i<nx;i++){
   assert.ok(Math.abs(s.advectionU[j*(nx+1)+i])<2e-12);
   assert.ok(Math.abs(s.laplacianU[j*(nx+1)+i]-(lid?0:-2/H**2))<2e-10);
  }
  assert.ok(s.advectionV.every(x=>x===0));assert.ok(s.laplacianV.every(x=>x===0));
 }
});

test('momentum operators converge against independently checked continuous derivatives, including wall-adjacent faces',()=>{
 const rows=[];
 for(const n of [8,16,32]){
  const exact=manufacturedCavity(),u=Float64Array.from({length:(n+1)*n},(_,k)=>exact.velocity((k%(n+1))/n,(Math.floor(k/(n+1))+.5)/n,0)[0]),v=Float64Array.from({length:n*(n+1)},(_,k)=>exact.velocity((k%n+.5)/n,Math.floor(k/n)/n,0)[1]),o=createMacMomentumStencil({nx:n,ny:n,dx:1/n,dy:1/n}).evaluate(u,v),a=[],l=[];
  for(let j=0;j<n;j++)for(let i=1;i<n;i++){const f=exact.components(i/n,(j+.5)/n,0);a.push(o.advectionU[j*(n+1)+i]-f.advection[0]);l.push(o.laplacianU[j*(n+1)+i]-f.laplacianVelocity[0]);}
  for(let j=1;j<n;j++)for(let i=0;i<n;i++){const f=exact.components((i+.5)/n,j/n,0);a.push(o.advectionV[j*n+i]-f.advection[1]);l.push(o.laplacianV[j*n+i]-f.laplacianVelocity[1]);}
  rows.push({a:rms(a),l:rms(l)});
 }
 for(let i=1;i<3;i++){assert.ok(rows[i-1].a/rows[i].a>8);assert.ok(rows[i-1].l/rows[i].l>8);}
 assert.ok(rows[2].a<.003);assert.ok(rows[2].l<.0017);
});

test('optional momentum stencil reduces manufactured pressure error at the same mesh and fixed time step',()=>{
 const n=32,exact=manufacturedCavity(),rows=[];
 for(const momentumScheme of ['conservative2','polynomial4']){
  const m=createCavity({...cfg(n),momentumScheme},exact);
  for(let k=0;k<512;k++)m.step(.025/512,false);
  const s=m.snapshot(),p=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)p.push(s.pressure[j*n+i]-exact.pressure((i+.5)/n,(j+.5)/n,s.time));
  rows.push(rms(p));assert.ok(s.divergence<1e-8);assert.ok(Math.abs(s.energyError)<1e-8);
 }
 assert.ok(rows[1]<.0003);assert.ok(rows[0]/rows[1]>40);
 // This single manufactured case is not a general pressure accuracy approval.
});

test('different momentum schemes cannot exchange snapshots; failures leave the accepted state unchanged',()=>{
 const a=createCavity(cfg(8),manufacturedCavity()),b=createCavity({...cfg(8),momentumScheme:'conservative2'},manufacturedCavity()),old=b.snapshot();
 assert.throws(()=>b.restore(a.snapshot()),/一致/);assert.deepEqual(b.snapshot(),old);
 a.step(a.safeDt,false);const seed=a.snapshot();a.step(a.safeDt,false);const next=a.snapshot();a.restore(seed);a.step(a.safeDt,false);assert.deepEqual(a.snapshot(),next);
 assert.throws(()=>a.step(a.safeDt*1.1));assert.deepEqual(a.snapshot(),next);
 assert.throws(()=>createCavity({...cfg(8),momentumScheme:'unknown'}));assert.throws(()=>createCavity(cfg(4)));
 assert.throws(()=>createMacMomentumStencil({nx:8,ny:8,dx:0,dy:1}));
 const stencil=createMacMomentumStencil({nx:8,ny:8,dx:1,dy:1});assert.throws(()=>stencil.evaluate(new Float64Array(72).fill(NaN),new Float64Array(72)));
});
