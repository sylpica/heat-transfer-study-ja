"""Offline independent verification; no application imports or public model.

NumPy conservative fluxes + symbolic continuous forcing + Neumann DCT;
dense graph LU on the smallest projection case; psi/omega momentum integrals.
Only our numerical fields/results are archived. Python >=3.12, numpy/scipy/sympy.
"""
from pathlib import Path
import hashlib, json
import numpy as np
import sympy as sp
from scipy.fft import dctn, idctn
from scipy.integrate import cumulative_trapezoid
from scipy.interpolate import RegularGridInterpolator

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/dynamic/support-forced'


def divergence(u, v, h):
    return (u[:, 1:] - u[:, :-1] + v[1:, :] - v[:-1, :]) / h


def neumann(rhs, h):
    """Invert positive -Laplacian, mean zero; cell-centered cosine basis."""
    ny, nx = rhs.shape
    eigen = 4 / h**2 * (np.sin(np.pi*np.arange(ny)/(2*ny))[:, None]**2
                        + np.sin(np.pi*np.arange(nx)/(2*nx))[None, :]**2)
    eigen[0, 0] = 1
    r = dctn(rhs-rhs.mean(), type=2, norm='ortho') / eigen
    r[0, 0] = 0
    return idctn(r, type=2, norm='ortho')


def projection_checks(raw, fresh):
    rows = []
    for c, f in zip(raw['projection'], fresh['cases'], strict=True):
        n, rho, dt = c['n'], c['rho'], c['dt']; h = 1/n
        u = np.array(c['tentativeU'], dtype=float).reshape(n, n+1)
        v = np.array(c['tentativeV'], dtype=float).reshape(n+1, n)
        rhs = -rho/dt*divergence(u, v, h)
        p = neumann(rhs, h)
        uc, vc = u.copy(), v.copy()
        uc[:, 1:-1] -= dt/rho*np.diff(p, axis=1)/h
        vc[1:-1, :] -= dt/rho*np.diff(p, axis=0)/h
        pp = np.array([x['pressure'] for x in f['outputs']])
        row = dict(n=n, rho=rho, kind=c['kind'],
            dctVersusExactPressureMaxPa=float(abs(p.ravel()-c['expectedP']).max()),
            pcgVersusDctMaxPa=float(abs(pp-p.ravel()).max()),
            correctedVelocityMaximumDifference=float(max(
                max(abs(np.array(x['u'])-uc.ravel()).max(), abs(np.array(x['v'])-vc.ravel()).max()) for x in f['outputs'])),
            initialConstantGaugeDifferencePa=float(max(abs(pp[0]-pp[1]).max(), abs(pp[2]-pp[3]).max())),
            pressureMeanPa=float(abs(pp.mean(axis=1)).max()),
            iterations=[x['iterations'] for x in f['outputs']],
            relativeResidual=max(x['residual']/x['rhsNorm'] for x in f['outputs']))
        if n == 8:
            # Assemble adjacency graph independently of the cosine eigenvalues.
            L = np.zeros((n*n, n*n))
            for j in range(n):
                for i in range(n):
                    a = j*n+i
                    for di, dj in [(1, 0), (0, 1)]:
                        if i+di < n and j+dj < n:
                            b = (j+dj)*n+i+di
                            L[a,a] += 1/h**2; L[b,b] += 1/h**2
                            L[a,b] -= 1/h**2; L[b,a] -= 1/h**2
            graph = np.zeros(n*n)
            graph[1:] = np.linalg.solve(L[1:,1:], rhs.ravel()[1:])
            graph -= graph.mean()
            row['denseGraphLuVersusDctMaxPa'] = float(abs(graph-p.ravel()).max())
        rows.append(row)
    return rows


