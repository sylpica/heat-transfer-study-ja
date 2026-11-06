// Hypothetical constant-property insulated rectangle; no real material claim.
export function gpuDiffusionUIConfig(input={}){
 const allowed=['grid','meanTemperature','amplitude','alpha','backend'];if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('未対応のGPU画面条件です。');const c={grid:32,meanTemperature:300,amplitude:1,alpha:.01,backend:'auto',...input};
 if(![16,32,64,128].includes(c.grid)||!['auto','cpu','webgpu'].includes(c.backend))throw Error('格子または計算経路が範囲外です。');for(const [k,min,max]of [['meanTemperature',280,330],['amplitude',-20,20],['alpha',.001,.1]])if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<min||c[k]>max)throw Error('仮想断熱板の画面入力範囲を超えます。');
 const nx=c.grid,ny=nx/2,sinc=x=>Math.sin(x)/x;return {backend:c.backend,physical:{nx,ny,width:1,height:.5,depth:1,materials:[{rho:1,cp:1,k:c.alpha}],initial:Array.from({length:nx*ny},(_,n)=>c.meanTemperature+c.amplitude*sinc(Math.PI/(2*nx))*sinc(Math.PI/(2*ny))*Math.cos(Math.PI*(n%nx+.5)/nx)*Math.cos(Math.PI*(Math.floor(n/nx)+.5)/ny))}};
}
