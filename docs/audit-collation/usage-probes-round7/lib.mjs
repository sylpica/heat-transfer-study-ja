// ラウンド7使い倒し共通ライブラリ（ループ4 lib.mjs を踏襲、証拠置き場を変更）
import {chromium} from 'playwright';
export const DIST='http://127.0.0.1:4180';
export const SHOTS='/home/hatch/workspace/dev/heat-r7-a5/docs/audit-collation/evidence/usage-stress-round7/';
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
// 記事内部で横にはみ出す要素（scrollWidth > clientWidth+1）を列挙する
export async function innerOverflow(page,rootSel='#reader-article'){
  return page.evaluate((sel)=>{
    const root=document.querySelector(sel)||document.body;
    const out=[];
    for(const e of root.querySelectorAll('*')){
      if(e.scrollWidth>e.clientWidth+1&&e.clientWidth>0){
        const cs=getComputedStyle(e);
        out.push({tag:e.tagName,cls:(e.className.baseVal!==undefined?'svg':String(e.className)).slice(0,40),
          sw:e.scrollWidth,cw:e.clientWidth,ox:cs.overflowX,text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,60)});
        if(out.length>=12)break;
      }
    }
    return out;
  },rootSel);
}
export async function launch(){return chromium.launch();}
export async function openSection(page,id){
  await page.goto(DIST+'/index.html#reader/'+id,{waitUntil:'load'});
  await page.waitForTimeout(2400);
  return page.evaluate(()=>({
    h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,80),
    paras:document.querySelectorAll('#reader-article p, #reader-article .block').length,
  }));
}
// 記事本文テキストの対象文字列カウント（添字は textContent では平たく連結される）
export async function termCounts(page,rootSel='#reader-article'){
  return page.evaluate((sel)=>{
    const root=document.querySelector(sel)||document.body;
    const t=root.textContent||'';
    const cnt=(re)=>(t.match(re)||[]).length;
    return {
      scriptG:cnt(/𝒢/g),
      gm_i:cnt(/gm,i/g),
      gm_2:cnt(/gm,2/g),
      gmStar:cnt(/g\*m/g),
      hfg:cnt(/hfg/g),
      hPrimeFg:cnt(/h′fg/g),
      chars:t.length,
    };
  },rootSel);
}
