"""Read-only, bounded round-5 checks; run from repository root. No full suite."""
import json
from fractions import Fraction as F
from pathlib import Path

def integral_polynomial(c):
    return sum((v/F(i+1) for i,v in enumerate(c)),F(0))

def main():
    result={}
    theta=lambda x: F(1)-F(3,2)*x+F(1,2)*x**3
    result['thermal_profile_BCs']=[str(theta(F(0))),str(theta(F(1))),str(-F(3,2)+F(3,2)),str(F(0))]
    assert result['thermal_profile_BCs']==['1','0','0','0']
    result['5.23_initial_value_b3_c2']=2-1
    result['5.23_initial_derivative_b3_c2']=-2+2
    result['momentum_integral']=str(integral_polynomial([0,0,1,-4,6,-4,1]))
    result['energy_integral']=str(integral_polynomial([0,1,-4,6,-4,1]))
    assert result['momentum_integral']=='1/105'
    assert result['energy_integral']=='1/30'
    result['squire_C1']=[]
    for pr in [.01,.7,1,7,100]:
        c=pr/(3*(20/21+pr))
        a=84*(1/3-c)/c**2; b=80/(c*pr)
        assert abs(a/b-1)<1e-12
        result['squire_C1'].append({'Pr':pr,'C1':c,'momentum_energy_ratio':a/b})
    pr=.7; ra=1e8; d=1+(.492/pr)**(9/16)
    result['8.43b_Nu']=.73*ra**.2/d**(16/45)
    result['8.43b_implicit_Nu']=None
    lo,hi=0.,1000.
    for _ in range(100):
        mid=(lo+hi)/2
        if mid**.25*(mid-.68)<.67*ra**.25/d**(4/9):lo=mid
        else:hi=mid
    result['8.43b_implicit_Nu']=(lo+hi)/2
    # Example 8.5: derive by substituting Ra=Ra*/Nu, not by assuming Nu=RHS.
    q,D,k,nu,alpha,beta,pr=661.,.17,.02623,1.578e-5,2.213e-5,1/300,.713
    rastar=9.8*beta*q*D**4/(k*nu*alpha)
    rhs=.82*rastar**.2*pr**.034
    result['8.5_example']={'Ra_star':rastar,'source_RHS':rhs,'correct_Nu':rhs**(5/6),'incorrect_Nu':rhs,'correct_deltaT':q*D/(k*rhs**(5/6)),'incorrect_deltaT':q*D/(k*rhs)}
    result['6.63_Nu']=.339*1e5**.5*.7**(1/3)/(1+(.0468/.7)**(2/3))**.25
    result['6.73_Nu']=.464*1e5**.5*.7**(1/3)/(1+(.0205/.7)**(2/3))**.25
    import math
    result['8.60_correct_limit']=4**(-.25)
    result['9.11_derived_coefficient']=math.pi/16*3**(-.25)
    sigma=5.67e-8; a=1+.7/.3; b=-.14 # use radiosity matrix directly below
    # B1=.7(.2B2+.8B3)+.3 e1; B2=.5(.2B1+.8B3)+.5 e2.
    rhs1=.7*.8*sigma*250**4+.3*sigma*400**4
    rhs2=.5*.8*sigma*250**4+.5*sigma*300**4
    B1=(rhs1+.14*rhs2)/(1-.14*.1);B2=.1*B1+rhs2
    result['example_10_9_a']={'sigma':sigma,'B1':B1,'B2':B2,'Q12':.2*(B1-B2),'Q12_modern_sigma':.2*(B1-B2)*(5.670374419e-8/sigma)}
    denominator=.7/.3+1/(1/(1/.8+1/.8)+.2)+.5/.5
    result['example_10_9_b']={'denominator':denominator,'Q':sigma*(400**4-300**4)/denominator}
    H=W=1.;S=H*H+W*W
    result['table_10_3_perpendicular_square']=(W*math.atan(1/W)-math.sqrt(S)*math.atan(1/math.sqrt(S))+H*math.atan(1/H)+.25*math.log((1+W*W)*(1+H*H)/(1+S)*(W*W*(1+S)/((1+W*W)*S))**(W*W)*(H*H*(1+S)/((1+H*H)*S))**(H*H)))/(math.pi*W)
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
