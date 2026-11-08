// Guide steps for the vertical heated wall screen (natural-convection-wall.html).
// This screen is a steady similarity/correlation calculator, so the guide
// walks preset -> conditions -> compute -> profiles -> summary.
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-natconv-wall';
export const GUIDE_STEPS=[
 {target:'#preset',title:'例題プリセット',text:'例題8.1・例題8.3（等温壁）と一様熱流束の参照ケースを呼び出せます。手入力に切り替えて値を変えることもできます。'},
 {target:'#settings',title:'壁と流体の条件',text:'等温壁は教科書§8.3の相似解（Ostrach）、一様熱流束壁は式(8.44b)で計算します。物性は膜温度で評価します。'},
 {target:'#apply',title:'計算する',text:'「計算する」を押すと結果が出ます。検証済み範囲（Pr=0.1〜100、層流Ra_L≲10⁹）の外では値を出さず、理由を表示します。'},
 {target:'#graph-velocity',title:'速度分布と温度分布',text:'上端（x＝L）断面の速度分布u(y)と温度分布T(y)です。yは壁からの距離で、表示範囲は境界層の外縁までです。'},
 {target:'#summary',title:'結果の要約',text:'ヌセルト数などの結果を要約で確認します。相関式の値と相似解の値を読み分け、警告が出ていないかも見てください。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
