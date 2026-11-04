// User-supplied SI data only; no inferred material curves or extrapolation.
export function positiveTable(rows){
 if(!Array.isArray(rows)||rows.length<2||rows.length>256)throw Error('物性表は2〜256行で指定してください。');
 const table=rows.map(r=>{if(!Array.isArray(r)||r.length!==2||r.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0))throw Error('物性表には正の温度[K]と正の物性値を指定してください。');return [...r];});
 for(let i=1;i<table.length;i++)if(table[i][0]<=table[i-1][0])throw Error('物性表の温度は重複させず、昇順で指定してください。');
 function withinRange(T){const lo=table[0][0],hi=table.at(-1)[0],tolerance=8*Number.EPSILON*Math.max(Math.abs(T),Math.abs(T<lo?lo:hi));if(!Number.isFinite(T)||T<lo-tolerance||T>hi+tolerance)throw Error(`温度${T} Kは物性表の範囲${lo}〜${hi} Kを超えています。外挿せず停止します。`);return Math.max(lo,Math.min(hi,T));}
 function at(T){T=withinRange(T);
  let i=0;while(i+1<table.length-1&&T>table[i+1][0])i++;const [a,ka]=table[i],[b,kb]=table[i+1];return ka+(kb-ka)*(T-a)/(b-a);
 }
 return {at,withinRange,minTemperature:table[0][0],maxTemperature:table.at(-1)[0],minValue:Math.min(...table.map(r=>r[1])),maxValue:Math.max(...table.map(r=>r[1]))};
}

// Exact integral/inverse of a piecewise-linear positive cp(T), per unit mass.
// Enthalpy zero is the table's lower temperature, not an extrapolation to 0 K.
export function heatCapacityTable(rows){
 const property=positiveTable(rows),table=rows.map(row=>[...row]),H=[0];
 for(let i=1;i<table.length;i++){const value=H[i-1]+(.5*table[i-1][1]+.5*table[i][1])*(table[i][0]-table[i-1][0]);if(!Number.isFinite(value)||value<=H[i-1])throw Error('比熱表の積分が数値範囲を超えています。');H.push(value);}
 function enthalpy(T){T=property.withinRange(T);const cp=property.at(T);let i=0;while(i+1<table.length-1&&T>table[i+1][0])i++;return H[i]+(.5*table[i][1]+.5*cp)*(T-table[i][0]);}
 function temperature(h){
  if(!Number.isFinite(h)||h<0||h>H.at(-1))throw Error('エンタルピーが比熱の物性表の範囲を超えています。外挿せず停止します。');
  if(h===0)return table[0][0];if(h===H.at(-1))return table.at(-1)[0];let i=0;while(i+1<H.length-1&&h>H[i+1])i++;
  const [a,ca]=table[i],[b,cb]=table[i+1],scale=Math.max(ca,cb),p=ca/scale,slope=(cb/scale-p)/(b-a),delta=(h-H[i])/scale,discriminant=p*p+2*(slope*delta),root=Math.sqrt(Math.max(0,discriminant)),distance=2*delta/(p+root),T=a+distance;
  if(discriminant< -64*Number.EPSILON||!Number.isFinite(T)||T<a-8*Number.EPSILON*Math.abs(a)||T>b+8*Number.EPSILON*Math.abs(b))throw Error('比熱表の逆積分が悪条件です。物性値・温度間隔を見直してください。');
  return Math.max(a,Math.min(b,T));
 }
 return {...property,enthalpy,temperature,maxEnthalpy:H.at(-1)};
}
