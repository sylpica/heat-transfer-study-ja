// Diagnostics of the existing closed MAC D/G pair. This does not advance a
// model, add viscous heat, or claim continuum pressure accuracy.
export function macKineticDiagnostics(state,config){
 const {nx,ny,width,height,rho,depth=1}=config;
 if(![nx,ny].every(n=>Number.isSafeInteger(n)&&n>=2)||nx*ny>65536||![width,height,depth,rho].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0))throw Error('運動エネルギー診断の格子・寸法・密度が不正です。');
 const {u,v,pressure:p,lastDt:dt}=state,U=(i,j)=>j*(nx+1)+i,V=(i,j)=>j*nx+i,dx=width/nx,dy=height/ny,volume=dx*dy*depth;
 for(const [values,size]of [[u,(nx+1)*ny],[v,nx*(ny+1)],[p,nx*ny]])if(values?.length!==size||Array.from(values).some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('運動エネルギー診断の速度・圧力が不正です。');
 if(typeof dt!=='number'||!Number.isFinite(dt)||dt<0||!Number.isFinite(volume)||volume<=0)throw Error('運動エネルギー診断の時間・体積が不正です。');
 for(let j=0;j<ny;j++)if(Math.abs(u[U(0,j)])>1e-12||Math.abs(u[U(nx,j)])>1e-12)throw Error('運動エネルギー診断は閉境界だけです。');
 for(let i=0;i<nx;i++)if(Math.abs(v[V(i,0)])>1e-12||Math.abs(v[V(i,ny)])>1e-12)throw Error('運動エネルギー診断は閉境界だけです。');
 let speedSquared=0,facePower=0,correctionSquared=0,impliedLoss=0,cellPower=0,divergenceMax=0;
 const accumulate=(velocity,gradient)=>{const correction=dt/rho*gradient;speedSquared+=velocity*velocity;facePower-=velocity*gradient;correctionSquared+=correction*correction;impliedLoss+=correction*(velocity+correction/2);};
 for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)accumulate(u[U(i,j)],(p[j*nx+i]-p[j*nx+i-1])/dx);
 for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)accumulate(v[V(i,j)],(p[j*nx+i]-p[(j-1)*nx+i])/dy);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const divergence=(u[U(i+1,j)]-u[U(i,j)])/dx+(v[V(i,j+1)]-v[V(i,j)])/dy;cellPower+=p[j*nx+i]*divergence;divergenceMax=Math.max(divergenceMax,Math.abs(divergence));}
 const kineticEnergyJ=.5*rho*volume*speedSquared,pressurePowerByFacesW=volume*facePower,pressurePowerByCellsW=volume*cellPower,projectionImpliedLossJ=rho*volume*impliedLoss,orthogonalProjectionLossJ=.5*rho*volume*correctionSquared;
 const result={kineticEnergyJ,pressurePowerByFacesW,pressurePowerByCellsW,integrationByPartsResidualW:pressurePowerByFacesW-pressurePowerByCellsW,projectionImpliedLossJ,orthogonalProjectionLossJ,projectionOrthogonalityDefectJ:projectionImpliedLossJ-orthogonalProjectionLossJ,projectionIdentityResidualJ:projectionImpliedLossJ-orthogonalProjectionLossJ+dt*pressurePowerByCellsW,divergenceMaxPerS:divergenceMax};
 if(Object.values(result).some(x=>!Number.isFinite(x)))throw Error('運動エネルギー診断の量が数値範囲外です。');return result;
}
