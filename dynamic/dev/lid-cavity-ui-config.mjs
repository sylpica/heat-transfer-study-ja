// A nondimensional-benchmark-style hypothetical 1 m square, expressed in SI.
export function lidCavityUIConfig(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['velocity','grid','pressureTolerance','maxPressureIterations'].includes(k)))throw Error('未対応の移動壁画面条件です。');
 const c={velocity:1,grid:16,pressureTolerance:1e-11,maxPressureIterations:4000,...input};
 if(typeof c.velocity!=='number'||!Number.isFinite(c.velocity)||Math.abs(c.velocity)>1||![16,32,64].includes(c.grid))throw Error('移動壁は−1〜1m/s、格子は16/32/64です。');
 // Solver settings exposed on this expert screen (P5-3), with the same safe
 // envelope as the natural-convection screen: tolerance 1e-13..1e-10
 // (relative), iterations 1..5000. The defaults are the values this screen
 // has always used, so an untouched form is bit-identical to before.
 if(typeof c.pressureTolerance!=='number'||!Number.isFinite(c.pressureTolerance)||c.pressureTolerance<1e-13||c.pressureTolerance>1e-10)throw Error('圧力反復の収束許容値（相対）は1e-13〜1e-10の有限値です。画面の安全範囲で、上限は計算核側の最も厳しい上限に合わせています。');
 if(!Number.isSafeInteger(c.maxPressureIterations)||c.maxPressureIterations<1||c.maxPressureIterations>5000)throw Error('圧力反復の上限回数は1〜5000の整数です。');
 return {nx:c.grid,ny:c.grid,width:1,height:1,depth:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,lidVelocity:c.velocity,gravityBeta:0,referenceTemperature:300,scalarScheme:'upwind',momentumScheme:'conservative2',pressurePreconditioner:'multigrid',pressureTolerance:c.pressureTolerance,maxPressureIterations:c.maxPressureIterations};
}
