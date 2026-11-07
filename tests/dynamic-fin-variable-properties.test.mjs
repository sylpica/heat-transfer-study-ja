import test from 'node:test';import assert from 'node:assert/strict';
import {createThermal} from '../dynamic/thermal.mjs';import {finLearningConfigs,finObservation,steadyFinPrediction,FinJourney} from '../dynamic/fin-learning.mjs';
// Acceptance tests for fin lateral convection with k(T)/cp(T) tables
// (fin-coupling-verification-20261107.md section 3, conditions (b)1-4).
// Pinned values are from that record's independent references: R1 = shooting
// BVP steady solution for k(T) (base/side power 5.2175206390735855 W, cell
// averages below), R2 = enthalpy-form FV + BDF2/Newton transient profiles for
// k(T)+cp(T) aggregated to the 48-cell grid. Test property tables are the
// record's mathematical verification tables, not real materials.
const KT=[[250,150],[400,250]],CPT=[[250,700],[400,1000]];
const R1_24=[352.6605496070556,351.7111974843236,350.8058923811401,349.94427690906883,349.1260072181317,348.3507533631073,347.6181996552672,346.92804499900126,346.2800032129465,345.67380333525927,345.10918991266965,344.58592327296026,344.1037797805002,343.66255207448825,343.2620492899203,342.9020972608784,342.5825387059864,342.30323339573835,342.06405830155006,341.8649077264913,341.705693417657,341.5863446601352,341.5068083522218,341.46704906116116];
const R1_48=[352.9034221610571,352.41767705305404,351.94301257280557,351.4793823958417,351.0267410141249,350.58504374815516,350.1542467588624,349.73430705927524,349.3251825259691,348.92683191029425,348.53921484936996,348.1622918768446,347.79602443341696,347.44037487711734,347.09530649334465,346.7607835046578,346.43677108031744,346.1232353455756,345.8201433907113,345.5274632798072,345.2451640592676,344.9732157660716,344.7115894357611,344.46025711015943,344.2191918448188,343.9883677161816,343.76775982849995,343.55734432047655,343.3570983716024,343.16700020823816,342.9870291094139,342.81716541234294,342.65739051765127,342.50768689432164,342.3680380843515,342.2384287071252,342.118844463499,342.009272139601,341.90969961034205,341.8201158426406,341.7405108983594,341.6708759369545,341.61120321783517,341.56148610243514,341.52171905591155,341.4918976485321,341.47201855700473,341.4620795653176];
const R2_100=[352.83159831116836,352.2020217556366,351.58327653946515,350.975482795621,350.3787623505407,349.7932385247135,349.21903593016236,348.6562802650916,348.1050981059852,347.56561669744826,347.0379637400977,346.52226717681793,346.01865497770865,345.5272549240632,345.0481943917233,344.58160013416796,344.12759806570205,343.6863130451168,343.25786866020485,342.8423870135162,342.4399885097477,342.05079164516474,341.6749127994561,341.31246603042615,340.96356287192964,340.62831213545655,340.3068197157701,339.9991884010034,339.70551768761345,339.4259036005881,339.16043851929487,338.9092110093558,338.67230566091854,338.44980293369076,338.24177900908694,338.0483056498301,337.8694500673316,337.70527479716077,337.55583758289873,337.42119126865174,337.30138370048246,337.19645763699674,337.1064506693032,337.03139515054033,336.97131813514585,336.92624132801427,336.8961810436724,336.88114817557124];
const R2_600=[352.90339017708175,352.4176450548691,351.942980553666,351.4793503493613,351.02670893427813,350.58501162927803,350.1542145956515,349.73427484678973,349.3251502596335,348.92679958589656,348.5391824630585,348.16225942512386,347.7959919131447,347.44034228550186,347.0952738279435,346.7607507633761,346.4367382614059,346.1232024476276,345.8201104126584,345.52743022091266,345.24513091911734,344.97318254456366,344.7115561330941,344.4602237268213,344.21915838157815,343.9883341740958,343.7677262089088,343.55731062498455,343.35706460207643,343.1669663667976,342.9869951984161,342.81713143436735,342.6573564754847,342.5076527909453,342.36800392293185,342.2383944910067,342.1188101962004,342.00923782481027,341.9096652519114,341.82008144457706,341.7404764648087,341.6708414721747,341.6111687261577,341.56145158820914,341.52168452351157,341.49186310244716,341.471984001774,341.4620450055071];
const fin=nx=>({nx,ny:1,width:.1,height:.01,depth:.01,materials:[{k:200,rho:2700,cp:896}],initial:293.15,boundaries:{left:{type:'temperature',temperature:353.15},right:{type:'insulated'},top:{type:'insulated'},bottom:{type:'insulated'}},source:0,distributedConvection:{h:25,areaPerVolume:400,temperature:293.15}});
const withTables=(nx,k=true,cp=false)=>{const c=fin(nx);if(k)c.materials[0].kTable=structuredClone(KT);if(cp)c.materials[0].cpTable=structuredClone(CPT);return c;};
const runTo=(m,t,dt)=>{while(m.time<t-1e-12)m.step(Math.min(dt??m.safeDt,t-m.time),false);return m.snapshot();};
const maxDiff=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));

