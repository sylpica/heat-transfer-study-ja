// W1 読む：§8.3 のループ3修正（C3-S01〜S07）の実画面確認＋発展教材 §8.3 の確認
import {launch,newPage,DIST,SHOTS,makeLog,overflow} from './lib.mjs';
const log=makeLog('W1');
const browser=await launch();

const MAC='\u0304'; // 結合マクロン（上線）
function hasOver(s,ch){return s.includes(ch+MAC);}

async function gotoSection(page,sec){
  await page.goto(DIST+'/index.html#reader/'+sec,{waitUntil:'load'});
  await page.waitForFunction((s)=>{
    const h=[...document.querySelectorAll('h2')].map(x=>x.textContent).join(' ');
    return h.includes(s)&&document.querySelectorAll('.formula-block').length>0;
  },sec,{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(800);
}
async function formulaText(page,num){
  const loc=page.locator('.formula-block').filter({has:page.getByText('式（'+num+'）',{exact:true})}).first();
  if(!await loc.count())return null;
  return (await loc.textContent()).replace(/\s+/g,' ').trim();
}

// ---------- 375px ライト： §8.3 全項目 ----------
{
  const {ctx,page,errors}=await newPage(browser,{width:375});
  page.setDefaultTimeout(120000);
  await gotoSection(page,'8.3');

  // C3-S01 式(8.13b)：8/27乗は分母括弧のみ
  const f813b=await formulaText(page,'8.13b');
  log.info('式(8.13b): '+f813b);
  if(f813b&&f813b.includes('0.387·RaL^(1/6)/[1 + (0.492/Pr)^(9/16)]^(8/27)'))log.ok('C3-S01 式(8.13b) は 8/27乗が分母括弧のみに掛かる形で表示');
  else log.fail('C3-S01 式(8.13b) の形が想定と異なる');
  if(f813b&&f813b.includes('[0.387·RaL^(1/6)/(1 + (0.492/Pr)^(9/16))]^(8/27)'))log.fail('C3-S01 旧形（分子込みの8/27乗）が残っている');
  const loc813b=page.locator('.formula-block').filter({has:page.getByText('式（8.13b）',{exact:true})}).first();
  await loc813b.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await loc813b.screenshot({path:SHOTS+'w1-eq813b-375.png'});

  // C3-S02 式(8.11)説明：割り算形＋訳注
  const f811=await formulaText(page,'8.11');
  log.info('式(8.11)ブロック: '+(f811||'').slice(0,420));
  if(f811&&f811.includes('RaL/[1 + 0.492/Pr^(9/16)]^(16/9)'))log.ok('C3-S02 遷移座標が割り算形で表示');
  else log.fail('C3-S02 遷移座標の割り算形が見つからない');
  if(f811&&f811.includes('RaL[1 + (0.492/Pr)^(9/16)]^(16/9)'))log.fail('C3-S02 旧形（掛け算）が残っている');
  if(f811&&f811.includes('訳注：原書本文の括弧内は 0.492/Pr^(9/16) と印刷されているが、図8.3の横軸は (0.492/Pr)^(9/16) の形である'))log.ok('C3-S02 訳注（本文と図の括弧差）が表示');
  else log.fail('C3-S02 訳注が見つからない');

  // C3-S03 式(8.26)説明：∫₀^L (Nux/x) dx
  const f826=await formulaText(page,'8.26');
  log.info('式(8.26)ブロック: '+(f826||'').slice(0,360));
  if(f826&&f826.includes('NuL = ∫₀^L (Nux/x) dx = (4/3)Nux(x = L)'))log.ok('C3-S03 平均Nu積分に 1/x を含む形で表示');
  else log.fail('C3-S03 積分の形が想定と異なる');
  if(f826&&f826.includes('(1/L)∫₀^L Nux dx'))log.fail('C3-S03 旧形が残っている');

  // C3-S05/S06/S07 例題8.3 の段落
  const exLoc=page.locator('article p, .book-content p').filter({hasText:'例題8.3'}).first();
  const ex=(await exLoc.count())?(await exLoc.textContent()).replace(/\s+/g,' ').trim():'';
  log.info('例題8.3: '+ex.slice(0,600));
  if(ex.includes('(RaL/Pr)^(−1/4)'))log.ok('C3-S05 例題8.3 に (RaL/Pr)^(−1/4) が表示');
  else log.fail('C3-S05 (RaL/Pr)^(−1/4) が見つからない');
  if(ex.includes('(RaL·Pr)^(−1/4)'))log.fail('C3-S05 旧形 (RaL·Pr) が残っている');
  if(ex.includes('この差の原因は未確定である'))log.ok('C3-S07 新訳注（原因は未確定）が表示');
  else log.fail('C3-S07 新訳注が見つからない');
  if(ex.includes('中間値の丸めで約1%異なる'))log.fail('C3-S07 旧訳注（丸め断定）が残っている');
  if(hasOver(ex,'h')&&hasOver(ex,'q'))log.ok('C3-S06 例題8.3 の問題・解に h̄・q̄ の上線が表示');
  else log.fail('C3-S06 h̄/q̄ の上線が例題8.3 に見つからない (h+macron=' + hasOver(ex,'h') + ', q+macron=' + hasOver(ex,'q') + ')');
  if(ex.includes('Nu'+MAC+'L = 0.678'))log.ok('C3-S06 解の NūL に上線が表示');
  else log.fail('C3-S06 解の NūL 上線が見つからない');
  await exLoc.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await exLoc.screenshot({path:SHOTS+'w1-example83-375.png'});

  // 発展教材 §8.3（読書画面内の #reader-deep-lesson）
  const deep=(await page.locator('#reader-deep-lesson').count())
    ? (await page.locator('#reader-deep-lesson').textContent()).replace(/\s+/g,' ').trim() : '';
  log.info('発展教材の有無: '+(deep?'あり':'なし'));
  if(deep.includes('Ra_L/[1＋(0.492/Pr)^(9/16)]^(16/9)'))log.ok('発展教材 遷移座標が割り算形で表示');
  else log.fail('発展教材 遷移座標の割り算形が見つからない');
  if(deep.includes('この座標は図8.3の横軸の形による。原書本文では括弧内が 0.492/Pr^(9/16) と印刷されている'))log.ok('発展教材 図8.3の横軸に関する括弧書きが表示');
  else log.fail('発展教材 括弧書きが見つからない');
  if(deep.includes('速度尺度 uc＝C1 gβ(Tw−T∞)δ²/ν'))log.ok('C3-S04 発展教材 uc が「速度尺度」と表示');
  else log.fail('C3-S04 「速度尺度 uc」が見つからない');
  if(deep.includes('実際の極大は y/δ＝1/3 における u＝(4/27)uc である'))log.ok('C3-S04 極大 (4/27)uc の併記が表示');
  else log.fail('C3-S04 (4/27)uc の併記が見つからない');
  if(deep.includes('極大速度は uc'))log.fail('C3-S04 旧表現「極大速度は uc」が残っている');
  if(deep.includes('Nu'+MAC+'_L＝61.25')&&deep.includes('h'+MAC+'＝4.02')&&deep.includes('q'+MAC+'＝104'))log.ok('発展教材 例題8.3 の Nū_L・h̄・q̄ に上線が表示');
  else log.fail('発展教材 上線つき Nū_L/h̄/q̄ が見つからない');
  const deepLoc=page.locator('#reader-deep-lesson');
  if(await deepLoc.count()){await deepLoc.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await page.screenshot({path:SHOTS+'w1-deeplesson83-375.png'});}

  // 幅：ページ全体と長式ブロックのはみ出し
  const ov=await overflow(page);
  log.info('§8.3 375px overflow: '+JSON.stringify(ov));
  if(!ov.bad)log.ok('§8.3 375px でページ横はみ出し 0'); else log.fail('§8.3 375px でページ横はみ出しあり');
  const blockOv=await page.evaluate(()=>[...document.querySelectorAll('.formula-block')].map(b=>({sw:b.scrollWidth,cw:b.clientWidth})).filter(x=>x.sw>x.cw+1).length);
  log.info('内部横スクロール超過の式ブロック数: '+blockOv);
  log.info('W1-375 errors: '+JSON.stringify(errors));
  if(errors.length===0)log.ok('W1 375px セッション pageerror 0');
  else log.fail('W1 375px エラー: '+errors.join(' | '));
  await ctx.close();
}

// ---------- 390px / 1280px / 375pxダーク： §8.3 のスポット確認 ----------
for(const opt of [{width:390,dark:false},{width:1280,dark:false},{width:375,dark:true}]){
  const tag=opt.width+(opt.dark?'-dark':'');
  const {ctx,page,errors}=await newPage(browser,opt);
  page.setDefaultTimeout(120000);
  await gotoSection(page,'8.3');
  const body=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' '));
  const checks={
    '8.13b':body.includes('0.387·RaL^(1/6)/[1 + (0.492/Pr)^(9/16)]^(8/27)'),
    'RaL/Pr':body.includes('(RaL/Pr)^(−1/4)'),
    '未確定':body.includes('この差の原因は未確定である'),
  };
  log.info('§8.3 '+tag+': '+JSON.stringify(checks));
  if(Object.values(checks).every(Boolean))log.ok('§8.3 '+tag+' スポット確認 正常');
  else log.fail('§8.3 '+tag+' スポット確認で欠けあり');
  const ov=await overflow(page);
  if(!ov.bad)log.ok('§8.3 '+tag+' 横はみ出し 0'); else log.fail('§8.3 '+tag+' 横はみ出し: '+JSON.stringify(ov));
  if(opt.width===1280)await page.screenshot({path:SHOTS+'w1-sec83-1280.png'});
  if(opt.dark)await page.screenshot({path:SHOTS+'w1-sec83-375-dark.png'});
  if(errors.length===0)log.ok('§8.3 '+tag+' pageerror 0');
  else log.fail('§8.3 '+tag+' エラー: '+errors.join(' | '));
  await ctx.close();
}
await browser.close();
console.log('W1 DONE');
