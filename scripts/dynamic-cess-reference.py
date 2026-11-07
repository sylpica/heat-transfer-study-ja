"""Independent coordinate-ODE/quad Cess reference and optional DNS comparison.
Default is entirely offline. Explicit --fetch-dns downloads only three small
published mean profiles into ignored work/; raw files are not redistributed.
"""
import argparse,datetime,hashlib,json,pathlib,platform,re,subprocess,urllib.request
import mpmath as mp
import numpy as np
import scipy
from scipy.integrate import quad,solve_ivp
from scipy.interpolate import PchipInterpolator

root=pathlib.Path(__file__).resolve().parents[1]
cases=[('MKM180',180,178.12,'f54c86e30a869798f140aa004c1e167cd13a6280e988d2794d72ca2be8b5fc82'),('MKM395',395,392.24,'211c6b8149cc7ef5cd20323716b47a45dd98cca55486a9554acfd4a7975d737a'),('MKM590',590,587.19,'878bc951794516b6136912f8f098cd6f2f96c4bbe7f21a8cea657ffb270d419d')]
mp.mp.dps=60
def effective_viscosity(d,ret):
    q=.426*ret/3*d*(2-d)*(1+2*(1-d)**2)*(-np.expm1(-d*ret/25.4))
    return .5*(1+np.sqrt(1+q*q))
def solve_profile(ret,max_step):
    solution=solve_ivp(lambda y,z:[ret*(1-y)/effective_viscosity(y,ret),z[0]],[0,1],[0,0],method='DOP853',rtol=2.3e-14,atol=1e-14,max_step=max_step,dense_output=True)
    assert solution.success
    return solution
def high_precision_eddy(d,ret):
    d=mp.mpf(str(d));ret=mp.mpf(str(ret));r=1-d
    q=mp.mpf('.426')*ret/3*(1-r*r)*(1+2*r*r)*(1-mp.exp(-d*ret/mp.mpf('25.4')))
    return float((mp.sqrt(1+q*q)-1)/2)
def common_metadata():
    path=pathlib.Path(__file__)
    return {'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'generatorTreeDirty':bool(subprocess.check_output(['git','status','--porcelain','--',str(path.relative_to(root))],cwd=root,text=True).strip()),'generatorSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'environment':{'python':platform.python_version(),'scipy':scipy.__version__,'numpy':np.__version__,'mpmath':mp.__version__},'constants':{'kappa':.426,'dampingAPlus':25.4},'independentMethod':'DOP853 integrates [U, integral U] along wall distance; SciPy quad independently checks center and bulk. 60-digit square-root formula checks the eddy ratio. No JS quadrature or external solver code reused.','releaseApproved':False}
def dns_path(cache,nominal):return cache/f'chan{nominal}.means'
def dns_url(nominal):return f'https://turbulence.oden.utexas.edu/data/MKM/chan{nominal}/profiles/chan{nominal}.means'

parser=argparse.ArgumentParser();parser.add_argument('--dns',action='store_true');parser.add_argument('--fetch-dns',action='store_true');parser.add_argument('--cache-dir',type=pathlib.Path,default=root/'work/turbulence-reference');args=parser.parse_args()
if args.fetch_dns:
    args.cache_dir.mkdir(parents=True,exist_ok=True)
    for _,nominal,_,expected in cases:
        path=dns_path(args.cache_dir,nominal)
        if path.exists():data=path.read_bytes()
        else:
            with urllib.request.urlopen(dns_url(nominal),timeout=30) as response:data=response.read(100001)
            if len(data)>100000 or hashlib.sha256(data).hexdigest()!=expected:raise RuntimeError('DNS input changed; review before saving or benchmarking')
            path.write_bytes(data)
        if hashlib.sha256(data).hexdigest()!=expected:raise RuntimeError('Existing cache differs; preserve it and review the source version')
    if not args.dns:
        print(json.dumps({'rawFilesInIgnoredCache':True,'rawFilesRedistributed':False,'files':[{'nominalReTau':c[1],'url':dns_url(c[1]),'sha256':c[3]} for c in cases]},indent=2));raise SystemExit

