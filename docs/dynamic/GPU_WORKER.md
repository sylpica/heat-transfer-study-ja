# 限定した断熱矩形拡散：非同期CPU/WebGPU Worker

2026-11-07（Asia/Tokyo）。事前範囲/予算はGPU_WORKER_WIP_20261107.md、基礎数値モデルはGPU_DIFFUSION_DEVELOPMENT.md。公開allowlist外。今回の実測とソースSHAはGPU_WORKER_CHECKPOINT_20261107.json。

## 状態と取消

既存の同期Worker基盤を変えず、別の非同期runtime/専用Workerを追加。init・復元・advanceを順番に処理し、取消/新init/復元は進行中のAbortControllerを先に中止、コアの実rollbackが完了してから次へ進む。遅れて出来た古いasync initは破棄し、失敗した新initは旧モデルを失わない。GPUデバイス取得そのものはWeb APIでabortできないので、そのPromiseが完了するまで次のinitは待つ。不要になった新規モデルのデバイスは完成後にcloseする。取消承認と次のモデル準備完了を混同しない。

GPUは条件/予算/backend署名、保持Float32θ、基準温度、時計/整数ステップ、正温度・最大原理・同じエネルギー閾値を検査して完全復元。CPUは同じ断熱式のFloat64復元と条件/時計/断熱収支を検査する。別backendの状態を補間/変換しない。未バージョンの旧devスナップショットは新しい復元形式として受け付けない（恒久保存は元から提供していない）。

CPU代替で進行中の可変温度をsnapshotが返し得た点を修正し、受理済みframeを分離した。最後のyield中にabortした場合も、yield後の確認でcommitを防止。戻したsnapshot配列の編集も内部受理状態を変えない。未知の根条件/材料/境界キーを拒否。WGSL式/Float32丸め・収支閾値は不変更で、shader本文SHAも旧b25b892と一致を確認。

## 実行結果

新runtimeの順序・実CPU進捗中の復元・古いasync initの破棄・無効init/restore後の旧モデル保持を含め、新6＋既存3の9Node成功。既存のChromium SwiftShader全数値回帰も再実行し、元の連続/離散指数・非対称収支・意図した厳格ゲート失敗/取消/CPU代替が成功。WebKitはdevice unavailableのCPU経路だけ実行した。

専用Workerを実際に起動したChromiumはvendor google/architecture swiftshader/fallback=true。32×16/t=.2sの連続セル平均RMS .000100374K、同刻みFloat64 CPUとの差RMS6.39495e−8K/最大2.57901e−7K（元の2e−5/5e−5予算内）。完全復元・実progress取消後の同一温度/時刻/ステップのbit再現、異種backend/署名/時計拒否、不正物理init後の旧Worker保持、意図した厳格エネルギーゲートでGPUを保ったまま停止、入力精度での理由付きCPU代替と明示GPUの拒否、古いinit取消/再利用、localStorage不変更が成功。

WebKitの実WorkerはWebGPU不可でFloat64 CPUのみ。連続RMS .000100364K、同CPUとの差0、復元/実取消/再現・代替理由/明示GPU拒否・状態保持が成功。shaderは未実行、strict GPU gateはnullと明記し、GPU成功と数えない。実機/物理GPU/ドライバー/性能/長時間/GUI/専用オフライン/一般物理精度/公開は未確認。ソフトウェアGPUの実行時間を高速化達成へ転用しない。

### 追加：CPUサブステップ時計の丸めと比較時刻

GUI接続準備で16,384細刻みを実測すると、CPU加算時計は.19999999999995183sとなり、宣言した.2sとの差4.81837e−14が既存A/B時刻予算を超えた。閾値や温度を調整せず、計画した通常刻み×回数＋端数刻みで定まる要求終点へCPU時計を確定する。内部の積み上げ時計との差は64ε×終点×(当該回数+1)以内を検査し、それを超える時刻エラーは拒否する。断熱・自律系の同じEuler温度列/更新数/最後の刻みは不変更。

実2セル場の16,384更新で元の直接Float64コアと全温度bit一致、離散固有モードの閉形式とも照合し、宣言時計/復元も成功。新表示関数2件を含む関連12Node成功、現ソースの実Workerを両エンジンでも再実行成功（work/gpu-async-worker-clock-*-20261107.log）。GPU計算式と時計は変えていない。GUIはGPU_UI_WIP_20261107.mdの計画段階。
