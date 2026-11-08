# 章末問題・参考文献 翻訳データ作成記録（2026-11-07）

## 目的と決定

- ユーザー決定（2026-11-07 22:48）：教科書 *A Heat Transfer Textbook*, 6th edition の
  章末問題（Problems）と参考文献（References）を翻訳してアプリに収録する
  （保留事項の解消。「より高度で多機能で使いやすく」の方向）。
- 本ラインの範囲は **データ作成まで**。アプリへの表示統合は後続ラインで行う。
- ブランチ：`feiris/chapter-problems-translation`（基点＝統合先端 `34b84ad`）。
  ローカルコミットのみ（push・PR なし）。

## 成果物と件数照合

データ：`data/chapter-problems/chapter-01.json` 〜 `chapter-11.json`（全11章）。

| 章 | 章タイトル（原文） | 問題（原文） | 問題（データ） | 参考文献（原文） | 参考文献（データ） |
|---|---|---|---|---|---|
| 1 | Introduction | 46 | 46 | 22 | 22 |
| 2 | Heat conduction, thermal resistance, and the overall heat transfer coefficient | 49 | 49 | 10 | 10 |
| 3 | Heat exchanger design | 44 | 44 | 13 | 13 |
| 4 | Analytical and numerical solutions of heat conduction problems | 45 | 45 | 10 | 10 |
| 5 | Transient and multidimensional heat conduction | 66 | 66 | 25 | 25 |
| 6 | Laminar and turbulent boundary layers | 51 | 51 | 37 | 37 |
| 7 | Forced convection in a variety of configurations | 51 | 51 | 49 | 49 |
| 8 | Natural convection in single-phase fluids and during film condensation | 59 | 59 | 42 | 42 |
| 9 | Heat transfer in boiling and other phase-change configurations | 38 | 38 | 80 | 80 |
| 10 | Radiative heat transfer | 56 | 56 | 39 | 39 |
| 11 | An introduction to mass transfer | 58 | 58 | 83 | 83 |
| **合計** | | **563** | **563** | **410** | **410** |

照合方法：検証スクリプト `scripts/check-chapter-problems.mjs` が、原文テキスト層
`ahtt.txt` から作成時と同一の分割規則（章ごとの Problems / References 見出し行、
連番受理、走行見出し・フッタページ番号の除去、ページ換算 PDF = 書籍 + 14）で
原文側の件数・連番・各エントリの開始ページを再導出し、データ側と機械的に照合する。
さらに全ブロックを app.js の `validBookBlocks` / `validBookFigure` と同じ規則で検証する。
実行結果：**全11章で件数・連番・ページが一致し、全ブロックが検証を通過**（2026-11-07 実行）。
ahtt.txt は公開リポジトリに含まれないため、このスクリプトは通常のテストスイート
（`npm test`）には組み込んでいない（スイート件数を基点のまま維持するため）。

## 形式設計

節データ（sections-ja）と同系のエンベロープを持つ章別 JSON とした。

```json
{
  "chapterId": "chapter-01",
  "language": "ja",
  "source": "A Heat Transfer Textbook, 6th edition, Chapter 1 (Introduction): Problems and References — Japanese translation",
  "bookPages": "36–48",
  "pdfPages": "50–62",
  "status": "complete",
  "problems":   { "heading": "問題",     "count": 46, "blocks": [ ... ] },
  "references": { "heading": "参考文献", "count": 22, "preambleBlocks": [ ... ], "blocks": [ ... ] }
}
```

設計根拠：

- アプリ既存の本ブロック検証 `validBookBlocks`（app.js）には `problem` と
  `reference` のブロック型が既に定義されており、節データと同じ検証系にそのまま
  乗せられる。問題・参考文献ともこの2型を使い、表示統合ラインは既存レンダラの
  拡張で対応できる。
- `problem` ブロックのフィールドは既存レンダラが解釈する範囲に合わせた：
  `number`、`text`（本文）、`items`（小問。レンダラは番号を付けないため
  「（a）」等のラベルは文字列に含める）、`continuation`（小問の後の本文）、
  `hint`、`answerHint`（本書に印刷された一部解答。レンダラは数式変換せず
  そのまま表示するため、平文＋ユニコードで記述）、`formulaBlocks`
  （`expression` と任意の `part`）、`figure`（`figureNumber` / `caption` /
  `alt` / `bookPage` / `pdfPage`。原図は権利方針により `src` を持たない）、
  `figureRefs`、`sourceNote`（`{ja, en}`）、`bookPage` / `endBookPage` /
  `pdfPage` / `endPdfPage`。
