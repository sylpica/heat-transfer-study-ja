// Guide steps for the 3D box radiation screen (box-radiation-3d.html).
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-box-radiation';
export const GUIDE_STEPS=[
 {target:'#preset',title:'検証済みプリセット',text:'灰色箱2×1×3（参照ケース）、等温黒体立方体（交換は厳密にゼロ）、扁平箱1×1×0.001（解像度の自動引上げを確認するケース）から選べます。手入力もできます。'},
 {target:'#settings',title:'寸法と6面の条件',text:'直方体の寸法と、6面それぞれの条件（等温の灰色拡散面）を決めます。面内の伝導・対流・参加媒体は解きません。'},
 {target:'#resolution',title:'形態係数の解像度',text:'形態係数の積分解像度です。「自動」では受入精度に達するまで引き上げます。扁平な箱では低い解像度が拒否されることがあります。'},
 {target:'#apply',title:'初期状態から計算',text:'「初期状態から計算」で条件を確定し、時刻0から解き直します。'},
 {target:'#run',title:'再生と1コマ',text:'「再生」で各面の温度が放射交換で変わっていきます。1コマは安定刻み以下へ自動で細分して進めます。実時間と同速ではありません。'},
 {target:'#face-values',title:'6面の収支表',text:'全6面の面積・温度・射度・照射・正味放射です。正味放射は外向きが正です。射度には自分の放出と他の面からの反射が含まれます。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
