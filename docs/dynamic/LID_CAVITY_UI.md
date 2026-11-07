# 移動壁・等温キャビティ：既存MACの限定画面

2026-11-07（Asia/Tokyo）。LID_CAVITY_UI_WIP_20261107.mdの事前計画後。`dynamic/dev/lid-cavity.html`/UI/view/preset。既存cavity.mjsはMarchi評価2c3694eから不変更とgit diffで確認した。新数値ソルバー/新定常ベンチマークとして再計数しない。公開allowlist外、releaseApproved=false。

## 条件と実データの意味

1m正方形・換算奥行1m、仮想ρ=cp=1/ν=α=.01 SI、初期静止・300K・四辺断熱・浮力なし。上壁速度−1〜1m/s、Re≤100、16/32/64格子。既存conservative2/前進Euler/MAC投影/multigrid、tol1e−11/max4000。自動刻みはA/B最小safeDt/2。等温の力学検証例で、動く壁の仕事・粘性散逸を熱源へ戻さず、実物性/一般CFDの精度を承認しない。

速度の再構成はcreateMacVelocityFieldに実lidVelocityを渡す。自然対流の静止上壁を仮定した表示を流用しない。上壁内部は指定速度、上の2角は静止側壁との不連続で速度未定義と示す。速度の評価点と、p/Tの所属セル中心を別記し、圧力は平均0の投影ゲージと明示。圧力Poisson残差だけで連続圧力を承認しない。

実MACの速度/圧力・瞬間流線・中心線u(y)/v(x)・離散MAC運動エネルギー/圧力補正を表示。内部矢印と上の指定境界矢印を区別。流線は凍結した現在の補間場に接する線で粒子軌跡ではない。小さい矢印は画素の分解能で図だけ省略し、元の測定値は保持する。流線後処理の失敗は別警告とし、物理計算の条件や状態を変更しない。

A/Bに正負壁速度・異なる格子を保持し、時計/全u,v,p,T/反復情報を実際に復元する。初期化拒否時も前回受理済み条件/時刻/場を保持。単一図は640CSS pxまでとして正方形全体を見やすくし、実寸比・DPRを保つ。

## 検査

新4Node：preset/Re上限・静止exact0、正負壁速度のx鏡映でu反転/v,p鏡映（最大差<1e−9）、壁中央u=指定値・角未定義・圧力セル座標、readonly field/profile/streamlineと実寸比。

初回の新preset試験では非ゼロ流でもTがbit等値という不適切な期待が失敗した。独立集計で最大|T−300|4.54748e−13K、全熱誤差0、最大div4.35673e−13/s。有限Poisson残差に対する一様移流と温度加算丸めの解析予算で確認し、静止lid=0のexact0は維持した。温度/右辺/全熱を補正していない。元失敗ログと測定値をcheckpointへ保存。

Chromium/WebKitで実Workerの全MAC面u/v・セルp/Tを同刻みCPUへ比較、中心線/機械診断、動く境界の補間/角未定義、pセル座標の区別、実巻戻し後の同一bitmap再現、正負/格子A-B、実progress取消と再試行、不正draft後の壁/時刻保持、lid0のexact静止、64格子の短い過渡、375/390/1280幅・明暗・DPR2・正方形比・横はみ出しなし・pageerror0/localStorage不変更が成功。初回のpointer試験は大きな図の角がviewport外だったため、図の幅上限と実canvasをスクロールしてからの実mouse測定へ修正し、角の期待は変えない。WebKitの図とフォームの実画像を目視。

全Node1458中1453成功・失敗0・スキップ5、公開ビルド成功・devなし、公開Worker SHA b55d6a055c88f59e10d5127b59cb7cac13b85eb9476f2bb6e02e6b50d0ab3f52とcache heat-study-ja-app-4a24eb30c8fdd98cは不変更。Node後に初期disabled markup/ブラウザー描画待機だけを更新し、影響するGPU/移動壁の実試験を両エンジンで再実行した。数値コア/Node-testソースは以後不変更。LID_CAVITY_UI_CHECKPOINT_20261107.jsonにソース/ログ/画像hashと実測を保存。新GUIをCIに追加し46コマンドとなる。

## 参照と残る範囲

既存Re100の定常64格子/Marchi全28点はGHIA_MARCHI_RESOLUTION_20261106.md/JSON参照。元Ghia-v未達は保持。今回の画面の過渡や他Re/粗格子をその精度へ転用せず、生表/原図を追加配信しない。

先行22b2012のWebKit CIでGPU画面のbackend-summaryを描画前に読み、空文字と判定したことを実ログで確認。初期操作をHTMLでもdisabledにし、同じ表示assertをready後の実RAF描画で検査する。元timeout/物理/精度閾値は維持。GPU/移動壁の両ブラウザー再実行成功、リモート新修正は対象SHAで別確認（GPU_UI_RENDER_READY_FIX_20261107.json）。

専用オフライン/実機/支援技術/外部専門家/一般連続全場精度/他形状・高Re/乱流・熱連成/工学公開・main・全Phase3/4は未完了。
