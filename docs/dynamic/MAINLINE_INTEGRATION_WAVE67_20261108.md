# 本線統合 第6・7弾 記録（2026-11-08）

基点 `34b84ad`（第1〜5弾統合・配信済み）上に、2026-11-07 夕方〜11-08 に着地した全21ラインを系統順に統合した記録。ローカルコミットのみ（配信は別途）。

## 統合結果

- 統合先：`feiris/mainline-integration`（クローン `~/workspace/dev/heat-mainline`）
- 全21ブランチの先端が統合ツリーの祖先であることを `git merge-base --is-ancestor` で全件確認。
- 統合後の先端：本記録コミットの親 `f39b77a`（統合フォローアップ込み）。

## マージ順序（系統ごと・祖先順）

| # | 系統 | ブランチ（先端） | 備考 |
|---|---|---|---|
| 1 | ヒートシンク | feiris/heatsink-coupled-js `c940d4b` → feiris/heatsink-coupled-gui `6ddbd98` | 基点の直系子孫のため FF |
| 2 | 台帳→連携→ケース | feiris/phase57-inventory `c57f2b0` → feiris/linkage-expand `615d2ec` → feiris/case-intake-expand `28f933b` | 競合なし |
| 3 | 共役 | feiris/conjugate-model-js `221cb53` → feiris/conjugate-gui `2858b8e` | 競合なし |
| 4 | 説明書 | feiris/manuals-inapp `1e087e4` → feiris/model-tutorials `a888ba2` → feiris/sim-guide-popups `7d92bea` | simguide で競合3件（下記） |
| 5 | 章末問題 | feiris/chapter-problems-translation `0a6ffbc` → feiris/chapter-problems-inapp `2f11b4a` → feiris/chapter-problems-search `b78cc5c` → feiris/glossary-flashcards `3750695` → feiris/appendix-references `c373243` → feiris/guide-review `717075f` | flash で競合3件（下記）。appx・guiderev は自動マージ |
| 6 | 単独 | feiris/browser-test-modernize `846be9c`、feiris/solver-settings `6ebf281`、feiris/highra-cavity-js `479326c` | highra で競合1件（下記） |
| 7 | フィン間 | feiris/fingap-flow-js `3ca3710` → feiris/fingap-flow-gui `9bd0c8d` | 競合なし |

## 競合と解消（すべて「両側の変更を両方残す」ユニオン解消。黙って捨てた変更はない）

1. **simguide × tutorials/manuals**（`sw.js`、`scripts/build-public-site.mjs`、`dynamic/lab.mjs`）
   - APP_SHELL／公開ファイル一覧：両側が `model-manuals.mjs` の直後に別モジュールを追加していた（HEAD 側 `model-tutorials.mjs`、simguide 側 `sim-guide.mjs`・`lab-guide.mjs`）。4モジュール全てを各1回ずつ収録。
   - `dynamic/lab.mjs`：import 2行（`MODEL_TUTORIALS` と `initLabGuide`）を両方保持。使用箇所（チュートリアル描画・`initLabGuide()` 呼び出し）も両方残存を目視確認。
2. **flash × prob-search**（`app.js`、`sw.js`、`scripts/build-public-site.mjs`）
   - `app.js` 検索結果クリック処理：HEAD 側（検索ライン）の `chapterExtras` 分岐付きハンドラを保持し、flash 側が追加した用語ブックマーク切替ブロック（`termBookmarkToggle`）をその直後に追加。flash 側は基点が prob-app のため `chapterExtras` 分岐を持たなかったもので、欠落ではなく系統差。
   - 一覧2件：flash 側の追加は `flashcards.mjs` のみ。HEAD 側の4モジュール（manuals／tutorials／sim-guide／lab-guide）を保持した上で `study-core.mjs` の直後に追加。
   - `styles.css` は自動マージ（両側の追加が共存）。
3. **highra × solver-settings**（`dynamic/dev/cavity-ui-config.mjs`）
   - highra 側：カーネルの Ra 上限引き上げ（1e6）に伴い、画面側に Ra≤1000 の明示ガード（Rayleigh 数チェック）を追加し、圧力許容値は固定値のまま。
   - solver 側：同じ return の `pressureTolerance`／`maxPressureIterations` を画面設定（`c.*`）から取るよう変更（ガードなし）。
   - 解消：Rayleigh ガード行と、設定値を使う return の両方を保持。画面の受入範囲（Ra≤1000）と解法設定の公開（P5-3）が両立する形が正本の意図と一致する。

## 統合フォローアップ（コミット `f39b77a`）

