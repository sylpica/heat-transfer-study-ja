// 最終監査ラインB共通ライブラリ（ループ3 lib.mjs を踏襲、証拠保存先を変更）
import {chromium} from 'playwright';
export const DIST='http://127.0.0.1:4180';
export const SHOTS='/home/hatch/workspace/dev/heat-collation3/docs/audit-final/evidence/';
export function makeLog(tag){
  const lines=[];
  return {
    lines,
    ok(m){lines.push('OK   '+m);console.log('OK  ',m);},
    obs(m){lines.push('OBS  '+m);console.log('OBS ',m);},
    fail(m){lines.push('FAIL '+m);console.log('FAIL',m);},
    info(m){lines.push('INFO '+m);console.log('INFO',m);},
  };
}
export async function newPage(browser,{width=375,height=812,dark=false}={}){
  const ctx=await browser.newContext({viewport:{width,height},colorScheme:dark?'dark':'light'});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,200));});
  return {ctx,page,errors};
}
export async function overflow(page){
  return page.evaluate(()=>({doc:document.documentElement.scrollWidth,win:innerWidth,
    bad:document.documentElement.scrollWidth>innerWidth+1}));
}
export async function launch(){return chromium.launch();}
export function errorSummary(log,errors,tag){
  const pe=errors.filter(e=>e.startsWith('pageerror'));
  const ce=errors.filter(e=>e.startsWith('console'));
  if(ce.length)log.info(tag+' console errors（観察）: '+JSON.stringify(ce.slice(0,4)));
  if(pe.length)log.fail(tag+' pageerror: '+pe.join(' | '));
  else log.ok(tag+' pageerror 0');
  return pe.length;
}
