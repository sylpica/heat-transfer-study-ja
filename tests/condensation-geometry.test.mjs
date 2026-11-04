import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [deep,bank]=await Promise.all(['original-deep-lessons','questions'].map(async n=>JSON.parse(await readFile(new URL('../data/'+n+'.json',import.meta.url)))));
const lesson=deep.lessons.find(l=>l.sectionId==='8.5'),get=key=>bank.find(q=>q.id==='supp-condensation-geometry-'+key+'-v1');
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
const simpson=(fn,a,b,n=4000)=>{let sum=fn(a)+fn(b);for(let i=1;i<n;i++)sum+=(i%2?4:2)*fn(a+(b-a)*i/n);return sum*(b-a)/(3*n);};
const choicesMatch=(key,values,t=.005)=>{const q=get(key),n=q.answer,rotated=n?values.slice(-n).concat(values.slice(0,-n)):values;for(let i=0;i<4;i++)assert.ok(Math.abs(parseFloat(q.choices[i])-rotated[i])<=t*Math.abs(rotated[i]),key+': '+q.choices[i]);assert.equal(q.choices.filter(s=>Math.abs(parseFloat(s)-values[0])<=t*Math.abs(values[0])).length,1);};

test('subcooling correction uses liquid Pr and Ja with the condensation coefficients and a consistent mass balance',()=>{
 const Pr=2,Ja=.02,hfg=2e6,corrected=hfg+( .683-.228/Pr)*Ja*hfg;
 close(corrected,2022760);choicesMatch('effective-latent',[corrected/1e6,2,(2*hfg-corrected)/1e6,(1+.683-.228/Pr)*hfg/1e6]);
 const inputHeat=2200,effective=2.2e6,mass=inputHeat/effective;close(mass,.001);close(mass*effective,inputHeat);
 // Options here use ×10^n rather than parseFloat-ready powers. Interpret each as SI.
 const q=get('corrected-mass'),parse=s=>{const m=s.match(/^([\d.]+)(?:×10⁻([³]))?/);return Number(m[1])*(m[2]?1e-3:1);};
 const values=[mass,2200/2e6,mass*1000,2200*effective],n=q.answer,rotated=values.slice(-n).concat(values.slice(0,-n));
 for(let i=0;i<4;i++){
  const s=q.choices[i];const value=s.includes('10⁹')?parseFloat(s)*1e9:parse(s);close(value,rotated[i]);
 }
 assert.equal(q.choices.filter(s=>s==='1.00×10⁻³ kg/s').length,1);
});

test('added geometry example uses the effective latent heat consistently and preserves the earlier uncorrected example',()=>{
 const rho=950,rhov=.6,k=.68,mu=2.8e-4,hfg=2.25e6,g=9.81,cp=4000,deltaT=10,D=.04,L=.02,b=.5;
 const Pr=cp*mu/k,Ja=cp*deltaT/hfg,hp=hfg*(1+(.683-.228/Pr)*Ja);
 close(Pr,1.6470588235294115);close(Ja,.017777777777777778);close(hp,2271782.8571428573);
 const term=length=>rho*(rho-rhov)*g*hp*k**3/(mu*length*deltaT),hv=.943*term(L)**.25,hc=.728*term(D)**.25,hs=.828*term(D)**.25;
 close(hv,17284.17023223046);close(hc,11220.461571932114);close(hs,12761.733765878831);
 const Q=hv*L*b*deltaT,mass=Q/hp;close(Q,1728.417023223046);close(mass,.0007608196433865235);
 close(hc*Math.PI*D*.1*deltaT,1410.0047857707407);close(hs*Math.PI*D*D*deltaT,641.4747047352598);
 const delta=(4*mu*k*deltaT*L/(rho*(rho-rhov)*g*hp))**.25;
 const u=y=>(rho-rhov)*g/mu*(delta*y-y*y/2),Gamma=rho*delta/6*(u(0)+4*u(delta/2)+u(delta));
 // The 0.943 prefactor is rounded from 4/(3*4^.25), so distinguish rounding from an energy leak.
 close(Gamma*b*hp,(4/3)*k/delta*L*b*deltaT,1e-9);close(Gamma*b,mass,3e-4);
 close(hv/(.943*(term(L)*hfg/hp)**.25),(hp/hfg)**.25);
 close(mass/(b*mu),5.434426024189453);close(4*mass/(b*mu),21.737704096757813);
 assert.match(lesson.workedExample.answer,/1\.724 kW/);assert.ok(lesson.workedExample.steps.some(s=>s.includes('1728.42')));
});

