// Guide steps for the 3D transient conduction brick screen (transient-brick-3d.html).
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-brick-3d';
export const GUIDE_STEPS=[
 {target:'#preset',title:'プリセット',text:'検証済みのプリセットから始めるか、手入力で寸法・格子・物性を決めます。セル中心有限体積で、一定物性・一様初期温度の3次元非定常熱伝導を解きます。'},
 {target:'#faces',title:'6面の境界条件',text:'面ごとに境界条件を設定します。放射・温度依存物性・体積発熱・複数材料は解きません。'},
 {target:'#apply',title:'初期状態から計算',text:'「初期状態から計算」で条件を確定し、時刻0から解き直します。'},
 {target:'#run',title:'再生と1コマ',text:'「再生」で温度が時間とともに変わります。1コマは安定刻み以下に自動で割って進めます。実時間と同速ではありません。'},
 {target:'#field',title:'断面で見る',text:'表示は3次元そのものの描画ではなく、選んだ方向の1層分の断面（セル平均温度の色）です。断面の向きと位置を変えて内部の広がりを確認し、測定セルは断面図のクリックでも選べます。'},
 {target:'#diagnostics',title:'診断で確認',text:'診断には安定刻みとエネルギー収支が出ます。格子を変えたときの結果の変化と合わせて確認してください。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
