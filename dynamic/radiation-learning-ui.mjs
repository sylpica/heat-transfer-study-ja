import {RadiationJourney,RADIATION_CHOICES} from './radiation-learning.mjs';
export function attachRadiationJourney({root,prepare,advance,rewind,locate,context,pause}){
 const $=id=>root.querySelector('#'+id),mode=$('radiation-path'),panel=$('radiation-learning-content'),start=$('radiation-prepare'),move=$('radiation-locate'),run=$('radiation-run'),back=$('radiation-rewind'),choices=$('radiation-choices'),commit=$('radiation-commit'),status=$('radiation-learning-status'),result=$('radiation-result');
 let journey=null,preparing=false,working=false,generation=0;
 function render(){
  panel.hidden=mode.value==='free';if(panel.hidden)return;
  const prediction=mode.value==='prediction',ready=journey?.prepared;choices.hidden=!prediction;move.hidden=prediction;back.hidden=prediction;start.disabled=working;move.disabled=working||!ready;run.disabled=working||!journey?.canRun;back.disabled=working||!journey?.result;commit.disabled=working||!ready||!!journey?.prediction;choices.querySelectorAll('input').forEach(el=>el.disabled=working||!ready||!!journey?.prediction);
  $('radiation-learning-steps').textContent=prediction?'専用条件を準備 → 長時間後の共通温度を予想し確定 → 20秒まで計算 → 保存量と過渡温度を区別':'専用条件を準備 → 面1を注目面にする → 20秒まで計算 → 保存量を確認 → 初期状態へ戻す';
  status.textContent=journey?.reason||(!ready?'「専用条件を準備」で比較Bと履歴も初期化します。':journey.complete?'観察完了。自由実験では熱容量や放射率も変えて比べられます。':prediction&&!journey.prediction?'長時間後に近づく温度を予想し、実行前に確定してください。':!prediction&&!journey.located?'「面1を注目面にする」で高温側の温度を追いましょう。':!journey.result?'「20秒まで計算」で実際の温度と放射収支を計算します。':'観察値を確認して初期状態へ戻してください。');
  result.hidden=!journey?.result;
  if(journey?.result){const r=journey.result,f=x=>x.toFixed(3);$('radiation-learning-values').textContent=`観察した時刻 t=${f(r.time)} s：面1 ${f(r.hot)} ℃、面2 ${f(r.cold)} ℃。容量平均は ${f(r.weighted)} ℃。面1が失った熱 ${f(r.lost)} J、面2が受け取った熱 ${f(r.gained)} J。正味外向き出力は面1 ${f(r.outwardPower[0])} W、面2 ${f(r.outwardPower[1])} W。`;
   $('radiation-learning-reflection').textContent=(prediction?`あなたの予想：${RADIATION_CHOICES[journey.prediction]}。`:'')+`計算で保たれた容量平均は ${f(r.weighted)} ℃。長時間後の共通温度は保存則から80℃と予測できますが、20秒ではまだ共通温度に達していません。`+(prediction&&journey.prediction!=='weighted'?'単純平均や冷たい面を一定温度とする仮定ではなく、両面の有限な熱容量で考えましょう。':'')+'予想の採点や回答履歴への保存はしません。';
  }
 }
 mode.onchange=()=>{pause();generation++;journey=mode.value==='free'?null:new RadiationJourney(mode.value);choices.querySelectorAll('input').forEach(el=>el.checked=false);render();};
 async function act(fn,after=()=>{}){if(working)return;const token=generation;working=true;render();try{await fn(token);}catch(error){if(token===generation)journey?.invalidate(error.message);}finally{working=false;render();if(token===generation)after();}}
 start.onclick=()=>act(async token=>{preparing=true;try{if(!await prepare())throw Error('専用条件を準備できませんでした。画面のエラーを確認してください。');if(token!==generation)return;journey=new RadiationJourney(mode.value);journey.prepare(context());choices.querySelectorAll('input').forEach(el=>el.checked=false);}finally{preparing=false;}},()=>{if(journey?.prepared)(journey.path==='prediction'?choices.querySelector('input'):move).focus();});
 move.onclick=()=>{locate(0);journey?.locate(0);render();};commit.onclick=()=>{try{journey.predict(choices.querySelector('input:checked')?.value,context().snapshots[0].time);render();}catch(error){status.textContent=error.message;}};
 run.onclick=()=>act(async token=>{if(!journey?.canRun)return;const remaining=20-context().snapshots[0].time;if(remaining>0&&!await advance(remaining))throw Error('計算が完了しませんでした。画面のエラーを確認してください。');if(token===generation)journey?.observe(context().snapshots);},()=>{if(journey?.result)result.focus();});
 back.onclick=()=>act(async token=>{if(await rewind()&&token===generation)journey?.rewind(context().snapshots);},()=>{if(journey?.complete)status.focus();});render();
 return {event(type){if(!journey||preparing)return;if(type==='ready')journey.invalidate('条件が再設定されました。「専用条件を準備」からやり直してください。');else if(type==='advanced')journey.observe(context().snapshots);else if(type==='rewound')journey.rewind(context().snapshots);render();},probeMoved(face){journey?.locate(face);render();}};
}
