// V4 主要パス：読書パネル／検索／簡易シミュレーター／通常ラボ＋ポップアップガイド／使い方ガイド
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('V4');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(180000);
const visPop=()=>page.evaluate(()=>{
  const p=document.querySelector('.sim-guide-pop, [data-sim-guide], .guide-popover');
  if(!p)return {exists:false};
  const r=p.getBoundingClientRect(),cs=getComputedStyle(p);
  return {exists:true,visible:r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden',
          text:p.textContent.replace(/\s+/g,' ').slice(0,80)};
});

// ---------- A. 読書：章末問題パネル・付録 ----------
await page.goto(DIST+'/index.html#reader',{waitUntil:'load'});
await page.waitForTimeout(2500);
const chOpened=await page.evaluate(()=>{
  const bs=[...document.querySelectorAll('button')].filter(b=>/章末問題・参考文献/.test(b.textContent));
  if(bs.length>=9){bs[8].click();return bs.length;}
  return bs.length;
});
await page.waitForTimeout(1800);
const panel=await page.evaluate(()=>({
  has9:/問題\s*9\./.test(document.body.textContent),
  sample:(document.body.textContent.replace(/\s+/g,' ').match(/問題\s*9\.\d+[^。]{0,40}/)||[])[0]||null,
}));
log.info('章末問題パネル（第9章）: ボタン数='+chOpened+' '+JSON.stringify(panel));
if(panel.has9)log.ok('目次から第9章の章末問題パネルが開く');
await page.screenshot({path:SHOTS+'v4-chapter9-panel-375.png'});
const apx=await page.evaluate(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/付録A/.test(b.textContent));
  if(b){b.click();return b.textContent.trim().slice(0,30);}return null;
});
await page.waitForTimeout(1800);
const apxBody=await page.evaluate(()=>({hasA1:document.body.textContent.includes('[A.1]')}));
log.info('付録Aボタン: '+apx+' / [A.1]表示: '+apxBody.hasA1);
if(apxBody.hasA1)log.ok('付録Aの参考文献 [A.1] が表示される');

// ---------- B. 検索 ----------
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(1500);
await page.fill('#search-query','熱抵抗');
await page.click('button[type=submit]');
await page.waitForTimeout(2000);
const reach=await page.evaluate(()=>{
  const a=[...document.querySelectorAll('main a, main button')].find(e=>/熱抵抗/.test(e.textContent)&&e.textContent.length<80);
  if(a){a.click();return a.textContent.trim().slice(0,40);}return null;
});
await page.waitForTimeout(1800);
const now=await page.evaluate(()=>({hash:location.hash}));
log.info('本文検索「熱抵抗」→ '+reach+' → '+now.hash);
if(/reader/.test(now.hash))log.ok('本文検索結果から読書画面へ到達');
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(1200);
const kinds=await page.evaluate(()=>{const s=document.querySelector('select[name=kind]');return s?[...s.options].map(o=>({v:o.value,t:o.textContent})):[];});
const pk=kinds.find(k=>/章末問題/.test(k.t));
if(pk){
  await page.selectOption('select[name=kind]',pk.v);
  await page.fill('#search-query','木星の大気');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2200);
  const sr=await page.evaluate(()=>[...document.querySelectorAll('main a, main button, main li')].filter(e=>/木星|11\.3/.test(e.textContent)).slice(0,3).map(e=>e.textContent.trim().slice(0,60)));
  log.info('章末問題検索: '+JSON.stringify(sr));
  if(sr.length)log.ok('種別=章末問題で問題11.3（木星の大気）に到達できる');
  await page.screenshot({path:SHOTS+'v4-search-problem-375.png'});
}else log.obs('検索種別に章末問題がない');

