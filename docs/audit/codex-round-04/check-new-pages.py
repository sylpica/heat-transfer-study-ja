"""Independent scalar algebra for two new source-page checks; audit artifacts only."""
from pathlib import Path
import math,json,hashlib
out=Path(__file__).parent/'evidence'
ra,pr=1e8,.7
d=1+(.492/pr)**(9/16)
old=(.73*ra/d)**(16/45)
printed=.73*ra**(1/5)/d**(16/45)
from_balance=.67**(4/5)*ra**(1/5)/d**(16/45)
a,b=.68,1e4
for _ in range(100):
 mid=(a+b)/2;res=mid**.25*(mid-.68)-.67*ra**.25/d**(4/9)
 if res>0:b=mid
 else:a=mid
root=(a+b)/2
reg=[{'pdf_page':n,'book_page':n-14,'dpi':130,'image_sha256':hashlib.sha256(Path(f'/tmp/codex-round04-source/page-{n}.png').read_bytes()).hexdigest()}for n in [452,685]]
evidence={'scope':'Only PDF452 and685 newly imaged; no original page images distributed','source_pdf_sha256':hashlib.sha256(Path('book/AHTTv600.pdf').read_bytes()).hexdigest(),'pages':reg,'eq8.43b':{'Ra_star':ra,'Pr':pr,'baseline_wrong':old,'source_printed':printed,'ratio_wrong_to_source':old/printed,'derived_ignoring_0_68':from_balance,'derived_coefficient':.67**(4/5),'implicit8.43a_bisection':root,'error_definition':'wrong/source ratio; independent asymptotic coefficient0.67^(4/5) versus rounded original0.73 kept distinct'},'eq11.77':{'rhoD_over_delta':1,'m_s':.4,'m_e':.05,'Bm':(.4-.05)/(1-.4),'log_flux':math.log(1+(.4-.05)/(1-.4)),'independent_stefan_integral':math.log((1-.05)/(1-.4)),'difference':math.log(1+(.4-.05)/(1-.4))-math.log((1-.05)/(1-.4))}}
(out/'new-pages.json').write_text(json.dumps(evidence,indent=2)+'\n');print(json.dumps(evidence,indent=2))
