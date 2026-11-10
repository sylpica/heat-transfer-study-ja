// R7-W1b h_{fg} のレンダリング形式診断（§11.7 / §11.10、375px）
import {launch,newPage,openSection} from './lib.mjs';
const browser=await launch();
const {page}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
for(const id of ['11.7','11.10']){
  await openSection(page,id);
  const diag=await page.evaluate(()=>{
    const art=document.querySelector('#reader-article');
    const t=art?art.textContent:'';
    const cnt=(re)=>(t.match(re)||[]).length;
    const ctxs=[];
    const re=/fg/g;let m;
    while((m=re.exec(t))&&ctxs.length<10){ctxs.push(t.slice(Math.max(0,m.index-24),m.index+10).replace(/\s+/g,' '));}
    // 'fg' を含む要素の HTML 断片
    const htmlHits=[];
    for(const e of art.querySelectorAll('*')){
      if(e.children.length===0&&(e.textContent||'').includes('fg')){htmlHits.push(e.outerHTML.slice(0,120));if(htmlHits.length>=6)break;}
    }
    return {hfg:cnt(/hfg/g),h_fg:cnt(/h_fg/g),hSpaceFg:cnt(/h\s+fg/g),fgTotal:cnt(/fg/g),ctxs,htmlHits,
      bodyFg:(document.body.textContent.match(/fg/g)||[]).length};
  });
  console.log('§'+id,JSON.stringify(diag,null,1));
}
await browser.close();
console.log('DONE R7-W1b');
