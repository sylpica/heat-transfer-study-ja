// Guide steps for the heat-sink screen (heat-sink.html).
import {attachSimGuide} from '../sim-guide.mjs';

export const GUIDE_ID='dev-heat-sink';
export const GUIDE_STEPS=[
 {target:'#settings',title:'基部とフィンの条件',text:'フィンの本数・長さ・厚さ・間隔、基部の寸法と発熱、指定hを決めます。均一温度の基部と同一の1Dフィンを結合したモデルです。'},
 {target:'#apply',title:'初期状態から計算',text:'「初期状態から計算」で条件を確定し、時刻0から解き直します。本数を増やすと、放熱面積だけでなく熱容量と基部からの熱流も変わります。'},
 {target:'#compare',title:'条件Bで比較',text:'「現在の条件をBへ固定」すると、条件を変えてAとBを同じ時刻で比べられます。'},
 {target:'#run',title:'再生と1コマ',text:'「再生」で基部とフィンの温度が時間とともに変わります。「1コマ進める／戻す」で途中経過を確認できます。'},
 {target:'#field-a',title:'立体表示の読み方',text:'図は1D解の温度を立体形状へ配置したもので、3D解析ではありません。色と数値を合わせて確認してください。'},
 {target:'#summary',title:'要約で確認',text:'基部温度や放熱量などの結果は要約で確認します。診断では収支も見られます。'},
];
if(typeof document!=='undefined')attachSimGuide({id:GUIDE_ID,steps:GUIDE_STEPS,termsUrl:'../../data/glossary.json',termUrlBase:'../../index.html'});