1. **ガイド追随**：ガイド見直しライン（`717075f`、基点 `2f11b4a` 時点の機能前提）では扱えなかった統合後の新機能について、`guide.mjs` の既存項目へ最小限の段落を追加（項目数は49のまま、件数を固定する `tests/guide.test.mjs`／`tests/coverage.test.mjs`／README 表記と整合）：
   - `search` 項目：単語帳モード（裏返し・シャッフル・裏から表示・ソート3種・章／分野絞り込み）と用語ブックマーク（☆、問題の☆と別保存、「ブックマークのみ」デッキ）。
   - `reader` 項目：付録A・Bは参考文献のみ収録し、付録本文（物性値・換算表）は未収録である旨。
   - `lab` 項目：実験室と一部専用ページの「ガイド」ボタン（ポップアップ式手順案内、次へ／戻る／閉じる、役割は操作順序のみで理論は説明書側）。
2. **配信スイートの前提更新**（下記「検証で見つけた要対応」参照）。

## 検証で見つけた要対応（テスト側の前提更新・アプリ側の不具合ではない）

- `tests/browser-distribution.mjs` の目次件数表明が統合ツリーで失敗（期待76・実測89）。原因：章末問題ボタン11件と付録参考文献ボタン2件も `.toc-item` として目次に並ぶため、「未着手でない目次項目数」は 76+11+2=89 が正しい現行仕様。表明の意図（全76節が利用可能）どおり、セレクタを `.toc-item[data-section]:not(.not-ready)` に限定して76件を数える形に更新した。章末問題系・付録の各ラインが「全体配信スイートは統合弾で回す前提」として繰り延べていた項目の処理にあたる。

## 最終検証（統合ツリーで実測）

- **全 Node スイート**：初回（マージ直後）・最終（フォローアップ込み）の2回とも **1,782件＝1,777合格／0失敗／0中止／5スキップ**、終了コード0（両回のログで一致を確認）。各ライン単独の実測（1,671〜1,693件台）からの増加は、各ラインの新規テストの和集合によるもの。
- **公開ビルド**：成功。dist 棚卸し（実測）：
  - 節データ 76件、章末問題データ 11件、付録参考文献データ 2件（appendix-a／appendix-b）
  - 用語集 504語
  - `dist/dynamic` エントリ **51件**（基点47＋`model-manuals.mjs`＋`model-tutorials.mjs`＋`sim-guide.mjs`＋`lab-guide.mjs`）
  - `dist/flashcards.mjs` 収録、開発専用ファイル（`dynamic/dev/`）の混入 **0件**（`developed-channel.mjs` は公開モジュールであり混入ではない）
- **配信ブラウザースイート全体**（`tests/browser-distribution.mjs`、Chromium）：前提更新後に **全合格**（終了コード0、約25分）。全76詳細講義の確認、問題バンク444件の個別検証、原本PDFとオフライン範囲取得、ガイド・演習・計算・保存・画面幅・キー操作・3表示モードを確認。
- **新機能の実動確認**（Chromium、統合ツリー／配信物）：
  - 章末問題の表示：ガイド見直しのブラウザー検証（章パネル・問題展開）合格。
  - 検索到達：検索語「木星の大気」→ 第11章 問題11.3 の結果をクリックし、章末パネルで該当問題が開くことを確認（補足検証スクリプト）。
  - 単語帳：`tests/flashcards-browser.mjs` 全チェック合格（裏返し・シャッフル・裏から表示・ソート・ブックマーク付け外し・ブックマークのみデッキ）。
  - 付録パネル：目次ボタンから付録Aパネルが開き、参考文献41件・「付録の本文は収録していません」の明示・[A.41] の描画を確認（補足検証スクリプト）。
  - ポップアップガイド：`tests/dynamic-sim-guide-browser.mjs`／`tests/dynamic-sim-guide-screens-browser.mjs` 合格。補足検証でも実験室でステップ送りと Esc クローズを確認。
  - チュートリアル：実験室の説明書内に「手順案内（チュートリアル）」が描画されることを確認。
  - 専用画面3件のプリセット計算：ヒートシンク連成（`tests/dynamic-heat-sink-coupled-browser.mjs` 合格。画面値が核計算と表示桁一致）、共役キャビティ（合格。定常値 q=0.6964472716・τ=2.7 がライン記録と一致）、フィン間流れ（合格）。

## 未実施・繰り延べ残件

- **WebKit は本環境で起動できないため未実施**（従来どおりの環境制約。Chromium のみで検証）。
- 実機・支援技術（画面リーダー）での確認は未実施（各ラインから引き継いだ残件）。
- 各ラインの記録に残るモデル側の適用範囲・残件（例：高Raキャビティの公開昇格は判断事項、強制対流の圧力精度 6.84% は未承認、流路のケース受け口は機構のみ）は本統合では変更していない。監査フェーズで台帳どおり扱う。
- 本統合ツリーの GitHub 配信と公開反映は未実施（親側で別途、節目バーストで実施）。
