#!/usr/bin/env python3
"""Independent collocated streamfunction/vorticity diagnosis; not a release model."""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import argparse,json,hashlib,time,math,re,subprocess
import numpy as np
import scipy
from scipy.fft import dstn,idstn
ROOT=Path(__file__).resolve().parents[1]
EXPECTED='22029fe4045039c60b4459b4120a66efe408dd96135a454ab2d80c4cb6cd1c6d'
def maximum(a):return float(np.max(np.abs(a)))
def poisson_factory(n):
 h=1/n;q=np.arange(1,n);e=4*np.sin(np.pi*q/(2*n))**2/h**2;den=e[:,None]+e[None,:]
 def solve(omega):
  psi=np.zeros_like(omega);psi[1:-1,1:-1]=idstn(dstn(omega[1:-1,1:-1],type=1,norm='ortho',workers=1)/den,type=1,norm='ortho',workers=1);return psi
 return solve
def velocities(psi,h,lid=1.):
 u=np.zeros_like(psi);v=np.zeros_like(psi);u[1:-1,1:-1]=(psi[2:,1:-1]-psi[:-2,1:-1])/(2*h);v[1:-1,1:-1]=-(psi[1:-1,2:]-psi[1:-1,:-2])/(2*h);u[-1,1:-1]=lid;return u,v
def walls(omega,psi,h):
 omega[0,1:-1]=-2*psi[1,1:-1]/h**2;omega[-1,1:-1]=-2*psi[-2,1:-1]/h**2-2/h;omega[1:-1,0]=-2*psi[1:-1,1]/h**2;omega[1:-1,-1]=-2*psi[1:-1,-2]/h**2
def sample(a,x,y):
 n=a.shape[0]-1;xx=np.asarray(x)*n;yy=np.asarray(y)*n;i=np.minimum(n-1,np.floor(xx).astype(int));j=np.minimum(n-1,np.floor(yy).astype(int));fx=xx-i;fy=yy-j;return (1-fx)*(1-fy)*a[j,i]+fx*(1-fy)*a[j,i+1]+(1-fx)*fy*a[j+1,i]+fx*fy*a[j+1,i+1]
def primitive_checks():
 rows=[]
 for n in [32,64]:
  h=1/n;x,y=np.meshgrid(np.linspace(0,1,n+1),np.linspace(0,1,n+1));psi=np.sin(np.pi*x)*np.sin(np.pi*y);psi[[0,-1],:]=0;psi[:,[0,-1]]=0;lam=8*math.sin(math.pi/(2*n))**2/h**2;actual=poisson_factory(n)(lam*psi);u,v=velocities(actual,h,lid=0);error=max(maximum(u[1:-1,1:-1]-np.pi*np.sin(np.pi*x[1:-1,1:-1])*np.cos(np.pi*y[1:-1,1:-1])),maximum(v[1:-1,1:-1]+np.pi*np.cos(np.pi*x[1:-1,1:-1])*np.sin(np.pi*y[1:-1,1:-1])));div=(u[2:-2,3:-1]-u[2:-2,1:-3]+v[3:-1,2:-2]-v[1:-3,2:-2])/(2*h);rows.append({'intervals':n,'poissonMaximumError':maximum(actual-psi),'interiorVelocityMaximumError':error,'interiorDivergence':maximum(div)})
 assert all(r['poissonMaximumError']<1e-13 and r['interiorDivergence']<1e-12 for r in rows);order=math.log2(rows[0]['interiorVelocityMaximumError']/rows[1]['interiorVelocityMaximumError']);assert 1.9<order<2.1;return {'rows':rows,'interiorDerivativeOrder':order,'wallVorticityValidationClaimed':False}
