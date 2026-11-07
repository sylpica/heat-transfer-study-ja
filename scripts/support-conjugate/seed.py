import json
from pathlib import Path
import numpy as np
from scipy.interpolate import RegularGridInterpolator
from models import FVM,P1

def initialize_from_own_coarse(m,path,method):
    j=json.loads(Path(path).read_text());assert j['method']==method and j['steady'] and j['failure'] is None
    c=j['config'];assert c['n']<m.n and all(c[k]==getattr(m,k) for k in ('ra','K','C','source'))
    old=(FVM if method=='fv' else P1)(**c);d=np.load(Path(path).with_name(j['stateFile']));old.T=d['temperature'];old.u=d['u'];old.v=d['v'];o=old.n;n=m.n
    points=lambda ys,xs:np.stack(np.meshgrid(ys,xs,indexing='ij'),axis=-1)
    if method=='fv':
        xx=np.r_[-old.d,(np.arange(old.nx)+.5)/o-old.d,1];yy=np.r_[0,(np.arange(o)+.5)/o,1]
        vv=np.column_stack((np.ones(o),old.T,np.zeros(o)));vv=np.vstack((vv[0],vv,vv[-1]));m.T=RegularGridInterpolator((yy,xx),vv)(points((np.arange(n)+.5)/n,(np.arange(m.nx)+.5)/n-m.d))
    else:m.T=RegularGridInterpolator((np.linspace(0,1,o+1),np.arange(old.nx+1)/o-old.d),old.T.reshape(o+1,old.nx+1))(points(np.linspace(0,1,n+1),np.arange(m.nx+1)/n-m.d)).ravel()
    u=RegularGridInterpolator((np.r_[0,(np.arange(o)+.5)/o,1],np.linspace(0,1,o+1)),np.vstack((np.zeros(o+1),old.u,np.zeros(o+1))))(points((np.arange(n)+.5)/n,np.linspace(0,1,n+1)))
    v=RegularGridInterpolator((np.linspace(0,1,o+1),np.r_[0,(np.arange(o)+.5)/o,1]),np.column_stack((np.zeros(o+1),old.v,np.zeros(o+1))))(points(np.linspace(0,1,n+1),(np.arange(n)+.5)/n))
    m.u,m.v,m.p=m.project(u,v);m.initial=m.T.copy();m.inspect(m.T,m.u,m.v)
