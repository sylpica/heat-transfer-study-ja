// Independent inspection of cell-centred solved data; no new physical model.
function validate(mesh,values){
 const {nx,ny,width,height,mask}=mesh||{};
 if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<1||ny<1||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||mask?.length!==nx*ny||values?.length!==nx*ny)throw Error('温度場と格子の寸法が一致しません。');
 for(let n=0;n<mask.length;n++)if(mask[n]&&!Number.isFinite(values[n]))throw Error('有効セルの温度が有限値ではありません。');
}
export function crossSection(mesh,values,{axis='x',fraction=.5}={}){
 validate(mesh,values);if(!['x','y'].includes(axis)||!Number.isFinite(fraction)||fraction<0||fraction>1)throw Error('断面の軸・位置が不正です。');
 const along=axis==='x'?mesh.nx:mesh.ny,across=axis==='x'?mesh.ny:mesh.nx,row=Math.min(across-1,Math.floor(fraction*across)),length=axis==='x'?mesh.width:mesh.height,at=(row+.5)/across*(axis==='x'?mesh.height:mesh.width);
 return {axis,at,length,points:Array.from({length:along},(_,i)=>{const n=axis==='x'?row*mesh.nx+i:i*mesh.nx+row;return {position:(i+.5)/along*length,temperature:mesh.mask[n]?values[n]:null};})};
}
export function temperatureContours(mesh,values,levels){
 validate(mesh,values);if(!Array.isArray(levels)||levels.length>12||levels.some(v=>!Number.isFinite(v)))throw Error('等温線は有限の温度で12本以下にしてください。');
 const segments=[],seen=new Set(),{nx,ny,width,height,mask}=mesh,point=n=>[(n%nx+.5)/nx*width,(Math.floor(n/nx)+.5)/ny*height];
 // Split each cell-centre quadrilateral along its lower-left/upper-right
 // diagonal. This is piecewise-linear interpolation, not a bilinear saddle
 // resolver or a reconstruction of the physical boundary temperature.
 for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
  const a=j*nx+i,b=a+1,d=a+nx,c=d+1;if(![a,b,c,d].every(n=>mask[n]))continue;
  for(const triangle of [[a,b,c],[a,c,d]])for(const level of levels){
   const hits=[];for(let e=0;e<3;e++){const n=triangle[e],m=triangle[(e+1)%3],v=values[n],w=values[m];if((v<level&&w>=level)||(w<level&&v>=level)){const p=point(n),q=point(m),t=(level-v)/(w-v);hits.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}
   if(hits.length!==2)continue;const keys=hits.map(p=>p.map(v=>v.toPrecision(14)).join(','));if(keys[0]===keys[1])continue;const key=level+':'+keys.sort().join(';');if(seen.has(key))continue;seen.add(key);segments.push({level,from:hits[0],to:hits[1]});
  }
 }
 return segments;
}
