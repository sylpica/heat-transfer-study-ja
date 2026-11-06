// A nondimensional-benchmark-style hypothetical 1 m square, expressed in SI.
export function lidCavityUIConfig(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['velocity','grid'].includes(k)))throw Error('未対応の移動壁画面条件です。');const c={velocity:1,grid:16,...input};if(typeof c.velocity!=='number'||!Number.isFinite(c.velocity)||Math.abs(c.velocity)>1||![16,32,64].includes(c.grid))throw Error('移動壁は−1〜1m/s、格子は16/32/64です。');return {nx:c.grid,ny:c.grid,width:1,height:1,depth:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,lidVelocity:c.velocity,gravityBeta:0,referenceTemperature:300,scalarScheme:'upwind',momentumScheme:'conservative2',pressurePreconditioner:'multigrid',pressureTolerance:1e-11,maxPressureIterations:4000};
}
