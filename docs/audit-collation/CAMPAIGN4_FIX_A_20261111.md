# 照合第4次 修正台帳 ラインA（章末問題・用語集）（2026-11-11）

担当ファイル: `data/chapter-problems/` 全ファイルと `data/glossary.json` のみを変更。他ファイルは変更なし。
方法: Python による原文字列の置換（変更前件数を assert してから置換）。変更した全ファイルで `json.load` による妥当性確認済み。テストスイートは統合側で実施のため未実行。

## 項目別結果

### 1. CF4-P2-5（C4-C11-06）問題11.31 の与件表 — **変更なし（既存データに表が存在することを確認）**
- 指示は「表を追加」だったが、実データを確認したところ、表は既に存在したため追加しなかった（重複追加は誤りになるため）。
- 根拠: `data/chapter-problems/chapter-11.json` の blocks[31] に `table-11-31-1`（caption「表11.31 問題11.31の気象データ」）が、blocks[30] の problem-11-31 の直後・blocks[32] の problem-11-32 の前に配置されている。初出は当初の第11章問題追加コミット（b5da809）で、第4次の基準ツリーにも含まれていた。
- 値の照合: headers = 日付／乾球温度 (°C)／湿球温度 (°C)、rows = 3/15: 15.5／11.0、4/21: 22.0／16.8、5/13: 27.3／25.8、5/31: 32.7／20.0、7/4: 39.0／31.2。記録（PDF 728、600dpi 確認）の値と全行一致。bookPage 714／pdfPage 728 も問題と一致。
- 表示経路の確認: app.js は chapter-problems のブロック列を順に描画し、`table` 型ブロックの描画（行1022）と妥当性検証（行282、headers/rows の文字列配列を要求）が実装されている。同型の表（問題6.47 等）も同じ兄弟ブロック方式。
- 記録側の所見は「problem-11-31 のオブジェクト内に表がない」ことの確認にとどまり、後続の兄弟テーブルブロックを見落としたものと判断する。**統合側の裁定を求める事項として明記する。**

### 2. CF4-P2-4（C4-C08-07）用語集 convective-boiling の帰属修正 — 実施
- ファイル: `data/glossary.json`（エントリ convective-boiling、detail）
- 変更前: 「Chen 型の相関では h_fb/h_lo が対流数 Co と沸騰数 Boi の関数として表される（原典 (9.49)）。」
- 変更後: 「式(9.49) の一般形を持つ相関（h_fb/h_lo を対流数 Co と沸騰数 Boi の関数として表す形）は、Schrock and Grossman、Shah、Gungor and Winterton によって開発され、Kandlikar によってさらに精緻化された。なお Chen のモデルは核沸騰成分と対流成分の重み付き和であり、この形とは別物である。」
- 根拠: 原典 PDF 530 の明記（記録 C4-C08-07 が 600dpi 確認のうえ英語原文を引用）。formula 欄は正しいため変更なし。

### 3. C08-08（記録 C4-C08-09）用語集 nucleation の式修正 — 実施（2件）
- ファイル: `data/glossary.json`（エントリ nucleation の formula と detail）
- `p_sat(T_w) − p_l` → `p_sat(T_sup) − p_ambient`（formula 1件・detail 1件）
- 根拠: 原典 式(9.1)（PDF 492）の印字形。レッスン9.2・問題 book-9-2-bubble-radius は元々 T_sup 表記で正しい（記録どおり）。

### 4. C11-04 用語集 concentration-polarization の帰属付け替え — 実施（3箇所）
- ファイル: `data/glossary.json`（エントリ concentration-polarization）
- detail: 「原典 §11.11 の逆浸透の説明で扱われる。」→「原典 §11.8 の逆浸透の説明（例題11.15）で扱われる。」
- relatedSections: `["11.11"]` → `["11.8"]`
- source.reference: 「原典第11章 §11.11に基づく独立執筆の補足」→「§11.8に基づく」（同じ帰属誤りが残るため併せて修正した。台帳に明記）
- 根拠: §11.11 に逆浸透・濃度分極の記述はなく、原典の扱いは §11.8（例題11.15）（記録 C4-C11-04）。

### 5. C03-02（問題分）訳語「熱伝達率」の統一 — 実施（3件）
- ファイル: `data/chapter-problems/chapter-03.json`。「熱伝達率」→「熱伝達係数」。ファイル全体で出現はちょうど3件であり、全て対象問題内であることを確認してから置換した。
  - 問題3.22 text: 「管内の熱伝達率は1600 W/m²·K」→「熱伝達係数は」
  - 問題3.33 text: 「熱交換器における熱伝達率を決める要因は」→「熱伝達係数を決める要因は」
  - 問題3.41 items[3]: 「空気と液滴の間の熱伝達率は h̄ = 170」→「熱伝達係数は」
- 置換後: 同ファイルの「熱伝達率」残存 0件。
- （§3.1 節本文の1件は節ファイル担当ラインの範囲。）

### 6. C03-03 数式括弧の全角開き／半角閉じ混在の統一 — 実施（5スパン）
- ファイル: `data/chapter-problems/chapter-03.json`。閉じ括弧を半角 `)` から全角 `）` へ。
  - 問題3.30 text ×2: `（C_H2O = 460 W/K)`、`（C_oil = 920 W/K)`
  - 問題3.33 text ×1: `（ṁ_shell)`
  - 問題3.37 text ×2: `（h̄ = 2000 Btu/h·ft²·°F)`、`（T_sat = 170 °F、h̄ = 1500 Btu/h·ft²·°F)`

