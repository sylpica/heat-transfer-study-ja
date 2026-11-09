"""Read-only independent arithmetic for reported §8.3 findings."""
import math,json
from pathlib import Path
r,p=6.78e7,.710
a=.387*r**(1/6);d=1+(.492/p)**(9/16)
r2,p2=1.555e8,.713
nu=.678*r2**.25*(p2/(.952+p2))**.25
local=.508*r2**.25*(p2/(.952+p2))**.25
result={'8.13b':{'Ra':r,'Pr':p,'baseline':(.825+(a/d)**(8/27))**2,'source':(.825+a/d**(8/27))**2},'mean_definition':{'local_Nu_power':.25,'wrong_mean_to_endpoint':1/1.25,'correct_mean_to_endpoint':1/.25,'note':'Nux=C*x^(1/4); mean NuL=integral(Nux/x)dx=4*NuL(local). The actual Nux~x^(3/4) follows h~x^(-1/4), so the physically relevant factor is 4/3, below.'},'natural_convection_mean':{'Nux_power':.75,'wrong_factor':1/1.75,'correct_factor':1/.75},'velocity':{'eta_max':1/3,'u_max_over_uc':(1/3)*(1-1/3)**2},'example8.3':{'Ra':r2,'Pr':p2,'Nu_mean':nu,'h_mean_W_m2K':nu*.02623/.4,'q_mean_W_m2':nu*.02623/.4*26,'h_local_at_L_W_m2K':local*.02623/.4,'q_local_at_L_W_m2':local*.02623/.4*26,'delta_over_L_wrong_Ra_times_Pr':3.936*((.952+p2)/p2**2)**.25*(r2*p2)**(-.25),'delta_over_L_correct_Ra_divided_Pr':3.936*((.952+p2)/p2**2)**.25*(r2/p2)**(-.25),'delta_over_L_original_printed':.0431,'difference_cause':'not established'}}
# Keep only the physically applicable x^(3/4) local Nu example.
result.pop('mean_definition')
Path(__file__).with_name('83-numerics.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
