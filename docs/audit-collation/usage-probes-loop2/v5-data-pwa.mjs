// V5 保存・復元／オフライン／PWA＋簡易シミュレーター数値再計算（ループ1検証値との突合）
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
import {writeFileSync,readFileSync} from 'node:fs';
const log=makeLog('V5');
const browser=await launch();

// ---------- 0. 簡易シミュレーター数値再計算（二面間放射、ループ1記録値と突合） ----------
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  page.setDefaultTimeout(120000);
  await page.goto(DIST+'/index.html#simulator',{waitUntil:'load'});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/モードを変更/.test(b.textContent));b?.click();});
  await page.waitForTimeout(700);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/二面間の放射/.test(b.textContent));b?.click();});
  await page.waitForTimeout(1200);
  const resultText=()=>page.evaluate(()=>{const t=document.querySelector('main').textContent.replace(/\s+/g,' ');const m=t.match(/計算結果(.{0,160})/);return m?m[1]:t.slice(0,200);});
  const r1=await resultText();
  const q1=parseFloat((r1.match(/([\d,]+\.?\d*)\s*W(?!\/)/)||[])[1]?.replace(/,/g,''));
  log.info('二面間放射 初期: '+r1.slice(0,120)+' / Q='+q1);
  await page.evaluate(()=>{const i=document.querySelector('input[name=area1]');i.value='2';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForTimeout(1000);
  const r2=await resultText();
  const q2=parseFloat((r2.match(/([\d,]+\.?\d*)\s*W(?!\/)/)||[])[1]?.replace(/,/g,''));
  log.info('A1=2 変更後: '+r2.slice(0,120)+' / Q='+q2);
  if(q1&&q2&&Math.abs(q1-1689.751)<1&&Math.abs(q2-3023.765)<1)log.ok('計算値がループ1検証値と一致（Q: '+q1+' → '+q2+' W）');
  else if(q1&&q2&&q1!==q2)log.obs('再計算は動作するがループ1記録値と異なる: '+q1+' → '+q2);
  else log.fail('再計算の数値を確認できず');
  log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
  await ctx.close();
}

// ---------- 1. 保存・復元（書き出し／現行・旧形式取り込み／破損・形式違いの拒否） ----------
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  page.setDefaultTimeout(120000);
  page.on('dialog',d=>d.accept());
  // 単語帳ソートを五十音順にしておく（旧形式取り込みでの保持確認用）
  await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
  await page.waitForTimeout(1000);
  await page.evaluate(()=>{const s=document.querySelector('select[name=flash-sort]');if(s){const o=[...s.options].find(o=>o.textContent.includes('五十音'));if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}});
  await page.waitForTimeout(800);
  await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{const b=document.querySelector('[data-action="export-preview"]');b?.click();});
  await page.waitForTimeout(1200);
  const exported=await page.evaluate(()=>document.querySelector('#export-json')?.value||'');
  log.info('書き出しJSON: '+exported.length+' bytes');
  if(!exported){log.fail('書き出しプレビューが得られない');}
  else{
    writeFileSync('/tmp/v5-current.json',exported);
    const legacy=JSON.parse(exported);
    const strip=(o)=>{if(o&&typeof o==='object'){for(const k of Object.keys(o)){if(/flash/i.test(k))delete o[k];else strip(o[k]);}}};
    strip(legacy);
    writeFileSync('/tmp/v5-legacy.json',JSON.stringify(legacy));
    const rawBefore=await page.evaluate(()=>localStorage.getItem('heat-study-ja:v1'));
    // 現行形式（追加・更新）
    await page.setInputFiles('#import-file','/tmp/v5-current.json');
    await page.waitForSelector('[data-action="import-merge"]',{timeout:60000});
    await page.click('[data-action="import-merge"]');
    await page.waitForTimeout(2000);
    const fb1=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' ').match(/学習データを追加しました|取り込み可能なデータです/)?.[0]||'');
    log.info('現行形式取り込み後: '+fb1);
    // 旧形式（flash系キーなし）
    await page.setInputFiles('#import-file','/tmp/v5-legacy.json');
    await page.waitForSelector('[data-action="import-merge"]',{timeout:60000});
    await page.click('[data-action="import-merge"]');
    await page.waitForTimeout(2000);
    await page.goto(DIST+'/index.html#glossary',{waitUntil:'load'});
    await page.waitForTimeout(1800);
    await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='単語帳');b?.click();});
    await page.waitForTimeout(1000);
    const sortNow=await page.evaluate(()=>document.querySelector('select[name=flash-sort]')?.selectedOptions[0]?.textContent);
    log.info('旧形式取り込み後の単語帳ソート: '+sortNow);
    if(sortNow&&sortNow.includes('五十音'))log.ok('旧形式JSON取り込みでも単語帳設定が保持される（C1-02 の持続確認）');
    else log.fail('旧形式取り込みで単語帳ソートが変わった: '+sortNow);
    // 破損JSON
    await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
    await page.waitForTimeout(1500);
    const rawMid=await page.evaluate(()=>localStorage.getItem('heat-study-ja:v1'));
    writeFileSync('/tmp/v5-corrupt.json','{"sessions": [broken json');
    await page.setInputFiles('#import-file','/tmp/v5-corrupt.json');
    await page.waitForTimeout(2500);
    const fbBad=await page.evaluate(()=>document.querySelector('#import-feedback')?.textContent.replace(/\s+/g,' ').trim().slice(0,120));
    const rawAfterBad=await page.evaluate(()=>localStorage.getItem('heat-study-ja:v1'));
    log.info('破損JSONのフィードバック: '+fbBad);
    if(/読み取れませんでした/.test(fbBad||'')&&rawAfterBad===rawMid)log.ok('破損JSONは拒否され、現在の記録は変更されない');
    else log.fail('破損JSONの扱いが想定と異なる');
    // 形式違いJSON（生の状態オブジェクト）
    writeFileSync('/tmp/v5-wrongformat.json',rawMid);
    await page.setInputFiles('#import-file','/tmp/v5-wrongformat.json');
    await page.waitForTimeout(2500);
    const fbWrong=await page.evaluate(()=>document.querySelector('#import-feedback')?.textContent.replace(/\s+/g,' ').trim().slice(0,120));
    const rawAfterWrong=await page.evaluate(()=>localStorage.getItem('heat-study-ja:v1'));
    log.info('形式違いJSONのフィードバック: '+fbWrong);
    if(/形式ではありません/.test(fbWrong||'')&&rawAfterWrong===rawMid)log.ok('形式違いJSONは拒否され、記録は変更されない');
    else log.obs('形式違いJSONの扱い: '+fbWrong);
    log.info('rawBefore一致（参考）: '+(rawBefore===rawMid));
  }
  log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
  await ctx.close();
}