- 本書に印刷されたデータ表（問題6.47/6.48/6.49、10.48 の表10.6、
  10.52 の表10.7、11.31 の気象データ）は `table` ブロックとして、
  対応する問題ブロックの直後に配置した。`problems.count` は問題ブロックのみを数える。
- `reference` ブロックは書誌情報を構造化した：`authors`（原文のまま、
  団体著者・編者表記を含む）、`originalTitle`（原題）、`titleJa`（題名の和訳）、
  `publication`（出版社・誌名・年・ページ等、原文のまま）、
  `noteJa` / `noteEn`（本書自身の付記 ― 復刻・オープンアクセス等の注記 ― の和訳／原文）、
  `url`、`doi`（本文中に存在する場合に機械的に分離。テキスト層の改行由来の
  空白は除去した）。
- 第1章のみ、Problems と References の間に置かれた
  "Bibliography of Historical and Advanced Texts"（歴史的文献と発展的テキストの
  文献案内）を `references.preambleBlocks` として翻訳収録した。
- 数値表記の方針は本文翻訳と同一：°C、W/m²、W/m·K、式（1.16）式の参照表記、
  下付きは `_` 記法、上付きは `^(...)` / `^数値` 記法、オーバーラインは
  結合マクロン（h̄ 等）。数値・単位・式番号・問題番号は原文どおり保持した。

## 範囲外

- 付録A・付録Bの参考文献（[A.n] / [B.n]）は本タスクの対象外（章末の
  Problems / References のみ）。必要になれば別ラインで追加できる。

## 原文の印刷上の不整合（原文値を保持し、注記したもの）

データ側に `sourceNote` を付けたもの：

- **問題1.21**：原文 "on either side if the wall"（of の誤植とみられる）。
  意味に従って翻訳し、注記した。
- **問題3.29**：原文 "Could a different configuration would reduce the
  irreversibility" と文法が乱れている。意味に従って翻訳し、注記した。
- **問題5.28**：印刷された一部解答が "[q = 338 W/m2 K]" で、熱流束に対して
  単位が W/m²·K になっている。値を保持し、単位の誤植らしい旨を注記した
  （PDF ページ画像でも確認）。
- **問題5.30**：印刷された一部解答 "[Q = 1.0 kW]" が、与えられた
  2 cm 球の条件（形状係数からの見積もりで最大でも数 W 程度）と桁が合わない。
  値を保持し、誤植の疑いとして注記した（断定はしていない）。
- **問題5.55**：有効熱伝達係数の単位が "W/m·K" と印刷されている
  （W/m²·K の誤植とみられる）。値を保持し、注記した。
- **問題7.36**：一部解答の単位が "11.2 kW/m²" と印刷され、求める量である
  熱伝達係数の K が欠けているように見える。値を保持し、注記した
  （PDF ページ画像でも確認）。
- **問題8.53**：与えられた物性データで粘度 µ の単位が "kg/m³" と印刷されている
  （kg/(m·s) の誤植とみられる）。数値・単位を保持し、注記した
  （PDF ページ画像でも確認）。
- **問題10.56**：吸収成分が "12% by volume of CO2 and 18% CO2" と印刷され、
  ヒントも "emissivities of CO2 and CO2" となっている。第2の CO₂ は
  H₂O の誤植とみられるが、原文の表記のまま保持し、注記した。
- **問題11.21**：相互参照が "(see Problem prob:12.33)" と印刷されており、
  未解決の LaTeX 参照ラベルが残っている。原文どおり保持し、注記した
  （PDF ページ画像でも確認）。

記録のみに留めた軽微なもの（翻訳は意味に従った）：

- 問題5.27 "After after 0.2 s"（after の重複。ページ画像で確認）。
- 問題5.56 "The consider the parameter ψ"（Consider の誤植とみられる）。
- 問題5.62 "How to these values"（文法の乱れ）。
- 問題9.21 "can be adapted subcooled flow boiling"（to の欠落とみられる）。
- 問題11.5 "A what rate does H+ flow away"（At の誤植。ページ画像で確認）。
- 問題11.36 "evaporate rapidly dry air"（in の欠落とみられる。ページ画像で確認）。

## 図データの復元方法

