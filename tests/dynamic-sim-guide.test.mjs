import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {popupPlacement,guideStorageKey,readGuidePreference,writeGuidePreference} from '../dynamic/sim-guide.mjs';
import {LAB_GUIDE_STEPS} from '../dynamic/lab-guide.mjs';

// The popup guide (dynamic/sim-guide.mjs) is the coach-mark companion to the
// in-app manuals. These tests pin the pure placement math, the persisted
// on/off preference, and that every step of every shipped guide points at an
// element that actually exists on its screen.
const htmlIds=async path=>{
  const html=await readFile(new URL(path,import.meta.url),'utf8');
  return new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]));
};
const checkSteps=(steps,ids,label)=>{
  assert.ok(steps.length>=4,`${label}: at least 4 steps`);
  const seen=new Set();
  for(const step of steps){
    assert.ok(step.title?.trim(),`${label}: title`);
    assert.ok(step.text?.trim().length>=20,`${label}: text for ${step.title}`);
    assert.match(step.target,/^#[A-Za-z][\w-]*$/,`${label}: target is an id selector`);
    assert.ok(ids.has(step.target.slice(1)),`${label}: ${step.target} exists on the screen`);
    assert.ok(!seen.has(step.target),`${label}: ${step.target} not repeated`);
    seen.add(step.target);
  }
};

test('popup placement prefers below, falls back above, and always clamps inside the viewport',()=>{
  const view={width:375,height:667},size={width:320,height:180};
  const below=popupPlacement({left:10,top:100,right:200,bottom:140},size,view);
  assert.equal(below.side,'below');assert.equal(below.top,150);assert.equal(below.left,10);
  const above=popupPlacement({left:10,top:600,right:200,bottom:640},size,view);
  assert.equal(above.side,'above');assert.equal(above.top,410);
  const clamped=popupPlacement({left:300,top:100,right:370,bottom:140},size,view);
  assert.equal(clamped.left,375-8-320);
  const centered=popupPlacement(null,size,view);
  assert.equal(centered.side,'center');assert.ok(centered.left>=8&&centered.left+320<=375-8+1);
  for(const spot of [below,above,clamped,centered]){
    assert.ok(spot.left>=8&&spot.top>=8&&spot.left+320<=375&&spot.top+180<=667+8,JSON.stringify(spot));
  }
});

test('guide preference persists per screen id and defaults to off',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
  assert.equal(guideStorageKey('lab'),'heat-sim-guide:lab');
  assert.equal(readGuidePreference(storage,'lab'),false);
  writeGuidePreference(storage,'lab',true);
  assert.equal(readGuidePreference(storage,'lab'),true);
  writeGuidePreference(storage,'dev-cavity',true);
  writeGuidePreference(storage,'lab',false);
  assert.equal(readGuidePreference(storage,'lab'),false);
  assert.equal(readGuidePreference(storage,'dev-cavity'),true);
  assert.equal(readGuidePreference(null,'lab'),false);
  writeGuidePreference(null,'lab',true); // must not throw without storage
});

test('lab guide steps target elements that exist in dynamic/index.html',async()=>{
  const ids=await htmlIds('../dynamic/index.html');
  checkSteps(LAB_GUIDE_STEPS,ids,'lab guide');
  assert.equal(LAB_GUIDE_STEPS.at(-1).target,'#manual-toggle','last step points at the manual, keeping guide and manual roles separate');
});

const DEV_GUIDES=[
  ['sim-guide-cavity.mjs','cavity.html'],
  ['sim-guide-natconv-wall.mjs','natural-convection-wall.html'],
  ['sim-guide-annular-fin.mjs','annular-fin.html'],
  ['sim-guide-fin-tip.mjs','fin-convective-tip.html'],
  ['sim-guide-heat-sink.mjs','heat-sink.html'],
  ['sim-guide-box-radiation.mjs','box-radiation-3d.html'],
  ['sim-guide-long-duct.mjs','long-duct.html'],
  ['sim-guide-brick-3d.mjs','transient-brick-3d.html'],
  ['sim-guide-radial-multilayer.mjs','radial-multilayer.html'],
];
test('every dev guide targets existing elements and is loaded by its screen',async()=>{
  const ids=new Set(['lab']);
  for(const [moduleFile,htmlFile] of DEV_GUIDES){
    const mod=await import(new URL(`../dynamic/dev/${moduleFile}`,import.meta.url));
    assert.ok(!ids.has(mod.GUIDE_ID),`guide id ${mod.GUIDE_ID} unique`);ids.add(mod.GUIDE_ID);
    const html=await readFile(new URL(`../dynamic/dev/${htmlFile}`,import.meta.url),'utf8');
    assert.ok(html.includes(`src="${moduleFile}"`),`${htmlFile} loads ${moduleFile}`);
    checkSteps(mod.GUIDE_STEPS,new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1])),moduleFile);
  }
  assert.equal(ids.size,10);
});

test('guide modules are wired into the public build and the app shell',async()=>{
  const build=await readFile(new URL('../scripts/build-public-site.mjs',import.meta.url),'utf8');
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  const lab=await readFile(new URL('../dynamic/lab.mjs',import.meta.url),'utf8');
  for(const name of ['dynamic/sim-guide.mjs','dynamic/lab-guide.mjs']){
    assert.ok(build.includes(`'${name}'`),`build lists ${name}`);
    assert.ok(sw.includes(`'./${name}'`),`sw shell lists ${name}`);
  }
  assert.match(lab,/initLabGuide\(\)/);
});
