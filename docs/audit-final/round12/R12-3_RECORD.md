# R12-3 記録 — 回帰テスト＋使い倒し（A5）

- ライン: Muse 監査第12回 R12-3
- 実施日: 2026-11-11
- 作業クローン: ~/workspace/dev/heat-r123、HEAD `6ea18bc`（Round 12 brief。第7次修正 A／B／C 適用済みツリー）
- 指示書: `docs/audit-final/round12/R12_BRIEF_20261111.md` の R12-3 節
- データ変更: なし（本ラインは検証専任。不合格の指摘は本記録に留める）

## 結論

- フルスイート: **1,939件 ＝ 合格 1,933 ／ 失敗 1 ／ スキップ 5（exit 1）**。失敗は1件のみで、第7次修正 C-4 の公開コピーへの伝播漏れ（所見 F01）。
- ビルド: `npm run build:public` **成功**（初回は node_modules 未導入で失敗し、`npm ci` 後に成功。アプリの欠陥ではない）。
- 設問カバレッジ: **751/751 を維持**（チェッカー exit 0、uncovered 0）。再発行は不要。
- A5（Chromium、375px／1280px）: 自動チェック 106件中 104 合格。残る2件の FAIL は §10.4 並び順チェックの手法上の人工物であり、DOM 順プローブによる再測定で正しい並びを両幅で確認した。アプリ側の A5 所見はゼロ。
- 新規所見: F01 の1件のみ（内容面は P3 相当。ただしスイートを赤にするため、収束判定・公開前に解消必須）。

## 1. フルスイート

- コマンド: `node --test tests/*.test.mjs`（ログ: `work-r123-suite.log`）
- 結果: tests 1939 / pass 1933 / fail 1 / skipped 5、SUITE_EXIT=1

### 失敗の内訳（1件のみ）— 所見 R12-3-F01

- テスト: `tests/original-section-questions.test.mjs:11:1`「Source question content must remain unchanged except for its cognition tag」（アサーションは同ファイル :63、`deepStrictEqual`）
- 対象設問: `supp-section-6-1`（§6.1 補助設問）
- 差分フィールド: `explanation` と `distractors[0]` の2箇所のみ。各1回の語句差で、原本 `data/original-section-questions.json` は「熱伝達係数h」、公開コピー `data/questions.json` は旧表記「熱伝達率h」のまま。
- 実測カウント（supp-section-6-1 の JSON 全体を対象に機械計数）:
  - 原本: 「熱伝達率h」2回（いずれも複合語「対流熱伝達率h」内、C-4 の保持対象）＋「熱伝達係数h」2回
  - 公開コピー: 「熱伝達率h」4回 ＋「熱伝達係数h」0回
- 原因: 第7次修正 C-4（コミット `69a20ba`）が原本・ノート二重台帳・派生設問ファイルの「熱伝達率h」→「熱伝達係数h」統一を行ったが、公開コピー `data/questions.json` への伝播が漏れた。原本側の変更自体は用語統一境界（記号拘束用法は「熱伝達係数」）に沿っており正しい。誤りは公開コピー側の未同期である。
- 必要な後続手順（統合側で実施）: `data/questions.json` の supp-section-6-1 の `explanation` と `distractors[0]` を原本の文言（熱伝達係数h）に同期し、当該テストファイル単体 → フルスイートの順に再実行する。本ラインはデータ変更禁止のため実施していない。

## 2. ビルド

- 初回 `npm run build:public` は `ERR_MODULE_NOT_FOUND: Cannot find package 'esbuild'` で失敗。新規クローンに `node_modules` が無かったため。
- `npm ci`（added 4 packages、exit 0、ログ `work-r123-npmci.log`）の後に再実行し、**成功（exit 0**、ログ `work-r123-build.log`）。

## 3. 設問カバレッジ

- チェッカー: `node docs/audit-collation/check-coverage-reissue.mjs`（exit 0、ログ `work-r123-coverage.log`）
- 結果: total 751、covered_union 751、uncovered 0 → **751/751 を維持**。
- 内訳: Muse round 2 claims 422、Codex round 2 valid 33/41、Muse round 3 valid 255/289、Q01 supplement 1/1、part-2 reissue 56/56、campaign-4 reissue 6/6。
- チェッカー出力の `changed_56_prior_coverage`（56 ID）は従来どおりの定常出力であり、旧レシートが無効な ID も他レシートでカバーされ uncovered は 0。再発行は不要。
- F01 の対象 `supp-section-6-1` は changed リストに含まれず、そのカバレッジ・レシートは有効なまま（今回の差分はハッシュに影響しない）。

## 4. 使い倒し（A5）

