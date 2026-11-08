// Popup coach-mark guide for the dynamic simulations. This is a companion to
// the in-app manuals (#manual): the manual holds the full §21 text, while the
// guide walks the actual controls of one screen in order. One engine serves
// every screen; each screen supplies only its step definitions
// ({target, title, text}) and its own storage id.
//
// Behaviour contract:
// - A 「ガイド」 toggle button switches the guide on/off. The choice is kept
//   in localStorage (heat-sim-guide:<id>) and restored on the next visit.
//   The default is off.
// - While on, a popup anchored to the current step's element shows the step
//   title and text, with 戻る / 次へ / 閉じる. Escape and any click outside
//   the popup (and not on the toggle) close the guide and switch it off.
// - The popup is position:fixed and clamped to the viewport, so it never
//   widens the page or adds scroll. Focus moves into the popup while it is
//   open and returns to the previously focused element (fallback: the
//   toggle) when it closes.
// - Step text is plain text. When a glossary is supplied via termsUrl, term
//   mentions are linked with the shared term-links machinery; following a
//   term opens its glossary entry (termUrlBase + '#term-<id>') in a new tab
//   so the simulation state on this screen is left untouched.
import {linkTermTextNodes} from '../term-links.mjs';

export const SIM_GUIDE_STORAGE_PREFIX='heat-sim-guide:';
export function guideStorageKey(id){return SIM_GUIDE_STORAGE_PREFIX+id;}
export function readGuidePreference(storage,id){
  try{return storage?.getItem(guideStorageKey(id))==='on';}catch{return false;}
}
export function writeGuidePreference(storage,id,on){
  try{storage?.setItem(guideStorageKey(id),on?'on':'off');}catch{/* storage unavailable: the toggle still works for this visit */}
}

// Pure placement: given the target's viewport rect (or null), the popup size
// and the viewport, return the popup's fixed position. Prefers below the
// target, then above; always clamped inside the viewport with `margin` to
// spare, so a 320px popup stays fully visible at 375px width.
export function popupPlacement(rect,size,viewport,margin=8){
  const width=Math.min(size.width,Math.max(0,viewport.width-2*margin));
  const maxLeft=Math.max(margin,viewport.width-margin-width);
  if(!rect)return {left:Math.round((viewport.width-width)/2),top:margin+4,side:'center'};
  let left=Math.min(Math.max(margin,rect.left),maxLeft);
  const below=rect.bottom+10,above=rect.top-10-size.height;
  if(below+size.height<=viewport.height-margin)return {left:Math.round(left),top:Math.round(below),side:'below'};
  if(above>=margin)return {left:Math.round(left),top:Math.round(above),side:'above'};
  const top=Math.min(Math.max(margin,rect.bottom+10),Math.max(margin,viewport.height-margin-size.height));
  return {left:Math.round(left),top:Math.round(top),side:'clamped'};
}

