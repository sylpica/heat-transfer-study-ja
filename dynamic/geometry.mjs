const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function polygon(points){
 if(!Array.isArray(points)||points.length<3||points.length>512)throw Error('輪郭は3〜512頂点で指定してください。');
 if(points.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!finite(x)||Math.abs(x)>1e4)))throw Error('輪郭座標が不正です。');
 const repaired=[],p=points.map(v=>[...v]);
 if(p.length>3&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]){p.pop();repaired.push('重複する終点を除き、同じ輪郭を保持しました。');}
 const scale=Math.max(...p.flat().map(Math.abs),1e-12),eps=1e-12*scale*scale;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a,b,c)=>Math.abs(cross(a,b,c))<=eps&&c[0]>=Math.min(a[0],b[0])-Math.sqrt(eps)&&c[0]<=Math.max(a[0],b[0])+Math.sqrt(eps)&&c[1]>=Math.min(a[1],b[1])-Math.sqrt(eps)&&c[1]<=Math.max(a[1],b[1])+Math.sqrt(eps);
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(b[0]-a[0],b[1]-a[1])<scale*1e-8)throw Error('重複頂点または微小辺があります。輪郭を見直してください。');
  for(let j=i+1;j<p.length;j++){
   if(j===i+1||(i===0&&j===p.length-1))continue;
   const c=p[j],d=p[(j+1)%p.length],x=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];
   if((x[0]*x[1]<0&&x[2]*x[3]<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw Error('輪郭が自己交差または重なっています。');
  }
 }
 const area=Math.abs(p.reduce((s,a,i)=>s+a[0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*a[1],0))/2;
 if(area<=eps)throw Error('面積のない輪郭です。');return {points:p,area,repaired};
}
export function contains(points,x,y){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
 const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;}
export function rasterize({nx,ny,width,height,outline}){
 const shape=outline?polygon(outline):null,mask=new Uint8Array(nx*ny);let count=0;
 if(shape&&shape.points.some(([x,y])=>x<0||x>width||y<0||y>height))throw Error('輪郭が計算領域の外にあります。');
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const n=j*nx+i;mask[n]=!shape||contains(shape.points,(i+.5)*width/nx,(j+.5)*height/ny)?1:0;count+=mask[n];}
 if(!count)throw Error('形状が格子に解像されません。寸法か格子を見直してください。');
 const visited=new Set(),start=mask.findIndex(Boolean),todo=[start];visited.add(start);
 for(let q=0;q<todo.length;q++){const n=todo[q],i=n%nx,j=Math.floor(n/nx);for(const [x,y] of [[i-1,j],[i+1,j],[i,j-1],[i,j+1]])if(x>=0&&x<nx&&y>=0&&y<ny){const m=y*nx+x;if(mask[m]&&!visited.has(m)){visited.add(m);todo.push(m);}}}
 if(visited.size!==count)throw Error('格子上で領域が分断されています。細い部分や隙間を確認してください。');
 return {mask,count,repaired:shape?.repaired||[],area:count*width/nx*height/ny,geometricArea:shape?.area??width*height};
}
export function rectangle(x,y,w,h){return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}
export function circle(x,y,r,n=64){return Array.from({length:n},(_,i)=>[x+r*Math.cos(2*Math.PI*i/n),y+r*Math.sin(2*Math.PI*i/n)]);}
