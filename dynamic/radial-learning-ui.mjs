import {RadialJourney,RADIAL_CHOICES} from './radial-learning.mjs';
export function attachRadialJourney({root,prepare,advance,rewind,locate,context,pause}){
 const $=id=>root.querySelector('#'+id),mode=$('radial-path'),panel=$('radial-learning-content'),start=$('radial-prepare'),move=$('radial-locate'),run=$('radial-run'),back=$('radial-rewind'),choices=$('radial-choices'),commit=$('radial-commit'),status=$('radial-learning-status'),result=$('radial-result');
 let journey=null,preparing=false,working=false,generation=0;
 function render(){
  panel.hidden=mode.value==='free';if(panel.hidden)return;
  const prediction=mode.value==='prediction',ready=journey?.prepared;choices.hidden=!prediction;move.hidden=prediction;back.hidden=prediction;start.disabled=working;move.disabled=working||!ready;run.disabled=working||!journey?.canRun;back.disabled=working||!journey?.result;commit.disabled=working||!ready||!!journey?.prediction;
  choices.querySelectorAll('input').forEach(el=>el.disabled=working||!ready||!!journey?.prediction);
  $('radial-learning-steps').textContent=prediction?'専用条件を準備 → 平均温度を予想し確定 → 1秒まで計算 → 数値と理由を比べる':'専用条件を準備 → 測定点を中心寄りへ移動 → 1秒まで計算 → 初期状態へ戻す';
  status.textContent=journey?.reason||(!ready?'「専用条件を準備」でA/Bと履歴を初期化します。':journey.complete?'観察完了。自由実験では半径や境界条件も比べられます。':prediction&&!journey.prediction?'1秒後、どちらの体積平均温度が高いか予想を確定してください。':!prediction&&!journey.located?'r/R≤0.3の中心寄りへ測定点を動かしてください。下のボタンでも操作できます。':!journey.result?'「1秒まで計算」で実際の2条件を同時刻まで進めます。':'観察値を確認して「初期状態へ戻す」を試してください。');
  result.hidden=!journey?.result;
  if(journey?.result){const r=journey.result,f=x=>x.toFixed(3);$('radial-learning-values').textContent=`観察した時刻 t=${f(r.time)} sの体積平均：球A ${f(r.sphere.mean)} ℃、端面断熱の円筒B ${f(r.cylinder.mean)} ℃。差は ${f(r.difference)} K。中心寄りのr/R≈0.25の殻平均は球 ${f(r.sphere.inner)} ℃、円筒 ${f(r.cylinder.inner)} ℃。表示桁は精度を保証しません。`;
   $('radial-learning-reflection').textContent=(prediction?`あなたの予想：${RADIAL_CHOICES[journey.prediction]}。`:'')+`計算による観察：${RADIAL_CHOICES[r.observed]}。`+(prediction?(journey.prediction===r.observed?'予想と一致しました。':'予想との差を、内部の温度勾配と外面積/体積の比で考えてみましょう。'):'')+'「ほぼ同じ」は差0.01 K以内の表示上の区分で、採点や回答履歴には記録しません。';
  }
 }
 mode.onchange=()=>{pause();generation++;journey=mode.value==='free'?null:new RadialJourney(mode.value);choices.querySelectorAll('input').forEach(el=>el.checked=false);render();};
 async function act(fn,after=()=>{}){if(working)return;const token=generation;working=true;render();try{await fn(token);}catch(error){if(token===generation)journey?.invalidate(error.message);}finally{working=false;render();if(token===generation)after();}}
 start.onclick=()=>act(async token=>{preparing=true;try{if(!await prepare())throw Error('初期条件を準備できませんでした。画面のエラーを確認してください。');if(token!==generation)return;journey=new RadialJourney(mode.value);journey.prepare(context());choices.querySelectorAll('input').forEach(el=>el.checked=false);}finally{preparing=false;}},()=>{if(journey?.prepared)(journey.path==='prediction'?choices.querySelector('input'):move).focus();});
 move.onclick=()=>{locate(.25);journey?.locate(.25);render();};
 commit.onclick=()=>{try{journey.predict(choices.querySelector('input:checked')?.value,context().snapshots[0].time);render();}catch(error){status.textContent=error.message;}};
 run.onclick=()=>act(async token=>{if(!journey?.canRun)return;const remaining=1-context().snapshots[0].time;if(remaining>0&&!await advance(remaining))throw Error('計算が完了しませんでした。画面のエラーを確認してください。');if(token===generation)journey?.observe(context().snapshots);},()=>{if(journey?.result)result.focus();});
 back.onclick=()=>act(async token=>{if(await rewind()&&token===generation)journey?.rewind(context().snapshots);},()=>{if(journey?.complete)status.focus();});
 render();
 return {event(type){if(!journey||preparing)return;if(type==='calculating'&&journey.prepared&&journey.path==='prediction'&&!journey.prediction)journey.invalidate('予想の確定前に計算を開始しました。もう一度、条件を準備してください。');else if(type==='ready')journey.invalidate('条件が再設定されました。「専用条件を準備」からやり直してください。');else if(type==='advanced')journey.observe(context().snapshots);else if(type==='rewound')journey.rewind(context().snapshots);render();},probeMoved(fraction){journey?.locate(fraction);render();}};
}
