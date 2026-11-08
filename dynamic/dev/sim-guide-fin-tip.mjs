// Guide steps for the straight fin screen (fin-convective-tip.html).
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-fin-tip';
export const GUIDE_STEPS=[
 {target:'#settings',title:'フィンの条件',text:'長さ・厚さ・奥行と、熱伝導率k・密度ρ・比熱cp・熱伝達率hを決めます。基部は指定温度に保たれ、側面は一様なhで周囲流体へ放熱します。'},
 {target:'#tip',title:'先端条件の切替',text:'先端は、先端面が同じ流体へ対流する場合と断熱の場合を切り替えて比べられます。先端温度と効率がどう変わるかを見てください。'},
 {target:'#apply',title:'初期状態から計算',text:'「初期状態から計算」で条件を確定し、時刻0から解き直します。'},
 {target:'#run',title:'再生と1コマ',text:'「再生」で軸方向の温度分布が時間とともに変わります。「1コマ進める／戻す」で途中経過を確認できます。実時間と同速ではありません。'},
 {target:'#field',title:'温度分布を見る',text:'軸方向の温度分布です。基部から先端への温度低下が、フィンの効き方を表します。'},
 {target:'#summary',title:'要約で確認',text:'フィン効率や有効度などの結果は要約で確認します。定常では解析解とも比較できます。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
