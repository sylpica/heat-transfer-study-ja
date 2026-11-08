// V1 読む：C2-SCI-01 で修正された原典式・表の読書画面表示確認
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('V1');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

async function gotoSection(sec){
  await page.goto(DIST+'/index.html#reader/'+sec,{waitUntil:'load'});
  await page.waitForFunction((s)=>{
    const h=[...document.querySelectorAll('h2')].map(x=>x.textContent).join(' ');
    return h.includes(s)&&document.querySelectorAll('.formula-block, article li').length>0;
  },sec,{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(700);
}
async function shotFormula(num,name){
  const loc=page.locator('.formula-block').filter({has:page.getByText('式（'+num+'）',{exact:true})}).first();
  const n=await loc.count();
  if(!n){log.fail('式（'+num+'）の formula-block が見つからない');return;}
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const text=(await loc.textContent()).replace(/\s+/g,' ').trim();
  log.info('式（'+num+'）: '+text.slice(0,300));
  await loc.screenshot({path:SHOTS+name+'.png'});
  log.ok('式（'+num+'）表示を撮影: '+name+'.png');
}
async function shotListItem(needle,name,maxLen=400){
  const loc=page.locator('article li').filter({hasText:needle}).first();
  const n=await loc.count();
  if(!n){log.fail('リスト項目が見つからない: '+needle);return;}
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const text=(await loc.textContent()).replace(/\s+/g,' ').trim();
  log.info('項目['+needle.slice(0,20)+'…]: '+text.slice(0,maxLen));
  await loc.screenshot({path:SHOTS+name+'.png'});
  log.ok('リスト項目を撮影: '+name+'.png');
}

// §3.3 表3.1
await gotoSection('3.3');
await shotListItem('直交流、両流れとも未混合（R > 0.3','v1-table31-row1');
await shotListItem('Nシェルパス、2N管パス','v1-table31-nshell');

// §7.6 式(7.74)
await gotoSection('7.6');
await shotFormula('7.74','v1-eq774');

// §8.3 式(8.20)/(8.22)/(8.23)
await gotoSection('8.3');
await shotFormula('8.20','v1-eq820');
await shotFormula('8.22','v1-eq822');
await shotFormula('8.23','v1-eq823');

// §8.4 式(8.44a)/(8.44b)
await gotoSection('8.4');
await shotFormula('8.44a','v1-eq844a');
await shotFormula('8.44b','v1-eq844b');

// §9.4 式(9.32)
await gotoSection('9.4');
await shotFormula('9.32','v1-eq932');

// §9.7 式(9.40)
await gotoSection('9.7');
await shotFormula('9.40','v1-eq940');

// §10.3 表10.2 配置3・配置5、表10.3 配置2
await gotoSection('10.3');
await shotListItem('配置3（直角に接する帯','v1-table102-cfg3');
await shotListItem('配置5（帯と平行円柱','v1-table102-cfg5');
await shotListItem('配置2（垂直な2面、共通辺','v1-table103-cfg2',600);

// §10.4 式(10.35)
await gotoSection('10.4');
await shotFormula('10.35','v1-eq1035');

log.info('pageerror/console errors: '+JSON.stringify(errors));
if(errors.length===0)log.ok('V1 セッション pageerror 0');
else log.fail('エラーあり: '+errors.join(' | '));
await ctx.close();
await browser.close();
console.log('V1 DONE');
