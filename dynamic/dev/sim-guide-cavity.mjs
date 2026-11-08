// Guide steps for the natural-convection cavity screen (cavity.html).
// Texts follow the screen's own introduction and notes; the engine is
// ../sim-guide.mjs. Exported for the structure test; attaching is guarded so
// importing this module outside a browser has no effect.
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-cavity';
export const GUIDE_STEPS=[
 {target:'#settings',title:'条件を決める',text:'左右壁の温度差、プラントル数Pr、アスペクト比（幅／高さ）、格子数を選びます。左壁は300＋ΔT/2 K、右壁は300−ΔT/2 Kで、上下は断熱、全壁は静止・滑りなしです。'},
 {target:'#apply',title:'初期状態から計算',text:'「初期状態から計算」で現在の条件を確定します。条件変更と比較の開始では、A・Bの両方を時刻0へ戻します。'},
 {target:'#run',title:'再生と1コマ',text:'「再生」は計算が完了するごとに次のコマへ進みます。実時間との同速再生は保証されません。「1コマ進める／戻す」で保存した状態を確認できます。'},
 {target:'#field-a',title:'流れと温度を見る',text:'色で表示する量は温度・速度の大きさ・圧力などに切り替えられます。温かい側の上昇流と全体の循環を、計算した速度場で観察してください。'},
 {target:'#diagnostics',title:'診断で計算を確認',text:'診断には計算と保存則の確認値が出ます。条件を変えたら、まずここで異常がないかを見てください。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
