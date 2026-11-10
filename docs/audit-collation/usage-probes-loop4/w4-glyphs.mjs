// W4 復元グリフの実レンダリング確認：存在件数／canvas 豆腐判定／DSF=2 の拡大スクリーンショット
import {launch,newPage,DIST,SHOTS,makeLog,overflow,tofuCheck} from './lib.mjs';
const log=makeLog('W4');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

// ---------- 存在件数（記事本文の textContent） ----------
const targets=[
  ['10.4',{'ℱ':'\u2131'}],
  ['11.10',{'𝒟':'\u{1D49F}'}],
  ['11.11',{'𝒟':'\u{1D49F}','𝒩':'\u{1D4A9}','𝔪':'\u{1D52A}','⦵':'\u29B5'}],
  ['4.2',{'𝒯':'\u{1D4AF}','𝒳':'\u{1D4B3}'}],
  ['11.6',{'𝒢':'\u{1D4A2}','𝒟':'\u{1D49F}'}],
];
for(const [id,chars] of targets){
  await page.goto(DIST+'/index.html#reader/'+id,{waitUntil:'load'});
  await page.waitForTimeout(2400);
  const counts=await page.evaluate((cs)=>{
    const t=document.querySelector('#reader-article')?.textContent||'';
    const out={};
    for(const [name,ch] of Object.entries(cs))out[name]=(t.split(ch).length-1);
    return out;
  },chars);
  log.info('§'+id+' グリフ件数: '+JSON.stringify(counts));
  for(const [name,n] of Object.entries(counts)){
    if(n>0)log.ok('§'+id+' に '+name+' が '+n+' 件レンダリングされている'); else log.fail('§'+id+' に '+name+' が無い');
  }
  const ov=await overflow(page);
  if(ov.bad)log.fail('§'+id+' 横はみ出し: '+JSON.stringify(ov));
}

// ---------- canvas 豆腐判定 ----------
await page.goto(DIST+'/index.html#reader/10.4',{waitUntil:'load'});
await page.waitForTimeout(1500);
const chars=['\u2131','\u{1D49F}','\u{1D4A2}','\u{1D4A9}','\u{1D52A}','\u{1D4AF}','\u{1D4B3}','\u29B5'];
const tofu=await tofuCheck(page,chars);
for(const [ch,r] of Object.entries(tofu)){
  const fonts=r.perFont.map(p=>p.font.split(' ')[1]+(p.sameAsMissing?':TOFU':p.blank?':BLANK':':ok')).join(' ');
  log.info('豆腐判定 '+ch+' ('+r.codepoint+'): '+fonts);
  if(!r.tofuSomewhere)log.ok(ch+' は全フォントスタックで実グリフとして描画される');
  else log.obs(ch+' は一部スタックで豆腐/空白: '+fonts);
}
// 実際にページで使われているフォントでの判定を補強：本文要素の computed font-family で再測定
const bodyFont=await page.evaluate(()=>{
  const el=[...document.querySelectorAll('#reader-article p')].find(p=>p.textContent.includes('\u2131'));
  return el?getComputedStyle(el).fontFamily:'(ℱを含む段落なし)';
});
log.info('§10.4 で ℱ を含む段落の font-family: '+bodyFont);
const tofuBody=await page.evaluate((list)=>{
  const el=[...document.querySelectorAll('#reader-article p')].find(p=>p.textContent.includes('\u2131'));
  const fam=el?getComputedStyle(el).fontFamily:'sans-serif';
  const cv=document.createElement('canvas');cv.width=64;cv.height=64;
  const cx=cv.getContext('2d',{willReadFrequently:true});
  const draw=(ch)=>{cx.clearRect(0,0,64,64);cx.font='32px '+fam;cx.fillStyle='#000';cx.fillText(ch,4,44);return cx.getImageData(0,0,64,64).data.join(',');};
  const miss=draw('\u{10FFFE}');
  const out={};
  for(const ch of list)out[ch]=draw(ch)!==miss;
  return {fam,out};
},chars);
log.info('本文フォント ('+tofuBody.fam+') での実グリフ判定: '+JSON.stringify(tofuBody.out));
const allOk=Object.values(tofuBody.out).every(v=>v);
if(allOk)log.ok('本文フォントでは対象グリフ全てが実グリフとして描画される（豆腐でない）');
else log.obs('本文フォントで豆腐の可能性があるグリフあり: '+JSON.stringify(tofuBody.out));

// ---------- DSF=2 拡大スクリーンショット ----------
const {ctx:ctx2,page:page2,errors:errors2}=await newPage(browser,{width:375});
await ctx2.close().catch(()=>{});
// deviceScaleFactor 付きで作り直す
const ctx3=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:2});
const page3=await ctx3.newPage();
const errs3=[];page3.on('pageerror',e=>errs3.push(e.message));
page3.setDefaultTimeout(120000);
const shotEl=async(id,predicate,file)=>{
  await page3.goto(DIST+'/index.html#reader/'+id,{waitUntil:'load'});
  await page3.waitForTimeout(2400);
  const el=page3.locator('#reader-article *').filter({hasText:predicate}).last();
  if(await el.count()){
    await el.scrollIntoViewIfNeeded().catch(()=>{});
    await page3.waitForTimeout(500);
    await el.screenshot({path:SHOTS+file}).catch(e=>log.info('shot '+file+': '+e.message));
    log.info('拡大撮影: '+file);
  }else log.obs('拡大撮影の対象要素なし: '+id+' '+file);
};
await shotEl('10.4',/ℱ1/, 'w4-glyph-scriptF-104-375@2x.png');
await shotEl('11.11',/𝒟ij/, 'w4-glyph-scriptD-1111-375@2x.png');
await shotEl('11.11',/⦵/, 'w4-glyph-standard-1111-375@2x.png');
await shotEl('4.2',/𝒯/, 'w4-glyph-scriptT-42-375@2x.png');
await shotEl('2.4',/h\u0304/, 'w4-overline-24-375@2x.png');
log.info('page3 pageerrors: '+JSON.stringify(errs3));
await ctx3.close();

log.info('W4 errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
if(!errors.some(e=>e.startsWith('pageerror')))log.ok('W4 セッション pageerror 0');
else log.fail('W4 pageerror: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('W4 DONE');