out=common_metadata();out['cases']=[]
for case_id,nominal,ret,expected_hash in cases:
    solved=solve_profile(ret,.002);coarse=solve_profile(ret,.004);probe=np.linspace(0,1,201)
    consistency=float(np.max(np.abs(solved.sol(probe)-coarse.sol(probe))));assert consistency<1e-10
    center=float(solved.y[0,-1]);bulk=float(solved.y[1,-1]);f=lambda y:ret*(1-y)/effective_viscosity(y,ret)
    quad_center=quad(f,0,1,epsabs=1e-12,epsrel=1e-12)[0];quad_bulk=quad(lambda y:(1-y)*f(y),0,1,epsabs=1e-12,epsrel=1e-12)[0]
    assert abs(center-quad_center)<2e-11 and abs(bulk-quad_bulk)<2e-11
    row={'id':case_id,'nominalReTau':nominal,'reTau':ret,'centerVelocityPlus':center,'bulkVelocityPlus':bulk,'odeStepRefinementMaxDifference':consistency,'centerODEvsQuadDifference':center-quad_center,'bulkODEvsQuadDifference':bulk-quad_bulk}
    if args.dns:
        path=dns_path(args.cache_dir,nominal);raw=path.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=expected_hash:raise RuntimeError('Run --fetch-dns into the ignored cache; do not substitute another data version')
        header=raw.decode();assert float(re.search(r'# Re_tau = ([\d.]+)',header)[1])==ret
        table=np.loadtxt(path);y=table[:,0];dns=table[:,2]
        assert np.isfinite(table).all() and y[0]==0 and y[-1]==1 and np.all(np.diff(y)>0) and np.all(dns>=0)
        assert np.max(abs(table[:,1]-y*ret))<.05
        curve=PchipInterpolator(y,dns);predicted=solved.sol(y)[0];squared=0;norm=0;linear_squared=0
        # Integrate each DNS interval separately; avoid quadrature warnings at
        # interpolation knots and disclose interpolation as a separate choice.
        for a,b in zip(y[:-1],y[1:]):
            squared+=quad(lambda s:float(solved.sol(s)[0]-curve(s))**2,a,b,epsabs=1e-13,epsrel=1e-11)[0]
            norm+=quad(lambda s:float(curve(s))**2,a,b,epsabs=1e-12,epsrel=1e-11)[0]
            linear_squared+=quad(lambda s:float(solved.sol(s)[0]-np.interp(s,y,dns))**2,a,b,epsabs=1e-13,epsrel=1e-11)[0]
        dns_bulk=float(curve.integrate(0,1));nonzero=dns>0
        row.update({'sourceURL':dns_url(nominal),'sourceSHA256':expected_hash,'sourceBytes':len(raw),'records':len(y),'sourceFileCreated':re.search(r'# Date File Created: (.+)',header)[1].strip(),'dnsCenterVelocityPlus':float(dns[-1]),'dnsBulkVelocityPlusFromPCHIP':dns_bulk,'centerRelativeError':(center-dns[-1])/dns[-1],'bulkRelativeError':(bulk-dns_bulk)/dns_bulk,'profileRMSErrorUPlus':float(np.sqrt(squared)),'profileRelativeRMS':float(np.sqrt(squared/norm)),'profileRMSErrorWithLinearDNSInterpolation':float(np.sqrt(linear_squared)),'maxErrorAtPublishedPointsUPlus':float(np.max(abs(predicted-dns))),'maxRelativeErrorAtNonzeroPublishedPoints':float(np.max(abs(predicted[nonzero]-dns[nonzero])/dns[nonzero])),'rawDNSRedistributed':False})
    else:
        row['eddyRatioSamples']=[{'distanceOverHalfGap':d,'eddyRatio':high_precision_eddy(d,ret)} for d in [0,1e-12,1e-8,1e-4,.01,.1,.5,1]]
        row['samples']=[]
        for n in [16,32,64,128]:
            edges=np.linspace(0,1,n//2+1);integrals=solved.sol(edges)[1];bottom=np.diff(integrals)/(2/n);full=np.r_[bottom,bottom[::-1]]
            row['samples'].append({'rows':n,'rowVelocityPlus':full.tolist()})
    out['cases'].append(row)
if args.dns:
    out['scope']='Model discrepancy against all published half-channel Umean samples, including the low-Re case. Integrals use physical wall distance, not a row-count-weighted RMS. PCHIP and linear interpolation differences are retained. No coefficient fitting. Raw DNS tables, third-party code and figures are not redistributed.'
    out['quantitativeUseApproved']=False
else:out['scope']='Own mathematical model outputs only, normalized by u_tau and half-gap. Not DNS data and not an empirical accuracy approval.'
print(json.dumps(out,indent=2))