// ---------- 2. PWA（manifest・アイコン・sw.js）＋オフライン ----------
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  page.setDefaultTimeout(120000);
  const manResp=await page.request.get(DIST+'/manifest.json');
  log.info('manifest.json status: '+manResp.status());
  const manifest=await manResp.json();
  log.info('manifest icons: '+JSON.stringify(manifest.icons));
  for(const size of [192,512]){
    const icon=(manifest.icons||[]).find(i=>i.sizes===size+'x'+size&&i.type==='image/png');
    if(!icon){log.fail('manifest に '+size+' PNG アイコンがない');continue;}
    const resp=await page.request.get(DIST+'/'+icon.src);
    const body=await resp.body();
    const w=body.readUInt32BE(16),h=body.readUInt32BE(20);
    log.info(icon.src+': status='+resp.status()+' PNG '+w+'x'+h);
    if(resp.status()===200&&w===size&&h===size)log.ok('PNG アイコン '+size+' が解決し実寸一致');
    else log.fail('PNG アイコン '+size+' 不一致');
  }
  const svgIcon=(manifest.icons||[]).find(i=>i.type==='image/svg+xml');
  if(svgIcon){
    const resp=await page.request.get(DIST+'/'+svgIcon.src);
    log.info(svgIcon.src+': status='+resp.status());
    if(resp.status()===200)log.ok('SVG アイコンが解決する');
  } else log.obs('manifest に SVG アイコンなし');
  const swResp=await page.request.get(DIST+'/sw.js');
  const sw=await swResp.text();
  const shellIcons=['icon-192.png','icon-512.png','icon.svg'].filter(x=>sw.includes(x));
  const sectionRefs=(sw.match(/sections\/[0-9]+-[0-9]+-ja\.json/g)||[]).length;
  log.info('sw.js: アイコン参照 '+JSON.stringify(shellIcons)+' / 節ファイル参照数 '+sectionRefs);
  if(shellIcons.length===3)log.ok('APP_SHELL にアイコン3種が含まれる');
  if(sectionRefs>=76)log.ok('APP_SHELL に全76節が含まれる（R1-P1-01 の持続確認）');
  const html=await (await page.request.get(DIST+'/index.html')).text();
  log.info('index.html: manifest link=' + /rel="manifest"/.test(html) + ' icon link=' + /rel="icon"/.test(html));
  // オフライン再読み込み
  await page.goto(DIST+'/index.html',{waitUntil:'load'});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:90000}).catch(()=>log.obs('SW controller 待ちタイムアウト'));
  await page.reload({waitUntil:'load'});
  await page.waitForTimeout(1500);
  const cacheIcons=await page.evaluate(async()=>{for(const p of ['./assets/icon-192.png','./assets/icon-512.png','./assets/icon.svg']){if(!(await caches.match(p)))return p;}return null;});
  log.info('キャッシュ内アイコン不足: '+cacheIcons);
  if(!cacheIcons)log.ok('アイコン3種が SW キャッシュから解決する');
  await ctx.setOffline(true);
  await page.reload({waitUntil:'load'}).catch(e=>log.info('offline reload: '+e.message));
  await page.waitForTimeout(2000);
  const off=await page.evaluate(()=>({title:document.title,home:/熱移動を学ぶ|ホーム/.test(document.body.textContent),len:document.body.textContent.length}));
  log.info('オフライン再読込: '+JSON.stringify(off));
  if(off.len>500)log.ok('オフラインでもホームが描画される');
  else log.fail('オフラインで描画されない');
  await page.screenshot({path:SHOTS+'v5-offline-375.png'});
  await ctx.setOffline(false);
  log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
  await ctx.close();
}
await browser.close();
console.log('V5 DONE');
