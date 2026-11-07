from pathlib import Path
from dataclasses import asdict,replace
from datetime import datetime,timezone
import sys,time,json,hashlib,subprocess
import numpy as np
from scipy.sparse.linalg import spsolve
from prototype import Conditions,Matrix,build,solve,measure

ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/dynamic/support-heatsink'

def learning_reference(c,n):
    Ac=c.thickness*c.length;P=2*(c.thickness+c.length);ds=c.height/n
    M=Matrix(n+1);m2=c.h_reference*P/(c.solid_k*Ac);m=np.sqrt(m2)
    M.add(0,0,c.h_reference*(c.width-c.fins*c.thickness)*c.length)
    # Parallel identical fins reduced to one node chain, all branches counted.
    M.edge(0,1,c.fins*2*c.solid_k*Ac/ds)
    M.edge(np.arange(1,n),np.arange(2,n+1),c.fins*c.solid_k*Ac/ds)
    M.add(np.arange(1,n+1),np.arange(1,n+1),c.fins*c.h_reference*P*ds)
    b=np.zeros(n+1);b[0]=c.power;theta=spsolve(M.matrix(),b)
    eta=np.tanh(m*c.height)/(m*c.height)
    analytic=c.ambient+c.power/(c.h_reference*((c.width-c.fins*c.thickness)*c.length+c.fins*eta*P*c.height))
    config=dict(baseWidth=c.width,baseDepth=c.length,baseThickness=c.base,finLength=c.height,finThickness=c.thickness,finCount=c.fins,finCells=n,k=c.solid_k,rho=2700,cp=900,h=c.h_reference,ambient=c.ambient,initialBase=float(c.ambient+theta[0]),initialFin=(c.ambient+theta[1:]).tolist(),power=c.power,contactResistance=0)
    return dict(finCells=n,config=config,discreteBaseTemperatureK=float(c.ambient+theta[0]),
        continuumBaseTemperatureK=analytic,continuumFinEfficiency=eta,
        maximumDiscreteResidualW=float(abs(M.matrix()@theta-b).max()),
        continuumFinAdmittanceWPerK=float(c.solid_k*Ac*m*np.tanh(m*c.height)))

def main():
    target=OUT/'REFERENCE.json'
    if target.exists():raise FileExistsError('Protect earlier results; use a new version name')
    c=Conditions();cases=[]
    for r,epsilon in [(1,.8),(2,.8),(4,.8),(4,0.)]:
        t=time.monotonic();system=build(replace(c,emissivity=epsilon),r);theta,history=solve(system);row=measure(system,theta,history)
        row.update(emissivity=epsilon,elapsedSeconds=time.monotonic()-t)
        fname=f'FIELD_r{r}_epsilon{str(epsilon).replace(".","p")}.npz';path=OUT/fname
        with path.open('xb') as f:
            np.savez_compressed(f,theta=theta,base=system['base'],fins=system['fins'],fluid=system['fluid'],xEdges=system['xe'],yEdges=system['ye'],patchArea=system['patch'])
        row.update(field=fname,fieldSHA256=hashlib.sha256(path.read_bytes()).hexdigest());cases.append(row)
        print(json.dumps({k:row[k] for k in ['refinement','emissivity','unknowns','sourceAverageTemperatureK','maximumBaseCellTemperatureK','radiationOutwardW','relativeEnergyResidual','hydraulicMobilityRelativeError','elapsedSeconds']}),flush=True)
    zero=build(replace(c,power=0),1);zt,zh=solve(zero);zeroResult=measure(zero,zt,zh)
    data=dict(generatedAtUTC=datetime.now(timezone.utc).isoformat(),sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),config=asdict(c),widthM=c.width,hReferenceWPerM2K=c.h_reference,cases=cases,zeroPower=dict(maximumTemperatureExcessK=float(abs(zt).max()),relativeEnergyResidual=zeroResult['relativeEnergyResidual']),learning=[learning_reference(c,n) for n in [64,128,256]],releaseApproved=False,generalCFD=False)
    data['sourceSHA256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__),Path(__file__).with_name('prototype.py')]}
    with target.open('x') as f:json.dump(data,f,indent=2);f.write('\n')
    print(json.dumps({'saved':str(target),'learning':[(x['finCells'],x['discreteBaseTemperatureK']) for x in data['learning']]}),flush=True)

if __name__=='__main__':main()