def continuous_functions():
    x,y,t,A = sp.symbols('x y t A', real=True)
    psi = A*sp.sin(sp.pi*x)**2*sp.sin(sp.pi*y)**2*sp.exp(-t)
    u,v = sp.diff(psi,y), -sp.diff(psi,x)
    p = sp.Rational(1,10)*sp.cos(2*sp.pi*x)*sp.cos(2*sp.pi*y)*sp.exp(-t)
    forces = [sp.diff(q,t)+u*sp.diff(q,x)+v*sp.diff(q,y)+sp.diff(p,d)-sp.diff(q,x,2)-sp.diff(q,y,2)
              for q,d in [(u,x),(v,y)]]
    return [sp.lambdify((x,y,t,A), q, 'numpy', cse=True) for q in [u,v,p,*forces]]


def momentum(u, v, h):
    """Conservative MAC face balances, zero tangential lid here, nu=1."""
    fu, fv = np.zeros_like(u), np.zeros_like(v)
    ug = np.pad(u, ((1,1),(0,0)))
    ug[0] = -u[0]; ug[-1] = -u[-1]
    a = u[:,1:-1]; e = u[:,2:]; w = u[:,:-2]
    north = ug[2:,1:-1]; south = ug[:-2,1:-1]
    vn = .5*(v[1:,:-1]+v[1:,1:]); vs = .5*(v[:-1,:-1]+v[:-1,1:])
    adv = ((a+e)**2-(a+w)**2)/(4*h) + ((a+north)*vn-(a+south)*vs)/(2*h)
    fu[:,1:-1] = (e+w+north+south-4*a)/h**2-adv
    vg = np.pad(v, ((0,0),(1,1))); vg[:,0] = -v[:,0]; vg[:,-1] = -v[:,-1]
    a=v[1:-1,:]; e=vg[1:-1,2:]; w=vg[1:-1,:-2]; north=v[2:,:]; south=v[:-2,:]
    ue=.5*(u[:-1,1:]+u[1:,1:]); uw=.5*(u[:-1,:-1]+u[1:,:-1])
    adv=((a+e)*ue-(a+w)*uw)/(2*h)+((a+north)**2-(a+south)**2)/(4*h)
    fv[1:-1,:]=(e+w+north+south-4*a)/h**2-adv
    return fu,fv


def manufacture_checks(raw):
    ufun,vfun,pfun,fx,fy = continuous_functions()
    rows=[]
    for c in raw['manufactured']:
        n,A,dt=c['n'],c['velocityAmplitude'],c['dt']; h=1/n
        xc=(np.arange(n)+.5)*h; xf=np.arange(n+1)*h
        xu,yu=np.meshgrid(xf,xc); xv,yv=np.meshgrid(xc,xf); xp,yp=np.meshgrid(xc,xc)
        old,last=c['previous'],c['last']; t0,t=old['time'],last['time']
        def rebuild(s, at, exact_velocity=False, include_old_divergence=False):
            if exact_velocity:
                u=ufun(xu,yu,at,A); v=vfun(xv,yv,at,A)
                u[:,[0,-1]]=0;v[[0,-1],:]=0
            else:
                u=np.array(s['u']).reshape(n,n+1);v=np.array(s['v']).reshape(n+1,n)
            fu,fv=momentum(u,v,h)
            fu[:,1:-1]+=fx(xu[:,1:-1],yu[:,1:-1],at,A)
            fv[1:-1,:]+=fy(xv[1:-1,:],yv[1:-1,:],at,A)
            if include_old_divergence:
                return neumann(-divergence(u+dt*fu,v+dt*fv,h)/dt,h)
            return neumann(-divergence(fu,fv,h),h)
        p=np.array(last['pressure']).reshape(n,n);p-=p.mean()
        ref=pfun(xp,yp,t,A); lag=pfun(xp,yp,t0,A)
        r0=rebuild(old,t0,include_old_divergence=True)
        rend=rebuild(last,t); rex=rebuild(last,t,exact_velocity=True)
        norm=np.sqrt(np.mean(ref**2))
        err=lambda a,b:float(np.sqrt(np.mean((a-b)**2)))
        row=dict(n=n,velocityAmplitude=A,steps=c['steps'],dt=dt,endTime=t,
            independentOldTimeVersusPcgMaxPa=float(abs(r0-p).max()),
            returnedPressureRelativeRmsEnd=err(p,ref)/norm,
            returnedPressureRelativeRmsLag=err(p,lag)/np.sqrt(np.mean(lag**2)),
            endpointRebuiltRelativeRms=err(rend,ref)/norm,
            exactVelocityDiscreteRelativeRms=err(rex,ref)/norm,
            accumulatedVelocityPressureDifferenceRmsPa=err(rend,rex),
            endpointVersusReturnedRmsPa=err(rend,p),
            relativePoissonResidual=last['pressureResidual']/max(last['pressureRhsNorm'],1e-300))
        if A==0:
            factor=(np.pi/n)/np.sin(np.pi/n)
            row.update(zOverSinZ=factor,analyticDiscreteMaxDifferencePa=float(abs(p-factor*lag).max()))
        rows.append(row)
    return rows


