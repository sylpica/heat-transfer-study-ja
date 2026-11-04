// Independent manufactured PDE on a unit square (metres), time in seconds.
// Velocity from psi=sin²(pi*x)sin²(pi*y)exp(-t); gauge pressure and temperature
// have compatible Neumann/Dirichlet walls. This is a code-verification case,
// not a real fluid preset or a new publicly selectable physical model.
export function manufacturedCavity({rho=1,cp=1,nu=1,alpha=.2}={}){
 function fields(x,y,t){
  const p=Math.PI,E=Math.exp(-t),sx=Math.sin(p*x),sy=Math.sin(p*y),cx=Math.cos(p*x),cy=Math.cos(p*y),s2x=Math.sin(2*p*x),s2y=Math.sin(2*p*y),c2x=Math.cos(2*p*x),c2y=Math.cos(2*p*y);
  const u=p*sx*sx*s2y*E,v=-p*s2x*sy*sy*E,ux=p*p*s2x*s2y*E,uy=2*p*p*sx*sx*c2y*E,vx=-2*p*p*c2x*sy*sy*E,vy=-p*p*s2x*s2y*E;
  const lapU=2*p**3*(2*c2x-1)*s2y*E,lapV=2*p**3*s2x*(1-2*c2y)*E,px=-.2*p*s2x*c2y*E,py=-.2*p*c2x*s2y*E,theta=sx*cy*E,Tx=p*cx*cy*E,Ty=-p*sx*sy*E;
  return {velocity:[u,v],pressure:.1*c2x*c2y*E,temperature:300+theta,bodyForce:[-u+u*ux+v*uy+px/rho-nu*lapU,-v+u*vx+v*vy+py/rho-nu*lapV],heatSource:rho*cp*(-theta+u*Tx+v*Ty+2*alpha*p*p*theta)};
 }
 return {fields,velocity:(...a)=>fields(...a).velocity,pressure:(...a)=>fields(...a).pressure,temperature:(...a)=>fields(...a).temperature,bodyForce:(...a)=>fields(...a).bodyForce,heatSource:(...a)=>fields(...a).heatSource};
}
