#!/usr/bin/env python3
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
import unittest,json,math
import numpy as np
from models import FVM,P1

def exact(x,K,S,d=.25):
    Q=(1+S*d*d/(2*K))/(1+d/K)
    return np.where(x<0,1+(S*d-Q)*(x+d)/K-S*(x+d)**2/(2*K),Q*(1-x)),Q
class Limits(unittest.TestCase):
    def test_piecewise_linear_steady_conduction_and_solid_dominated_limit(self):
        for cls in (FVM,P1):
            for K in (.01,.5,10):
                m=cls(n=16,ra=0,K=K,C=2)
                x=(np.arange(m.nx)+.5)/m.n-m.d if cls is FVM else m.xy[:,0]
                T,Q=exact(x,K,0);m.T=np.broadcast_to(T,m.T.shape).copy();m.initial=m.T.copy();r,a,b,q=m.rhs(m.T,m.u,m.v)
                self.assertLess(abs(r).max(),1e-9);self.assertLess(max(abs(q[0]-Q),abs(q[1]+Q),abs(q[3]-Q)),1e-12);self.assertEqual(q[2],0);self.assertTrue((a==0).all() and (b==0).all());m.step(m.dt());self.assertLess(m.metrics()['energy']['relativeMaximumError'],1e-9)
                print(json.dumps({'linearLimit':cls.__name__,'K':K,'interfaceHeat':float(q[3]),'exact':Q,'maxThermalRate':float(abs(r).max())}),flush=True)
    def test_nonuniform_source_energy_and_atomic_rejection(self):
        for cls in (FVM,P1):
            m=cls(n=16,ra=1000,K=.5,C=2,source=1)
            if cls is FVM:
                X,Y=np.meshgrid((np.arange(m.nx)+.5)/m.n-m.d,(np.arange(m.n)+.5)/m.n);m.T=.3+.05*np.sin(np.pi*X)*np.sin(np.pi*Y)
            else:
                X,Y=m.xy.T;m.T=.3+.05*np.sin(np.pi*X)*np.sin(np.pi*Y);m.T[m.back]=1;m.T[m.cold]=0
            m.initial=m.T.copy()
            for _ in range(40):m.step(m.dt()/4)
            e=m.metrics()['energy'];self.assertLess(e['relativeMaximumError'],1e-9);self.assertGreater(abs(e['solidStorage']),0);self.assertGreater(abs(e['fluidStorage']),0);self.assertGreater(m.heats[2],0);before=[v.copy() for v in (m.T,m.u,m.v,m.heats)];time=m.time;steps=m.steps
            with self.assertRaises(ValueError):m.step(m.dt()*2)
            for a,b in zip((m.T,m.u,m.v,m.heats),before):np.testing.assert_array_equal(a,b)
            self.assertEqual(m.time,time);self.assertEqual(m.steps,steps)
            print(json.dumps({'nonuniformSourceEnergy':cls.__name__,**e}),flush=True)
    def test_p1_conservative_advection_preserves_constant_and_total_heat(self):
        m=P1(n=16,ra=1000);grid=np.linspace(0,1,m.n+1);x,y=np.meshgrid(grid,grid);psi=.01*np.sin(np.pi*x)**2*np.sin(np.pi*y)**2;u=m.n*np.diff(psi,axis=0)
        one=m.convective_load(np.ones_like(m.T),u);load=m.convective_load(np.sin(m.xy[:,0])+np.cos(m.xy[:,1]),u)
        self.assertLess(abs(one).max(),1e-15);self.assertLess(abs(load.sum()),1e-15)
if __name__=='__main__':unittest.main(verbosity=2)
