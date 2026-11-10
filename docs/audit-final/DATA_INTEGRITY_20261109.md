# フェイリス側最終監査ラインC：データ整合性の再点検

- 対象ツリー：`audit/integration-loop3` 先端 `54b55ac`
  （`fix: wrap question meta row so .question-actions stays inside the card at phone widths (A5-L3-F01)`）
- 実施日時：2026-11-09（JST）
- 監査のみ。製品コード・データへの変更なし。dist/ は gitignore 対象のビルド成果物のため、項目3の実測用に現行ツリーから `npm run build:public` を実行した（追跡ファイルへの変更なし）。
- 数値はすべて実測値。未実施のブラウザースイート（Chromium 配信テストの完走）には言及しない。

## 1. 問題カバレッジの再集計

### 1.1 `docs/audit-round3/check-coverage-r3.mjs` の実行結果（現行データに対する再実行）

```
codex round 2: receipts 41, valid 41, invalid []
Muse round 3: receipts 289, valid 288, invalid ["supp-next-local-versus-average-v1"]
{
  "total": 751,
  "muse_round2_claims": 422,
  "codex_round2_receipts_valid": 41,
  "muse_round3_receipts_valid": 288,
  "covered_union": 750,
  "uncovered_count": 1,
  "uncovered": ["supp-next-local-versus-average-v1"]
}
```
exit code 1（未カバー1件が残るため、スクリプトの設計どおり）。旧レシート集合だけでは 750/751。

無効になった1件は、Codex 第3回所見 C3-Q01 の指摘（選択肢の全称命題）に基づく文案改訂で内容が変わった問題そのものであり、改訂前のレシート（content_sha256 `5b5d0ee9…`）が現行データと一致しなくなったためである。内容の改訂をレシートの失効として扱う仕組み自体が正しく働いている。

### 1.2 補足レシートの機械確認（`docs/audit-collation/evidence/q01-revised-receipt.json`）

`check-coverage-r3.mjs` と同一の検証規則（`scripts/audit-question-coverage.mjs` の `questionEvidenceHash` 一致、独立選択＝保存キー、作業解の非空）で検証した：

| 検査項目 | 実測 |
|---|---|
| 対象問題の存在 | `supp-next-local-versus-average-v1`、現行 revision `v2` |
| レシートの content_sha256 | `064b6e86e689e7b629127c02e0d4afa0a4a4ef051949faed9f3c5a0e056b1e9d` |
| 現行データからの再計算ハッシュ | `064b6e86e689e7b629127c02e0d4afa0a4a4ef051949faed9f3c5a0e056b1e9d`（一致） |
| 保存キー（answer） | 3 |
| 独立選択（independent_choice_index） | 3（保存キーと一致） |
| 作業解（working） | 非空 |
| 選択肢文（selected_text）と現行選択肢[3] | 一致（「局所値と平均は別の量であり、平均には分布の積分が必要」） |

### 1.3 合計

- 旧レシート集合（第2回 claims 422＋Codex 第2回レシート41＋第3回レシート288有効）＝ **750**
- 補足レシート（1件・有効）＝ **+1**
- **合計 751/751、未カバー 0 件。**

旧レシートの失効は `docs/audit-round3/evidence/independent-289.json` を改変せず、補足レシートが別ファイルで差し替える形で記録されており、歴史的記録の改ざんはない。

## 2. 用語集の重複排除の不変条件（全504用語）

`term-links.mjs` の実ヘルパー `withoutRepeatedLead` を通し、`app.js` の用語カード／単語帳裏面と同一の式（summary＝brief||meaning、meaningBody＝withoutRepeatedLead(meaning, summary)、detailBody＝detail を meaning と summary で順に処理）で全用語を再計数した：

| 指標 | 実測 |
|---|---|
| 用語総数（`data/glossary.json`） | 504 |
| 生データで brief と meaning が完全一致 | 433（第2回照合の計数と一致） |
| brief が meaning の真の接頭辞 | 46 |
| 処理後に meaningBody が空（定義が brief に完全に吸収される） | 433（完全一致の433件と同一集合） |
| 処理後も本文に brief 全文が残存（重複表示）— meaningBody 側 | 0 |
| 同上 — detailBody 側 | 0 |
| 復元検査（summary＋remainder が meaning と一致しない） | 0 |
| 展開表示が実質空になる用語（meaningBody 空 かつ detail/beginner/unit/formula/example のいずれもなし） | **0** |

