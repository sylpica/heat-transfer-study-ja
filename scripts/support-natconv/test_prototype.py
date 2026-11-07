#!/usr/bin/env python3
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
from pathlib import Path
import importlib.util,unittest,json,math
import numpy as np
from scipy.linalg import solve
from scipy.integrate import solve_ivp
ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
proto=load('support_cavity',Path(__file__).with_name('prototype.py'))
ref=load('independent_central',ROOT/'scripts/dynamic-independent-thermal-wall-central-time.py')
class Validation(unittest.TestCase):
    def test_dct_matches_independent_dense_saddle_projection(self):
        n=8;m=proto.Cavity(n,10000);rng=np.random.default_rng(417);u=rng.normal(size=m.u.shape);v=rng.normal(size=m.v.shape);u[:,[0,-1]]=0;v[[0,-1]]=0
        L=np.zeros((n*n,n*n))
        for j in range(n):
            for i in range(n):
                a=j*n+i
                for di,dj in ((-1,0),(1,0),(0,-1),(0,1)):
                    if 0<=i+di<n and 0<=j+dj<n:L[a,a]+=n*n;L[a,(j+dj)*n+i+di]-=n*n
        div=n*(np.diff(u,axis=1)+np.diff(v,axis=0));K=np.block([[L,np.ones((n*n,1))],[np.ones((1,n*n)),np.zeros((1,1))]])
        p=solve(K,np.r_[-div.ravel(),0])[:-1].reshape(n,n);ue=u.copy();ve=v.copy();ue[:,1:-1]-=n*np.diff(p,axis=1);ve[1:-1]-=n*np.diff(p,axis=0)
        ud,vd,pd=m.project(u.copy(),v.copy());self.assertLess(max(abs(ud-ue).max(),abs(vd-ve).max(),abs(pd-p).max()),1e-12);self.assertLess(abs(n*(np.diff(ud,axis=1)+np.diff(vd,axis=0))).max(),1e-12)
    def test_independent_physical_ode_time_convergence_and_all_heat(self):
        n=8;T=np.array([[.3+.1*math.sin(math.pi*(i+.5)/n)*math.sin(math.pi*(j+.5)/n)+.05*(i+.5)/n for i in range(n)] for j in range(n)])
        c={'nx':n,'ny':n,'width':1,'height':1,'depth':1,'rho':1,'cp':1,'nu':.71,'alpha':1,'gravityBeta':7100,'wallCapacityJPerK':1,'wallInputW':0,'wallInitialTemperature':300.5,'coldTemperature':299.5,'wallMode':'isothermal-thermostat','initial':(T.ravel()+299.5).tolist()}
        rhs,initial,(u0,v0,h)=ref.nonlinear(c);T=initial[:n*n].reshape(n,n);end=.001
        a=solve_ivp(rhs,[0,end],initial,method='DOP853',rtol=1e-11,atol=1e-13);b=solve_ivp(rhs,[0,end],initial,method='DOP853',rtol=2.3e-14,atol=1e-15);self.assertTrue(a.success and b.success);self.assertLess(abs(a.y[:,-1]-b.y[:,-1]).max(),1e-10);exact=b.y[:,-1];rows=[]
        for dt in [.0002,.0001,.00005,.000025,.0000125]:
            m=proto.Cavity(n,10000);m.T=T.copy()
            while m.time<end:m.step(min(dt,end-m.time))
            te=float(abs(m.T.ravel()-exact[:n*n]).max());ve=float(max(abs(m.u.ravel()-exact[u0:v0]).max(),abs(m.v.ravel()-exact[v0:h]).max()));he=float(abs(m.heats-exact[h:h+2]).max());balance=float((m.T-T).mean()-m.heats.sum());rows.append({'dt':dt,'temperatureError':te,'velocityError':ve,'heatError':he,'balance':balance})
            self.assertLess(abs(balance),1e-12);self.assertTrue((m.u[:,[0,-1]]==0).all());self.assertTrue((m.v[[0,-1]]==0).all())
        for key in ('temperatureError','velocityError'):
            order=math.log2(rows[-2][key]/rows[-1][key]);self.assertTrue(1.8<order<2.2,(key,order))
        self.assertLess(rows[-1]['temperatureError'],.001);self.assertLess(rows[-1]['velocityError'],1e-5);self.assertLess(rows[-1]['heatError'],1e-4)
        print(json.dumps({'independentTimeRows':rows,'selfRefinement':float(abs(a.y[:,-1]-b.y[:,-1]).max())}),flush=True)
    def test_rhs_matches_independent_physical_lu_across_all_three_rayleigh_numbers(self):
        n=8;edge=np.linspace(0,1,n+1);x,y=np.meshgrid(edge,edge);psi=.01*np.sin(math.pi*x)**2*np.sin(math.pi*y)**2
        for ra in (10000,100000,1000000):
            m=proto.Cavity(n,ra);m.u=n*np.diff(psi,axis=0);m.v=-n*np.diff(psi,axis=1);m.u[:,[0,-1]]=0;m.v[[0,-1]]=0
            T=np.array([[.3+.1*math.sin(math.pi*(i+.5)/n)*math.sin(math.pi*(j+.5)/n) for i in range(n)] for j in range(n)])
            c={'nx':n,'ny':n,'width':1,'height':1,'depth':1,'rho':1,'cp':1,'nu':.71,'alpha':1,'gravityBeta':.71*ra,'wallCapacityJPerK':1,'wallInputW':0,'wallInitialTemperature':300.5,'coldTemperature':299.5,'wallMode':'isothermal-thermostat','initial':(T.ravel()+299.5).tolist()}
            rhs,state,(u0,v0,h)=ref.nonlinear(c);state[u0:v0]=m.u.ravel();state[v0:h]=m.v.ravel();m.T=state[:n*n].reshape(n,n);expected=rhs(0,state);r,a,b,_,q=m.rhs(m.T,m.u,m.v);a,b,_=m.project(a,b)
            differences=[float(abs(r.ravel()-expected[:n*n]).max()),float(abs(a.ravel()-expected[u0:v0]).max()),float(abs(b.ravel()-expected[v0:h]).max()),float(abs(q-expected[h:h+2]).max())]
            self.assertLess(max(differences)/(1+float(abs(expected).max())),1e-12)
            print(json.dumps({'independentRhsRa':ra,'maximumAbsoluteDifferencesThermalUVHeat':differences}),flush=True)
    def test_saved_full_fields_match_true_discrete_diagnostics_and_definition_specific_benchmarks(self):
        report=json.loads((ROOT/'docs/dynamic/support-natconv/RESULTS.json').read_text());self.assertTrue(report['allSelectedFineColdStartChecksPassed'])
        for row in report['fineColdStartCases']:
            j=json.loads((ROOT/'docs/dynamic/support-natconv'/row['file']).read_text());saved=np.load(ROOT/'docs/dynamic/support-natconv'/j['fullState']);n=row['grid'];T=saved['temperature'];u=saved['u'];v=saved['v'];heats=saved['heats']
            self.assertEqual(T.shape,(n,n));self.assertTrue(np.isfinite(T).all() and np.isfinite(u).all() and np.isfinite(v).all());self.assertTrue((u[:,[0,-1]]==0).all() and (v[[0,-1]]==0).all());self.assertLess(abs(n*(np.diff(u,axis=1)+np.diff(v,axis=0))).max(),1e-9)
            self.assertLess(abs(float(2*(1-T[:,0]).sum())-row['last']['Nu0']),1e-12);self.assertLess(abs(float((T-.5).mean()-heats.sum())),1e-10);self.assertTrue(all(row['checks'].values()))
        cold=[r for r in report['coldStartSeries'] if r['ra']==1000000 and r['grid'] in (64,128)];self.assertEqual(len(cold),2);self.assertTrue(all('Peclet' in r['failure'] and not r['steady'] for r in cold));self.assertFalse(report['warmCoarseRa1e6']['coldStart']);self.assertFalse(report['releaseApproved'])
    def test_rejected_stage_retains_physical_state(self):
        m=proto.Cavity(64,1000000);saved=np.load(ROOT/'docs/dynamic/support-natconv/RA1000000_N64_DT1_stagev2.npz');m.T=saved['temperature'].copy();m.u=saved['u'].copy();m.v=saved['v'].copy();m.heats=saved['heats'].copy();m.comp=saved['compensation'].copy();m.time=float(saved['time']);m.steps=int(saved['steps']);before=(m.T.copy(),m.u.copy(),m.v.copy(),m.heats.copy(),m.time,m.steps)
        with self.assertRaisesRegex(ValueError,'Peclet'):m.step(m.dt())
        for actual,expected in zip((m.T,m.u,m.v,m.heats),before[:4]):np.testing.assert_array_equal(actual,expected)
        self.assertEqual(m.time,before[4]);self.assertEqual(m.steps,before[5])
if __name__=='__main__':unittest.main(verbosity=2)
