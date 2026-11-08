// V2 Part B のみ再実行（Part A は合格済み）
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
import {createEmptyState,localDay} from '../../../study-core.mjs';
import {writeFileSync} from 'node:fs';
const log=makeLog('V2B');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(180000);
page.on('dialog',d=>{log.info('ネイティブ確認ダイアログ: '+d.message().slice(0,60));d.accept();});
const now=new Date(),day=localDay(now);
const att=(qid,correct,at)=>({questionId:qid,correct,at});
const payload=createEmptyState();
payload.sessions=[
  {id:'v2-inconsistent-empty',date:day,startedAt:new Date(now.getTime()-3600e3).toISOString(),total:99,correct:99,answers:[]},
  {id:'v2-inconsistent-detail',date:day,startedAt:new Date(now.getTime()-1800e3).toISOString(),total:2,correct:2,answers:[att('v2-q1',true,new Date(now.getTime()-1700e3).toISOString()),att('v2-q2',false,new Date(now.getTime()-1600e3).toISOString())]},
  {id:'v2-consistent',date:day,startedAt:now.toISOString(),total:2,correct:1,answers:[att('v2-q3',true,new Date(now.getTime()-600e3).toISOString()),att('v2-q4',false,new Date(now.getTime()-500e3).toISOString())]},
];
writeFileSync('/tmp/v2-import.json',JSON.stringify({...payload,schemaVersion:1,exportedAt:now.toISOString(),format:'heat-study-ja-learning-data'}));
await page.goto(DIST+'/index.html#settings',{waitUntil:'load'});
await page.waitForFunction(()=>!!document.querySelector('#import-file'),null,{timeout:90000});
await page.setInputFiles('#import-file','/tmp/v2-import.json');
const preview=await page.waitForSelector('[data-action="import-replace"]',{timeout:90000}).then(()=>true).catch(()=>false);
log.info('取り込みプレビュー表示: '+preview);
if(preview){await page.click('[data-action="import-replace"]');await page.waitForTimeout(2500);}
const storedCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).sessions.length);
log.info('取り込み後の保存セッション数: '+storedCount);
await page.goto(DIST+'/index.html#calendar',{waitUntil:'load'});
await page.waitForTimeout(2500);
let entries=await page.evaluate(()=>[...document.querySelectorAll('.session-entry')].map(e=>e.textContent.replace(/\s+/g,' ').trim()));
if(!entries.length){
  const clicked=await page.evaluate((d)=>{const cell=document.querySelector(`[data-date="${d}"]`)||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes(d));if(cell){cell.click();return true;}return false;},day);
  log.info('当日セルクリック: '+clicked);
  await page.waitForTimeout(1500);
  entries=await page.evaluate(()=>[...document.querySelectorAll('.session-entry')].map(e=>e.textContent.replace(/\s+/g,' ').trim()));
}
log.info('セッションエントリ数: '+entries.length);
entries.forEach((t,i)=>log.info('entry'+i+': '+t));
const stats=await page.evaluate(()=>document.querySelector('.day-stats')?.textContent.replace(/\s+/g,' ').trim()||null);
log.info('day-stats（回答履歴由来）: '+stats);
const withLabel=entries.filter(t=>t.includes('保存時集計：')).length;
const withNote=entries.filter(t=>t.includes('一致しません')).length;
if(entries.length===3&&withLabel===3)log.ok('全セッションに「保存時集計：」標識');
else log.fail('標識: entries='+entries.length+' label='+withLabel);
if(withNote===2)log.ok('不一致注記は不整合2件のみに表示、整合1件には出ない');
else log.fail('不一致注記の件数: '+withNote);
const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('heat-study-ja:v1')).sessions.map(s=>({total:s.total,correct:s.correct,n:(s.answers||[]).length})));
log.info('保存値（不変確認）: '+JSON.stringify(stored));
await page.screenshot({path:SHOTS+'v2-calendar-inconsistent-375.png'});
log.info('errors: '+JSON.stringify(errors.filter(e=>!/404/.test(e))));
await ctx.close();await browser.close();
console.log('V2B DONE');