判定：重複排除は描画ヘルパーで成立しており、定義文の欠落もなく、展開後に中身が空になる用語も存在しない。433件の meaningBody 空は設計どおりの挙動（定義は brief として1回だけ表示される）であり欠陥ではない。EN 経路でも完全一致は433件で、残余は常に空だった。

## 3. オフライン完全性（公開ビルド dist の実測）

`npm run build:public`（成功）で生成した dist の `sw.js` の `APP_SHELL` を実測：

| 指標 | 実測 |
|---|---|
| APP_SHELL エントリ総数 | 255 |
| 節データファイル（`data/sections/*-ja.json`） | 76（ソース76件、dist 内76件と一致、未登録 0） |
| `dynamic/` ラボファイル | 50 |
| PWA アイコン | `./assets/icon.svg`、`./assets/icon-192.png`、`./assets/icon-512.png`（3件とも登録あり） |
| APP_SHELL の各エントリが dist 内に実在するか | 不足 0 |
| アイコン PNG の実寸（IHDR） | icon-192.png＝192×192、icon-512.png＝512×512（PNG 署名確認済み） |
| dist/manifest.json の icons | icon.svg／icon-192.png／icon-512.png の3件 |

判定：第1回 P1（初回オフラインで節ファイルがプリキャッシュされない）の再発なし。76節・ラボファイル・アイコンがすべてプリキャッシュ対象であり、エントリの実在も確認済み。

## 4. 学習記録の整合（C2-SESSION-01）

- `sessionSummaryMismatch` は `study-core.mjs:306` に定義され、`app.js` で import されたうえ、学習記録の日別詳細描画（`app.js:1408` 付近）で「保存時集計：N問 · 正解 M問」の表示とともに、不一致時に注記（「保存時集計と詳細回答の件数が一致しません。この日の回答数・正解数は上の回答履歴の集計を確認してください。」）を表示する配線が残っている。
- 対象テスト `tests/audit-round02.test.mjs` の `inconsistent session detail is identified without changing legacy snapshots` を単体実行：**pass 1 / fail 0**（スナップショットの保存値は変更しない設計で、不一致が検出される）。

判定：C2-SESSION-01 の修正（不一致フラグ表示・保存値の温存）は現行コードに残っており、テストで確認済み。

## 5. 全 Node スイートの最終値

実行経緯（正直な記録）：初回実行（`npm test` をパイプ経由で実行）は約147秒で SIGTERM により終了し出力が一切得られなかった。途中で結果として取り込まれた数値ブロックは、その所要時間がプロセス生存時間と矛盾したため採用しなかった。その後、ファイル出力で再実行し、完走した実測が以下である（プロセス所要時間 約478秒、テストランナー報告 duration_ms 477,331.93、整合）。

`npm test`（`node --test tests/*.test.mjs`）再実行の実測（マスクなし、ログ末尾）：

```
tests 1798
pass 1793
fail 0
cancelled 0
skipped 5
todo 0
SUITE_EXIT=0
```

判定：第3回統合後の最終値（1,798＝1,793/0/5）と一致し、劣化なし。

## 総合

ラインCの項目1〜4では、想定と異なる結果は出なかった：

1. カバレッジ：旧レシート750＋補足レシート1＝**751/751** を機械確認。
2. 用語集：重複表示 0、展開表示が空になる用語 0（504用語全数）。
3. オフライン：APP_SHELL 255件に76節・dynamic/ 50件・アイコン3件を含み、全エントリが dist に実在。
4. セッション整合：C2-SESSION-01 のフラグ配線が残存し、対象テスト pass。
5. 全スイート：初回実行は SIGTERM で出力なしに終了したが、再実行が完走し **1,798件＝1,793 pass / 0 fail / 5 skip（SUITE_EXIT=0）** を実測（§5に経緯を記録）。

新規所見なし。本記録はコミットしない（親側の指示どおり）。

新規所見なし。本記録はコミットしない（親側の指示どおり）。
