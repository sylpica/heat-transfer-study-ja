# 非定常熱伝導（§6）残作業・項目9 正式実測記録

- 日時：2026-11-07（Asia/Tokyo）
- 対象：リポジトリ `sylpica/heat-transfer-study-ja`、統合先端 `3f44bc281b5f9fe7a206affee63c8c047ede930a`（ブランチ `feiris/mainline-integration` 先端）
- 計測クローン：`~/workspace/dev/heat-transient-item9`、作業ブランチ `feiris/transient-item9-final`（上記先端から分岐）
- 位置づけ：Phase 3 締め監査（`phase3-closure-audit-20261107.md`、監査時点の先端 `36f5361`）の非定常分野・残作業項目9「先端での分野全体の全 Node 回帰＋両ブラウザー再実行と、公開配信物 SHA でのブラウザー記録の更新」に対する正式実測。監査時点の限定「先端自体での分野全体の再実行記録は確認できない」（基準7）への回答として実施した。
- 本記録の実施範囲：非定常関連テストの正式実測、全 Node スイートの再実行、公開ビルドと公開配信物（dist）の棚卸しおよびハッシュ記録。**両ブラウザー再実行は本タスクの作業範囲に含まれず未実施**（下記の判定を参照）。コードの修正は行っていない。

## 1. 非定常関連テストの正式実測（主範囲）

### 範囲の定義

監査文書 §6 が非定常分野の本体として数えるモデルと、統合後に追加された同分野モデルに対応する Node テスト（`tests/*.test.mjs`）を主範囲と定義する。

| 区分 | テストファイル | 対応モデル |
|---|---|---|
| 矩形 FVM | `dynamic-thermal.test.mjs`、`dynamic-thermal-zero-flux.test.mjs` | `dynamic/thermal.mjs`（熱流束ゼロ条件の専用試験を含む） |
| 径方向（円筒／球） | `dynamic-radial.test.mjs`、`dynamic-radial-analysis.test.mjs`、`dynamic-radial-learning.test.mjs` | `dynamic/radial.mjs` ほか |
| 多層径方向 | `dynamic-radial-multilayer.test.mjs` | 多層円筒／球・中空（監査時点では未実装、本統合で実装済み） |
| 集中近似 | `dynamic-lumped-radial.test.mjs` | `dynamic/lumped-radial.mjs` |
| 表面交換 | `dynamic-surface-exchange.test.mjs` | `dynamic/surface-exchange.mjs`（同一面の対流＋放射） |
| 三角形系 | `dynamic-triangle-*.test.mjs`（20ファイル） | `dynamic/dev/triangle-*.mjs` |
| 円柱横流れ過渡 | `dynamic-cylinder-crossflow-transient.test.mjs` | 円柱まわりの過渡伝導 |
| 3次元直方体 | `dynamic-transient-brick-3d.test.mjs` | 3次元直方体伝導 |
| 共通基盤 | `dynamic-experiment.test.mjs`、`dynamic-field-analysis.test.mjs` | 実験基盤、等温線・場解析 |

### 実測結果（統合先端 3f44bc2、単一実行）

- **164件 ＝ 合格164 / 失敗0 / スキップ0**（所要 約138秒、終了コード0）
- 内訳の裏付け（同一ファイル集合の分割実行でも一致）：
  - 三角形系以外（12ファイル）：93件 ＝ 合格93 / 失敗0 / スキップ0
  - 三角形系（20ファイル）：71件 ＝ 合格71 / 失敗0 / スキップ0
- 準備段階の予備実行は162件合格とされていた。本実測の定義では164件である。予備実行側の範囲定義が記録に残っていないため、差2件の内訳は断定しない（推測で説明しない）。本記録の164件を、上記の定義を明示した正式値とする。

## 2. 隣接範囲の参考実測

監査文書が非定常分野の本体として数えていないが、熱拡散に係るため取りこぼし防止として実行した範囲。主範囲の判定には算入しない。