test('k(T) fin steady state converges to the shooting-BVP reference at second order',()=>{
 const errors={};
 for(const nx of [24,48]){const s=runTo(createThermal(withTables(nx)),1500);errors[nx]=maxDiff(s.temperature,nx===24?R1_24:R1_48);}
 assert.ok(errors[24]<1.1e-2,`nx=24 error ${errors[24]}`);
 assert.ok(errors[48]<2.8e-3,`nx=48 error ${errors[48]}`);
 const order=Math.log2(errors[24]/errors[48]);assert.ok(order>1.8&&order<2.2,`observed order ${order}`);
});

test('observation uses the table k at the base cell, so display matches the solved flux',()=>{
 const config=withTables(48),s=runTo(createThermal(config),1500),observed=finObservation(config,s);
 assert.ok(Math.abs(observed.basePowerW-5.2175206390735855)<.01,`base power ${observed.basePowerW}`);
 assert.ok(Math.abs(observed.sidePowerW-5.2175206390735855)<.01,`side power ${observed.sidePowerW}`);
 assert.ok(Math.abs(observed.basePowerW-observed.sidePowerW)<2e-3);
 // The pre-acceptance reading (nominal constant k) is far off, which is why
 // the table-aware path is required instead of a silent nominal substitution.
 const nominal=2*200*1e-4/(.1/48)*(353.15-s.temperature[0]);
 assert.ok(Math.abs(nominal-5.2175206390735855)>.1,`nominal-k reading ${nominal}`);
 // The analytic prediction refuses tables explicitly rather than desyncing.
 assert.throws(()=>steadyFinPrediction(config),/一定物性/);
 // The learning layer keeps its fixed-condition scope and refuses tables.
 const configs=finLearningConfigs(48);configs[0].materials[0].kTable=structuredClone(KT);
 const models=configs.map(createThermal),journey=new FinJourney();
 assert.throws(()=>journey.prepare({configs,snapshots:models.map(m=>m.snapshot())}),/一致しません/);
});

test('k(T)+cp(T) transient matches the independent reference and is first order in time',()=>{
 const config=withTables(48,true,true),m=createThermal(config);
 const s100=runTo(m,100);assert.ok(maxDiff(s100.temperature,R2_100)<4e-3,`t=100 diff ${maxDiff(s100.temperature,R2_100)}`);
 const s600=runTo(m,600);assert.ok(maxDiff(s600.temperature,R2_600)<4e-3,`t=600 diff ${maxDiff(s600.temperature,R2_600)}`);
 assert.ok(s600.relativeEnergyError<1e-10);
 const fine=runTo(createThermal(config),100,m.safeDt/4);
 const dtEffect=maxDiff(s100.temperature,fine.temperature);
 assert.ok(dtEffect>4e-4&&dtEffect<2e-3,`dt refinement effect ${dtEffect}`);
});

test('dt=safeDt stays stable for a coarse grid with large h and tables',()=>{
 const c=withTables(8);c.distributedConvection.h=500;const m=createThermal(c);
 for(let t=5;t<=60;t+=5){const s=runTo(m,t);assert.ok(s.min>=293.15-1e-9&&s.max<=353.15+1e-9,`envelope at ${t} s: ${s.min}..${s.max}`);assert.ok(s.relativeEnergyError<1e-9);}
});

test('property tables stop outside their range instead of extrapolating, including the base face',()=>{
 const near=fin(24);near.materials[0].kTable=[[250,150],[360,260]];
 const s=runTo(createThermal(near),1500);assert.ok(s.max<=353.15);
 const out=fin(24);out.materials[0].kTable=[[250,150],[340,240]];
 const m=createThermal(out);assert.throws(()=>m.step(m.safeDt),/物性表の範囲/);
 const outCp=fin(24);outCp.materials[0].cpTable=[[300,700],[400,1000]];
 assert.throws(()=>createThermal(outCp),/物性表の範囲/);
});
