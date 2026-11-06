// Export deterministic OWN fields for the separate Python verifier, not for release.
import {createBlasiusBoundaryFlow,blasiusSimilarity} from '../dynamic/dev/blasius-boundary-flow.mjs';import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const base={width:1,height:.12,depth:.03,nu:.0001,rho:1,freeStreamVelocity:1},cases=[
 ...[16,32,64].map(n=>({name:`base-${n}`,config:{...base,nx:n,ny:n}})),
 {name:'scaled',config:{...base,width:4,height:.48,depth:.15,nu:.0012,rho:7,freeStreamVelocity:3,nx:32,ny:32}},
 {name:'Re-upper-eta-upper',config:{...base,height:24/Math.sqrt(1e5),nu:.00001,nx:64,ny:48}},
 {name:'eta-lower',config:{...base,height:.1,nx:48,ny:40}},
 {name:'streamwise-512',config:{...base,nx:512,ny:128}},
 {name:'dimensional-air-flow',config:{...base,width:.2,height:.025,nu:1.5e-5,rho:1.177,nx:32,ny:32}},
];
const bytes=readFileSync(new URL('../dynamic/dev/blasius-boundary-flow.mjs',import.meta.url));
console.log(JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),generatorSHA256:createHash('sha256').update(bytes).digest('hex'),environment:{node:process.version,platform:process.platform},similaritySamples:[0,.001,.037,.25,.5,1,2,3,4,5,6,7,8,9,10,11,11.9999,12,12.0001,16,24].map(eta=>({eta,...blasiusSimilarity(eta)})),cases:cases.map(({name,config})=>({name,flow:createBlasiusBoundaryFlow(config)})),releaseApproved:false}));