- 原図そのものは収録しない（権利方針）。図番号・キャプション・alt テキストのみ。
- テキスト層では、図のラベルやキャプションが隣接する問題の段落に混入している
  箇所が複数あった（例：第1章の Fig. 1.17〜1.22 のラベル群、第2章の
  Fig. 2.22/2.23 の寸法）。これらは正しい問題へ付け替え、値を問題文と
  figure の alt に反映した。
- ラベルがテキスト層になく図像内のみにあり、問題がその値に依存する場合は、
  該当 PDF ページを `pdftoppm` で描画して読み取った
  （第1章 pp.53–56、第2章 pp.102–103、第5章 pp.273/279 の一部解答確認、
  第6章 pp.356–357 の公式確認、第7章 pp.404–405 の 7.36/7.42、
  第8章 p.465 の 8.53/8.55/8.57、第9章 pp.531–533 の 9.21/9.29/9.34/9.38、
  第11章 pp.708/711/712/715/716 の 11.5/11.6/11.18/11.19/11.21/11.24/11.34/11.41）。
  特に Fig. 1.17（問題1.12）は、テキスト層のラベル順が示す左右と図像が
  異なっており、図像を正として左右の条件を取り違えないよう記録する：
  左板の外側は T_∞ = 100 °C・h = 50 W/m²·K、右板の外側は T_∞ = 20 °C・
  h = 20 W/m²·K。
- 問題文中に紛れ込んだ本文側の図キャプション・サイドバーは問題文に含めない：
  問題5.24 の卵調理サイドノート、問題9.6 の途中に差し込まれた
  Fig. 9.23 の写真キャプションは除外した（問題文自体は連続文として復元）。
  問題2.45 の "(Continues on next page.)" は改ページ上の案内文のため訳出していない。

## ビルド・スイートへの影響

- `data/chapter-problems/` は公開ビルド（`scripts/build-public-site.mjs`）の
  許可リストに含まれないため、dist にはコピーされない。ビルドゲート
  （節ファイルちょうど76件）にも触れていない。
- ビルド後の dist を基点スナップショット（237ファイル、SHA-256）と照合：
  **全ファイル一致・無変化**（本書記録の最終検証節を参照）。
- 全 Node スイート：基点 1,671 件（1,666 合格 / 0 失敗 / 5 スキップ）の維持を
  最終検証で確認した（次節）。

## 制限・正直な留保

- figure の alt テキストは、キャプションと問題文に基づく記述であり、
  ページ描画で実物を確認した図（上記）以外は図像そのものの精密な描写ではない。
  表示統合ラインで原図参照が必要になれば、該当ページを個別に確認すること。
- 式の組版がテキスト層で崩れていた箇所（問題6.21 の速度分布、
  問題7.42 の方程式群など）は、ページ描画または当該分野の標準形で復元した。
  復元にページ描画を使ったものは上記の確認ページ一覧に含まれる。
- 参考文献の `publication` は原文の表記を保持しており、書誌情報そのものの
  正しさ（誌名・ページの誤り等）は検証対象外（原文どおりが原則）。

## 最終検証（2026-11-07 実測）

- 件数照合：`node scripts/check-chapter-problems.mjs` を実行し、全11章で
  原文再導出と データが件数・連番・開始ページまで一致、全ブロックが
  `validBookBlocks` 相当の検証を通過（問題 563 件・参考文献 410 件）。
- 全 Node スイート（`npm test`、最終先端で実行）：**tests 1671 /
  pass 1666 / fail 0 / skipped 5、EXIT=0**。基点（統合先端 34b84ad）と
  完全一致し、失敗 0 を維持した。実行時間は約16分（他ラインの並行実行で
  VM が高負荷だったため。通常より長い）。
- 公開ビルド（`npm run build:public`）後の dist を基点スナップショット
  （237ファイルの SHA-256 一覧）と照合：**全ファイル一致・無変化**。
  本ラインの追加は `data/chapter-problems/` と本書・検証スクリプトのみで、
  アプリ本体・ビルド・スイートのいずれからも参照されていないことを
  grep でも確認した。
- 基点スイートの事前実測は、高負荷で汚染された実行ログだったため破棄し、
  上記の最終先端での実測を正式な結果とする。

## 残件

- アプリへの表示統合（章末問題・参考文献の閲覧 UI）は後続ライン。
  その際、`data/chapter-problems/` を公開ビルドの許可リストへ加えるか、
  ローカルコンテンツとして載せるかは統合ライン側で判断する。
- 付録A・付録Bの参考文献（[A.n] / [B.n]）は対象外のまま。
