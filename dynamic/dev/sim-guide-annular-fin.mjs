// Guide steps for the annular fin screen (annular-fin.html).
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-annular-fin';
export const GUIDE_STEPS=[
 {target:'#settings',title:'フィンの条件',text:'内半径・外半径・厚さと、熱伝導率k・密度ρ・比熱cp・熱伝達率hを決めます。基部（内半径の面）は指定温度に保たれ、両側面は一様なhで周囲流体へ放熱します。'},
 {target:'#tip',title:'先端条件の切替',text:'先端は、先端面そのものが対流する場合と、修正半径（Schmidt）で断熱先端に置き換える近似とを切り替えて比べられます。'},
 {target:'#apply',title:'初期状態から計算',text:'「初期状態から計算」で条件を確定し、時刻0から解き直します。'},
 {target:'#run',title:'再生と1コマ',text:'「再生」で半径方向の温度分布が時間とともに変わります。「1コマ進める／戻す」で途中経過を確認できます。実時間と同速ではありません。'},
 {target:'#field',title:'温度分布を見る',text:'半径方向の温度分布です。基部から先端へ向かう温度低下の形が、放熱と伝導の釣り合いを表します。'},
 {target:'#summary',title:'要約で確認',text:'フィン効率や基部からの熱流などの結果は要約で確認します。先端条件を切り替えたときの差と合わせて見てください。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
