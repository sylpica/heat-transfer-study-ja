// Execute the unchanged existing learning model at its independently computed
// discrete steady point. This verifies the comparator, not a physical transient.
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createHeatSink} from '../../dynamic/dev/heat-sink.mjs';
const root=new URL('../../',import.meta.url),dir=new URL('docs/dynamic/support-heatsink/',root);
const data=JSON.parse(readFileSync(new URL('REFERENCE_v2.json',dir))),c=data.learning.at(-1).config;
const m=createHeatSink(c),a=m.snapshot(),b=m.step(m.safeDt/2);
const fields=['baseTemperature','baseConvectionOutwardW','finTotalConvectionOutwardW','netExternalPowerW'];
const record={method:'Original JS executed at independent discrete steady point, followed by one real stable step',config:c,
 initial:Object.fromEntries(fields.map(p=>[p,a[p]])),afterStep:Object.fromEntries(fields.map(p=>[p,b[p]])),
 maximumTemperatureDriftK:Math.max(...a.temperature.map((v,i)=>Math.abs(v-b.temperature[i]))),
 originalAssumptions:a.assumptions,originalSourceSHA256:createHash('sha256').update(readFileSync(new URL('dynamic/dev/heat-sink.mjs',root))).digest('hex'),
 baselineFieldIsUniformBase:true,baselineRepresentsMassFlowOrLocalizedPatch:false,releaseApproved:false};
writeFileSync(new URL('LEARNING_MODEL.json',dir),JSON.stringify(record,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...record,config:{...c,initialFin:'256 finite-volume temperatures saved in record'}}));
