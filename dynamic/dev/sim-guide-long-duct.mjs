// Guide steps for the long-duct radiation screen (long-duct.html).
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-long-duct';
export const GUIDE_STEPS=[
 {target:'#settings',title:'断面と壁の条件',text:'軸方向に無限に長い凸多角形ダクトの断面です。断面形状・寸法と、各壁の初期温度・放射率を決めます。各壁は一様温度の灰色拡散面で、壁内伝導と対流は解きません。'},
 {target:'#vertex-svg',title:'断面の頂点編集',text:'頂点は図の丸をドラッグするか、座標を数値で書き換えて動かせます。厳密な凸形にならない形状（凹み・自己交差など）は、その場で理由を示して受け付けません。'},
 {target:'#apply',title:'初期状態から計算',text:'編集の反映は「初期状態から計算」から行います。形を変えると壁の数と長さが変わり、形態係数も変わります。'},
 {target:'#run',title:'再生と1コマ',text:'「再生」で各壁の温度が放射交換で変わっていきます。「1コマ進める／戻す」で途中経過を確認できます。'},
 {target:'#figure-a',title:'射度と正味交換',text:'射度には自分の放出と他の壁からの反射が含まれるため、正味交換の矢印は温度差だけでは決まらず、解いた射度差から描きます。'},
 {target:'#wall-values',title:'壁ごとの値',text:'壁ごとの温度や交換量はここで確認します。条件Bを固定すると、形の違いによる変化を同じ時刻で比べられます。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