// ---------- C. 簡易シミュレーター ----------
await page.goto(DIST+'/index.html#simulator',{waitUntil:'load'});
await page.waitForTimeout(2000);
const barState=await page.evaluate(()=>({
  changeBtn:!![...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent)),
  modeBtnsVisible:[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/伝導|放射|対流/.test(b.textContent)&&b.textContent.length<30).length,
}));
log.info('初期状態（ピッカー閉）: '+JSON.stringify(barState));
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
await page.waitForTimeout(1000);
const picker=await page.evaluate(()=>({
  tabs:[...document.querySelectorAll('[role=tab], button')].map(b=>b.textContent.trim().slice(0,20)).filter(t=>/伝導|フィン|非定常|対流|放射|沸騰/.test(t)).slice(0,8),
}));
log.info('ピッカー: '+JSON.stringify(picker));
await page.screenshot({path:SHOTS+'v4-picker-375.png'});
const picked=await page.evaluate(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>/二面間放射|放射/.test(b.textContent)&&b.textContent.length<40&&b.offsetParent);
  if(b){const t=b.textContent.trim().slice(0,30);b.click();return t;}return null;
});
await page.waitForTimeout(1500);
log.info('モード選択: '+picked);
const simBefore=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/Q\s*=|熱流束|W\b[^ ]{0,20}/)?.[0]||document.querySelector('output')?.textContent||null);
const changed=await page.evaluate(()=>{
  const inp=[...document.querySelectorAll('input[type=number], input[type=text]')].find(i=>i.offsetParent);
  if(!inp)return null;
  const old=inp.value; inp.value=String(Number(old||1)*2||2);
  inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true}));
  return {old,new:inp.value};
});
await page.waitForTimeout(1200);
const simAfter=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/Q\s*=|熱流束|W\b[^ ]{0,20}/)?.[0]||document.querySelector('output')?.textContent||null);
log.info('再計算: 入力 '+JSON.stringify(changed)+' / 表示 '+simBefore+' → '+simAfter);
if(changed&&simBefore!==simAfter)log.ok('簡易シミュレーターで入力変更が再計算に反映される');
const figScroll=await page.evaluate(()=>{
  const figs=[...document.querySelectorAll('figure, svg, .sim-figure, canvas')].map(f=>({sw:f.scrollWidth,cw:f.clientWidth})).filter(x=>x.cw>0);
  return {n:figs.length,maxExcess:figs.reduce((m,x)=>Math.max(m,x.sw-x.cw),0)};
});
log.info('図の内部横スクロール超過（現モード）: '+JSON.stringify(figScroll));
if(figScroll.maxExcess<=1)log.ok('現モードで図の内部横スクロールなし（C1-06 の持続確認）');

