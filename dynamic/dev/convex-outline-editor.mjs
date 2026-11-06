// Development-only outline editor. No temperatures or solver state live here.
import {createConvexOutlineDraft,outlineDraftBounds} from './convex-outline-draft.mjs';
const NS='http://www.w3.org/2000/svg';
const element=(name,attributes,text)=>{const node=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attributes))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;};
export function mountConvexOutlineEditor({svg,select,xInput,yInput,moveButton,insertButton,removeButton,fitButton,status,changed}){
 let draft=null,bounds=null,plot=null,drag=null,applied=false;
 function syncInputs(){const p=draft.outline[draft.selected];xInput.value=String(p[0]);yInput.value=String(p[1]);}
 function message(error){status.textContent=error?'変更を拒否しました。直前の有効な編集輪郭を保持します。'+error.message:`編集輪郭：${draft.outline.length}頂点、面積${draft.area.toPrecision(8)} m²。${applied?'この輪郭を温度場へ適用済みです。':'温度場へは未適用です。'}`;status.dataset.valid=String(!error);}
 function render(){
  if(!draft||svg.closest('[hidden]'))return;
  const W=Math.max(280,Math.round(svg.clientWidth||600)),H=320,scale=Math.min((W-70)/(bounds[2]-bounds[0]),(H-70)/(bounds[3]-bounds[1]));plot={left:(W-(bounds[2]-bounds[0])*scale)/2,top:(H-(bounds[3]-bounds[1])*scale)/2,scale};
  const map=p=>[plot.left+(p[0]-bounds[0])*scale,plot.top+(bounds[3]-p[1])*scale],focused=document.activeElement?.closest?.('[data-vertex]'),restoreFocus=focused&&svg.contains(focused)?Number(focused.dataset.vertex):null,p=draft.outline,polygon=element('polygon',{points:p.map(v=>map(v).join(',')).join(' '),class:'outline-polygon'});
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.dataset.plot=JSON.stringify({...plot,bounds});svg.replaceChildren(polygon);select.replaceChildren(...p.map((_,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`頂点${i+1}`;return option;}));select.value=String(draft.selected);
  p.forEach((point,i)=>{const [x,y]=map(point),g=element('g',{'data-vertex':i,'data-x-m':point[0],'data-y-m':point[1],tabindex:0,role:'button','aria-label':`頂点${i+1} x=${point[0]} m、y=${point[1]} m。矢印キーで移動`,'aria-pressed':String(i===draft.selected)});g.append(element('circle',{cx:x,cy:y,r:22,fill:'transparent'}),element('circle',{cx:x,cy:y,r:8,class:i===draft.selected?'outline-node selected':'outline-node'}),element('text',{x:x+12,y:y-12,fill:'currentColor','font-size':14},String(i+1)));svg.append(g);});
  svg.append(element('text',{x:6,y:18,fill:'currentColor','font-size':14},'y [m]'),element('text',{x:W-48,y:H-8,fill:'currentColor','font-size':14},'x [m]'),element('text',{x:6,y:H-8,fill:'currentColor','font-size':14},`x ${bounds[0].toFixed(3)}〜${bounds[2].toFixed(3)}、y ${bounds[1].toFixed(3)}〜${bounds[3].toFixed(3)}`));
  removeButton.disabled=p.length===3;insertButton.disabled=p.length===12;
  if(restoreFocus!==null)svg.querySelector(`[data-vertex="${Math.min(restoreFocus,p.length-1)}"]`)?.focus({preventScroll:true});
 }
 function edit(operation){if(!draft)return;try{operation();applied=false;syncInputs();message();render();changed(draft.outline);return true;}catch(error){message(error);return false;}}
 function physical(event){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());return [bounds[0]+(p.x-plot.left)/plot.scale,bounds[3]-(p.y-plot.top)/plot.scale];}
 // Selecting a vertex changes editor focus, not the physical draft. A parent
 // form must not redraw this select between its input and change events.
 select.oninput=event=>event.stopPropagation();
 select.onchange=()=>{if(!draft)return;draft.select(Number(select.value));syncInputs();render();};
 moveButton.onclick=()=>edit(()=>{if(!xInput.value.trim()||!yInput.value.trim())throw Error('x、yを入力してください。');draft.move(draft.selected,[Number(xInput.value),Number(yInput.value)]);});
 insertButton.onclick=()=>edit(()=>draft.insertAfter(draft.selected));removeButton.onclick=()=>edit(()=>draft.remove(draft.selected));fitButton.onclick=()=>{if(!draft)return;bounds=outlineDraftBounds(draft.outline);render();};
 svg.onpointerdown=event=>{const node=event.target.closest('[data-vertex]');if(!draft||!node||event.button!==0)return;event.preventDefault();draft.select(Number(node.dataset.vertex));syncInputs();drag={pointerId:event.pointerId,index:draft.selected};svg.setPointerCapture(event.pointerId);render();svg.querySelector(`[data-vertex="${draft.selected}"]`).focus({preventScroll:true});};
 svg.onpointermove=event=>{if(drag?.pointerId!==event.pointerId)return;event.preventDefault();edit(()=>draft.move(drag.index,physical(event)));};
 const end=event=>{if(drag?.pointerId!==event.pointerId)return;drag=null;if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);};svg.onpointerup=end;svg.onpointercancel=end;svg.onlostpointercapture=()=>{drag=null;};
 svg.onkeydown=event=>{if(!draft||event.altKey||event.ctrlKey||event.metaKey)return;const d={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[event.key];if(!d)return;event.preventDefault();const node=event.target.closest('[data-vertex]');if(node)draft.select(Number(node.dataset.vertex));const p=draft.outline[draft.selected],step=(event.shiftKey?.05:.01)*Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);edit(()=>draft.move(draft.selected,[p[0]+step*d[0],p[1]+step*d[1]]));};
 return {start(points){draft=createConvexOutlineDraft(points);bounds=outlineDraftBounds(draft.outline);drag=null;applied=false;syncInputs();message();render();},get outline(){return draft?.outline??null;},markApplied(points){if(!draft)return;applied=JSON.stringify(draft.outline)===JSON.stringify(points);message();},render};
}
