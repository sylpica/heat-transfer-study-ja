// ループ4使い倒し共通ライブラリ（ループ3の lib.mjs を踏襲、証拠置き場のみ変更）
import {chromium} from 'playwright';
export const DIST='http://127.0.0.1:4180';
export const SHOTS='/home/hatch/workspace/dev/heat-collation3/docs/audit-collation/evidence/usage-stress-loop4/';
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
// 節の読書画面へ到達する（目次クリック相当）。data-open-section があればそれを使い、無ければハッシュ遷移後に節リンクを探す。
export async function openSection(page,id){
  await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
  await page.waitForTimeout(1600);
  const clicked=await page.evaluate((sid)=>{
    const el=document.querySelector(`[data-open-section="${sid}"]`);
    if(el){el.click();return true;}
    return false;
  },id);
  if(!clicked){
    // 目次に無い場合は本文検索など別経路がありうるので、読書画面内の節セレクタを探す
    await page.evaluate((sid)=>{
      const sel=document.querySelector('#section-select, select[name=section]');
      if(sel){sel.value=sid;sel.dispatchEvent(new Event('change',{bubbles:true}));}
    },id);
  }
  await page.waitForTimeout(2000);
  return page.evaluate(()=>({
    h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim()).join(' ').slice(0,80),
    paras:document.querySelectorAll('#reader-article p, #reader-article .block').length,
  }));
}
// 豆腐（欠落グリフ）判定：対象文字の canvas 描画を、未定義コードポイント U+10FFFE の描画と比較する。
// 同一ピクセルならそのフォントスタックでは .notdef（豆腐）として描かれているとみなす。
export async function tofuCheck(page,chars){
  return page.evaluate((list)=>{
    const cv=document.createElement('canvas');cv.width=64;cv.height=64;
    const cx=cv.getContext('2d',{willReadFrequently:true});
    const fonts=['32px "Noto Sans","Noto Sans JP",sans-serif','32px "Noto Serif","Noto Serif JP",serif','32px sans-serif','32px serif'];
    const draw=(ch,font)=>{cx.clearRect(0,0,64,64);cx.font=font;cx.fillStyle='#000';cx.fillText(ch,4,44);return cx.getImageData(0,0,64,64).data.join(',');};
    const out={};
    for(const ch of list){
      const perFont=fonts.map(f=>{
        const a=draw(ch,f),b=draw('\u{10FFFE}',f);
        const ink=a.split(',').reduce((s,v,i)=>i%4===3?s+Number(v):s,0);
        return {font:f.slice(0,28),sameAsMissing:a===b,blank:ink===0};
      });
      out[ch]={codepoint:'U+'+ch.codePointAt(0).toString(16).toUpperCase(),perFont,
        tofuSomewhere:perFont.some(p=>p.sameAsMissing||p.blank)};
    }
    return out;
  },chars);
}