test('cylinder average coefficient follows integration of perimeter mass addition rather than a copied shape constant',()=>{
 // On one half of a horizontal cylinder, g_t=g sin(phi). Γ^(4/3) is proportional
 // to the upstream integral of sin(phi)^(1/3). phi=(pi/2)t^3 removes the top singularity.
 const integral=2*simpson(t=>3*Math.PI/2*t*t*Math.sin(Math.PI/2*t**3)**(1/3),0,1);
 close(integral,2.58710955922979,1e-10);
 const coefficient=2/Math.PI*(2*integral/3)**.75*3**(-.25);
 close(coefficient,.7280186089474988);close(coefficient,.728,3e-5);
 choicesMatch('cylinder-coefficient',[.728*15000/1e4,.828*15000/1e4,.943*15000/1e4,1.5]);
 choicesMatch('sphere-ratio',[.828/.728,.728/.828,1,(.828/.728)**.25]);
 const diameter=.04,cylinderArea=Math.PI*diameter*.1,sphereArea=Math.PI*diameter**2;
 assert.ok(sphereArea/cylinderArea*.828/.728<1,'larger sphere h does not imply larger Q for these areas');
});

test('effective gravity reduces for constant tangential forcing and the incline comparison fixes sloped length',()=>{
 const g=9.81,theta=Math.PI/3,tangent=g*Math.cos(theta),x=.2,R=.08;
 const integral=simpson(()=>tangent**(1/3)*R**(4/3),0,x);
 const effective=x*(tangent*R)**(4/3)/integral;close(effective,tangent);
 const hRatio=(effective/g)**.25;close(hRatio,.8408964152537145);
 choicesMatch('inclination',[hRatio,.5,Math.sin(theta)**.25,1/hRatio]);
 assert.ok(lesson.blocks.some(b=>b.text.includes('θ→90°')&&b.text.includes('ゼロとはいえない')));
 const choice=get('curved-film-history');assert.match(choice.choices[choice.answer],/上流積分/);
 const limit=get('horizontal-limit');assert.match(limit.choices[limit.answer],/排液や膜保持/);
});

test('film Reynolds conventions and bundle mean area remain distinct from local transport quantities',()=>{
 const Gamma=.02,mu=.00025,Re=Gamma/mu,Re4=4*Re;close(Re,80);close(Re4,320);
 const q=get('reynolds-definitions'),values=[[Re,Re4],[Re4,Re],[Re,Re],[Re/1000,Re4/1000]],n=q.answer;
 const rotated=values.slice(-n).concat(values.slice(0,-n));
 for(let i=0;i<4;i++){const nums=[...q.choices[i].matchAll(/=(\d+(?:\.\d+)?)/g)].map(m=>+m[1]);assert.deepEqual(nums,rotated[i]);}
 close(4*7,28);close(4*400,1600);assert.ok(lesson.equations.some(e=>e.meaning.includes('1600')));
 const nTubes=64,a=1/6,meanRatio=nTubes**(-a),heatRatio=nTubes*meanRatio;close(meanRatio,.5);close(heatRatio,32);
 choicesMatch('bundle-mean',[heatRatio,meanRatio,nTubes,nTubes**(1-1/4)]);
});

test('new questions retain unique revision identities and remain internal drafts pending comprehensive and expert review',()=>{
 const added=bank.filter(q=>q.id.startsWith('supp-condensation-geometry-'));assert.equal(added.length,9);assert.equal(new Set(added.map(q=>q.id)).size,9);
 assert.deepEqual(added.map(q=>q.answer),[0,1,2,3,0,1,2,3,0]);assert.equal(new Set(added.map(q=>q.questionKind)).size,3);
 for(const q of added){assert.equal(q.revision,'v1');assert.equal(q.expertReviewed,false);assert.equal(q.source.focusSectionId,'8.5');assert.match(q.reviewStatus,/包括的品質監査/);assert.equal(q.choices.length,4);assert.equal(q.distractors.filter(r=>r.startsWith('正解。')).length,1);assert.ok(q.distractors[q.answer].startsWith('正解。'));}
 assert.match(lesson.reviewStatus,/外部学術専門家校閲前/);assert.equal(deep.translation,false);assert.equal(deep.expertReviewed,false);
});