export function attachSimGuide({id,steps,mount=null,termsUrl=null,termUrlBase=null,doc=document,storage=globalThis.localStorage}={}){
  if(!id||!Array.isArray(steps)||!steps.length)throw Error('ガイドの識別子とステップが必要です。');
  const usable=steps.filter(step=>step&&typeof step.text==='string'&&step.text.trim()&&typeof step.title==='string'&&step.title.trim());
  if(!usable.length)throw Error('ガイドのステップが空です。');
  let terms=null;
  if(termsUrl)fetch(termsUrl).then(r=>r.ok?r.json():null).then(data=>{terms=Array.isArray(data)?data:(data?.terms||null);if(open)render();}).catch(()=>{});

  const toggle=doc.createElement('button');
  toggle.type='button';toggle.className='sim-guide-toggle';toggle.textContent='ガイド';toggle.setAttribute('aria-pressed','false');
  if(mount)mount.append(toggle);
  else{
    const bar=doc.createElement('div');bar.className='sim-guide-bar';bar.append(toggle);
    const host=doc.querySelector('main')||doc.body;
    host.insertBefore(bar,host.children[1]||null);
  }

  const popup=doc.createElement('div');
  popup.className='sim-guide-popup';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','シミュレーションのガイド');popup.hidden=true;
  const count=doc.createElement('span');count.className='sim-guide-count';
  const heading=doc.createElement('h3');heading.className='sim-guide-title';
  const text=doc.createElement('div');text.className='sim-guide-text';
  const nav=doc.createElement('div');nav.className='sim-guide-nav';
  const back=doc.createElement('button');back.type='button';back.textContent='戻る';
  const next=doc.createElement('button');next.type='button';next.textContent='次へ';
  const close=doc.createElement('button');close.type='button';close.textContent='閉じる';
  nav.append(back,next,close);popup.append(count,heading,text,nav);doc.body.append(popup);

  let open=false,index=0,highlighted=null,origin=null;
  const resolveTarget=step=>{if(!step.target)return null;try{return typeof step.target==='string'?doc.querySelector(step.target):step.target;}catch{return null;}};
  function place(){
    if(!open)return;
    const target=resolveTarget(usable[index]);
    let rect=null;
    if(target){
      const r=target.getBoundingClientRect();
      if(r.width||r.height)rect=r;
    }
    const spot=popupPlacement(rect,{width:popup.offsetWidth,height:popup.offsetHeight},{width:doc.defaultView.innerWidth,height:doc.defaultView.innerHeight});
    popup.style.left=spot.left+'px';popup.style.top=spot.top+'px';
  }
  function render(){
    const step=usable[index];
    count.textContent=`${index+1} / ${usable.length}`;
    heading.textContent=step.title;
    text.replaceChildren(doc.createTextNode(step.text));
    if(terms)linkTermTextNodes(text,terms,{limit:2});
    back.disabled=index===0;next.disabled=index===usable.length-1;
    if(highlighted){highlighted.classList.remove('sim-guide-target');highlighted=null;}
    const target=resolveTarget(step);
    if(target){
      highlighted=target;target.classList.add('sim-guide-target');
      const r=target.getBoundingClientRect(),view=doc.defaultView;
      if(r.top<0||r.bottom>view.innerHeight||r.left<0||r.right>view.innerWidth)target.scrollIntoView({block:'nearest',inline:'nearest'});
    }
    place();
  }
  function show(){
    if(open)return;open=true;origin=doc.activeElement&&doc.activeElement!==doc.body?doc.activeElement:null;
    popup.hidden=false;toggle.setAttribute('aria-pressed','true');render();
    (next.disabled?close:next).focus();
  }
  function hide(){
    if(!open)return;open=false;popup.hidden=true;toggle.setAttribute('aria-pressed','false');
    if(highlighted){highlighted.classList.remove('sim-guide-target');highlighted=null;}
    writeGuidePreference(storage,id,false);
    const backTo=origin&&origin.isConnected?origin:toggle;origin=null;backTo.focus();
  }
  function turnOn(){writeGuidePreference(storage,id,true);index=0;show();}
  toggle.addEventListener('click',()=>{open?hide():turnOn();});
  back.addEventListener('click',()=>{if(index>0){index--;render();(back.disabled?next:back).focus();}});
  next.addEventListener('click',()=>{if(index<usable.length-1){index++;render();(next.disabled?close:next).focus();}});
  close.addEventListener('click',hide);
  popup.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-term-id]');
    if(button&&termUrlBase)doc.defaultView.open(termUrlBase+'#term-'+button.dataset.termId,'_blank','noopener');
  });
  doc.addEventListener('keydown',event=>{if(open&&event.key==='Escape'){event.stopPropagation();hide();}},true);
  doc.addEventListener('pointerdown',event=>{if(open&&!popup.contains(event.target)&&event.target!==toggle&&!toggle.contains(event.target))hide();},true);
  doc.defaultView.addEventListener('resize',place);
  doc.addEventListener('scroll',place,true);
  if(readGuidePreference(storage,id)){toggle.setAttribute('aria-pressed','true');index=0;show();}
  return {toggle,popup,isOn:()=>open,open:turnOn,close:hide,stepCount:usable.length};
}
