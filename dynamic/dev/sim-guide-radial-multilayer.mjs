// Guide steps for the radial multilayer screen (radial-multilayer.html).
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-radial-multilayer';
export const GUIDE_STEPS=[
 {target:'#preset',title:'プリセットと形状',text:'検証プリセットから始めるか、手入力で円筒・球を選びます。同心の多層（最大8層）の半径方向1D非定常熱伝導を解きます。'},
 {target:'#layers',title:'層の構成',text:'層は内側から積みます。各層は一様なセルに分割され、物性は層ごとに一定です。「層を追加」で最大8層まで増やせます。'},
 {target:'#interfaces',title:'界面の接触熱抵抗',text:'接触熱抵抗Rc″が0なら完全接触です。温度ジャンプは熱流束とRc″の積で生じ、界面の両側温度として分けて表示します。層の順序を変えたら、界面に紐づく値を確認してください。'},
 {target:'#apply',title:'初期状態から計算',text:'内外の境界条件まで決めたら「初期状態から計算」で時刻0から解き直します。'},
 {target:'#field',title:'温度分布を見る',text:'半径方向の温度分布です。界面では熱流束の連続と温度ジャンプが分かれて返るため、界面の両側の値を読み分けてください。'},
 {target:'#summary',title:'要約で確認',text:'熱流や界面の値などの結果は要約で確認します。診断では収支も見られます。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
