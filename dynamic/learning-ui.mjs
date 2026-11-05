import {HeatingJourney,HEATING_CHOICES} from './learning-path.mjs';
export function attachLearningJourney({root,prepare,advance,rewind,locate,context}){
 const $=id=>root.querySelector('#'+id);let journey=null,preparing=false,working=false,generation=0;
 const mode=$('learning-path'),panel=$('learning-content'),start=$('learning-prepare'),move=$('learning-locate'),run=$('learning-run'),back=$('learning-rewind'),choices=$('learning-choices'),commit=$('learning-commit'),status=$('learning-status'),result=$('learning-result');
 function render(){
  panel.hidden=mode.value==='free';if(panel.hidden)return;
  const prediction=mode.value==='prediction',ready=journey?.prepared;choices.hidden=!prediction;move.hidden=prediction;back.hidden=prediction;start.disabled=working;move.disabled=working||!ready;run.disabled=working||!journey?.canRun;back.disabled=working||!journey?.result;commit.disabled=working||!ready||!!journey?.prediction;
  choices.querySelectorAll('input').forEach(el=>el.disabled=working||!ready||!!journey?.prediction);
  $('learning-steps').textContent=prediction?'条件を確認 → 予想を確定 → 5秒まで計算 → 数値と理由を比較':'初期条件を準備 → 左側へ測定点を動かす → 5秒まで計算 → 初期状態へ戻す';
  status.textContent=journey?.reason||(!ready?'「初期条件を準備」で実験Aと比較Bを初期化します。':journey.complete?'観察完了。入力を変える自由実験も試せます。':prediction&&!journey.prediction?'左右の温度を予想し、実行前に確定してください。':!prediction&&!journey.located?'図の測定点を左寄りへ移してください。下のボタンでも操作できます。':!journey.result?'「5秒まで計算」で実際の数値計算を進めます。':'温度を確認したら「初期状態へ戻す」で巻き戻しを試してください。');
  result.hidden=!journey?.result;
  if(journey?.result){const r=journey.result,f=x=>x.toFixed(3);$('learning-values').textContent=`観察した状態 t=${f(r.time)} s：左 T=${f(r.left)} ℃（x=${f(r.leftPosition[0])} m）、右 T=${f(r.right)} ℃（x=${f(r.rightPosition[0])} m）、共通 y=${f(r.leftPosition[1])} m。各点に最も近いセルの平均温度。差は ${f(r.difference)} K。`;
   $('learning-reflection').textContent=(prediction?`あなたの予想：${HEATING_CHOICES[journey.prediction]}。`:'')+`計算による観察：${HEATING_CHOICES[r.observed]}。`+(prediction?(journey.prediction===r.observed?'予想と観察が一致しました。':'予想との差を、加熱面からの距離と温度勾配で考えてみましょう。'):'')+'ここで「ほぼ同じ」は温度差0.01 K以内の表示上の区分です。';
  }
 }
 mode.onchange=()=>{generation++;journey=mode.value==='free'?null:new HeatingJourney(mode.value);choices.querySelectorAll('input').forEach(el=>el.checked=false);render();};
 async function act(fn,after=()=>{}){if(working)return;working=true;render();try{await fn();}catch(error){if(journey)journey.invalidate(error.message);}finally{working=false;render();after();}}
 start.onclick=()=>act(async()=>{const token=generation;preparing=true;try{const ok=await prepare();if(!ok)throw Error('初期条件の準備に失敗しました。画面のエラーを確認してください。');if(token!==generation)return;journey=new HeatingJourney(mode.value);journey.prepare(context());choices.querySelectorAll('input').forEach(el=>el.checked=false);}finally{preparing=false;}},()=>{if(journey?.prepared)(journey.path==='prediction'?choices.querySelector('input'):move).focus();});
 move.onclick=()=>{locate({x:.25,y:.5});journey?.locate({x:.25,y:.5});render();};
 commit.onclick=()=>{try{journey.predict(choices.querySelector('input:checked')?.value,context().snapshot.time);render();}catch(error){status.textContent=error.message;}};
 run.onclick=()=>act(async()=>{if(!journey?.canRun)return;const remaining=5-context().snapshot.time;if(remaining>0){const ok=await advance(remaining);if(!ok)throw Error('計算が完了しませんでした。画面のエラーを確認してください。');}journey.observe(context().snapshot);},()=>{if(journey?.result)result.focus();});
 back.onclick=()=>act(async()=>{if(await rewind())journey?.rewind(context().snapshot);},()=>{if(journey?.complete)status.focus();});
 render();
 return {event(type){if(!journey||preparing)return;if(type==='calculating'&&journey.prepared&&journey.path==='prediction'&&!journey.prediction)journey.invalidate('予想の確定前に計算を開始しました。もう一度、条件を準備してください。');else if(type==='ready'||type==='left-thermal'){journey.invalidate('条件が再設定されました。「初期条件を準備」からやり直してください。');}else if(type==='advanced')journey.observe(context().snapshot);else if(type==='rewound')journey.rewind(context().snapshot);render();},probeMoved(probe){journey?.locate(probe);render();}};
}