### 7. C04-09 問題4.43 の ≃ → ≈ — 実施（2件）
- ファイル: `data/chapter-problems/chapter-04.json`、問題4.43 text のみ。
  - `幅 w ≃ D_w` → `幅 w ≈ D_w`、`長さ l ≃ 2D_w` → `長さ l ≈ 2D_w`
- 同ファイルに残る ≃ 1件は問題4.14 内のもので、対象外のため変更していない（記録どおり使い分けが正しい箇所）。

### 8. C07-05 問題7.42 の合成済み文字の統一 — 実施（8件）
- ファイル: `data/chapter-problems/chapter-07.json`、問題7.42（text・formulaBlocks）。同ファイル内の合成済み ū/ȳ はこの問題だけであることを機械計数で確認。
  - ū（U+016B）×5 → `u` + U+0304
  - ȳ（U+0233）×3 → `y` + U+0304
- 置換後の問題7.42 内訳: u+U+0304 が5件、y+U+0304 が3件、既存の x+U+0304 が3件で、符号化方式が基底文字＋結合マクロンに統一された。

### 9. C08-01 問題8.53（続き）の単位の中点除去 — 実施（1件）
- ファイル: `data/chapter-problems/chapter-08.json`、問題8.53 continuation。
  - `c_p = 2314 J/kg·K` → `c_p = 2314 J/kgK`（原典 PDF 479 は中点なし）
- 直後の `k = 0.0247 W/m·K` の中点は原典どおりのため保持した。

### 10. ADJ-1（問題分）U+224A → U+2245（≅） — 実施（4件）
- ファイル: `data/chapter-problems/chapter-11.json`。ファイル全体で U+224A はちょうど4件で、全て対象問題内。
  - 問題11.52 text ×1: `γ ≊ (D + 2)/D` → `γ ≅ (D + 2)/D`
  - 問題11.56 text ×1・items[1] ×2: `x_n ≊ 1`、`v⃗* ≊ v⃗_n ≊ v⃗` → いずれも ≅
- 置換後: 同ファイルの U+224A は0件、U+2245 は3件→7件。

### 11. ADJ-2（問題分＋用語集内担当分）µm のコードポイント — 実施（19件、全件変換）
- 判定方法: `data/chapter-problems/` 全ファイルと `data/glossary.json` について、U+03BC の直後に `m` が続く箇所を全数抽出し、文脈（数値＋単位の形）を1件ずつ確認した。全件が波長・直径・厚さ・粗さ・細孔半径といった長さの単位用法であり、粘度 µ_m 型の記号用法はなかったため、全件を U+00B5 へ変換した。
- 章末問題分（18件）:
  - chapter-01.json ×4: 問題1.30 items 内「波長0から50 μmまで」「0から5 μmまで」「4 μm未満」「4 μmを超える」（波長）
  - chapter-05.json ×1: 「直径100 μm」（フィラメント径）
  - chapter-07.json ×3: 「直径4 μm」（白金線）、「フィルムの厚さは150 μm」、「等価砂粒粗さ500 μm」
  - chapter-09.json ×1: 問題9.24「直径2 μm のピット」（記録 C4-C08 の範囲外申し送り分）
  - chapter-10.json ×8: 「λ = 0.2 μm と 0.65 μm」（2件）、answerHint「ε_0.65μm」、表10.6 headers「λ (μm)」、「14387.8 μm·K」、表10.7 caption「λT（μm·K）」、「λ_band = 1.11 μm」、「表面粗さが約10 μm」
  - chapter-11.json ×1: 「初期直径が0.2、0.5、1、2、5 μm の場合」（液滴径）
- 用語集分（1件）: glossary.json、capillary-pressure の example「r_eff=15 μmなら圧力尺度2000 Pa」（細孔半径）
- 逆方向の点検: `data/chapter-problems/` 全ファイルで U+00B5 の出現は0件であり、記号用法への混入はなかった。用語集の U+00B5 3件は記録 C4-C08-08 が単位用法として対照確認済みのもの。
- 置換後: chapter-problems 全ファイルで U+03BC＋m の残存は0件。

## 変更ファイル一覧（git diff --stat）
- data/chapter-problems/chapter-01.json（ADJ-2 ×4）
- data/chapter-problems/chapter-03.json（C03-02 ×3、C03-03 ×5スパン）
- data/chapter-problems/chapter-04.json（C04-09 ×2）
- data/chapter-problems/chapter-05.json（ADJ-2 ×1）
- data/chapter-problems/chapter-07.json（C07-05 ×8、ADJ-2 ×3）
- data/chapter-problems/chapter-08.json（C08-01 ×1）
- data/chapter-problems/chapter-09.json（ADJ-2 ×1）
- data/chapter-problems/chapter-10.json（ADJ-2 ×8）
- data/chapter-problems/chapter-11.json（ADJ-1 ×4、ADJ-2 ×1）
- data/glossary.json（CF4-P2-4、C08-08 ×2、C11-04 ×3箇所、ADJ-2 ×1）
- chapter-02.json・chapter-06.json は対象がなく変更なし。
