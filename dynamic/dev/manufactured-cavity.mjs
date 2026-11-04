// Independent manufactured PDE on a unit square (metres), time in seconds.
// Velocity from psi=sin²(pi*x)sin²(pi*y)exp(-t); gauge pressure and temperature
// have compatible Neumann/Dirichlet walls. This is a code-verification case,
// not a real fluid preset or a new publicly selectable physical model.
export function manufacturedCavity({rho=1,cp=1,nu=1,alpha=.2,velocityAmplitude=1}={}){
 if(![rho,cp,nu,alpha].every(x=>Number.isFinite(x)&&x>0)||!Number.isFinite(velocityAmplitude))throw Error('製造解の物性/速度振幅が不正です。');
 function fields(x,y,t,includeTerms=false){
  const p=Math.PI,E=Math.exp(-t),sx=Math.sin(p*x),sy=Math.sin(p*y),cx=Math.cos(p*x),cy=Math.cos(p*y),s2x=Math.sin(2*p*x),s2y=Math.sin(2*p*y),c2x=Math.cos(2*p*x),c2y=Math.cos(2*p*y);
  const EA=velocityAmplitude*E,u=p*sx*sx*s2y*EA,v=-p*s2x*sy*sy*EA,ux=p*p*s2x*s2y*EA,uy=2*p*p*sx*sx*c2y*EA,vx=-2*p*p*c2x*sy*sy*EA,vy=-p*p*s2x*s2y*EA;
  const lapU=2*p**3*(2*c2x-1)*s2y*EA,lapV=2*p**3*s2x*(1-2*c2y)*EA,px=-.2*p*s2x*c2y*E,py=-.2*p*c2x*s2y*E,theta=sx*cy*E,Tx=p*cx*cy*E,Ty=-p*sx*sy*E;
  const result={velocity:[u,v],pressure:.1*c2x*c2y*E,temperature:300+theta,bodyForce:[-u+u*ux+v*uy+px/rho-nu*lapU,-v+u*vx+v*vy+py/rho-nu*lapV],heatSource:rho*cp*(-theta+u*Tx+v*Ty+2*alpha*p*p*theta)};
  return includeTerms?{...result,advection:[u*ux+v*uy,u*vx+v*vy],laplacianVelocity:[lapU,lapV],pressureGradient:[px,py],velocityTimeDerivative:[-u,-v]}:result;
 }
 return {id:'manufactured-cavity-v2:'+JSON.stringify([rho,cp,nu,alpha,velocityAmplitude]),parameters:Object.freeze({rho,cp,nu,alpha,velocityAmplitude,width:1,height:1,leftTemperature:300,rightTemperature:300}),fields,components:(...a)=>fields(...a,true),velocity:(...a)=>fields(...a).velocity,pressure:(...a)=>fields(...a).pressure,temperature:(...a)=>fields(...a).temperature,bodyForce:(...a)=>fields(...a).bodyForce,heatSource:(...a)=>fields(...a).heatSource};
}
