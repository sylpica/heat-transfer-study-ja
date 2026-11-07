#!/usr/bin/env python3
"""Actual fixed-property air case: independent projected physical central ODE."""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import argparse,hashlib,importlib.util,json,math,subprocess
import numpy as np
from scipy.linalg import expm
from scipy.integrate import solve_ivp
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'scripts/dynamic-independent-thermal-wall-time.py'
CENTRAL=ROOT/'scripts/dynamic-independent-thermal-wall-central-time.py'
spec=importlib.util.spec_from_file_location('independent_wall_central',CENTRAL)
central=importlib.util.module_from_spec(spec);spec.loader.exec_module(central)
base=central.base
nonlinear=central.nonlinear

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--tag',default='v1');args=parser.parse_args();assert args.tag.isalnum()
    out=ROOT/f'docs/dynamic/THERMAL_WALL_AIR_REFERENCE_20261107_{args.tag}.json';assert not out.exists(),'Protect saved result.'
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-thermal-wall-air-cases.mjs'],cwd=ROOT,text=True));runs=[]
    for entry in own['runs']:
        c=entry['config'];nx,ny,dx,dy,D,rhoCp,C,k=base.geometry(c);N=nx*ny
        if c['gravityBeta']==0:
            A,initial=base.thermal(c);exact=expm(A*entry['timeS'])@initial
            temperatures=exact[:N];wall=exact[N];heat=exact[N+1:N+5];u=np.zeros((nx+1)*ny);v=np.zeros(nx*(ny+1));reference_difference=0
        else:
            rhs,initial,(u0,v0,h0)=nonlinear(c)
            a=solve_ivp(rhs,[0,entry['timeS']],initial,method='DOP853',rtol=1e-12,atol=1e-14)
            b=solve_ivp(rhs,[0,entry['timeS']],initial,method='DOP853',rtol=2.3e-14,atol=1e-15)
            assert a.success and b.success;exact=b.y[:,-1];reference_difference=float(max(abs(exact-a.y[:,-1])))
            temperatures=exact[:N];wall=exact[N];u=exact[u0:v0];v=exact[v0:h0];heat=exact[h0:]
        fluid_energy=C*float(sum(temperatures-(np.array(c['initial'])-c['coldTemperature'])))
        wall_energy=c['wallCapacityJPerK']*(float(wall)-(c['wallInitialTemperature']-c['coldTemperature']))
        residuals=[fluid_energy-float(heat[1]+heat[2]),wall_energy-float(heat[0]-heat[2]),fluid_energy+wall_energy-float(heat[3])]
        rows=[]
        for case in entry['cases']:
            s=case['snapshot'];te=max(float(max(abs(np.array(s['offsetTemperature'])-temperatures))),abs(s['wallOffsetTemperatureK']-float(wall)))
            ve=max(float(max(abs(np.array(s['u'])-u))),float(max(abs(np.array(s['v'])-v))));he=float(max(abs(np.array(s['cumulativeComponentJ'])-heat)))
            rows.append({'factor':case['factor'],'maximumDt':case['maximumDt'],'maximumFluidAndWallTemperatureErrorK':te,'maximumFaceVelocityErrorMPerS':ve,'maximumAllHeatIntegralDifferenceJ':he,'divergencePerS':s['divergence'],'maximumCellPeclet':s['maximumCellPeclet'],'ownEnergyErrorJ':s['energyErrorJ'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ'],'wallStorageChangeJ':s['storageChangeJ']['wall'],'controllerEqualsInterfaceExactly':s['cumulativeComponentJ'][0]==s['cumulativeComponentJ'][2]})
        orders=[math.log2(a['maximumFluidAndWallTemperatureErrorK']/b['maximumFluidAndWallTemperatureErrorK']) for a,b in zip(rows,rows[1:])]
        vorders=[math.log2(a['maximumFaceVelocityErrorMPerS']/b['maximumFaceVelocityErrorMPerS']) for a,b in zip(rows,rows[1:])] if c['gravityBeta'] else []
        selected=next(r for r in rows if r['factor']==.125)
        checks={'selectedGuiDtTemperatureBelow001K':selected['maximumFluidAndWallTemperatureErrorK']<.001,'selectedGuiDtVelocityBelow1eMinus6MPerS':selected['maximumFaceVelocityErrorMPerS']<1e-6,'selectedGuiDtAllHeatBelow1eMinus7J':selected['maximumAllHeatIntegralDifferenceJ']<1e-7,'referenceSelfRefinementBelow1eMinus10':reference_difference<1e-10,'independentThreeEnergyResidualsBelow1eMinus11J':float(max(abs(np.array(residuals))))<1e-11,'finestTemperatureBelow001K':rows[-1]['maximumFluidAndWallTemperatureErrorK']<.001,'finestVelocityBelow1eMinus6MPerS':rows[-1]['maximumFaceVelocityErrorMPerS']<1e-6,'finestAllHeatBelow1eMinus7J':rows[-1]['maximumAllHeatIntegralDifferenceJ']<1e-7,'finalThermalOrder18To22':1.8<orders[-1]<2.2,'allThreeOwnEnergyBudgets':all(all(abs(x)<=r['ownEnergyRoundoffBudgetJ'] for x in r['ownEnergyErrorJ'].values()) for r in rows),'allDivergenceBelow1eMinus9PerS':all(r['divergencePerS']<1e-9 for r in rows),'actualCentralCellPecletAtMost2':all(r['maximumCellPeclet']<=2 for r in rows)}
        if vorders:checks['finalVelocityOrder18To22']=1.8<vorders[-1]<2.2
        else:checks['thermalOnlyVelocityExactlyZero']=all(r['maximumFaceVelocityErrorMPerS']==0 for r in rows)
        if c['wallMode']=='isothermal-thermostat':checks['fixedWallAndIdenticalActualControlHeat']=all(r['wallStorageChangeJ']==0 and r['controllerEqualsInterfaceExactly'] for r in rows)
        result={'name':entry['name'],'config':c,'timeS':entry['timeS'],'selectedGuiDtFactor':.125,'initialEffectiveRa':c['gravityBeta']*(c['wallInitialTemperature']-c['coldTemperature'])*c['height']**3/(c['nu']*c['alpha']),'independentReference':{'temperatureOffsetsK':temperatures.tolist(),'wallTemperatureOffsetK':float(wall),'u':u.tolist(),'v':v.tolist(),'cumulativeComponentJ':heat.tolist(),'storageChangeJ':{'fluid':fluid_energy,'wall':wall_energy,'total':fluid_energy+wall_energy},'threeEnergyResidualsJ':residuals,'DOP853ToleranceRefinementMaximumDifference':reference_difference},'rows':rows,'temperatureTimeOrders':orders,'velocityTimeOrders':vorders,'checks':checks,'allChecksPassed':all(checks.values())};runs.append(result)
        print(json.dumps({key:value for key,value in result.items() if key not in ('config','independentReference')}),flush=True)
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'42cd72a','sourceFilesSHA256':own['sourceFilesSHA256'],'independentReferenceSourceFilesSHA256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (BASE,CENTRAL,Path(__file__))},'method':'Independent physical thermal graph/exponential and projected conservative MAC ODE with direct saddle LU and DOP853. Conservative internal-face central correction; thermostat zero wall rate and actual interface control heat. No product assembly, RHS, CG or RK2 in reference.','runs':runs,'allChecksPassed':all(r['allChecksPassed'] for r in runs),'generalConjugateCFDApproved':False,'releaseApproved':False}
    with out.open('x') as f:f.write(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'output':str(out),'allChecksPassed':result['allChecksPassed']}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed central comparison; no approval.')
if __name__=='__main__':main()