def lid_checks():
    coords=np.linspace(.1,.9,17)
    refs=[];hashes={}
    for n in [64,128]:
        path=ROOT/f'docs/dynamic/GHIA_VORTICITY_N{n}_20261106_v1.json'
        hashes[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
        f=json.loads(path.read_text())['field'];h=1/n
        u,v,w=(np.array(f[k]) for k in ['u','v','vorticity'])
        uy,ux=np.gradient(u,h,h,edge_order=2);vy,vx=np.gradient(v,h,h,edge_order=2)
        wy,wx=np.gradient(w,h,h,edge_order=2)
        px=-(u*ux+v*uy)-.01*wy;py=-(u*vx+v*vy)+.01*wx
        grid=np.arange(n+1)*h
        curves=[]
        for g in [px[n//2,:],py[:,n//2]]:
            integral=cumulative_trapezoid(g,grid,initial=0);integral-=integral[n//2]
            curves.append(np.interp(coords,grid,integral))
        refs.append(dict(intervals=n,horizontal=curves[0].tolist(),vertical=curves[1].tolist()))
    result=[]
    for n in [16,32,64]:
        path=ROOT/f'docs/dynamic/CFD_FINE_LID_N{n}_20261106_v1.json'
        hashes[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
        data=json.loads(path.read_text());p=np.array(data['finalState']['pressure']).reshape(n,n)
        grid=(np.arange(n)+.5)/n;f=RegularGridInterpolator((grid,grid),p)
        center=float(f([[.5,.5]])[0])
        hh=f(np.column_stack([np.full(17,.5),coords]))-center
        vv=f(np.column_stack([coords,np.full(17,.5)]))-center
        diff=np.concatenate([hh-np.array(refs[-1]['horizontal']),vv-np.array(refs[-1]['vertical'])])
        result.append(dict(n=n,pressureGauge='p(0.5,0.5)=0, rho=U_lid=L=1',
            horizontal=hh.tolist(),vertical=vv.tolist(),
            differenceVersusPsiOmega128Rms=float(np.sqrt(np.mean(diff**2))),
            differenceVersusPsiOmega128Max=float(abs(diff).max()),flowFieldRecomputed=False))
    diff=np.concatenate([np.array(refs[0][k])-refs[1][k] for k in ['horizontal','vertical']])
    return dict(sampleCoordinates=coords.tolist(),referenceMethod='steady momentum line integration, trapezoid; rho=U_lid=L=1',
        independentSolverReferences=refs,macComparisons=result,
        psiOmega64Versus128Rms=float(np.sqrt(np.mean(diff**2))),
        psiOmega64Versus128Max=float(abs(diff).max()),
        sourceSHA256=hashes,externalExactPressureBenchmark=False)


def main():
    inputs=['PRESSURE_CASES.json','PRESSURE_PROJECTION_FRESH.json']
    raw,fresh=[json.loads((OUT/n).read_text()) for n in inputs]
    result=dict(projection=projection_checks(raw,fresh),manufactured=manufacture_checks(raw),lid=lid_checks(),
        inputsSHA256={n:hashlib.sha256((OUT/n).read_bytes()).hexdigest() for n in inputs},
        generatorSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),releaseApproved=False)
    with (OUT/'INDEPENDENT_PRESSURE.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({**result,'lid':{k:v for k,v in result['lid'].items() if k not in ['sourceSHA256','independentSolverReferences','macComparisons']}},indent=2))

if __name__=='__main__':main()