- 対象：自由輪郭・幾何基盤（`dynamic-cut-cell-*.test.mjs` 5件、`dynamic-convex-*.test.mjs` 2件、`dynamic-corner-closure.test.mjs`、`dynamic-planar-predicates.test.mjs`、`dynamic-dyadic-quotient.test.mjs`）、境界細分（`dynamic-boundary-refined-*.test.mjs` 3件）、直交メッシュ拡散（`dynamic-orthogonal-*.test.mjs` 5件）、GPU拡散（`dynamic-gpu-*.test.mjs` 3件）、蓄熱（`dynamic-heat-capacity.test.mjs`）、静的解析モデル（`transient-slab.test.mjs`、`semi-infinite-solid.test.mjs`、`transient-cooling.test.mjs`、`transient-gap.test.mjs`。監査文書が「動的 FVM としては数えない」と明記したもの）
- **実測：119件 ＝ 合格119 / 失敗0 / スキップ0**

## 3. 全 Node スイート（統合先端での再確認）

### 初回実行（依存未導入の計測クローン）

- 1604件 ＝ 合格1598 / 失敗1 / スキップ5（終了コード1）
- 失敗は `tests/dynamic-public-worker-bundle.test.mjs` の1件のみ。
- **切り分け：統合先端のコード起因ではない。** 失敗の実体は `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'esbuild'` で、計測クローンに `node_modules` が未導入だった環境要因である。当該ファイル内のテストは2件あり、ファイルレベルで読み込みに失敗したため「失敗1件」として集計され、総数（1605→1604）と合格数（1600→1598）が従来値より少なく出た。

### 依存導入後の再実行（正式値）

- `npm ci` で依存（esbuild、playwright 等）を導入後、当該ファイルを単独実行：**2件 ＝ 合格2 / 失敗0**。
- 全スイート再実行：**1605件 ＝ 合格1600 / 失敗0 / スキップ5**（終了コード0、所要 約546秒）。統合第4弾時点の従来値（1605件＝1600合格／0失敗／5スキップ）と完全一致した。

## 4. 公開ビルドと公開配信物の棚卸し

- `npm run build:public`：成功（終了コード0）。ビルド自身が検証する日本語訳の節ファイル76件の充足と原本 PDF の SHA-256 照合を含む。
- dist 棚卸し（統合先端で生成）：
  - 日本語節ファイル：**76件**（`dist/data/sections/*.json`）
  - `dist/dynamic` のエントリ：**47件**
  - 開発専用モジュールの混入：**0件**（`dist/dynamic/dev` は存在せず、三角形系・キャビティ系等の開発専用ファイルは含まれない）
  - dist 総ファイル数：237件
- 公開配信物 SHA：dist 全237ファイルの `sha256sum` 一覧（相対パス昇順）の SHA-256 ＝ **`67411bd17c02f4504251fcfd429e71bb3e3fd34d303f069b3402a2b6b9a5f955`**

## 5. 判定

| 要素 | 判定 | 根拠 |
|---|---|---|
| 非定常関連テストの先端での正式実測 | **充足** | 主範囲164件を統合先端 `3f44bc2` で単一実行し、全合格・失敗0・スキップ0 を実測。監査時点の「先端自体での再実行記録なし」の限定は解消した |
| 全 Node スイートの先端での再確認 | **充足** | 依存導入後の再実行で 1605件＝1600合格／0失敗／5スキップ、従来値と完全一致。初回の失敗1件は環境要因（esbuild 未導入）であることを切り分け済み |
| 公開配信物の棚卸しと SHA 記録 | **充足** | 公開ビルド成功、76節・47エントリ・混入0 を実測し、配信物のハッシュを本記録に固定した |
| 両ブラウザー再実行とブラウザー記録の更新 | **未実施（未充足）** | 監査文書の項目9の文言には含まれるが、本タスクの作業範囲に含まれないため実施していない。実施したことにしない。Chromium／WebKit での再実行は別途必要 |
| 項目10：実機（iPhone/Android）・支援技術での操作確認 | **対象外（未実施）** | この環境では実施不可能であり、正式実測の対象から除外した。実施したことにしない |

**項目9全体の判定：部分充足。** Node 回帰と公開配信物の確認については統合先端での正式実測が完了し充足した。ただし監査文書の文言に含まれる両ブラウザー再実行が未実施であるため、項目9全体としては未充足部分が残る。

## 6. 申し送り

- ブラウザー再実行（Chromium／WebKit）を行う際は、本記録の配信物 SHA（`67411bd1…`）と対応付けて記録すること（監査文書の「公開配信物 SHA でのブラウザー記録の更新」の後工程）。
- 本実測ではコードの修正は行っていない。計測中に発見したコード起因の問題はなかった（唯一の失敗は環境要因として切り分け済み）。
