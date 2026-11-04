// User-supplied SI data only; no inferred material curves or extrapolation.
export function positiveTable(rows){
 if(!Array.isArray(rows)||rows.length<2||rows.length>256)throw Error('物性表は2〜256行で指定してください。');
 const table=rows.map(r=>{if(!Array.isArray(r)||r.length!==2||r.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0))throw Error('物性表には正の温度[K]と正の物性値を指定してください。');return [...r];});
 for(let i=1;i<table.length;i++)if(table[i][0]<=table[i-1][0])throw Error('物性表の温度は重複させず、昇順で指定してください。');
 function at(T){if(!Number.isFinite(T)||T<table[0][0]||T>table.at(-1)[0])throw Error(`温度${T} Kは物性表の範囲${table[0][0]}〜${table.at(-1)[0]} Kを超えています。外挿せず停止します。`);
  let i=0;while(i+1<table.length-1&&T>table[i+1][0])i++;const [a,ka]=table[i],[b,kb]=table[i+1];return ka+(kb-ka)*(T-a)/(b-a);
 }
 return {at,minTemperature:table[0][0],maxTemperature:table.at(-1)[0],maxValue:Math.max(...table.map(r=>r[1]))};
}
