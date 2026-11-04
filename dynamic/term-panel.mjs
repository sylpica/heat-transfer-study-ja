import {linkTermTextNodes} from '../term-links.mjs';
// Common dynamic-lab panel. It does not call model controls or learning storage.
export function attachTermPanel({root,additionalRoots=[],dialog,title,body,close}){
 const roots=[root,...additionalRoots],contains=element=>roots.some(r=>r.contains(element));let terms=[],origin=null;
 function open(id){
  const term=terms.find(t=>t.id===id);if(!term)return;title.textContent=term.ja;body.replaceChildren();const seen=new Set();
  for(const [label,value]of[['短い説明',term.brief||term.meaning],['初心者向け',term.beginner],['詳しい説明',term.detail],['式',term.formula],['単位',term.unit]])if(typeof value==='string'&&value.trim()&&!seen.has(value.trim())){seen.add(value.trim());const heading=document.createElement('h3'),p=document.createElement('p');heading.textContent=label;p.textContent=value;body.append(heading,p);}
  for(const name of term.related||[]){const found=terms.find(t=>t.id===name||t.ja===name||t.en===name);if(found){const button=document.createElement('button');button.textContent=found.ja;button.dataset.termId=found.id;body.append(button);}}
  if(!dialog.open)dialog.showModal();close.focus();
 }
 close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(origin?.isConnected)origin.focus();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 document.addEventListener('click',event=>{const button=event.target.closest?.('[data-term-id]');if(button&&(contains(button)||dialog.contains(button))){if(!dialog.open)origin=button;open(button.dataset.termId);}});
 document.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;const button=event.target.closest?.('[data-term-id][role=button]');if(button&&button.tagName!=='BUTTON'&&(contains(button)||dialog.contains(button))){event.preventDefault();if(!event.repeat)button.click();}});
 return fetch(new URL('../data/glossary.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('用語データ');return r.json();}).then(data=>{terms=Array.isArray(data)?data:data.terms||[];for(const r of roots)linkTermTextNodes(r,terms,{limit:2});return terms.length;}).catch(()=>{const p=document.createElement('p');p.textContent='用語データを読み込めませんでした。用語集へのリンクから確認できます。';root.append(p);return 0;});
}