// ---------- D. 通常シミュレーター（タブ→実験室）＋ポップアップガイド ----------
await page.goto(DIST+'/index.html#lab',{waitUntil:'load'});
await page.waitForTimeout(1800);
const labLink=await page.evaluate(()=>{const a=[...document.querySelectorAll('a')].find(a=>/dynamic\/index\.html/.test(a.getAttribute('href')||''));return a?{href:a.getAttribute('href'),text:a.textContent.trim().slice(0,30)}:null;});
log.info('実験室リンク: '+JSON.stringify(labLink));
let labPage=page;
if(labLink){
  const [popup]=await Promise.all([
    ctx.waitForEvent('page',{timeout:30000}).catch(()=>null),
    page.evaluate(()=>{const a=[...document.querySelectorAll('a')].find(a=>/dynamic\/index\.html/.test(a.getAttribute('href')||''));a?.click();}),
  ]);
  if(popup){labPage=popup;log.ok('「実験室を開く」で別タブに実験室が開く');}
  else{log.obs('ポップアップが捕捉できず直接遷移で代替');await page.goto(DIST+'/dynamic/index.html',{waitUntil:'load'});}
}
await labPage.waitForTimeout(2500);
const labErrors=[];labPage.on('pageerror',e=>labErrors.push(e.message));
await labPage.selectOption('#learning-path',{label:'予想して確かめる'}).catch(e=>log.info('learning-path: '+e.message));
await labPage.waitForTimeout(600);
await labPage.getByRole('button',{name:'フィンの温度',exact:true}).click().catch(e=>log.info('fin btn: '+e.message));
await labPage.waitForTimeout(800);
await labPage.getByRole('button',{name:/初期条件を準備/}).click().catch(e=>log.info('prep btn: '+e.message));
await labPage.waitForTimeout(600);
const radios=labPage.locator('label:has(input[type=radio]) >> visible=true');
if(await radios.count())await radios.first().click();
await labPage.waitForTimeout(300);
await labPage.getByRole('button',{name:/予想を確定/}).click().catch(e=>log.info('confirm btn: '+e.message));
await labPage.waitForTimeout(600);
await labPage.getByRole('button',{name:/5秒まで計算/}).click().catch(e=>log.info('run btn: '+e.message));
await labPage.waitForTimeout(6000);
const snap=await labPage.evaluate(()=>({clock:document.querySelector('[id=clock]')?.textContent||'',readout:document.querySelector('#readout')?.textContent.replace(/\s+/g,' ').slice(0,110)||''}));
log.info('ラボ計算後: '+JSON.stringify(snap));
if(/5\.0/.test(snap.clock))log.ok('通常ラボ：予想→確定→5秒まで計算が実働（時計 '+snap.clock+'）');
await labPage.screenshot({path:SHOTS+'v4-lab-predict-375.png'});
// ポップアップガイド
const popInit=await visPop.call({page:labPage}).catch(()=>null);
const visOnLab=async()=>labPage.evaluate(()=>{
  const p=document.querySelector('.sim-guide-pop, [data-sim-guide], .guide-popover');
  if(!p)return {exists:false};
  const r=p.getBoundingClientRect(),cs=getComputedStyle(p);
  return {exists:true,visible:r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden',text:p.textContent.replace(/\s+/g,' ').slice(0,70)};
});
log.info('ガイド初期表示: '+JSON.stringify(await visOnLab()));
const gBtn=await labPage.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');if(b){b.click();return {pressed:b.getAttribute('aria-pressed')};}return null;});
await labPage.waitForTimeout(900);
const popOn=await visOnLab();
log.info('ガイドボタン押下後: btn='+JSON.stringify(gBtn)+' pop='+JSON.stringify(popOn));
if(popOn.visible)log.ok('ポップアップガイドが表示される');
await labPage.keyboard.press('Escape');
await labPage.waitForTimeout(700);
const popEsc=await visOnLab();
log.info('Esc後: '+JSON.stringify(popEsc));
if(popOn.visible&&!popEsc.visible)log.ok('ポップアップガイドは Esc で閉じる');
// OFF の保持：ガイドをOFFにしてリロード
await labPage.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');return b?{pressed:b.getAttribute('aria-pressed')}:null;}).then(v=>log.info('現在のガイドボタン状態: '+JSON.stringify(v)));
await labPage.reload({waitUntil:'load'});
await labPage.waitForTimeout(2500);
const popReload=await visOnLab();
const btnAfter=await labPage.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='ガイド');return b?b.getAttribute('aria-pressed'):null;});
log.info('リロード後: pop='+JSON.stringify(popReload)+' aria-pressed='+btnAfter);
if(!popReload.visible)log.ok('リロード後もガイドは自動表示されない（OFF/初期状態の保持）');
log.info('lab pageerrors: '+JSON.stringify(labErrors));
if(labPage!==page)await labPage.close();

// ---------- E. 使い方ガイド ----------
await page.goto(DIST+'/index.html#guide',{waitUntil:'load'});
await page.waitForTimeout(1800);
const guideCount=await page.evaluate(()=>document.querySelectorAll('.guide-item, [id^="guide-"], article.guide, section.guide').length||[...document.querySelectorAll('a[href^="#guide/"]')].length);
const guideLinks=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#guide/"]')].map(a=>a.getAttribute('href')));
log.info('ガイド項目リンク数: '+guideLinks.length+' （lab: '+guideLinks.includes('#guide/lab')+'）');
if(guideLinks.length>=49)log.ok('使い方ガイド全49項目への導線がある');
await page.goto(DIST+'/index.html#guide/lab',{waitUntil:'load'});
await page.waitForTimeout(1500);
const labItem=await page.evaluate(()=>{const t=document.body.textContent.replace(/\s+/g,' ');return /実験室/.test(t)&&/通常シミュレーター|動的/.test(t);});
log.info('#guide/lab 着地で実験室の説明が読める: '+labItem);
log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
await ctx.close();
await browser.close();
console.log('V4 DONE');
