// Guide steps for the main dynamic lab (dynamic/index.html). The texts only
// walk the screen's own controls in order and point at the in-app manual for
// theory; every statement is taken from the manual text shipped in
// dynamic/index.html (使い方と理論) and the screen's labels. The engine is
// dynamic/sim-guide.mjs; lab.mjs calls initLabGuide() once.
import {attachSimGuide} from './sim-guide.mjs';

export const LAB_GUIDE_STEPS=[
 {target:'#presets',title:'実験を選ぶ',text:'「板を加熱」「板を冷却」「フィンの温度」「放射で冷却」の4実験と、円筒・球や流路など別画面へのリンクがあります。まずは「板を加熱」で、左面を60 ℃に保った板の温まり方を見てください。'},
 {target:'#mode',title:'操作モード',text:'体験モードでは温度と材料だけ、自由実験では形状・熱源・境界条件まで、専門解析では格子と時間刻みまで設定できます。これは表示範囲の選択で、「学び方」のチュートリアルや予想実験とは別の選択です。'},
 {target:'#material',title:'材料と物性',text:'材料を選ぶと熱伝導率k・密度ρ・比熱cpが入ります。値を手で変えた場合は、出典と温度範囲を自分で確認してください。自由・専門では温度依存のk(T)・cp(T)表を線形補間で使うこともできます。'},
 {target:'#apply',title:'適用して再計算',text:'条件を変えたら「条件を適用して再計算」を押します。初期状態から計算し直すので、それまでの履歴は初期化されます。'},
 {target:'#play',title:'再生と1コマ',text:'「再生」で計算が進み、「1コマ」は指定した物理時間だけ進めます。巻き戻しは保存した過去の状態を表示しているだけで、熱移動を逆向きに解いているわけではありません。'},
 {target:'#field-a',title:'温度場と測定点',text:'色が各セルの平均温度です。図をクリック・ドラッグするか、矢印キーで測定点の十字を動かせます。格子や等温線を重ねて、離散化の粗さや同じ温度の場所も確認できます。'},
 {target:'#graph',title:'温度履歴のグラフ',text:'測定点の温度の時間変化です。グラフの点や左右キーで時刻を選ぶと、その時刻の状態と数値を表示します。色だけで判断せず、数値や断面でも確認してください。'},
 {target:'#manual-toggle',title:'詳しくは説明書へ',text:'このガイドは操作の順序だけを案内します。支配方程式・モデルの仮定と限界・モデル別の詳しい説明は「使い方と理論」の説明書にあります。ガイド文中の用語を押すと、用語集のその項目が開きます。'},
];

export function initLabGuide(doc=document){
  const mount=doc.querySelector('.modebar');
  if(!mount)return null;
  return attachSimGuide({id:'lab',steps:LAB_GUIDE_STEPS,mount,termsUrl:'../data/glossary.json',termUrlBase:'../index.html'});
}