- 手法: ビルド済み `dist` を `scripts/serve.mjs`（port 4195）で配信し、Playwright の Chromium ヘッドレスで 375px と 1280px の両幅で実際に開いて確認した。用語集は検索 → トグル → `details.term-full` を開いて本文を読んだ。スクリプト `work-r123-a5.mjs`、ログ `work-r123-a5.log`、代表スクリーンショット4点（問題6.47／6.48、§10.4、§11.10、いずれも 375px）を目視確認した。
- 総計: **106件中 104 合格 ／ 2 FAIL**（2件とも §10.4 並び順チェックの手法上の人工物。是正プローブで合格を確認。下記）。
- 項目別結果（両幅とも同一）:
  - 問題6.47・6.48: 章末問題の表見出しが「St × 10³」と表示され、「St × 10⁻³」は存在しない（B-1 の P2 修正が表示に反映）。375px スクリーンショット目視でも表・数値の崩れなし。
  - 用語集 viscous-sublayer: 原典 §6.7 の y⁺≲7 を主記述とし、汎用慣例 y⁺≲5 は「目安とすることもある」と併記。旧誤帰属文（≲5 を原典とする文）は不在。
  - 用語集 buffer-layer: 7 < y⁺ < 30（原典 §6.7）が主記述で、汎用分類 5≲y⁺≲30 を併記。
  - 用語集 biot-number: 「原典は Bi ≲ 0.1 で…」と表示され、「Bi < 0.1」の帰属文は不在。
  - 拡大した7節のリーダーメタ: §10.1 書籍 p.543–551 · PDF p.557–565／§10.3 p.555–567 · p.569–581／§10.4 p.567–581 · p.581–595／§10.5 p.581–594 · p.595–608／§11.1 p.621–624 · p.635–638／§11.2 p.624–632 · p.638–646／§11.4 p.638–647 · p.652–661 — 全て新範囲で表示。
  - 例題11.17 の注記（§11.10 内）: Ωμ の原書不整合の訳注が表示される（「原書側の不整合であり、値はいずれも原書のまま保持した。」を含む）。
  - 図11.27 の説明文: 横軸「モル分率 x₁（Mole fraction、0〜1）」の記述が表示される。
  - 全ページで横はみ出し overflow=0、pageerror=0。文字切れ・レイアウト崩れは検出されなかった。

### §10.4 式ブロックの並び（B-7）の検証経緯

- 一次チェック（`innerText` の `indexOf` による単調性判定）は両幅で FAIL となった。しかしこれは手法の欠陥である: 式番号 (10.41)・(10.42)・(10.44)・(10.45) は (10.39) ブロック等の解説文の中でも参照されて先行出現するため、平坦化テキスト上の位置では表示順を測れない（実測位置の例、375px: 10.39@3347、図10.17@18943、10.40@19316 に対し 10.41@3566、10.42@3494、10.43@6256、10.44@3502、10.45@3510）。
- 是正プローブ `work-r123-a5b.mjs`（`figure.formula-block`／`figure.book-figure` の DOM 文書順を列挙、port 4196）で再測定した結果、両幅とも「… Eq(10.38) Fig10.16 **Eq(10.39) Fig10.17 Eq(10.40) Eq(10.41) Eq(10.42) Eq(10.43) Eq(10.44) Eq(10.45)** Fig10.18 …」と連続し、目標列が位置 23–30 に単調に並ぶことを確認した（PASS、ログ `work-r123-a5b.log`）。B-7 の並び替えは実際の表示上も正しい。

## 5. 未実施（未実施として区別する）

- WebKit: この VM では起動できないため未実施。
- Firefox、実機、スクリーンリーダー: 未実施。

## 6. 新規所見一覧

- **R12-3-F01（要修正）**: `supp-section-6-1` の公開コピー未同期（§1 に詳述）。第7次修正 C-4 の伝播漏れ。統合側で `data/questions.json` を原本に同期し、再検証すること。
- A5 のアプリ所見: ゼロ（2件の FAIL は検証手法側の人工物であり、是正プローブで合格を確認済み）。

## 添付ログ（クローン内に保存、記録ファイルのみコミット）

- `work-r123-suite.log`／`work-r123-build.log`／`work-r123-npmci.log`／`work-r123-coverage.log`／`work-r123-a5.log`／`work-r123-a5b.log`
- スクリプト: `work-r123-a5.mjs`／`work-r123-a5b.mjs`
- スクリーンショット: `work-r123-shot-problem-6-47-375.png`／`work-r123-shot-problem-6-48-375.png`／`work-r123-shot-10-4-375.png`／`work-r123-shot-11-10-375.png`
