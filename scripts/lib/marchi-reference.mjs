// Parser for the specific, hash-checked private working copy of Tables 12/13.
// No original table is embedded. Tc is an extrapolated estimate, not an exact solution.
export function parseMarchiRe100(text){
 const normalized=text.replaceAll('\x03','-').replaceAll('\x02','×').replaceAll('−','-');
 const table12=normalized.search(/Table\s+12\s+Profile/),table13=normalized.search(/Table\s+13\s+Profile/),table14=normalized.search(/Table\s+14\s+Comparisons/);
 if(table12<0||table13<table12||table14<table13)throw Error('Expected Re100 Tables 12/13, not another reference section.');
 const result={};
 for(const [component,start,end] of [['u',table12,table13],['v',table13,table14]]){
  const chunk=normalized.slice(start,end);if(!/Re\s*[=5]\s*100\s*,/.test(chunk))throw Error('Re100 header is required.');
  const rows=[];for(const line of chunk.split('\n')){
   const coordinate=line.match(new RegExp(`^\\s*${component}\\(([0-9.]+)\\)`));if(!coordinate)continue;
   const numbers=[...line.matchAll(/(-?\d+(?:\.\d+)?)\s*×\s*10(-?\d+)\s*\((\d+)\)/g)];
   if(numbers.length!==2)throw Error('Expected separate Th(GCI) and Tc(Uc) with last-digit uncertainty.');
   const x=Number(coordinate[1]),tc=numbers[1],exponent=Number(tc[2]),decimals=tc[1].split('.')[1]?.length??0,value=Number(tc[1])*10**exponent,uncertainty=Number(tc[3])*10**(exponent-decimals);
   if(!Number.isFinite(x)||x<=0||x>=1||!Number.isInteger(x*128)||!Number.isFinite(value)||!Number.isFinite(uncertainty)||uncertainty<=0||rows.length&&x<=rows.at(-1).coordinate)throw Error('Reference coordinates, ordering or Tc uncertainty are invalid.');
   rows.push({coordinate:x,value,uncertainty});
  }
  if(rows.length!==28)throw Error('All 28 interior rows of each Re100 profile are required.');result[component]=rows;
 }
 return result;
}
