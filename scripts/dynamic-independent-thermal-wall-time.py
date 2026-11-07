#!/usr/bin/env python3
"""Physical thermal graph + affine exponential, and separate projected MAC
ODE with a directly factorized pressure saddle matrix and DOP853.
No product RHS, assembly, pressure iteration or RK2 is used as reference.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,math,subprocess
import numpy as np
from scipy.linalg import expm,lu_factor,lu_solve
from scipy.integrate import solve_ivp
ROOT=Path(__file__).resolve().parents[1]

def geometry(c):
    nx,ny=c['nx'],c['ny'];dx=c['width']/nx;dy=c['height']/ny;D=c['depth'];rhoCp=c['rho']*c['cp'];C=rhoCp*dx*dy*D;k=rhoCp*c['alpha'];return nx,ny,dx,dy,D,rhoCp,C,k

def thermal(c):
    nx,ny,dx,dy,D,rhoCp,C,k=geometry(c);N=nx*ny;wall=N;heat=N+1;const=N+5;A=np.zeros((N+6,N+6));Gx=k*dy*D/dx;Gy=k*dx*D/dy;Gw=2*k*dy*D/dx;Cw=c['wallCapacityJPerK']
    for j in range(ny):
        for i in range(nx):
            n=j*nx+i
            for other,G in [(n+1,Gx)] if i<nx-1 else []:A[n,n]-=G/C;A[n,other]+=G/C;A[other,other]-=G/C;A[other,n]+=G/C
            for other,G in [(n+nx,Gy)] if j<ny-1 else []:A[n,n]-=G/C;A[n,other]+=G/C;A[other,other]-=G/C;A[other,n]+=G/C
            if i==0:
                A[n,n]-=Gw/C;A[n,wall]+=Gw/C;A[wall,wall]-=Gw/Cw;A[wall,n]+=Gw/Cw;A[heat+2,wall]+=Gw;A[heat+2,n]-=Gw
            if i==nx-1:A[n,n]-=Gw/C;A[heat+1,n]-=Gw;A[heat+3,n]-=Gw
    A[wall,const]+=c['wallInputW']/Cw;A[heat,const]=c['wallInputW'];A[heat+3,const]=c['wallInputW'];initial=np.zeros(N+6);initial[:N]=np.array(c['initial'])-c['coldTemperature'];initial[wall]=c['wallInitialTemperature']-c['coldTemperature'];initial[-1]=1;return A,initial

def nonlinear(c):
    nx,ny,dx,dy,D,rhoCp,C,k=geometry(c);N=nx*ny;un=(nx+1)*ny;vn=nx*(ny+1);u0=N+1;v0=u0+un;heat=v0+vn;L=np.zeros((N,N))
    for j in range(ny):
        for i in range(nx):
            n=j*nx+i
            for other,G in [(n-1,1/dx**2)] if i else []:L[n,n]+=G;L[n,other]-=G
            for other,G in [(n+1,1/dx**2)] if i<nx-1 else []:L[n,n]+=G;L[n,other]-=G
            for other,G in [(n-nx,1/dy**2)] if j else []:L[n,n]+=G;L[n,other]-=G
            for other,G in [(n+nx,1/dy**2)] if j<ny-1 else []:L[n,n]+=G;L[n,other]-=G
    saddle=np.zeros((N+1,N+1));saddle[:N,:N]=L;saddle[-1,:N]=1;saddle[:N,-1]=1;factor=lu_factor(saddle)
    def rhs(t,y):
        T=y[:N].reshape(ny,nx);w=y[N];u=y[u0:v0].reshape(ny,nx+1);v=y[v0:heat].reshape(ny+1,nx);result=np.zeros_like(y)
        # Shared centre/corner momentum fluxes, built independently as arrays.
        centre_u=((u[:,:-1]+u[:,1:])/2)**2;centre_v=((v[:-1,:]+v[1:,:])/2)**2;uv=np.zeros((ny+1,nx+1));uv[1:-1,1:-1]=(u[:-1,1:-1]+u[1:,1:-1])*(v[1:-1,:-1]+v[1:-1,1:])/4
        up=np.vstack([-u[0],u,-u[-1]]);vp=np.column_stack([-v[:,0],v,-v[:,-1]]);Fu=np.zeros_like(u);Fv=np.zeros_like(v)
        Fu[:,1:-1]=c['nu']*((u[:,2:]-2*u[:,1:-1]+u[:,:-2])/dx**2+(up[2:,1:-1]-2*u[:,1:-1]+up[:-2,1:-1])/dy**2)-(centre_u[:,1:]-centre_u[:,:-1])/dx-(uv[1:,1:-1]-uv[:-1,1:-1])/dy
        Fv[1:-1,:]=c['nu']*((vp[1:-1,2:]-2*v[1:-1,:]+vp[1:-1,:-2])/dx**2+(v[2:,:]-2*v[1:-1,:]+v[:-2,:])/dy**2)-(uv[1:-1,1:]-uv[1:-1,:-1])/dx-(centre_v[1:,:]-centre_v[:-1,:])/dy+c['gravityBeta']*(T[:-1]+T[1:])/2
        divergence=(Fu[:,1:]-Fu[:,:-1])/dx+(Fv[1:]-Fv[:-1])/dy;forcing=np.zeros(N+1);forcing[:N]=-divergence.ravel();pi=lu_solve(factor,forcing)[:N].reshape(ny,nx);Fu[:,1:-1]-=(pi[:,1:]-pi[:,:-1])/dx;Fv[1:-1]-=(pi[1:]-pi[:-1])/dy
        qx=k*D*dy/dx*(T[:,1:]-T[:,:-1])-rhoCp*D*dy*u[:,1:-1]*np.where(u[:,1:-1]>=0,T[:,:-1],T[:,1:]);qy=k*D*dx/dy*(T[1:]-T[:-1])-rhoCp*D*dx*v[1:-1]*np.where(v[1:-1]>=0,T[:-1],T[1:]);power=np.zeros_like(T);power[:,:-1]+=qx;power[:,1:]-=qx;power[:-1]+=qy;power[1:]-=qy
        interface=2*k*dy*D/dx*(w-T[:,0]);cold=-2*k*dy*D/dx*T[:,-1];power[:,0]+=interface;power[:,-1]+=cold;Qw=float(sum(interface));Qc=float(sum(cold));result[:N]=power.ravel()/C;result[N]=(c['wallInputW']-Qw)/c['wallCapacityJPerK'];result[u0:v0]=Fu.ravel();result[v0:heat]=Fv.ravel();result[heat:]=[c['wallInputW'],Qc,Qw,c['wallInputW']+Qc];return result
    initial=np.zeros(heat+4);initial[:N]=np.array(c['initial'])-c['coldTemperature'];initial[N]=c['wallInitialTemperature']-c['coldTemperature'];return rhs,initial,(u0,v0,heat)

def main():
    out=ROOT/'docs/dynamic/THERMAL_WALL_TIME_REFERENCE_20261107_v1.json';assert not out.exists(),'Protect saved result.'
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-thermal-wall-time-cases.mjs'],cwd=ROOT,text=True));runs=[]
    for entry in own['runs']:
        c=entry['config'];nx,ny,dx,dy,D,rhoCp,C,k=geometry(c);N=nx*ny
        if entry['name']=='thermal-only':
            A,initial=thermal(c);exact=expm(A*entry['timeS'])@initial;temperatures=exact[:N];wall=exact[N];heat=exact[N+1:N+5];u=np.zeros((nx+1)*ny);v=np.zeros(nx*(ny+1));reference_difference=0;original_reference_difference=0
        else:
            rhs,initial,(u0,v0,h0)=nonlinear(c);coarse=solve_ivp(rhs,[0,entry['timeS']],initial,method='DOP853',rtol=1e-11,atol=1e-13);a=solve_ivp(rhs,[0,entry['timeS']],initial,method='DOP853',rtol=1e-12,atol=1e-14);b=solve_ivp(rhs,[0,entry['timeS']],initial,method='DOP853',rtol=2.3e-14,atol=1e-15);assert coarse.success and a.success and b.success;exact=b.y[:,-1];original_reference_difference=float(max(abs(exact-coarse.y[:,-1])));reference_difference=float(max(abs(exact-a.y[:,-1])));assert reference_difference<1e-10;temperatures=exact[:N];wall=exact[N];u=exact[u0:v0];v=exact[v0:h0];heat=exact[h0:]
        fluid_energy=C*float(sum(temperatures-(np.array(c['initial'])-c['coldTemperature'])));wall_energy=c['wallCapacityJPerK']*(float(wall)-(c['wallInitialTemperature']-c['coldTemperature']));energy_residual=[fluid_energy-float(heat[1]+heat[2]),wall_energy-float(heat[0]-heat[2]),fluid_energy+wall_energy-float(heat[3])];assert max(abs(np.array(energy_residual)))<1e-11
        rows=[]
        for case in entry['cases']:
            s=case['snapshot'];temperature_error=max(float(max(abs(np.array(s['offsetTemperature'])-temperatures))),abs(s['wallOffsetTemperatureK']-float(wall)));velocity_error=max(float(max(abs(np.array(s['u'])-u))),float(max(abs(np.array(s['v'])-v))));heat_error=float(max(abs(np.array(s['cumulativeComponentJ'])-heat)))
            rows.append({'factor':case['factor'],'maximumDt':case['maximumDt'],'maximumFluidAndWallTemperatureErrorK':temperature_error,'maximumFaceVelocityErrorMPerS':velocity_error,'maximumAllHeatIntegralDifferenceJ':heat_error,'divergencePerS':s['divergence'],'ownEnergyErrorJ':s['energyErrorJ'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ']})
        time_orders=[math.log2(a['maximumFluidAndWallTemperatureErrorK']/b['maximumFluidAndWallTemperatureErrorK']) for a,b in zip(rows,rows[1:])];velocity_orders=[math.log2(a['maximumFaceVelocityErrorMPerS']/b['maximumFaceVelocityErrorMPerS']) for a,b in zip(rows,rows[1:])] if entry['name']=='buoyant' else []
        checks={'finestTemperatureBelow001K':rows[-1]['maximumFluidAndWallTemperatureErrorK']<.001,'finestAllHeatBelow0001J':rows[-1]['maximumAllHeatIntegralDifferenceJ']<1e-4,'finalThermalOrder18To22':1.8<time_orders[-1]<2.2,'allThreeOwnEnergyBudgets':all(all(abs(x)<=r['ownEnergyRoundoffBudgetJ'] for x in r['ownEnergyErrorJ'].values()) for r in rows),'allDivergenceBelow1eMinus9PerS':all(r['divergencePerS']<1e-9 for r in rows)}
        if velocity_orders:checks.update({'finestVelocityBelow1eMinus5MPerS':rows[-1]['maximumFaceVelocityErrorMPerS']<1e-5,'finalVelocityOrder18To22':1.8<velocity_orders[-1]<2.2})
        else:checks['thermalOnlyVelocityExactlyZero']=all(r['maximumFaceVelocityErrorMPerS']==0 for r in rows)
        result={'name':entry['name'],'config':c,'timeS':entry['timeS'],'independentReference':{'temperatureOffsetsK':temperatures.tolist(),'wallTemperatureOffsetK':float(wall),'u':u.tolist(),'v':v.tolist(),'cumulativeComponentJ':heat.tolist(),'storageChangeJ':{'fluid':fluid_energy,'wall':wall_energy,'total':fluid_energy+wall_energy},'threeEnergyResidualsJ':energy_residual,'DOP853ToleranceRefinementMaximumDifference':reference_difference,'initialDOPToleranceRefinementMaximumDifference':original_reference_difference,'initialDOPTolerancePairPassedSelfCheck':original_reference_difference<1e-10},'rows':rows,'temperatureTimeOrders':time_orders,'velocityTimeOrders':velocity_orders,'checks':checks,'allChecksPassed':all(checks.values())};runs.append(result);print(json.dumps({key:value for key,value in result.items() if key not in ('config','independentReference')}),flush=True)
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'9f2b539','sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'method':'Independent physical thermal graph and affine exponential; separately built conservative MAC centre/corner fluxes, half-cell no-slip viscosity, exact gauge-saddle LU pressure projection and DOP853 projected semidiscrete ODE. Product RHS, CG and RK2 are not reference solvers.','pressureComparison':'Product pressure is the mean of two RK2 stage multipliers; no claim or comparison to end-time instantaneous pressure.','runs':runs,'allChecksPassed':all(r['allChecksPassed'] for r in runs),'continuousSpatialAccuracyVerified':False,'WorkerVerified':False,'GUIVerified':False,'generalConjugateCFDApproved':False,'releaseApproved':False}
    payload=json.dumps(result,indent=2)+'\n'
    with out.open('x') as f:f.write(payload)
    print(json.dumps({'output':str(out),'allChecksPassed':result['allChecksPassed']}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed coupled-wall time comparison; no approval.')
if __name__=='__main__':main()
