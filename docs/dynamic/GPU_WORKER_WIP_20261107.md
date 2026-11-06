# 断熱矩形GPU試作の実Worker接続：事前計画

2026-11-07（Asia/Tokyo）。Phase4/Q59/66の既存GPU_DIFFUSION_DEVELOPMENT.mdを続ける。既存の一定物性/1材料/発熱なし/全周断熱矩形だけを扱い、物理モデルやFloat32ゲートを広げない。一般CFD/自由形状/実GPU高速化の承認はしない。公開allowlist外。

## 接続と状態

GPU作成/進行は非同期のため、既存の同期CPU用worker-runtimeを変更せず別dev runtimeを作る。物理コアのCPU/GPU両経路へ完全復元を追加し、GPUは保持Float32θ・基準温度・元入力/予算署名・時計/ステップ・収支/最大原理を受理前に照合する。CPUは元のFloat64モデルの実復元を使う。別backendや別条件の状態を補間/変換して復元しない。backend/precision/adapter/fallback理由は表示データとして保持。

advance中の取消/restore/initはまずAbortControllerで旧計算を取り消し、旧コアのrollback完了後に順番に処理する。非同期initが古くなったら新規デバイスを破棄し、受理済み旧モデルを保護する。新initの失敗で旧モデルを閉じない。コンパイル/数値/収支/デバイスエラーをCPUへ黙って切り替えない。autoの代替理由は従来のdevice unavailable/input precisionだけを維持。

## 実行前検査

- 既存のGPU Node/ブラウザー検証を回帰し、元の連続/離散指数予算・非対称収支・意図した厳格ゲート失敗と状態保持を維持する。
- 新runtimeの順序・実取消rollback後のrestore/init・古いasync initの廃棄・無効init後の旧モデル保持を独立Nodeで検査する。
- Chromium SwiftShader明示の実Workerで、連続セル平均固有モード/Float64 CPUの同一刻みと照合。従来CPU差RMS<2e−5K/max<5e−5Kを維持し、固定32×16・t=.2s・safeDt*.1の真のGPU復元/再計算、実progress取消/再試行、入力不適合/別backend復元拒否・旧Worker保持を検査する。ソフトウェアGPUを実GPUとしない。
- WebKitではdevice取得不可なら、その旨を記録し同じ方程式のCPU Workerと解析モード/復元/取消を検査する。GPU明示指定の不可はエラー、autoでだけ理由付きCPUを許す。shader未実施を成功として数えない。
- GUIはこの段階の後。実GPU/ドライバー/性能/長時間/専用オフライン/実機/公開は未確認のまま保存する。root単独・逐次実行。
