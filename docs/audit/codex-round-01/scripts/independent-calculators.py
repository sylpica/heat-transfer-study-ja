"""Independent Python algebra and a bisected Sturm-Liouville series.
Same physical models as JS; not independent physical validation of correlations.
Uses actual public UI default inputs, without importing implementation code.
Relative budget 1e-11; half-space temperature 1e-5 K (erfc approximation).
"""
import json,math,pathlib
p=pathlib.Path(__file__).resolve().parents[1]/'evidence'
cases=json.loads((p/'calculator-baseline.json').read_text());checked=[]
sigma=5.670374419e-8;g=9.80665
for c in cases:
 m=c['mode'];v=c['input'];actual=c['result'];ref={};budget=1e-11
 if m=='conduction':ref={'watts':v['k']*v['area']*(v['hot']-v['cold'])/v['thickness']}
 if m=='convection':ref={'watts':v['h']*v['area']*(v['surface']-v['fluid'])}
 if m=='radiation':ref={'watts':v['emissivity']*sigma*v['area']*((v['surface']+273.15)**4-(v['surrounding']+273.15)**4)}
 if m=='resistance':ref={'watts':v['area']*(v['hot']-v['cold'])/(1/v['hHot']+v['L1']/v['k1']+v['L2']/v['k2']+1/v['hCold'])}
 if m=='transient':ref={'temperature':v['ambient']+(v['initial']-v['ambient'])*math.exp(-v['h']*v['area']*v['time']/(v['density']*v['volume']*v['cp']))}
 if m=='fin':
  mm=math.sqrt(2*v['h']/(v['k']*v['radius']));ref={'watts':v['k']*math.pi*v['radius']**2*mm*(v['base']-v['ambient'])*math.tanh(mm*v['length'])}
 if m=='exchanger':
  ch=v['hotMass']*v['hotCp'];cc=v['coldMass']*v['coldCp'];cr=min(ch,cc)/max(ch,cc);ntu=v['u']*v['area']/min(ch,cc)
  eff=ntu/(1+ntu) if cr==1 else (1-math.exp(-ntu*(1-cr)))/(1-cr*math.exp(-ntu*(1-cr)))
  ref={'watts':eff*min(ch,cc)*(v['hotIn']-v['coldIn'])}
 if m=='slab':
  L=v['thickness']/2;Bi=v['h']*L/v['k'];Fo=v['k']/(v['density']*v['cp'])*v['time']/L**2;total=0
  for n in range(40):
   lo=n*math.pi+1e-12;hi=n*math.pi+math.pi/2-1e-12
   for _ in range(70):
    x=(lo+hi)/2
    if x*math.tan(x)>Bi:hi=x
    else:lo=x
   z=(lo+hi)/2;A=4*math.sin(z)/(2*z+math.sin(2*z));total+=A*math.exp(-z*z*Fo)
  ref={'centerTemperature':v['ambient']+(v['initial']-v['ambient'])*total}
 if m=='enclosure':
  R=(1-v['epsilon1'])/(v['area1']*v['epsilon1'])+1/v['area1']+(1-v['epsilon2'])/(v['area2']*v['epsilon2'])
  ref={'watts':sigma*((v['temp1']+273.15)**4-(v['temp2']+273.15)**4)/R}
 if m=='cylinder':
  ro=v['radius']+v['thickness'];R=math.log(ro/v['radius'])/(2*math.pi*v['length']*v['k'])+1/(v['h']*2*math.pi*ro*v['length']);ref={'watts':(v['base']-v['ambient'])/R}
 if m=='halfspace':
  eta=v['depth']/(2*math.sqrt(v['k']/(v['density']*v['cp'])*v['time']));ref={'temperature':v['initial']+(v['surface']-v['initial'])*math.erfc(eta)};budget=1e-5
 if m in ['flatplate','pipe','crossflow','natural','laminarpipe']:
  pr=v['viscosity']*v['cp']/v['conductivity'];length=v.get('diameter',v.get('length',v.get('height')));re=v['density']*v.get('velocity',0)*length/v['viscosity']
  if m=='flatplate':ref={'nuAverage':.664*math.sqrt(re)*pr**(1/3)}
  if m=='pipe':
   f=(.79*math.log(re)-1.64)**-2;ref={'nu':(f/8)*(re-1000)*pr/(1+12.7*math.sqrt(f/8)*(pr**(2/3)-1))}
  if m=='crossflow':ref={'nusselt':.3+.62*math.sqrt(re)*pr**(1/3)/(1+(.4/pr)**(2/3))**.25*(1+(re/282000)**(5/8))**(4/5)}
  if m=='natural':
   Ra=g*v['beta']*abs(v['surface']-v['ambient'])*v['height']**3/(v['viscosity']/v['density']*v['conductivity']/(v['density']*v['cp']));ref={'nusselt':(.825+.387*Ra**(1/6)/(1+(.492/pr)**(9/16))**(8/27))**2}
  if m=='laminarpipe':
   gz=re*pr*v['diameter']/v['length'];ref={'nu':3.66+.0668*gz/(1+.04*gz**(2/3))}
 if m=='condensation':ref={'h':2*math.sqrt(2)/3*(g*v['rhoLiquid']*(v['rhoLiquid']-v['rhoVapor'])*v['latent']*v['conductivity']**3/(v['viscosity']*v['height']*(v['saturation']-v['wall'])))**.25}
 if m=='diffusion':ref={'fluxA':v['diffusivity']*v['pressure']/(8.31446261815324*v['temperature']*v['thickness'])*math.log((1-v['yA2'])/(1-v['yA1']))}
 if m=='nucleate':
  pr=v['cp']*v['viscosity']/v['conductivity'];ref={'flux':v['viscosity']*v['latent']*math.sqrt(g*(v['rhoLiquid']-v['rhoVapor'])/v['surfaceTension'])*(v['cp']*v['superheat']/(v['csf']*v['latent']*pr**v['n']))**3}
 if m=='chf':ref={'criticalFlux':.131*v['latent']*math.sqrt(v['rhoVapor'])*(g*(v['rhoLiquid']-v['rhoVapor'])*v['surfaceTension'])**.25}
 assert ref,m
 for key,value in ref.items():
  error=abs(actual[key]-value); normalized=error if m=='halfspace' else error/max(abs(value),1e-300)
  checked.append({'mode':m,'quantity':key,'js':actual[key],'python':value,'error':normalized,'error_definition':'absolute K' if m=='halfspace' else 'relative to Python reference','budget':budget,'pass':normalized<=budget})
(p/'independent-calculators.json').write_text(json.dumps(checked,indent=2)+'\n')
print(json.dumps({'checks':len(checked),'pass':sum(x['pass'] for x in checked),'failures':[x for x in checked if not x['pass']]},indent=2))