def parse_pack(path):
 data=path.read_bytes();assert hashlib.sha256(data).hexdigest()==EXPECTED;txt=data.decode()
 def rows(start,end):
  section=txt[txt.index(start):txt.index(end,txt.index(start))];out=[]
  for line in section.splitlines():
   if not line.startswith('|'):continue
   cells=[s.strip().replace('−','-') for s in line.split('|')[1:-1]]
   try:out.append([float(cells[0]),float(cells[1])])
   except ValueError:pass
  assert len(out)==17;return out
 return rows('### Table I:','### Table II:'),rows('### Table II:','## 2.')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--intervals',type=int,choices=[64,128],required=True);parser.add_argument('--pack',type=Path,required=True);parser.add_argument('--tag',default='v1');args=parser.parse_args();assert re.fullmatch('[a-z0-9-]{1,32}',args.tag);n=args.intervals;h=1/n;nu=.01;out=ROOT/f'docs/dynamic/GHIA_VORTICITY_N{n}_20261106_{args.tag}.json';assert not out.exists(),'Protect existing result; choose another tag.';u_ref,v_ref=parse_pack(args.pack);checks=primitive_checks();solve=poisson_factory(n);omega=np.zeros((n+1,n+1));psi=np.zeros_like(omega);walls(omega,psi,h);clock=0.;steps=0;history=[];previous=None;started=time.monotonic();next_progress=5;last=None
 for target in [25,30,35,40,45,50,55,60]:
  while clock<target:
   u,v=velocities(psi,h);speed=max(1.,maximum(u),maximum(v));dt=min(.1*h*h/nu,.2*h/speed,target-clock);r=nu*(omega[1:-1,2:]+omega[1:-1,:-2]+omega[2:,1:-1]+omega[:-2,1:-1]-4*omega[1:-1,1:-1])/h**2-u[1:-1,1:-1]*(omega[1:-1,2:]-omega[1:-1,:-2])/(2*h)-v[1:-1,1:-1]*(omega[2:,1:-1]-omega[:-2,1:-1])/(2*h);omega[1:-1,1:-1]+=dt*r;psi=solve(omega);walls(omega,psi,h);assert np.all(np.isfinite(omega)) and np.all(np.isfinite(psi));clock+=dt;steps+=1
   if steps>500000:raise RuntimeError('Vorticity step budget exceeded')
   if time.monotonic()-started>=next_progress:
    np.savez_compressed(ROOT/f'work/ghia-vorticity-{n}-{args.tag}-partial.npz',psi=psi,omega=omega,time=clock,steps=steps);print(json.dumps({'stage':'progress','n':n,'timeS':clock,'elapsedSeconds':time.monotonic()-started}),flush=True);next_progress=time.monotonic()-started+5
  u,v=velocities(psi,h);change=None if previous is None else max(maximum(u-previous[0]),maximum(v-previous[1]));row={'timeS':clock,'steps':steps,'maximumVelocityChangeFromPrevious':change,'uProfileMaximumError':max(abs(float(sample(u,.5,y))-ref) for y,ref in u_ref),'vProfileMaximumError':max(abs(float(sample(v,x,.5))-ref) for x,ref in v_ref)};history.append(row);previous=(u.copy(),v.copy());last=(u,v);print(json.dumps({'stage':'sample','n':n,**row}),flush=True)
  if change is not None and change<1e-8:break
 u,v=last;mac_file=ROOT/'docs/dynamic/CFD_FINE_LID_N64_20261106_v1.json';mac=json.loads(mac_file.read_text());m=64;mx,my=np.meshgrid(np.arange(m+1)/m,(np.arange(m)+.5)/m);ux=sample(u,mx,my);mx,my=np.meshgrid((np.arange(m)+.5)/m,np.arange(m+1)/m);vy=sample(v,mx,my);du=ux.ravel()-np.array(mac['finalState']['u']);dv=vy.ravel()-np.array(mac['finalState']['v']);profiles_u=[{'coordinate':y,'value':float(sample(u,.5,y))} for y,_ in u_ref];profiles_v=[{'coordinate':x,'value':float(sample(v,x,.5))} for x,_ in v_ref]
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':bool(subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=ROOT,text=True).strip()),'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'environment':{'numpy':np.__version__,'scipy':scipy.__version__,'fftWorkers':1,'BLASThreads':1,'python':os.sys.version,'platform':os.sys.platform},'referencePackSHA256':EXPECTED,'rawReferenceTableRedistributed':False,'method':'Own collocated streamfunction/vorticity, direct DST Dirichlet Poisson, central interior derivatives, Thom wall vorticity, explicit Euler. No production MAC pressure/momentum/interpolation functions used.','elapsedSeconds':time.monotonic()-started,'intervals':n,'Re':100,'nu':nu,'lidSpeed':1,'primitiveChecks':checks,'history':history,'steady':history[-1]['maximumVelocityChangeFromPrevious']<1e-8,'ownUProfile':profiles_u,'ownVProfile':profiles_v,'againstMAC64':{'sourceFile':mac_file.name,'sha256':hashlib.sha256(mac_file.read_bytes()).hexdigest(),'fullUFaceRmsDifference':float(np.sqrt(np.mean(du**2))),'fullVFaceRmsDifference':float(np.sqrt(np.mean(dv**2))),'maximumUFaceDifference':maximum(du),'maximumVFaceDifference':maximum(dv)},'field':{'u':u.tolist(),'v':v.tolist(),'streamfunction':psi.tolist(),'vorticity':omega.tolist()},'ghiaGateReplaced':False,'generalCFDAccuracyVerified':False,'releaseApproved':False};out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'output':str(out),'n':n,'steady':result['steady'],'againstMAC64':result['againstMAC64'],'elapsedSeconds':time.monotonic()-started}),flush=True)
 if not result['steady']:raise RuntimeError('Saved nonsteady independent result; do not claim convergence')
if __name__=='__main__':main()
