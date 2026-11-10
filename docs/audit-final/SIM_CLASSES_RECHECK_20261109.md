# シミュレーター不具合クラスの再監査 — 2026-11-09

対象ツリー：`~/workspace/dev/heat-collation3`（ブランチ `audit/integration-loop3`、先端 `6e3cd54`）
方法：各クラスについて「原所見の修正が現行ツリーで生きているか」＋「同クラスの未修正の残存がないか」を、コード読みと対象テストの前景実行、既存オフラインプローブ（Chromium／サーバー停止法）の再実行で確認した。製品コード・データは変更していない（監査のみ、本記録もコミットしない）。

## 結果サマリ

| クラス | 原所見・残件 | 修正／状態の生存 | 同クラスの残存 |
|---|---|---|---|
| 1. 計算核の精度 | 強制対流圧力場の連続解精度 6.84%@64格子（未承認） | 未承認のまま正しく保持。公開側で精度主張なし | 新規回帰なし。残件は従来どおり未承認（P3相当の既知残件） |
| 2. 境界条件・モデル切り替え | Graetz 3境界条件ほか | 生存 | なし |
| 3. 単位・無次元数変換 | Nu／Re／Pr 等の換算 | 生存 | なし |
| 4. オフライン・PWA | R1-P1-01（P1、節がプリキャッシュ外）、C2-PWA-01（P3、PNGアイコン） | 両方とも生存 | なし（実機インストール提示のみ従来どおり未検証） |

新規所見：P1 0件／P2 0件。既知残件の継続：圧力場精度 6.84%（未承認）、PWA 実機インストール提示（未検証）。

## 1. シミュレーターの計算核の精度

- 対象テストを前景実行し、全合格を確認した（所要約98秒）：
  `dynamic-cavity`、`dynamic-cavity-highra`、`dynamic-blasius-flow`、`dynamic-rans-channel`、`dynamic-graetz-channel`、`dynamic-graetz-reference`、`dynamic-channel`、`dynamic-thermal`、`dynamic-properties`、`forced-convection-flat-plate`、`laminar-pipe-convection`、`turbulent-pipe-convection`、`natural-convection-vertical`、`cylinder-crossflow` — **132件＝132 pass／0 fail／0 skip**。
  これには承認済みベンチマークへの回帰確認が含まれる：キャビティ（Ghia 照合・de Vahl Davis の Nu 定義区別、高 Ra 側も含む）、平板 Blasius（独立シューティング照合系）、RANS チャネル（Moser–Kim–Mansour 系の参照照合）、Graetz（下記クラス2）。
- 圧力場 6.84% の残件の扱い（現行ツリーで再確認）：
  - 当該 CFD 圧力場は開発専用側の対象であり、公開 Worker（`dynamic/worker.mjs`）が登録するモデルは `thermal`／`radiation-network`／`developed-channel`／`radial` の4種のみで、キャビティ CFD は公開ビルド（`dist/dynamic/` 51件）にも含まれない。
  - 診断スクリプト側でも未承認が明示され続けている：`scripts/dynamic-pressure-sensitivity.mjs` と `scripts/dynamic-pressure-components.mjs` は `pressureAccuracyApproved:false` を出力し、「passed は圧力精度の承認ではない」旨の scopeNote を伴う。
  - 公開 UI テキスト（`app.js`、`dynamic/lab.mjs`、`dynamic/learning-ui.mjs`、各 `index.html`）に「6.84」および圧力精度の主張は存在しない（grep で 0件）。未承認の数値を学習者向けに精度保証として表示する経路はない。
  - 判定：残件は「未承認のまま正直に保持」されており、修正済みと偽る表示も、ベンチマーク回帰もない。新規所見とはしない。

## 2. 境界条件・モデル切り替え

- 熱モデル（`dynamic/thermal.mjs`）：境界条件は `insulated／temperature／flux／convection／radiation／convection-radiation` の6種を検証付きで受理し、未知の型・非有限値・放射率範囲外は生成時に拒否する。自由輪郭では検証済みでない境界種（flux／convection／radiation／convection-radiation）を明示エラーで拒否するガードも現行のまま。
- 発達流路（`dynamic/developed-channel.mjs`）：境界は平行平板 no-slip・断熱＋温度周期に固定され、`outline／regions／boundaries` を渡すと明示エラーで拒否する。境界の黙った無視はない。定常 Re_Dh の上限（1000）超過も拒否。
- Graetz チャネル（開発モジュール＋参照）：境界3種（`wall-temperature`／`wall-heat-flux`／`wall-heat-flux-insulated`）すべてでエネルギー収支の相対残差 <1e-9、発達域の Nu 極限（等熱流束 140/17、等壁温の第1モード値）への収束、Lévêque 極限のプリファクタへの単調接近がテストで固定されており、本回実行でも合格（クラス1の132件に含む）。不正な境界（型欠落・余分なキー併記・非有限値・未知型）は拒否される。
- モデル切り替え時の状態混在：Worker 側（`dynamic/worker-runtime.mjs`）は `init` のたびに世代カウンタを進め、進行中トランザクションをロールバックしてから新モデルへ差し替える。制御側（`dynamic/experiment.mjs`）は `initialize` で設定を `structuredClone` し、epoch トークンで古い非同期結果を破棄、A/B 2モデルの物理時刻一致を検証してから状態を受理する。モデル種別は Worker 側でホワイトリスト検証される。
- 追加の対象テストも全合格：境界細分化（mesh／flux／transient）、三角形境界・表面境界、ゼロ熱流束、キャビティ状態・UI設定、ソルバー設定、公開キャッシュ版数、公開 Worker バンドル、シミュレーター拡張統合 — **47件＝47 pass／0 fail**。
- 判定：境界条件の選択は計算に正しく反映され、切り替えで状態が混ざる経路は見つからなかった。

