// Natural-convection development UI config. The kernel (cavity.mjs) now
// accepts grids of 4..256 per direction and Ra<=1e6 for development
// benchmarks, but this screen keeps its own verified scope: only the
// conditions verified for the screen (Ra<=1000 below, grids per height
// 12..64, width count 4..96) are offered, and out-of-scope combinations
// are refused here with the same messages the kernel used before.
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
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['difference','gravity','grid','prandtl','aspectRatio','pressureTolerance','maxPressureIterations'].includes(k)))throw Error('未対応の自然対流画面条件です。');
 const c={difference:10,gravity:9.81,grid:16,prandtl:.71,aspectRatio:1,pressureTolerance:1e-11,maxPressureIterations:4000,...input};
 if(typeof c.difference!=='number'||!Number.isFinite(c.difference)||c.difference<0||c.difference>12)throw Error('左右壁の温度差は0〜12 Kです。');
 if(typeof c.gravity!=='number'||!Number.isFinite(c.gravity)||Math.abs(c.gravity)>9.81)throw Error('鉛直浮力の向きは−9.81〜9.81 m/s²です。');
 if(!CAVITY_UI_GRIDS.includes(c.grid))throw Error('格子は高さ方向に12/16/24/32/64です。');
 if(!CAVITY_UI_PRANDTL.includes(c.prandtl))throw Error('Prは検証済みの0.1/0.71/1/7だけです。');
 if(!CAVITY_UI_ASPECT_RATIOS.includes(c.aspectRatio))throw Error('アスペクト比（幅/高さ）は検証済みの0.5/1/2だけです。');
 // Solver settings exposed on this expert screen (P5-3). The defaults above
 // are the values this screen has always used, so an untouched form is
 // bit-identical to the previous behaviour. The range is the screen's safe
 // envelope: the upper tolerance bound matches the strictest kernel-side cap
 // in the cavity family (thermal-wall cavity refuses >1e-10), and the
 // iteration cap matches that kernel's 5000. The kernel itself keeps
 // accepting other values for its own tests; the screen does not offer them.
 if(typeof c.pressureTolerance!=='number'||!Number.isFinite(c.pressureTolerance)||c.pressureTolerance<1e-13||c.pressureTolerance>1e-10)throw Error('圧力反復の収束許容値（相対）は1e-13〜1e-10の有限値です。画面の安全範囲で、上限は計算核側の最も厳しい上限に合わせています。');
 if(!Number.isSafeInteger(c.maxPressureIterations)||c.maxPressureIterations<1||c.maxPressureIterations>5000)throw Error('圧力反復の上限回数は1〜5000の整数です。');
 const ny=c.grid,nx=ny*c.aspectRatio;
 if(!Number.isInteger(nx)||nx<4||nx>96)throw Error('幅方向の格子数が画面で扱う範囲（4〜96）を超えます。高さ方向の格子数を小さくしてください。');
 const nu=Math.sqrt(product*c.prandtl),alpha=Math.sqrt(product/c.prandtl);
 const rayleigh=Math.abs((c.gravity/300)*c.difference*.01**3/(nu*alpha));
 if(rayleigh>1000*(1+1e-12))throw Error('開発用自然対流はRa≤1000の検証に限定しています。');
 return {nx,ny,width:.01*c.aspectRatio,height:.01,depth:1,rho,cp,nu,alpha,initial:300,leftTemperature:300+c.difference/2,rightTemperature:300-c.difference/2,gravityBeta:c.gravity/300,beta:1/300,referenceTemperature:300,scalarScheme:'central',pressurePreconditioner:'multigrid',momentumScheme:'conservative2',pressureTolerance:c.pressureTolerance,maxPressureIterations:c.maxPressureIterations};
}
