// ループ3使い倒し共通ライブラリ（ループ2の lib.mjs を踏襲）
import {chromium} from 'playwright';
export const DIST='http://127.0.0.1:4180';
export const SHOTS='/home/hatch/workspace/dev/heat-collation3/docs/audit-collation/usage-evidence-loop3/';
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
