"""Plot this project's computed benchmark samples; no source figure is reproduced."""
import json
from pathlib import Path
import subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
root=Path(__file__).resolve().parents[1]
r=json.loads((root/'docs/dynamic/CFD_BENCHMARKS_20261104.json').read_text())
candidates=subprocess.check_output(['fc-list',':lang=ja','-f','%{file}\n'],text=True).splitlines()
font_path=next((p for p in candidates if p.endswith('NotoSansCJK-Regular.ttc')),next((p for p in candidates if p.endswith(('.ttf','.ttc','.otf'))),None))
font=FontProperties(fname=font_path) if font_path else FontProperties()
fig,axes=plt.subplots(1,2,figsize=(11,4.5),layout='constrained')
ref=[(-.15662,.2813),(-.20581,.5),(-.13641,.6172),(.23151,.8516)]
axes[0].scatter([p[0] for p in ref],[p[1] for p in ref],c='black',marker='x',s=65,label='Ghia: public transcription (4 samples)')
for row,color,marker in zip(r['lid'],['#d16a1d','#007b87'],['o','s']):
 axes[0].scatter([p['u'] for p in row['samples']],[p['y'] for p in row['samples']],edgecolors=color,facecolors='none',marker=marker,s=50,label=f"This solver: {row['n']}×{row['n']}")
axes[0].set(xlabel='u / U_lid',ylabel='y / L',title='Lid-driven cavity: Re = 100')
axes[0].legend(fontsize=8,loc='best');axes[0].grid(alpha=.2)
rows=r['natural'];axes[1].plot([1/x['n']**2 for x in rows],[x['nusselt'] for x in rows],'o-',color='#007b87',label='Computed (central scalar flux)')
axes[1].axhline(1.117,color='black',linestyle='--',label='Public OpenLB reference: 1.117')
for row in rows:axes[1].annotate(f"{row['n']}×{row['n']}",(1/row['n']**2,row['nusselt']),xytext=(-45,-18) if row['n']==16 else (5,8),textcoords='offset points')
axes[1].set(xlabel='1 / N² (two grids only)',ylabel='Mean Nu',title='Natural convection: Ra = 1000, Pr = 0.71');axes[1].grid(alpha=.2);axes[1].legend(fontsize=8)
fig.suptitle('開発用の数値検算：一般CFDの完成・公開承認ではありません',fontproperties=font,fontsize=13)
fig.savefig(root/'docs/dynamic/CFD_COMPARISON_20261104.png',dpi=160)
