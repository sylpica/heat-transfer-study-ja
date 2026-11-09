"""Read-only independent checks on the unchanged ccc6cc3 product tree."""
from pathlib import Path
import json,math,hashlib
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).parent
pages=[185,318,319,322,326,447,458,459,513]
r=1e5;pr=.7
correlations={}
for number,c,a in [('6.63',.339,.0468),('6.73',.464,.0205)]:
 numerator=c*math.sqrt(r)*pr**(1/3);den=1+(a/pr)**(2/3)
 correlations[number]={'Re_x':r,'Pr':pr,'baseline':(numerator/den)**.25,'source':numerator/den**.25,'Re_power_baseline':.125,'Re_power_source':.5}
result={'baseline':'ccc6cc3b8e8955f0a04baf28ec655bb4e5b386c9','source_pdf_sha256':hashlib.sha256((ROOT/'book/AHTTv600.pdf').read_bytes()).hexdigest(),'pages':[{'pdf_page':p,'book_page':p-14,'dpi':125,'png_sha256':hashlib.sha256(Path(f'/tmp/codex-round04-supplement/page-{p}.png').read_bytes()).hexdigest()}for p in pages], 'images_distributed':False,
 '8.51':{'definitions':'C=(rho_f-rho_g)*g/(rho_f*nu), eta=y/delta','source':'u=C*delta^2*(eta-eta^2/2) = C*delta^2/2*(2eta-eta^2)','source_second_derivative_over_minus_C':1,'baseline_second_derivative_over_minus_C':.5,'source_integral_u_over_Cdelta3':1/3,'baseline_integral_u_over_Cdelta3':1/6,'consequence':'Baseline8.51 contradicts both8.50 momentum equation and8.53 mass flow; downstream8.53-8.59 must not be halved to fit the bad upstream expression.'},
 '6.51':{'source_left_factor':'u_infinity*(Tw-T_infinity)','baseline_left_factor':'1/(u_infinity*(Tw-T_infinity))','source_LHS_units':'K m/s','RHS_units':'K m/s','baseline_LHS_units':'s/(K m)'},
 'phi':{'source':'0.9638/sqrt(Pr*phi*(1-phi^2/14))','baseline':'0.9638*(Pr*phi*(1-phi^2/14))','test_Pr':1,'test_phi':1,'source_RHS':.9638/math.sqrt(1-1/14),'baseline_RHS':.9638*(1-1/14),'baseline_squared_nonzero_solution_at_Pr1':14*(1-1/.9638),'independent_relation':'phi^3*(1-phi^2/14)=0.9638^2/Pr; coefficient is rounded'},
 'table9.3':{'rows_reviewed':12,'row2_source':'1.14*(lambda_d1^2*N_j/A_heater)','row2_baseline':'1.14*(lambda_d1^2*N_j/A_heater)^(1/2)','example_dimensionless_group':4,'source_value':1.14*4,'baseline_value':1.14*math.sqrt(4),'other_rows':'No other mathematical discrepancy established. Row3 original includes sqrt(Rprime), preserved.'},
 'same_pattern_correlations':correlations,
 'mean_marks_confirmed':{'4.49':{'pdf_page':185,'quantity':'hbar in sqrt(k A hbar P)'},'8.32':{'pdf_page':447,'quantity':'surface-average Nubar_D'},'8.33':{'pdf_page':447,'quantity':'surface-average Nubar_D'}},
 'limits':'Only listed original pages and chains checked. Not every formula of sections6.5/8.5/9.3, nor every old defect or every mean-mark occurrence.'}
(OUT/'source-verdicts.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'phi':result['phi'],'correlations':correlations,'pages':pages},indent=2))
