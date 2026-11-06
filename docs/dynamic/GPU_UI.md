# 断熱矩形のCPU/WebGPU：限定開発画面

2026-11-07（Asia/Tokyo）。計画GPU_UI_WIP_20261107.md、数値基礎GPU_DIFFUSION_DEVELOPMENT.md、非同期状態GPU_WORKER.md。実測はGPU_UI_CHECKPOINT_20261107.json。`dynamic/dev/gpu-diffusion.html`、公開allowlist外・releaseApproved=false。

## 計算と表示

source-free/全周断熱/1材料・一定物性の矩形だけ。L1m/H.5m/換算幅1m、仮想ρ=cp=1でk=α。実在の物性・製品名を付けない。α.001〜.1m²/s、初期平均280〜330K・cosセル平均振幅±20K、16×8〜128×64、default32×16/300K/振幅1/α.01。1コマ.2s以下、自動刻みはA/B最小safeDt*.1。連続固有モードのセル平均と同じsinc係数で初期化。

専用Workerでauto/CPU明示/WebGPU明示、実際のbackend/精度/adapter/代替理由を表示。autoはdevice unavailable/input precisionだけの同じ式のCPU代替で、数値/コンパイル/収支失敗を黙ってCPU成功にしない。利用者へunsafeフラグを要求しない。QAでSwiftShaderを明示しても物理GPUの実測性能とは表示しない。

実セル平均T/実セル中心、熱誤差/入力丸め・時計/更新数・履歴/実復元/実取消を接続。温度色を受理した初期A/Bから固定し、減衰を現在値の再拡大で隠さない。実寸比で描画し、全境界が断熱であると明記。初回GUI試験で固定割合のArrowRightが粗格子の同じセルに留まってタイムアウトしたため、1回で隣接セル中心へ移る操作へ修正。端の0/1を含む16/32/128格子の4方向を新Nodeと実クリック/キーで検査し、元のGUI期待とtimeoutは緩めない。

Bは現在の物理条件をCPUとして固定する。同じphysical条件の時だけ最大温度差（初期入力丸めも含む）をbackend比較として表示。Aでα等を変えた時は「物理条件が異なる」と表示し、差を数値誤差とは呼ばない。同じ式同士が近いことと連続解の精度・速度の証明を分ける。不正条件やGPU明示不可でも、前回受理済みの場/時計/backend説明を新条件で上書きしない。

## 実行結果

ChromiumのソフトウェアGPUとWebKitのdevice-unavailable CPUで、それぞれ実Worker/同刻みCPU/連続モード、真の巻戻しと同一bitmap再現、実progress取消/再計算、同物理CPU-B比較/異なる条件の判定分離、入力拒否/旧状態保持、8192セルの均一0熱、キーボード/実クリック、375/390/1280幅・明暗・DPR2・横はみ出しなし・pageerror0・localStorage不変更が成功。WebKitの明示WebGPU拒否では前のCPU状態を保持。Chromiumでこのデバイス不可ケースを実施したとは記録せずnull、WebKitではshader未実行。

既定32×16/t=.2sの連続セル平均差<.001K、同物理CPU比較最大<5e−5Kは元の予算を維持。実Workerの詳細な場/非対称/ゲート結果はGPU_WORKER_CHECKPOINTと後続clock再実行ログ。Chromiumの温度図とWebKitの条件フォームの実キャプチャを目視し、他の画像は目視済みとしない。ログ/画像はignored work、hashをcheckpointへ保存。

全Node1454中1449成功・失敗0・スキップ5（test-concurrency=1）、公開ビルド成功、dist/dynamic/devなし。公開Worker SHA b55d6a055c88f59e10d5127b59cb7cac13b85eb9476f2bb6e02e6b50d0ab3f52、cache heat-study-ja-app-4a24eb30c8fdd98cは不変更。CIに新GUIを追加し45ブラウザーコマンドとなる。

先行993cb4e/run42312466227は両ブラウザー・数値・高次MMSの4ジョブ成功/CFD実行中を直接確認した。固定imageでの当該チェックアウト信頼/輪郭caption待機修正は両ブラウザーの実ジョブで裏付けられたが、後続の今回GUIや全5成功へ転用しない（GPU_WORKER_IMAGE_CI_20261107.json）。

実GPU/ドライバー/性能/長時間/実機/支援技術/専用オフライン/一般物理精度/自由形状/高度な他モデルGPU対応/工学公開・main・全Phase3/4は未完了。この画面は開発検証用に限定する。