## 3. 単位・無次元数の変換

- 簡易シミュレーター群の換算式を全数コード走査した。代表確認：
  - 平板強制対流：`NūL = 0.664·ReL^1/2·Pr^1/3`、`Re = ρuL/μ`、`Pr = μcp/k`、適用範囲（1000≤Re<5×10⁵、0.6≤Pr≤50）外は外挿せず拒否。
  - 層流円管：Hausen 式（発達極限 Nu=3.66）、`f = 64/Re`（Darcy）、`Δp = f(L/D)ρu²/2`、`Gz = Re·Pr·D/L`。
  - 乱流円管：Gnielinski 式と Petukhov 型 Darcy 摩擦係数。表示側でも「Fanning は Darcy の1/4で混同禁止」と明記され、係数の取り違えはない。
  - 自然対流（鉛直平板）：Churchill–Chu 式、膜温度は `(Ts+T∞)/2 + 273.15` でケルビン化してから β≈1/Tfilm を扱う。温度入力は ℃、温度差は K と等価である扱いが一貫。
  - その他（円柱横流れ、熱交換器、フィン効率、半無限固体、沸騰・凝縮系）も SI 単位系で統一され、℃↔K の変換は絶対温度が必要な箇所（膜温度・放射の T⁴・物性表の K 表記）でのみ行われ、温度差への誤った +273.15 混入は見つからなかった。時間・長さの 1000／3600 系の暗黙換算も残っていない（入力は単位明示の SI のみ）。
- 動的側の無次元量：発達流路の `steadyReynoldsDh`、セル Pe、CFL は定義どおり算出され、物性表（`dynamic/properties.mjs`）は範囲外を外挿せず停止する。
- テスト裏付け：クラス1の132件に各モジュールの独立再計算照合（Nu・摩擦・圧力損失・出口温度・エネルギー収支）が含まれ、全合格。
- 判定：誤換算の残存は見つからなかった。

## 4. オフライン・PWA（R1-P1-01／C2-PWA-01）

- APP_SHELL の実測（現行 `dist/sw.js`、前景スクリプトで機械確認）：
  - エントリ総数 **255**、うち節データ **76件**、`dynamic/` 50件、アイコン3件。
  - 全エントリが dist 内に実在（不足 **0**）。ソース側 `sw.js` の APP_SHELL と dist 側は集合として完全一致（差分 0）。
  - `dist` 総ファイル数 258。
- アイコン（C2-PWA-01）：`dist/assets/icon-192.png`／`icon-512.png` は実 PNG で、IHDR 実寸が 192×192／512×512 と一致。manifest の登録3件（SVG／192 PNG／512 PNG）と APP_SHELL の収録を確認。
- オフライン実働：既存プローブ `docs/audit-round1/probe-offline-first-visit.mjs`（サーバー停止法、Chromium）を現行 dist で再実行し合格：
  - 1回訪問でアプリキャッシュ **255件（節76件を含む）** がプリキャッシュされる。
  - サーバー停止後の再読み込みでホーム（h1「学習ホーム」）と読書画面（h1「読書モード」、本文ブロックあり）が描画され、`loadError` なし、pageerror **0**。
  - これは R1-P1-01 の原再現法（初回訪問のみ＋サーバー停止）そのものであり、修正が現行ツリーでも生きている。
- 未検証のまま残るもの：実機での PWA インストール提示（従来どおりの既知残件。本ラインは Chromium プローブまでの確認）。

## 未実施・注記

- WebKit／Firefox／実機での確認は行っていない（本ラインのブラウザー確認は Chromium のプローブ実行）。
- 全 Node スイート（約1,800件）の完走は本ラインの対象外とし、上記の対象テスト合計179件（132＋47、全合格）で代替した。
- 配信ブラウザースイート全体（`tests/browser-distribution.mjs`）の完走も対象外。オフライン経路は上記の対象絞りプローブで確認した。
