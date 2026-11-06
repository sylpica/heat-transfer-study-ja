// Boundary draft UI only: no model, history, temperature or persistence writes.
const defaults=()=>({type:'adiabatic',temperatureC:26.85,outwardFlux:0,h:10,ambientC:26.85,emissivity:.8,radiationC:26.85});
export function mountTriangleBoundaryEditor({container,status,changed}){
 let outline=[],values=[];
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function render(){
  container.replaceChildren();outline.forEach((a,i)=>{const b=outline[(i+1)%outline.length],row=node('fieldset'),legend=node('legend',`辺${i}：頂点${i+1}→頂点${(i+1)%outline.length+1}`),coords=node('p',`(${a.map(x=>x.toPrecision(5)).join(', ')}) → (${b.map(x=>x.toPrecision(5)).join(', ')}) m`),label=node('label','境界条件'),select=node('select');row.dataset.face=String(i);select.dataset.boundaryType='';for(const [value,text]of [['adiabatic','断熱'],['temperature','固定温度'],['flux','指定外向き熱流束'],['convection','一定hの対流'],['surface-exchange','対流＋黒い周囲への放射']]){const option=node('option',text);option.value=value;select.append(option);}select.value=values[i].type;label.append(select);row.append(legend,coords,label);select.oninput=e=>e.stopPropagation();select.onchange=()=>{values[i].type=select.value;render();container.querySelector(`[data-face="${i}"] select`).focus({preventScroll:true});changed();};
   for(const [name,text,lo,hi,types]of [['temperatureC','固定温度 [℃]',-100,1000,['temperature']],['outwardFlux','外向き熱流束 [W/m²]（入熱は負）',-1e5,1e5,['flux']],['h','h [W/(m² K)]',0,1000,['convection','surface-exchange']],['ambientC','流体温度 [℃]',-100,1000,['convection','surface-exchange']],['emissivity','放射率 ε（0〜1）',0,1,['surface-exchange']],['radiationC','黒い放射周囲温度 [℃]',-100,1000,['surface-exchange']]]){if(!types.includes(values[i].type))continue;const label=node('label',text),input=node('input');input.type='number';input.name=name;input.min=String(lo);input.max=String(hi);input.step='any';input.required=true;input.value=String(values[i][name]);input.oninput=e=>{e.stopPropagation();values[i][name]=input.value.trim()?Number(input.value):NaN;changed();};label.append(input);row.append(label);}container.append(row);
  });
 }
 return {
  start(points,boundaries){outline=structuredClone(points);values=outline.map((_,i)=>{const b=boundaries?.[i],v=defaults();if(b){v.type=b.type;if(b.type==='temperature')v.temperatureC=b.temperatureK-273.15;if(b.type==='flux')v.outwardFlux=b.outwardFluxWPerM2;if(['convection','surface-exchange'].includes(b.type)){v.h=b.h;v.ambientC=b.ambientK-273.15;}if(b.type==='surface-exchange'){v.emissivity=b.emissivity;v.radiationC=b.radiationTemperatureK-273.15;}}return v;});status.textContent='受理済みの辺条件を下書きへコピーしました。各辺の向きと符号を確認して適用してください。';render();},
  updateOutline(points){const reset=points.length!==outline.length;outline=structuredClone(points);if(reset){values=outline.map(defaults);status.textContent='頂点数が変わったため、辺条件の下書きを全辺断熱へ初期化しました。各辺を再設定してから適用してください。';}else status.textContent='同じ頂点番号に対応する辺条件を保持しました。移動後の形状と条件を確認して適用してください。';render();},
  get values(){return structuredClone(values);}
 };
}
