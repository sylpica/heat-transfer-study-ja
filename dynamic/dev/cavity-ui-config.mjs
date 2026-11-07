// Natural-convection development UI config. The kernel (cavity.mjs) is the
// authority: grids are 4..96 per direction and Ra<=1000 is refused there.
// Prandtl number: nu*alpha is held at the 300 K air product and split by Pr,
// exactly as in the verified Pr sweep (Ra is then independent of Pr at fixed
// temperature difference and gravity). Only the verified Pr values
// (0.1, 0.71, 1, 7 at Ra=1000, 32 cells per height) and aspect ratios
// (0.5, 1, 2 at Pr=0.71, Ra=1000) are offered. Aspect ratio is width/height
// at a fixed height of 10 mm; the grid value counts cells per height and
// the width count follows from the aspect ratio with square cells.
const rho=1.177,cp=1006,k=.0264,nuAir=1.575e-5,alphaAir=k/(rho*cp),product=nuAir*alphaAir;
export const CAVITY_UI_PRANDTL=[.1,.71,1,7],CAVITY_UI_ASPECT_RATIOS=[.5,1,2],CAVITY_UI_GRIDS=[12,16,24,32,64];
export function cavityUIConfig(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['difference','gravity','grid','prandtl','aspectRatio'].includes(k)))throw Error('未対応の自然対流画面条件です。');
 const c={difference:10,gravity:9.81,grid:16,prandtl:.71,aspectRatio:1,...input};
 if(typeof c.difference!=='number'||!Number.isFinite(c.difference)||c.difference<0||c.difference>12)throw Error('左右壁の温度差は0〜12 Kです。');
 if(typeof c.gravity!=='number'||!Number.isFinite(c.gravity)||Math.abs(c.gravity)>9.81)throw Error('鉛直浮力の向きは−9.81〜9.81 m/s²です。');
 if(!CAVITY_UI_GRIDS.includes(c.grid))throw Error('格子は高さ方向に12/16/24/32/64です。');
 if(!CAVITY_UI_PRANDTL.includes(c.prandtl))throw Error('Prは検証済みの0.1/0.71/1/7だけです。');
 if(!CAVITY_UI_ASPECT_RATIOS.includes(c.aspectRatio))throw Error('アスペクト比（幅/高さ）は検証済みの0.5/1/2だけです。');
 const ny=c.grid,nx=ny*c.aspectRatio;
 if(!Number.isInteger(nx)||nx<4||nx>96)throw Error('幅方向の格子数が計算核の範囲（4〜96）を超えます。高さ方向の格子数を小さくしてください。');
 const nu=Math.sqrt(product*c.prandtl),alpha=Math.sqrt(product/c.prandtl);
 return {nx,ny,width:.01*c.aspectRatio,height:.01,depth:1,rho,cp,nu,alpha,initial:300,leftTemperature:300+c.difference/2,rightTemperature:300-c.difference/2,gravityBeta:c.gravity/300,beta:1/300,referenceTemperature:300,scalarScheme:'central',pressurePreconditioner:'multigrid',momentumScheme:'conservative2',pressureTolerance:1e-11,maxPressureIterations:4000};
}
