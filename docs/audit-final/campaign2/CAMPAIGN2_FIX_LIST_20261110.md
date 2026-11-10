# 全ページ照合キャンペーン第2次 — 統合修正リスト（2026-11-10）

## ヘッダ

- 入力: コーディネーター記録12件（`CAMPAIGN2_C01_20261110.md` 〜 `CAMPAIGN2_C12_20261110.md`、PDF 1–810 全810ページ照合済み）。
- 登録所見総数: **487件（P1 3 / P2 29 / P3 455）**。コーディネーター別: C01 27（P2×1）、C02 48（P2×1）、C03 61（P1×1・P2×1）、C04 28（P2×2）、C05 30（P2×2）、C06 38（P2×1）、C07 70（P1×2・P2×5）、C08 41（P2×6）、C09 45（P2×4）、C10 42（P2×5）、C11 57（P2×1）、C12 0。
- 重複排除の内訳: **登録 487 → 真の重複 −0 → クラス集約による統合 −374 → 統合リスト 113件（P1 3 / P2 29 / P3 81）**。
  - 真の重複（同一ファイル・同一箇所・同一内容の二重登録）は0件。検討した近接ペア: (i) 第5章章末問題の h̄ 脱落は C04（問題5.4/5.7/5.12/5.24）と C05-06（問題5.27–5.56b）が別問題を分担し重複なし。𝒯 平坦化も C04-24（5.1–5.3）と C05-09（5.52/5.54/5.58）で別問題。(ii) 問題8.45 items[0] の h̄_o は C07-70 として登録済みであり、C08-F12 内の言及は未検証の付記（C08 担当範囲外）であって二重計上していない。(iii) C03-61（問題4.17 の w16/w17 両側検出）、C10-12（W2/W3 両側検出）、C10-15（W9/W10 候補統合）、C11 の W5 A1–A8・W10-C4 は各記録内で統合済みで、各1件として計数されている。
  - クラス集約 −374 は、同一クラスの複数登録を1つのクラス項目（CF2-033〜053）に束ねたことによる減数。各クラス項目は全出典を併記しており、出典数の合計は 487 に戻る（検算: P1 3 + P2 29 + クラス項目の出典 395 + P3 個別項目 60 = 487）。
- 跨ぎ確認（中央裁定事項）: C08 が未検証として残した問題9.17 の尾部（PDF 544→545）は、C09 の w01 パケット（PDF 545–548、問題9.17尾部〜9.38＋文献[9.1]–[9.10]）で照合されており、9.17 固有の登録所見はない（w01 の登録は C09-04・C09-05 のみ）。C08 の未検証分は解消した。
- 中央裁定の反映:
  - Δ コードポイント混在（U+0394 vs U+2206、C07-39/C07-52）は所見として存続（P3、CF2-041）。μ U+00B5 クラス（CF2-040）と同扱い。
  - C05-07（問題5.63 漸近式の指数脱落、CF2-009）と C10-39（例題11.9 erf 解の 𝒟_{im1} 添字脱落、CF2-031）は P2 を維持し、境界注記（P1 判定の余地）を残す。C10-38（§11.6 式(8.4) 表示欠落、CF2-030）も P2 を維持（格下げ余地の注記付き）。
  - スクリプト 𝓂（U+1D4C2）・𝓍（U+1D4CD）の復元は、第11章で原典が意味区別に使う範囲（C10-40/C10-41 の登録範囲）について行う。C10 の中央付託項目（C10-06/07/08/15/21/22/26/28/35/40/41 等）は登録どおり取り込んだ（CF2-038 ほか）。
  - C11 の h_{f𝒢} クラス（CF2-039）は章横断伝播チェックを修正側タスクとして明記した（grep 範囲は当該項目参照）。
  - 深刻度は上記以外コーディネーター登録どおり（変更なし）。
- 表記: 各項目は (a) 深刻度 (b) 対象ファイルと箇所 (c) 現行文字列（記録に verbatim がある場合は転記、ない場合は「修正時に原典画像で確定」） (d) 原典の印刷形 (e) 修正方針 (f) 出典（コーディネーターID＋項目番号＋PDFページ）。
- 本リストは読み取りと統合のみで作成した（データ編集・テスト実行・GitHub書き込みは行っていない）。

---

## 第1部 P1（3件）

### CF2-001 (P1) 問題3.38 Drake の式の第2因子が積→割り算に化けている
- 対象: `data/chapter-problems/chapter-03.json`、`problem-3-38` formulaBlocks[0]
- 現行: `ε ≃ 1 − exp{[exp(−NTU^0.78 R) − 1]/(NTU^0.22 R)}`
- 原典: `ε ≃ 1 − exp{[exp(−NTU^0.78 R) − 1](NTU^0.22/R)}`（第2因子は積 (NTU^0.22/R)）。R≠1 で値が変わり、表示式が数学的に偽。
- 修正方針: 原典の積の形に書き換える。
- 出典: C03-18（PDF 149）

### CF2-002 (P1) 問題7.1 の R² の指数脱落
- 対象: `data/chapter-problems/chapter-07.json`、`problem-7-1`（text と formulaBlocks[0].expression の両方）
- 現行: `(−dp/dx)R/(4µ) = 2u_av`
- 原典: "the quantity (−dp/dx)R²/4μ is twice the average velocity"。指数 ² の脱落で恒等式が次元的にも偽となり、学習者に偽の主張の証明を求める形になっている。
- 修正方針: 両箇所とも R² に復元する。
- 出典: C07-08（PDF 413）

### CF2-003 (P1) 式(8.26) への余分な因子 x
- 対象: `data/sections/8-3-ja.json` block 30 expression、式(8.26)
- 現行: `Nux ≡ (qx/∆T)(x/k) = 2x/δ = …`
- 原典: `Nu_x ≡ qx/(ΔTk) = 2x/δ`（単一の分数）。現行形は qx/∆T にさらに x/k を掛けており無次元でなく、第1の等式が偽。最終項 0.508·Rax^(1/4)·[Pr/(0.952 + Pr)]^(1/4) は原典と一致。
- 修正方針: qx/(ΔTk) の単一分数形に書き換える。
- 出典: C07-25（PDF 440）

---

## 第2部 P2（29件）

### CF2-004 (P2) 例題1.6 の説明が対流・放射の両方向を逆転
- 対象: `data/sections/1-3-ja.json` block 178（例題1.6）の alt・explanation
- 現行: alt「空気からの対流受熱と壁への正味の放射伝熱が釣り合う」、explanation「左辺は空気からの対流受熱、右辺は…正味の放射伝熱」
- 原典: 壁100 °C・空気20 °C・結果 T_tc = 23.5 °C で、対流は熱電対から空気へ熱を運び、正味放射は壁から受ける（例題1.5 の解、PDF 46: "The heat convected away from the thermocouple by the air must exactly balance that radiated to it by the hot walls."）。式・数値・23.5 °C は正しく、block 166（例題1.5）は方向を正しく述べており、block 178 の追加説明のみが原典と自ファイルの両方に矛盾する。
- 修正方針: alt・explanation の方向記述を原典どおりに直す。
- 出典: C01-F20（PDF 46–47）

### CF2-005 (P2) 問題2.34 の高温面・低温面の上下配置の逆転
- 対象: `data/chapter-problems/chapter-02.json`、`problem-2-34` text
- 現行: 「冷たい表面の下方、距離 H の位置にある熱い水平表面」
- 原典: "a hot horizontal surface parallel to a cold surface a distance H below" — 冷たい表面が熱い表面の下方 H にある（熱い面が上）。x = 0 が低温面・x = H が高温面という条件とも整合。数値（150 °C / −5 °C / H = 0.15 m）は一致。
- 修正方針: 配置の訳文を原典どおり（熱い面が上、低温面がその下方 H）に直す。
- 出典: C02-F17（PDF 106）

### CF2-006 (P2) 問題3.26 の比較方向の逆転
- 対象: `data/chapter-problems/chapter-03.json`、`problem-3-26` text
- 現行: 「両流体非混合の交換器の代わりに一方の流体が非混合の交換器を使った場合、面積は何パーセント違うか。」（一方非混合を使う側）
- 原典: "By what percentage will the area differ if a both-fluids-unmixed exchanger is used instead of a one-fluid-unmixed exchanger? [−1.8%]" — 両流体非混合を使う側。answerHint「−1.8%」は原典の方向に対する答えで、現行の設問文とは整合しない。
- 修正方針: 基準と置換を原典どおりに入れ替える。
- 出典: C03-01（PDF 147–148）

### CF2-007 (P2) 式(5.32) の表示ブロック自体が存在しない
- 対象: `data/sections/5-3-ja.json`（式番号 5.24–5.31、5.33–5.36 はあるが 5.32 のみ欠落。block 21 が帰結だけを散文で述べる）
- 原典: `∫₀² sin((mπ/2)ξ) dξ = Σ(n=1→∞) Gn ∫₀² sin((mπ/2)ξ) sin((nπ/2)ξ) dξ (5.32)`。導出の要の表示が欠け、散文が参照する番号付き式がアプリ内に存在しない。
- 修正方針: 式(5.32) の formula ブロックを追加する。
- 出典: C04-02（PDF 219）

### CF2-008 (P2) 問題5.22 の追加課題（小キャプション）の脱落
- 対象: `data/chapter-problems/chapter-05.json`、`problem-5-22`（text・figure.caption・figure.alt のいずれにもなし）
- 原典: 図5.30 の小キャプションに追加課題がある — 5.22a「(Also find T_center)」、5.22b「(Also find T_A)」、5.22f「(Also find T_A)」、5.22i「(Also find T_A)」。現行は形状係数のみを求める形で、問われている内容の一部が欠落（c・d・e・g・h・j に追加はない）。
- 修正方針: a/b/f/i に追加課題を補う。
- 出典: C04-25（PDF 271–272）

### CF2-009 (P2) 問題5.63 の漸近式の指数脱落
- 対象: `data/chapter-problems/chapter-05.json`、`problem-5-63` text
- 現行: `e^x erfc x ∼ 1/(√π x)`
- 原典: `e^{x²} erfc x ~ 1/√π x`（指数 x² を拡大切り出しで確認）。この漸近関係は e^{x²} erfc x に対して成立する。
- 境界注記: 中央裁定により P2 を維持（問題文中の注記式であるため）。ただし表示式の偽として P1 判定の余地がある旨の記録を残す。
- 修正方針: e^{x²} に復元する。
- 出典: C05-07（PDF 280）

### CF2-010 (P2) 図6.7 説明文の等式の誤り（ρ の脱落）
- 対象: `data/sections/6-2-ja.json` block[4]（図6.7）description
- 現行: 「隣り合う流線の間の質量流量は一定で、ψ の差に等しい」
- 原典: 式(6.7) は dṁ = ρdψ であり、本文も質量流量が ψ の差に「比例する」と述べるのみ。説明文が係数 ρ を欠いた等式を主張している（図説明の内容誤り。第9.7 の説明文数値誤りの先例と同クラス）。
- 修正方針: 「ρ と ψ の差の積に等しい（比例する）」旨に直す。
- 出典: C05-12（PDF 293）

### CF2-011 (P2) 式(7.18) 導出の explanation の文字化け重複
- 対象: `data/sections/7-2-ja.json` block 30 explanation（式(7.17) ブロック）
- 現行: 「…この結果と式(7.15)を式(7.16)に使うと、4[1 − (r/R)²] = [qw/(Rk)]·(r)(1/r)(d/dr)[r(dT/dr)]·(R/qw)·... 整理して、4[1 − (r/R)²]·(qw/(Rk)) に関連する常微分方程式が得られます（式(7.18)）」
- 原典: 導出は `4[1 − (r/R)²](q_w/Rk) = (1/r)(d/dr)(r dT/dr)` (7.18)。現行文は左辺から qw/(Rk) を落とし、余分な (r) 因子と (R/qw) を挿入し、「·...」で切断された意味の通らない等式になっている。同じ導出は block 31 に正しい形で存在し、表示式 (7.18) 自体（block 32）も正しい。
- 修正方針: explanation の導出文を原典の形に書き直す（または block 31 の正しい導出への参照に置換する）。
- 出典: C06-23（PDF 373）

### CF2-012 (P2) §8.4 説明文の Ra_L の指数 1/3 脱落で理由付けが偽
- 対象: `data/sections/8-4-ja.json` block 16
- 現行: 「後者の場合、NuL と RaL はどちらも L に比例するため、熱伝達係数は L に対して独立である。」
- 原典: "In the latter case, both Nu_L and Ra_L^{1/3} are proportional to L, so the heat transfer coefficient is independent of L." Ra_L 自体は L³ に比例するため、現行の理由付けは数学的に偽（結論は原典と一致）。
- 修正方針: Ra_L^{1/3} と指数を補う。
- 出典: C07-35（PDF 448）

### CF2-013 (P2) §8.4 レッスンの安定面・不安定面の取り違え
- 対象: `data/original-deep-lessons.json` lessons[46] block 17
- 現行: 「水平に近づく極限では安定側でもプルームが立つため、単純な置き換えの範囲を超える。」
- 原典: プルーム形成（θ = 90°）は不安定側（熱い板の上面・冷たい板の下面）に帰属し、安定側（熱い板の下面・冷たい板の上面）こそ g cos θ 置換が有効な範囲。現行文は原典の安定／不安定の分類と矛盾する。
- 修正方針: プルームの帰属を不安定側に直す。
- 出典: C07-36（PDF 448）

### CF2-014 (P2) §8.5 レッスンの Ja と Pr の注記の取り違え
- 対象: `data/sections/8-5-ja.json` block 16 explanation（式(8.59) の関数依存の注記）
- 現行: 「ここで Ja は、エネルギー方程式の対流項を無視した限りにおいて消去され、その影響は h′fg に陰に運ばれ、Π4 が明らかに支配的な変数です。」
- 原典: 注記付き表示では Π_4 = "this is clearly the dominant variable"、Ja = "this is carried implicitly in h′_fg"、Pr = "eliminated in so far as we neglected convective terms in the energy equation"。現行は Pr に付く消去の節を Ja の主語にしている。
- 修正方針: 3つの注記の帰属を原典どおりに直す。
- 出典: C07-46（PDF 460）

### CF2-015 (P2) §8.5 レッスンの Pr・Ja の役割の逆転（従属変数と誤記）
- 対象: `data/original-deep-lessons.json` lessons[47] block 10
- 現行: 「膜凝縮は Nu_L ＝ fn(Π4, Pr, Ja)（式8.49）と書け、Π4 が主変数、Pr と Ja は従属変数になる。」
- 原典: 式(8.49) は Pr, Ja を "secondary independent variables"（二次的な独立変数）とし、Nū_L が従属量。節ファイル block 5 の記述（「Pr と Ja が二次的な独立変数」）は正しく、レッスンのみが原典と自ファイルの両方に矛盾する。あわせて Nu_L の上線も脱落（CF2-034 の実例でもある）。
- 修正方針: 「二次的な独立変数」に直し、Nū_L の上線も復元する。
- 出典: C07-51（PDF 456）

### CF2-016 (P2) 問題8.15 のプロット対象への ρ_∞ − の挿入
- 対象: `data/chapter-problems/chapter-08.json`、`problem-8-15` text
- 現行: |ρ_w − ρ_∞| と |ρ_∞ − ρ_f β_f (T_w − T_∞)| をプロットせよ、という形
- 原典: "plot |ρ_w − ρ_∞| and |−ρ_f β_f(T_w − T_∞)|" — 第2の量は線形化した密度差そのもの。現行は絶対値の中に先行する「ρ_∞ −」を挿入し、プロット対象の量を変えている（線形化の検証が無意味になる）。
- 修正方針: 第2項を |−ρ_f β_f(T_w − T_∞)| に直す。
- 出典: C07-63（PDF 473）

### CF2-017 (P2) 図9.12 の alt が描かれた量を誤同定
- 対象: `data/sections/9-3-ja.json` block 23 alt
- 現行: 「qmax/qmaxz 対 ヒーターサイズ（波長単位）の図」
- 原典: 図9.12 の縦軸は q_max / (ρ_g^{1/2} h_fg [g(ρ_f−ρ_g)σ]^{1/4})（0.00–0.30、0.149 のプラトーに "eqn. (9.11) for large heaters" の注記）、横軸は "Heater size in wavelengths, L/λ_{d1}"。q_max/q_maxz は図9.13 の比（block 32 の alt が正しく使用）。caption・description は正しく alt のみ誤り。
- 修正方針: alt を図9.12 の実量に書き換える。
- 出典: C08-F03（PDF 508）

### CF2-018 (P2) "node" を「腹」と誤訳（節の逆）×4箇所
- 対象: `data/sections/9-3-ja.json` block 2（「重い相は波の1つの腹（node）で下方に落ち、軽い流体はもう1つの腹へ上昇する」）、block 4 description（「波の腹で落ち込む」）、block 6（「蒸気はテイラー波の腹で液体の中に上昇する」）ほか計4箇所
- 原典: "The heavy phase falls down at one node of a wave and the light fluid rises into the other node." node は節であり「腹」（antinode）は波の反対の点。アプリ自身の "(node)" グロスとも矛盾する。
- 修正方針: 4箇所とも「節」に直す。
- 出典: C08-F07（PDF 500）

### CF2-019 (P2) §9.7 レッスンが遷移消滅の閾値を R′ でなく L′ と誤記
- 対象: `data/original-deep-lessons.json` lessons[54] block 16「重力の定量的傾向」
- 現行: 「また L′ が約0.15を下回ると流体力学的な遷移そのものが劣化・消滅するため…」
- 原典: "hydrodynamic transitions deteriorate and vanish entirely as R′ is reduced below about 0.15"。節データ（9-7-ja.json block 8）は R′ で正しく、レッスンのみ誤り。
- 修正方針: L′ → R′ に直す。
- 出典: C08-F23（PDF 523）

### CF2-020 (P2) §9.7 レッスンの式(9.40) の構造誤述（加算形）＋式自体の欠落＋存在しない note 参照
- 対象: `data/original-deep-lessons.json` lessons[54] block 17
- 現行: 「式（9.40）は 0.21 を先行項とし、密度比・We_D・ジェット径と円板径の比 d_jet/D・係数 A を含む項が加わる形であるが、括弧の正確な組合せは原典の組版に依存するため、数値適用の前に原論文で確認する（理由は note 参照）」
- 原典: q_max/(ρ_g h_fg u_jet) = (0.21 + 0.0017·ρ_f/ρ_g)·(d_jet/D)^(1/3)·[(1000·ρ_g/ρ_f)/We_D]^A — 3因子の積。括弧の組合せは原典から読み取れ、節データ block 13 が正しい積の形を持つ。レッスンの equations に式(9.40) 自体がなく、参照先の `note` キーはレッスンオブジェクトに存在しない。
- 修正方針: 積の形の記述に書き換え、式(9.40) をレッスンの equations に追加し、note 参照を除く。
- 出典: C08-F24（PDF 524）

### CF2-021 (P2) 図9.18 の description の流れ様式の区間割当の誤り
- 対象: `data/sections/9-8-ja.json` block 4 description
- 現行: 「C スラグ流、D・E 環状流」
- 原典: Flow patterns 列は A 単相液体、B・C にまたがる気泡流、D スラグ流、E 環状流、F 液滴同伴環状流、G 液滴流、H 単相蒸気。現行はスラグと環状がずれている（C は気泡流、D がスラグ、環状は E から）。同 description 内の熱伝達領域リストは正しい。
- 修正方針: 区間割当を原典どおりに直す。
- 出典: C08-F27（PDF 527）

### CF2-022 (P2) 式(9.46) の引数リストが積に潰れている
- 対象: `data/sections/9-8-ja.json` block 9 explanation（インライン式）
- 現行: `hfb/hlo = fn(x, (qw/(Ghfg))·(ρg/ρf))（式(9.46)）`
- 原典: `h_fb/h_lo = fn(x, q_w/(Gh_fg), ρ_g/ρ_f)` — カンマ区切りの3引数。密度比は独立した無次元群であり、直後の本文（質と密度比が対流数に結合されるのはその後）も両者の独立性を前提とする。
- 修正方針: 3引数のカンマ区切りに直す。
- 出典: C08-F35（PDF 530）

### CF2-023 (P2) §10.2 レッスンが Kirchhoff の厳密形と拡散形を取り違えて表示
- 対象: `data/original-deep-lessons.json` lessons[60] equations[1]
- 現行: 式 ε_λ(T_s) = α_λ(T_s)（＝拡散形 (10.8b)）にラベル「対応するモードのKirchhoff関係」を付け、meaning で「対応する方向・偏光」を根拠に挙げる（表示された式は方向・偏光の引数を持たない）
- 原典: 厳密形 (10.8a) は ε_λ(T, θ, φ) = α_λ(T, θ, φ)（"exact form" と明記）。
- 修正方針: equations[1] を厳密形（引数付き）に直すか、拡散形である旨のラベルに改める。
- 出典: C09-08（PDF 565）

### CF2-024 (P2) Table 10.2 配置4 がアプリ内で同定できない
- 対象: `data/sections/10-3-ja.json` block[19] item4
- 現行: 「配置4：F1–2 = (A1 + A2 − A3)/(2A1)（交差紐の方法に関連する形）」のみ
- 原典: 配置は図のみで定義される（辺 1/2/3 の三角形の囲い）。A₁/A₂/A₃ が何かも三辺の囲いであることも示されず、アプリ内に図もないため、節データだけでは式を適用できない。式自体は原典と一致。
- 修正方針: 三辺の囲いの定義（A₁/A₂/A₃ の帰属）を item4 の文に補う。
- 出典: C09-14（PDF 575）

### CF2-025 (P2) Table 10.2 配置5 の文字 a, b, c がアプリ内で未定義
- 対象: `data/sections/10-3-ja.json` block[19] item5
- 現行: 式 [r/(b−a)]·[tan⁻¹(b/c) − tan⁻¹(a/c)] は正しいが、文字の定義は「原典PDF p.575（書籍p.561）の図を参照」と外部参照のみ
- 原典: a（円柱左端の鉛直線から中心線まで）、b（帯の左端＝点1から中心線まで）、c（帯の面から中心線までの鉛直距離）は図でのみ定義される。アプリ内に図がないため単独では使えない。
- 修正方針: a/b/c の定義を item5 の文に補う。
- 出典: C09-15（PDF 575）

### CF2-026 (P2) 図10.14 の alt が図の幾何を誤述（「同心状」）
- 対象: `data/sections/10-4-ja.json` block[13] alt・description
- 現行: alt「同心状の2物体の模式図」、description は空文字列
- 原典: 不規則な閉曲線の内側物体（中心もずれており円形でもない）を不規則な外殻が囲む一般の「囲まれた物体」で、同心配置ではない。図内ラベル（T = T₁、A₁、T₂、A₂）も登録テキストのどこにもない（caption は忠実）。
- 修正方針: alt を一般の囲い幾何の記述に書き換え、description に図内ラベルを補う。
- 出典: C09-26（PDF 583）

### CF2-027 (P2) 図11.1 の description の寸法帰属の誤り（7 in の帰属先）
- 対象: `data/sections/11-1-ja.json` block[5]（図11.1）description
- 現行: 「寸法は、上部径 195 ft、のど部径 170 ft、上縁の厚さ 7 in、全高 425 ft、充填部の高さ 42 ft、基部の厚さ 26 in、基部径 325 ft。」
- 原典: "7 in thick" の矢印は "170 ft diameter" と同じ高さ（のど部＝殻の最狭部）の殻壁を指し、上縁に厚さラベルはない。7つの寸法値自体は全て正しいが、7 in の帰属先が上縁→のど部の誤り。
- 修正方針: 「のど部の殻厚 7 in」に直す。
- 出典: C10-13（PDF 636）

### CF2-028 (P2) 問題10.44 の ℱ → F の字形置換
- 対象: `data/chapter-problems/chapter-10.json`、`problem-10-44` text（同ファイル内に ℱ U+2131 は0件）
- 現行: 「F_{1–2} に10%未満の誤差を導入するために A_1/A_2 はどれだけ小さくなければならないか」
- 原典: "introduce less than 10% error in ℱ_{1–2}" — ℱ はスクリプト字形で、同ページの問題10.43 "Verify F_{1–2}" のプレーンなイタリック F と意図的に書き分けられている。本書では ℱ（表面性質を含む放射交換係数）と F（形態係数）は別定義の量であり、当該設定（大囲い内の小物体）では F_{1–2} ≡ 1 なので、現行文は文字どおり読むと近似誤差を担い得ない量に誤差を帰属させる。
- 修正方針: ℱ_{1–2}（U+2131）に復元する（クラス項目 CF2-038 の ℱ 区分も参照）。
- 出典: C10-16（PDF 625）

### CF2-029 (P2) §11.6 のフィック／フーリエ表示式ペアの欠落
- 対象: `data/sections/11-6-ja.json` block[10]
- 原典: 単位体積あたりに書き直した法則を表示式ペアで示す: `j⃗_i = −ρ𝒟_im∇m_i = −𝒟_im(ρ∇m_i)`、`q⃗ = −k∇T = −(k/(ρc_p))(ρc_p∇T)` — 式(11.67c) の拡散率類推はこの表示から引かれる。アプリは散文の言い換えのみで表示式を欠く。
- 修正方針: 表示式ペアを block[10] に追加する。
- 出典: C10-30（PDF 671）

### CF2-030 (P2) §11.6 の式(8.4) 再掲表示の欠落
- 対象: `data/sections/11-6-ja.json` block[21] と式ブロック群
- 原典: 式(8.4) を本節本文中に表示する: `u ∂u/∂x + v ∂u/∂y = (1 − ρ_∞/ρ)g + ν ∂²u/∂y² (8.4)`（本文は続けて「eqn. (8.4) の浮力項」と参照）。アプリ §11.6 データには式(8.4) の再現が一切なく番号引用のみ（∂u/∂x を含む文字列がファイル内に存在しない）。
- 境界注記: 中央裁定により P2 を維持。章またぎの再掲ではあるが、隣接する同種の再掲 (6.68) が PDF 674 でインライン表示されておりアプリ内部の扱いが不一貫であることが根拠。引用のみで足りると裁定されれば格下げされる旨を併記する。
- 修正方針: 式(8.4) の表示（インライン再掲）を追加する。
- 出典: C10-38（PDF 675）

### CF2-031 (P2) 例題11.9 の erf 解の 𝒟_{im1} 添字脱落
- 対象: `data/sections/11-5-ja.json` block[16]（例題11.9 解の erf 表示）
- 現行: `erf[x/(2√(𝒟im·t))]` — 拡散係数の添字は `im` のみ（同箇所の `𝒟im·t` の中点は CF2-047 の実例でもある）
- 原典: `erf( x / (2√(𝒟_{im1} t)) )` — 媒体1の係数 𝒟_{im1}（図11.12 が Medium 1 の問題であり、アプリ自身の block[17] 式(11.57) は 𝒟im1 と正しい）。
- 境界注記: 中央裁定により P2 を維持（表示された解の係数の同一性の誤り。表示式の虚偽として P1 にするかは中央裁定に委ねるとのワーカー付記を併記）。
- 修正方針: 𝒟_{im1} に復元し、中点も除く。
- 出典: C10-39（PDF 665）

### CF2-032 (P2) §11.11 式(11.129) 導入文の転置で等式が数学的に誤り
- 対象: `data/sections/11-11-ja.json` blocks[8]（式(11.129) 導入文）
- 現行: 「Nv⃗i = xi·v⃗i/c、xi = pi/p と置き」と転置され、書かれた等式が数学的に誤り（次元も合わない）
- 原典: "Upon putting x_i v⃗_i = N⃗_i/c, x_i = p_i/p, and setting the total pressure p constant…"。表示式 (11.129a/b) 自体は正しいため P1 ではなく、導出前提の散文内関係式の誤りとして P2。
- 修正方針: 導入文を `x_i v⃗_i = N⃗_i/c` の形に直す。あわせて CF2-038（h_{f𝒢} クラス）の注記どおり、本項目と同じ潜熱記号クラスが他章へ伝播していないか章横断チェックを行うこと（詳細は CF2-039）。
- 出典: C11-041（PDF 717）

---

## 第3部 P3 クラス項目（21件）

### CF2-033 (P3) クラス: 章末問題データの平均記号（U+0304 結合マクロン）脱落 — 出典58件
- 修正方針: 各ファイル全体を実例単位で原典画像と照合して h̄（および Nū・τ̄_w・q̄・m̅）を復元する。原典で無印の h は復元しない（例: 問題1.40 の h(x)、問題6.16(c)(d) の局所 h、問題4.27 の h_sf、問題9.14 の本文 h は原典も無印）。機械的な一括置換は禁止。chapter-01/02/04/05/06.json はファイル内 U+0304 が0件であることが確認されている。
- インスタンス（ファイル別）:
- `chapter-01.json`（C01-F22、PDF 52–60）: 問題1.8（h̄ = 15 W/m²K）、1.19 の図 alt、1.30、1.31、1.33、1.34、1.35、1.38、1.40（検証済み9実例。修正時はファイル全体を走査）。
- `chapter-02.json`（C02-F14、PDF 101–110、ファイル内 U+0304 = 0）: 2.5（h̄_i, h̄_o）、2.8/図2.22（h̄ = 20）、2.13（h̄ = 12,000 / 9,000）、2.18（h̄_inside）、2.22（h̄ = 16）、2.23(c)（h̄ = 20）、2.25（h̄_o = 40）、2.28（h̄ = 230）、2.29（h̄ = 6.7）、2.32（h̄_outside, h̄_inside）、2.35（h̄_i, h̄_o）、2.37、2.38、2.41（h̄ = 6）、2.45（h̄ = 2ΔT^{1/4}）、2.46（h̄_o = 20, h̄_i = 10）、2.49（h̄_inside = h̄_outside = 1400）。
- `chapter-03.json`: C03-02 問題3.6（h̄ = 1380 Btu/h·ft²·°F、PDF 144）、C03-19 問題3.37（h̄ = 2000・h̄ = 1500、PDF 149）、C03-21 問題3.41(d)（h̄ = 170 W/m²K、PDF 150）、C03-24 問題3.44（h̄_water = 7200、h̄_air = 110、h̄_air is unchanged、PDF 151）。
- `chapter-04.json`（C03-41〜59、PDF 197–204、ファイル内 U+0304 = 0）: 4.2 h̄_RHS、4.3(b)、4.4、4.7 の図 alt、4.8、4.14（h̄ ≃ 600 W/m²K）、4.15(b)、4.16 h̄_o・h̄_i、4.21（h̄ = 130）、4.23（h̄ = 230）、4.25 h̄_outside = 6、4.26（h̄ = 28）、4.27（h̄ = 10）、4.29（h̄ = 12）、4.30（h̄ = 68）、4.33 h̄_f・h̄_w・h̄_eff、4.37（h̄ = 150）、4.38、4.42 h̄_i・h̄_o。
- `chapter-05.json`（ファイル内 U+0304 = 0）: C04-22 問題5.4（text の h_m・h_c、図5.28 alt の h_c・h_m、PDF 267）、C04-23 問題5.7（text と answerHint の h̄ = 1006、PDF 268）、C04-26 問題5.12（h̄ = 2000、PDF 269）、C04-28 問題5.24 items[2]（h̄ = 1000、PDF 270）、C05-06 問題5.27（h̄ = 10,000）、5.32、5.33（h̄ = 600）、5.34（h̄ = 10）、5.35（h̄ around the cube is 272）、5.39（h̄ = [2.733 + 10.448(ΔT °C)^{1/6}]²）、5.42（h̄ is 688）、5.46（h̄ = 500）、5.50（h̄ = 10）、5.56b（ρc_pδ/(2h̄) と φ = ρc_pωδ/(4πh̄) の2箇所）（PDF 273–279）。
- `chapter-06.json`（ファイル全体 U+0304 = 0）: C06-07 問題6.10 text の Nū_L、C06-08 問題6.10 式(6.121) の Nū_L（PDF 352）、C06-12 問題6.16(b) h̄、C06-13 問題6.17 h̄、C06-14 問題6.19 h̄・τ̄_w、C06-15 問題6.33 h̄（PDF 353–355）、C06-17 問題6.44 本文・式(6.124) の Nū_L、C06-18 問題6.45 h̄ ×2（PDF 358）。
- `chapter-07.json`: C07-09 問題7.4（items・answerHint）、C07-10 問題7.7、C07-11 問題7.9、C07-12 問題7.12、C07-13 問題7.13、C07-14 問題7.16（Nū_L = CRe^aPr^b）、C07-15 問題7.18、C07-16 問題7.21（PDF 414–416）。
- `chapter-08.json`: C07-64 問題8.21、C07-65 問題8.23、C07-66 問題8.25、C07-67 問題8.26（text・answerHint の h̄ = 9.5 kW/m²K）、C07-68 問題8.31（text ×2・answerHint の h̄ ≃ 1000）、C07-69 問題8.44（q̄ = 25 kW/m²、text・answerHint)、C07-70 問題8.45 items[0]（h̄_o ≡ h̄(T = T_o) の両 h)、C08-F12 問題8.45 item (b) h̄_o・問題8.47 h̄(D) と Nū_D・問題8.51 answerHint「Nū_D ≫ 2」（PDF 473–478）。
- `chapter-09.json`: C08-F40 問題9.14 answerHint（[h̄ = 48,000 and 680 W/m²K]、PDF 544）、C09-04 問題9.27（「What is h̄?」、PDF 546）。
- `chapter-10.json`: C10-11 問題10.27（h̄ = 62 W/m²K、PDF 623）。
- `chapter-11.json`: C11-050 問題11.29 の平均濃度 m_{He,s}（上線は添字まで複合記号全体に架かる、PDF 727）。

### CF2-034 (P3) クラス: 節データ・レッスンの平均記号脱落 — 出典37件
- 修正方針: 各実例を原典画像で確認して復元する（レッスン側の式の再掲・散文・図 alt/caption も対象）。CF2-015（C07-51）の Nū_L 復元も本クラスの実例として併せて行う。
- インスタンス:
- C03-06: `4-1-ja.json` block[12] の alt が h̄ を「h かける」と読む（expression/explanation は正しい、PDF 156）。
- C03-12: lessons[15] 式(4.3) の h̄（blocks[10]・equations 項とも平書き、PDF 159）。C03-13: 同レッスン 式(4.4) の h̄（同上）。
- C03-38: lessons[17] §4.4 の h̄₁/h̄₂（equations (4.20) 項・block 7・block 8、PDF 174）。C03-39: `4-5-ja.json` block 49 の h̄_L（PDF 185）。
- C04-01: lessons[19] §5.1（blocks[7] の fn 引数 h と Bi=hL/k、blocks[8] の h ×3 と式(5.6) の h、equations[5] の Bi=hL/k、PDF 209–210）。C04-03: `5-3-ja.json` block 31「Bi = hL/k」（PDF 221）。C04-12: lessons §5.6（blocks[7][8] の h、equations[4].meaning の h、PDF 241）。
- C05-23: lessons[31] §6.5 式(6.69)「Nu_L = 1.13 Pe_L^(1/2)」（blocks[10]・equations[12]、原典 Nū_L = 1.13 Pe_L^{1/2}、PDF 323）。
- C06-25: lessons[37] 式(7.27) 項目の Nū_D。C06-26: 同 式(7.29) 項目の Nū_D。C06-27: 同レッスン本文の Nū_D ×2（PDF 376、レッスン全体で U+0304 = 0）。C06-30: `7-3-ja.json` block 10 図7.5 alt「管内空気の NuD 対 ReD データを示す図」（PDF 382）。
- C06-33: `7-4-ja.json` block 3 explanation（式(7.57) の h̄)。C06-34: 同 explanation「U を h に置き換え」（原典 "replace U with h̄")。C06-35: 同 block 5 explanation（式(7.59b) の h̄)。C06-36: 同 block 7 text「NuD バー = 4.27」（綴り出し表記で他所と不統一、PDF 395–396）。
- C07-01: `7-6-ja.json` block 25 explanation 式(7.73h) の Nū_D（PDF 409）。C07-04: `8-3-ja.json` block 10 explanation の Nū_L（PDF 433）。C07-05: 同 block 11 図8.3 caption の h̄（PDF 434）。C07-27: 同 block 6 explanation の h̄（PDF 432）。
- C07-29: `8-4-ja.json` block 6 例題8.4「Q = πDhΔT = 4.47 W/m」（原典表頭 "Q = πD h̄ ΔT"、PDF 445）。C07-30: lessons[46] block 14（式(8.29)・(8.28) 再掲の Nu_D、例題8.4 の h = 2.85 / 6.30)。C07-33: 同 block 15（式(8.32)(8.33) 再掲の Nu_D、PDF 447）。C07-34: 同 block 16（式(8.34) の Nu_τ、球の Nu_D = 0.464 Ra_D^(1/4)、PDF 447–448）。
- C07-37: `8-4-ja.json` block 20 の h̄（PDF 450）。C07-38: 同 block 22 の Nū_L と ΔT̄（定義関係内の2箇所、PDF 451）。C07-40: 同 block 24 explanation の Nū_L ×3（PDF 452）。C07-41: 同 block 25 explanation「NuL ≳ 5」（原典 Nū_L ≳ 5、PDF 452）。C07-44: lessons[46] block 18 item (ii) 式(8.35) の Nū_L（PDF 449）。
- C07-45: `8-5-ja.json` block 6 図8.10 caption・description の Nū_D（PDF 457）。C07-49: 同 block 5 explanation 式(8.49) の Nū_L（PDF 456）。C07-55: lessons[47] block 11 の Nū_D（式(8.67) 0.728・(8.68) 0.828、PDF 466）。C07-56: 同 block 12 と equations の式(8.70) 項の Nū（PDF 466）。C07-60: `8-5-ja.json` block 32 explanation の Nū_L（PDF 468）。C07-61: 同 block 34 図8.15 alt（縦軸 Nū_L の上線と添字 L の両方が脱落、PDF 469）。
- C11-032: `11-8-ja.json` blocks[1] 式(11.79a) 導入文の時間平均質量分率 m̄_2（式ブロック blocks[8]/[9] は正しい、PDF 686）。

### CF2-035 (P3) クラス: 平均記号・スクリプト字形の過剰適用（逆向き誤り） — 出典4件
- 修正方針: 原典で無印・平文の箇所から過剰な上線／字形を除く（件別に画像確認）。
- インスタンス:
- C02-F40: `3-2-ja.json` blocks[55].text「平均の U を Ū ≡ (1/A)∫₀^A U dA と定義して」— 原典は全て平文 U で Ū 記号も ≡ もない（PDF 128。同ファイルで唯一の上線付き文字）。
- C03-32: `4-5-ja.json` block 17 explanation「h̄(A/P)/k ≪ 1 と置くことで」— 原典 "Setting h(A/P)/k ≪ 1" の h は平書き（同段落の他の h̄ / h̄_L は全てバー付き、PDF 181）。
- C10-08: lessons[66] の混合物モル質量 `M̄`（M + U+0304 が8箇所: blocks[1][2]、equations[0][1]、workedExample）— 原典はプレーンなイタリック M（式(11.8) M = Σ_i 𝓍_iM_i、PDF 639）。レッスン独自記法として登録されたもの（中央付託→登録どおり取り込み）。
- C10-31: `11-6-ja.json` blocks[7][8]（式11.66）[10][17]（式11.69）[18]（表11.2）計10箇所の物質移動係数がスクリプト大文字 𝒢 (U+1D4A2) — 原典は小文字イタリック g_{m,i}（無バー、PDF 670・672 を400dpiで確定）。注記: block[15] の式(11.67e) の 𝒢 も同字形だが、確定事項が裁定したのは (11.67e) のバーの有無のみで字形は未裁定のため件数に含めない（修正時に中央裁定へ情報として挙げる）。なお C11 の検証で §11.7/§11.9/§11.10 の係数位置の 𝒢 は原典どおり正しいことが確定している — 本件は §11.6 の g_{m,i} のみが対象。

### CF2-036 (P3) クラス: 上線の範囲（スコープ）の相違 — 出典3件
- 修正方針: 原典画像で範囲を件別に確定して直す。注記: 同種の候補は C06（W16-C1: Nū の末尾文字への結合マクロンはデータセットの統一符号化慣行として却下）と C08（W15-02: 同旨で却下）で登録されていない。本クラスは原典が範囲を意味的に区別する実例（複合記号全体・プライム込み）に限る。平文表現の慣行として許容するかは修正側の裁定事項（特に C05-22）。
- インスタンス:
- C03-31: `4-5-ja.json` blocks 10 / 15 の "h̄L" — 原典の h_L は全実例でバーが h＋下付き L の複合全体に架かる（\overline{h_L} 型、PDF 177・180）。
- C05-22: `6-5-ja.json` blocks[32][34]（ΔT̄）、[34] explanation・[36][37][41]（NūL）、[44]（例6.5)、[48]（式(6.72) 散文形）、[51]（ΔT̄・T̄w、例6.6）と lessons §6.5 blocks[5]・equations[3] — 結合マクロンが末尾の文字にのみ付く。原典は記号全体に架かる（式(6.68) の Nū_L、式(6.66) の ΔT̄、例6.6 の T̄_w は添字 w まで、PDF 322–326）。上線の有無自体は全箇所正しい（裁定事項として登録された項目）。
- C05-30: `6-7-ja.json` block[15] explanation（式(6.83) 再掲）と block[16] の ū′・v̄′ — 原典は上線が文字＋プライム全体に架かる（PDF 330・332）。同一式内で末項は「v′u′バー」と全体表記で正しく、表記が不統一。

### CF2-037 (P3) クラス: 近似・不等号記号の置換 — 出典28件
- 修正方針: 各実例を原典の記号に置き換える（≅ U+2245 / ≃ U+2243 / ≊ U+224A / ≳ U+2273 / ⩾（≧）/ ⩽（≦）の区別は画像判定に基づく。原典の ≥ が斜め二重線形 ⩾ の場合はアプリの ≧ が受理済み符号化であり対象外 — C05 の却下記録参照）。
- インスタンス:
- C02-F10: lessons「2.3」blocks[8].text の ≃（U+2243)×2 — 原典は ≊（U+224A): Q_net ≊ A₁h_radΔT、h_rad ≊ 6 W/m²K（PDF 86）。
- C03-34: `4-5-ja.json` block 77「tanh mL ≊ 1」— 原典 ≅（PDF 190）。C03-35: 同実例の lessons[18] block 11「tanh(mL)≃1」— 原典 ≅（節ファイルとも記号が食い違う）。
- C04-07: `5-4-ja.json` 例題5.2（blocks 18–20）の ≃ ×4 — 原典は全て ≈（U+2248、PDF 228）。あわせて block 10 散文の矢印「t → ∞」— 原典は ⟶（U+27F6、PDF 226）。
- C04-14: `5-6-ja.json` block 31（例題5.4「h̄external ≃ ∞」）と block 42（例題5.5「h̄ ≃ 100」）の ≃ — 原典はいずれも ≅（PDF 238・240）。
- C04-15: lessons §5.6 block 7「Fo<0.05」— 原典 "when Fo ≲ 0.05"（U+2272、PDF 240。節データ block 40 は ≲ で正しい）。
- C05-14: `6-2-ja.json` block[24]「ρ ≒ 一定 かつ µ ≒ 一定」（≒ ×2、PDF 297）、block[53] 式(6.22) explanation「≊ 0」（PDF 302）、block[59] 式(6.26) 項目「≊ 1」「≊ 0」（PDF 303）— 原典はいずれも ≅。
- C05-20: §6.5–§6.7 の ≊（U+224A）計10箇所 — `6-5-ja.json` block[13] 式(6.54)、block[22] 図6.15 caption；`6-7-ja.json` block[23][24] 式(6.91)、block[31] 式(6.96)、block[34] 式(6.97)、block[36] explanation「B ≊ 5.5」、block[37]「ℓ ≊ 0.09δ」；lessons §6.7 blocks[4]・equations[4]「原典の B ≊ 5.5」— 原典はいずれも ≅（PDF 318–336）。
- C05-24: lessons §6.5 blocks[8]・equations[8]「Pe_x>100」— 原典 "Pe_x ≳ 100"（式(6.62) の条件。厳密な > は式(6.63) 側、PDF 321）。
- C05-25: `6-8-ja.json` block[8]、block[9] 式(6.107)、block[11] 式(6.109) と explanation の計5箇所の ≊ — 原典はいずれも ≅（PDF 338）。
- C06-01: `6-9-ja.json` block 2 expression 式(6.114a)「Nutrans ≊ a·Rex^c」— 原典 ≅（PDF 342）。C06-02: 同 block 2 explanation「Rel ≊ 68,000」— 原典 ≅（PDF 343）。C06-03: lessons[35] §6.9 の同記号 ×2（本文・equations、U+224A)。
- C06-09: `chapter-06.json` problem-6-13 answerHint「x/d ≊ 0.01(Ud/ν)」— 原典 ≅（PDF 352）。C06-16: 同 problem-6-20 answerHint「u ≊ 0.003 m/s」— 原典は ≃（U+2243、PDF 353）。
- C06-28: `7-3-ja.json` block 13 explanation「Pr ≳ 0.7」— 原典は ⩾（直線斜線、通常の ≧ 条件、PDF 381）。C06-29: 同 block 19 explanation「ReD ≳ 10,000」— 原典 ⩾（PDF 382）。
- C07-42: lessons[46] block 18 item (i)「傾斜 θ＜45°」— 原典 "θ ≲ 45°"（節ファイル block 19 は正しい、PDF 449）。C07-43: 同 item (iii)「Nu_{L*}＜10」— 原典 "Nū_{L*} ≲ 10"（PDF 450。同項目にはもう1つの相違がある: 式(8.37b)（補正値を直接計算する置換式）を「対数補正を掛ける」と係数のように誤述している。節ファイルの記述は正しい）。
- C07-59: `8-5-ja.json` block 32 explanation ×2 と block 34 description ×1 の「Rec ≊ 7」— 原典は ≅（同ページの Re_c ≃ 400 はアプリと一致、PDF 468）。
- C08-F30: `9-7-ja.json` block 15 式(9.42) の適用条件「u∞²/(gD) ≳ 4」— 原典は ⩾ 4（PDF 525）。
- C10-01: `10-6-ja.json` block 12「CO2 濃度を30%以上増加させた」— 原典 "increased … by more than 30%"（厳密な >30%、PDF 614）。
- C10-34: `11-6-ja.json` block[1]「Bm,H2O ≤ 0.2」— 原典は ⩽ 形（PDF 670）。
- C11-038: `11-11-ja.json` blocks[6] 式(11.121) の ≦（U+2266)×2 — 原典は ⩽（U+2A7D 形）×2（PDF 714）。
- C11-049: `chapter-11.json` problem-11-23 の ≊ — 原典 ≅（PDF 726）。C11-052: 同 problem-11-35「ε_towel ≊ α_towel ≊ 1」— 原典 ≅。
- C11-057: lessons[74] blocks[9]「D_im≒D_iA」— 原典の式(11.110) は ≅（節側 blocks[22] は正しい、PDF 707）。C11-058: lessons[74] equations[6] meaning「J_j≈0」— 原典は J⃗_j ≅ 0（ベクトル矢印もない、PDF 705）。

### CF2-038 (P3) クラス: スクリプト字形の平坦化 — 出典32件
- 修正方針: 原典のスクリプト字形を復元する（字形が意味区別を担うものを含む）。小区分ごとに原典画像で範囲を確認すること（特に 𝓂/𝓍 は下記の裁定範囲）。
- 𝒟（拡散係数）: C02-F15 `chapter-02.json` problem-2-4 尾部「D_12」（原典 𝒟₁₂、PDF 101）。C02-F25 `2-3-ja.json` blocks[11] 式(2.19) と blocks[13] 例題2.3 の 𝒟₁₂（PDF 78）。C10-15 lessons[67] §11.3（D_AB ×21・D_12 ×1、𝒟 = 0件。うち直接引用箇所 = blocks[7] の Table 11.1 参照、blocks[8] の式(11.36) 引用、equations[4]、PDF 646–652）。C10-22 lessons[68] §11.4（D_AB ×4、式(11.44) 等、PDF 654）。C10-28 lessons[69] §11.5 全体（D_AB ×14、PDF 661–664）。C10-36 `11-6-ja.json` block[19] 例題11.11「Dnap,air」×2（原典 𝒟_{nap,air}、PDF 674）。C11-014 lessons[74] blocks[7] 式(11.108) 再掲の D_AB、C11-015 同 blocks[8] 例題11.16 再検算の D_AB ×2、C11-016 同 equations[5]（原書 (11.108) と明示）— いずれも原典 𝒟_AB（PDF 701–702）。C11-017 lessons[74] 全体の残余（D_AB ×14・D_im ×5、𝒟 = 0件。Blanc の法則 (11.109) の D_im 等を含む）。C11-039 lessons[75] §11.11（D_ij ×12 等、𝒟・Đ とも0回。原典は Fick 係数 𝒟ij と Maxwell–Stefan 係数 Đij を使い分ける、PDF 713–720）。C11-043 `chapter-11.json` problem-11-7（𝒟_12 = 𝒟_21、PDF 722）。C11-044 同 problem-11-10 (b)（𝒟_{salt,water}、PDF 723）。C11-045 同 problem-11-13 式(11.142)（𝒟_im、PDF 723）。C11-048 同ファイルの7実例（11.18 𝒟_{C,Fe}、11.19 c𝒟_12、11.23 ρ𝒟_12 ×2、11.24 𝒟_12、11.26(c) 𝒟_im、11.28 𝒟_{air,N2O}、11.29 𝒟_{He,air}。ファイル全体に U+1D49F は0件、PDF 725–728）。C11-051 同ファイルの追加実例（11.43 𝒟_{He,m}・𝒟_{Ar,m}、11.46 answerHint 𝒟_{CH4,air}、11.47 ρ𝒟_12・c𝒟_12、11.49 answerHint 𝒟_{acetone,methanol}、PDF 729–732）。
- 𝒩: C11-042 `chapter-11.json` problem-11-3 (b)(c) の数密度（原典 𝒩_{H2}、PDF 721）。
- 𝒱: C02-F19 `chapter-02.json` problem-2-47 items[1]/[2]（原典 𝒱 / d𝒱。同問題の電圧差 ΔV と衝突する、PDF 110）。
- ℱ: C01-F25 `chapter-01.json` problem-1-45「伝達係数 F」（原典 ℱ ×3、PDF 60）。C02-F09 lessons「2.3」（blocks[8].text ×3、equations[7].expression、equations[9].meaning の平文 F、PDF 85–86）。C08-F13 `chapter-08.json` problem-8-46「（F = 1）」（原典 ℱ = 1、PDF 477）。※問題10.44 の ℱ は P2 のため CF2-028 で別扱い。
- ℓ: C02-F12 `2-4-ja.json` blocks[21].text「T_∞l − T_∞r」（原典はスクリプト ℓ (U+2113)。ファイル内に U+2113 は0件、PDF 94–95）。
- 𝒯（時定数）: C02-F16 `chapter-02.json` problem-2-22 items[0]（原典の時定数記号 𝑻 が文から完全に脱落、PDF 104）。C04-24 `chapter-05.json` 問題5.1「(T_i − bT)」、5.2「物体の時定数 T」、5.3 項目6「β = fn(ωT)」（原典は太字イタリック 𝑻、PDF 266–267）。C05-09 同ファイル 問題5.52・5.54・5.58（原典 𝒯。ファイル内に U+1D47B・U+1D4AF は0件、PDF 278–279）。
- 𝒳: C10-32 `11-6-ja.json` block[17] 式(11.69) と block[18] 表11.2 の長さ記号（原典はスクリプト 𝒳 (U+1D4B3)。熱側（式11.68）は平文 x が原典どおり、PDF 672）。
- 𝓂/𝓍: C10-06 `11-2-ja.json` blocks[2][4][5][10][11][21] と block[37]（質量分率 𝓂_i が平文 mi、PDF 638–644）。C10-07 同 blocks[2][8][9][10][11][13][20][21]（モル分率 𝓍_i が平文 xi、PDF 639–640）。C10-40 `11-5-ja.json` blocks[16][20][22][23][24][25][26][27]（質量分率 𝓂。スクリプト化は式(11.58a) 以降の非希薄部からで、前半（式11.50–11.57）の m は原典も平文、PDF 665–668）。C10-41 同 block[28] 式(11.62)・block[29] 例題11.10 散文（モル分率 𝓍。同じ crop 内の位置座標 x は平文で区別される、PDF 667–668）。復元は第11章で原典が意味区別に使う範囲（C10-40/C10-41 の登録範囲）について行い、C10-06/C10-07 も登録どおり取り込む。
- 𝒴: C03-15 lessons[15]「T=𝒳(x)Y(y)」（原典 𝒴 スクリプト体、PDF 161）。
- Đ: C11-037 `11-11-ja.json` の Maxwell–Stefan 係数（アプリは Ð U+00D0 ETH を blocks[8][17]–[20] ほかファイル全体で使用。原典は Đ（縦棒を横切る水平ストローク、U+0110 の書体形）、PDF 715–716）。

### CF2-039 (P3) クラス: 潜熱記号 h_{f𝒢} の第2添字 𝒢 の平坦化（hfg / h_fg） — 出典9件（併記実例1件）
- 修正方針: 原典の筆記体 𝒢 (U+1D4A2) を第2添字として復元する。係数位置の 𝒢（𝒢*_{m,2} 等）はアプリで正しく使われており、落ちているのは潜熱添字のみ。
- 章横断伝播チェック: 本クラスは第11章以外（第8章・第10章等の潜熱記号）にも及ぶ可能性が高いため、修正時に `data/` 全体を grep して伝播範囲を確認すること。対象範囲: `data/sections/*.json` と `data/original-deep-lessons.json`、`data/chapter-problems/*.json` の全ファイルで、文字列 `hfg`、`h_fg`、`h′fg`、`h'fg` の出現箇所を洗い出し、各箇所を原典画像で件別に判定する（係数位置の 𝒢 や原典が平文 g の箇所は対象外）。
- インスタンス:
- C11-018: `11-9-ja.json` blocks[30] 式(11.99) の hfg。C11-019: 同 blocks[29] 無番号式 q_s = q_u + hfg·n_{i,s}。C11-020: 同 blocks[31] 式(11.100) の hfg（PDF 693–696、原典はいずれも h_{f𝒢}）。
- C11-021: lessons[73] blocks[8] 式(11.99) 引用の h_fg。C11-022: 同 blocks[8] 式(11.100) 引用の h_fg。C11-023: 同 equations[6]（原書 (11.100)）の h_fg。C11-024: 同 blocks[4]・equations[3]（レッスン独自モデルでも h_fg と平文）。
- C11-030: §11.7 内の実例 — 式(11.74)（`11-7-ja.json` blocks[11] の hfg|_{T_wet-bulb}）、式(11.76a)（blocks[18] の hfg）、例題11.13 解（blocks[12] の h_fg = 2.466 MJ/kg）（PDF 681–684）。
- C11-056: §11.10 の実例 — `11-10-ja.json` blocks[24]（本文 hfg,A／hfg,B／hfg の3箇所）、blocks[33]（式(11.115) ×2）、blocks[34]（Table 11.5 の items）（PDF 707–708）。
- 併記実例（計数は CF2-050）: C11-060 の problem-11-32 continuation にも h_fg（原典 h_{f𝒢}）があり、本クラスが章末問題データにも及ぶ。

### CF2-040 (P3) クラス: μ のコードポイント U+00B5（MICRO SIGN） — 出典2件
- 修正方針: U+03BC（ギリシア文字 μ）への置換の可否は全体機械処理として判断する（表示上の差はないが、検索・スクリーンリーダー・数式処理では区別される）。Δ クラス（CF2-041）と同扱い。
- インスタンス:
- C05-31: 第6章全体の慣行 — `6-7-ja.json` block[17] explanation ×1、block[18] expression ×2、block[23] ×1 のほか、範囲内の第6章ファイルで計31箇所（6-1 ×6、6-2 ×10、6-3 ×1、6-4 ×6、6-5 ×4、6-7 ×4。U+03BC は0件、PDF 329–336 ほか）。
- C08-F06: `9-2-ja.json` block 16 expression 式(9.4) の q/(µhfg)（PDF 492–498）。付記: 同じコードポイントは `9-9-ja.json` blocks[2][3] の expression にもあり（C08 記録の注記）、修正時は corpus 全体の µ/μ 一貫性チェックとして扱う。なお C11 の範囲では同種の観察は却下されている（表示上同一の互換コードポイントのため）— 本クラスは C05/C08 の登録に基づくもので、扱いの不統一をここに明記する。

### CF2-041 (P3) クラス: Δ のコードポイント混在（U+0394 vs U+2206） — 出典2件
- 修正方針: 中央裁定により所見として存続（μ クラスと同扱い）。同一表示内・同一例題内の混在を解消する方向で、U+0394（ギリシア文字）への統一を検討する。
- インスタンス:
- C07-39: `8-4-ja.json` block 24 expression 式(8.42) — 第1の Δ は U+0394、第2の Δ は U+2206（各1件、PDF 452）。
- C07-52: 同 block 29 例題8.5 — (qwD/(∆T̄k))^(6/5) と「∆T̄ の表式」は U+2206、評価形ほかは U+0394（block 29 内: U+0394 ×3、U+2206 ×2。ファイル合計 29 対 3、PDF 453–454）。

### CF2-042 (P3) クラス: 図の alt/description の不足・誤述 — 出典84件
- 修正方針: 各図について、原典図中のラベル・軸・数値・パネル構成を alt/description に転記する（caption は多くの場合忠実であり対象外）。誤述型（値の過大表示・描かれていない内容の主張・「写真」誤称）は内容を書き換える。P2 の図項目（CF2-017 図9.12 alt、CF2-021 図9.18 description、CF2-026 図10.14 alt、CF2-027 図11.1 description）は第2部で別扱い。
- インスタンス（図ごと）:
- C01-F05: 図1.6（`1-3-ja.json` block 33）alt/description「約2×10³ W/m·K 級」— Diamond IIb のプロット位置は 1000 と 2000 の間（≈1.3–1.6×10³）で約40%過大（PDF 29）。
- C01-F14: 図1.10（同 block 105）alt が評価バーを `L|dT/dx|` と書く — 原典は末尾の評価バー `L dT/dx|_surface`（PDF 37）。
- C01-F17: 図1.13（同 block 141）alt/description が図中注記 "The hohlraum is kept at a uniform temperature" を欠く（PDF 43）。
- C01-F21: 図1.15（同 block 155）alt が定量的内容（軸・凡例・曲線ラベル 1646°…723°・可視光範囲マーカー）を欠く（PDF 45）。
- C01-F24: 問題1.19/図1.20（`chapter-01.json` problem-1-19）— 左面のラベルが原典では T∞ = 100 °C であり、その旨の注記が図記録にない（平行する問題1.22/図1.21 には「原図ではいずれも T∞ と表記」の注記がある。PDF 55）。
- C01-F27: 図2.1（`2-1-ja.json` block 5）alt が法線 n⃗ と "T = T(r,t)" ラベルを欠く（PDF 64）。
- C02-F02: 図2.6（`2-2-ja.json` blocks[23]）— ピーク注記 (T_℄ − T_w)/(q̇L²/k) = 1/8、"Eqn (2.15)" ラベル、軸定義・目盛を欠く（PDF 74）。
- C02-F05: 図2.8（同 blocks[48]）— 図中の等式 I = Q、ΔV = ΔT を欠く（PDF 76）。
- C02-F11: 図2.19（`2-4-ja.json` blocks[10]）— 熱回路の半分（R_t,conv / R_t,cond / R_t,boiling、ΔT）と配置ラベル L, h̄, h̄_b を欠く（PDF 93）。
- C02-F13: 図2.20（同 blocks[23]）— 回路式 R_t = 1/(h̄A) ×2 等と配置ラベルを欠く（PDF 95）。
- C02-F20: 図3.1（`3-1-ja.json` blocks[8]）— 4つの具体的応用、Fluid 1/2 と "dividing wall" ラベル、Q 矢印を欠く（PDF 114）。
- C02-F21: 図3.2（同 blocks[9]）— 4つの流れラベル（Steam, Cold water, Warm water, Noncondensible bleed）と泡立ち機構を欠く（PDF 114）。
- C02-F22: 図3.3（同 blocks[10]）— a/b/c 小キャプション、Fluid A/B、Baffles、パス数、(c) の mixed/unmixed の区別を欠く（PDF 115）。
- C02-F23: 図3.4（同 blocks[11]）— alt が右半分 "Plan view showing flow patterns" を欠く（PDF 116）。
- C02-F24: 図3.7（同 blocks[13]）— a)/b) 小キャプションと39項目の TEMA 名称リストがアプリデータのどこにもない（PDF 120）。
- C02-F32: 図2.11（`2-3-ja.json` blocks[38]）— Solution パネルの軸、Bi = 0.1, 1.0, ≃10 の3曲線、Configuration ラベルを欠く（PDF 81）。
- C02-F35: 図2.13（同 blocks[60]）— R_{t,condensation} = negligible 等の決定的ラベルと回路式を欠く（PDF 84）。
- C02-F36: 図2.21（`2-4-ja.json` blocks[31]）— Pipe, Insulation, Scale, r_i, r_o, r_p, h̄_i, h̄_o のラベルと "New pipe" / "Older pipe" パネルキャプションを欠く（PDF 97）。
- C02-F37: 図3.7 続き（PDF 121）— パネル c)・d) の構成名がアプリのどこにも列挙されていない（`3-2-ja.json` に図3.7 ブロックなし）。
- C02-F38: 図3.8（`3-2-ja.json` blocks[5]）— ΔT_a/ΔT_b の端部定義と局所 ΔT / dA マークを欠く（PDF 122）。
- C02-F39: 図3.9（同 blocks[7]）— T_cond = T_saturation の水平線、加熱側が水であることのラベルを欠く（PDF 123）。
- C02-F41: 図3.10（同 blocks[42]）— 両パネル（"Cross-section of a cylinder" / "The equivalent slab"）と図中ラベルを欠く（PDF 126）。
- C02-F42: 図3.11（同 blocks[54]）— "Combustion gases"、"(Large U Region)" / "(Small U region)"、"Flow boiling" / "Superheated vapor"、"Dryout"、軸を欠く（PDF 128）。
- C02-F44: 図3.13（同 blocks[64]）— 定義式 ΔT_mean = F(LMTD) = …、"2 shell-pass, 6 tube-pass"、交換器ラベル、下部の向流 T 図を欠く（PDF 131）。
- C02-F45: 図3.12（同 blocks[57]）— alt が線画の切断図を「写真」と誤称し、図の内容（バーナー、炉壁・ボイラー・過熱器チューブ、約2 m スケール）も欠く（PDF 129）。
- C02-F46: 図3.14（同 blocks[69]）— alt が4パネルを区別しない（特に (c) と (d) の R 曲線範囲と流れ inset の違い、PDF 132–133）。
- C02-F47: 図3.15（`3-3-ja.json` blocks[3]）— 既知ラベル（U = known 等）を欠き、「入口条件だけが与えられ」と過大に述べる（U・両熱容量率・面積も既知、PDF 135）。
- C03-11: 図4.2（`4-2-ja.json` block 15）— q̇ ラベルと r ≅ constant ラベルを欠く（PDF 159）。
- C03-27: 図4.5（`4-4-ja.json` block 3）description — "Physical configuration" パネル、両パネルの条件見出し、右パネルの Bi = 0, 1, 10 が欠落（PDF 174）。
- C04-05: 図5.6（`5-3-ja.json` block 2）alt — 図自体（時刻ごとの温度分布曲線群）でなく下の散文への言及になっている（PDF 217）。
- C04-09: 図5.13（`5-6-ja.json` block 3）alt — 主体の刀工の挿絵に触れず小さい断面図の1つだけを述べる（PDF 234）。
- C04-13: 図5.17（`5-6-ja.json` block 53）description — 図直後の段落の訳であり、図のラベル要素（R、x = 0、T_sat、T_sup、温度分布）を述べていない（PDF 244）。
- C04-18: 式(5.59)（`5-6-ja.json` block 61）の alt が末尾の等式「= √3 R_Jakob」しか読まず第1形が脱落（expression は全形を持つ、PDF 245）。
- C04-19: 図5.27（`5-8-ja.json` block 7）description 項目 c — 「長い」と「無限（平板）」の修飾語が脱落（PDF 263）。
- C05-04: 図6.3（`6-1-ja.json` block[17]）description — 脇文 "He was a significant contributor to the subject of fluid mechanics in the late 19th C. [6.3]." と "pictured below" の要素がない（PDF 288）。
- C05-32: 図6.18（`6-7-ja.json` block[11]）alt「平均自由行程と混合長さによる運動量交換を示す図」— 図は平板上の速度矢印と変動する速度分布、注記 τ_yx を描くもので、平均自由行程も混合長さも描かれていない（PDF 331、caption は一致）。
- C06-32: 図7.7（`7-3-ja.json` block 47）alt/description が図の内容を低 Pr の場合だけに狭めている（図は Pr ≫ 1 / order of one / Pr ≪ 1 の3領域、PDF 390）。
- C06-37: 図7.10（`7-5-ja.json` block 4）description/alt の不完全さ（ṁ の矢印と図下の関係式 "D_h = 4A_c/P" を欠く、PDF 397）。
- C07-03: 図7.18（`7-6-ja.json` block 30）alt「ピッチ P と角度 φ の定義図」— 図は C 対 D/P のグラフ＋三角管群の inset で、φ は現れない（PDF 411）。
- C07-06: 図8.3（`8-3-ja.json` block 11）alt「NuL 対 RaL の相関図」— 横軸は Ra_L でなく Ra_L/[1 + (0.492/Pr)^(9/16)]^(16/9)、上線も脱落（PDF 434）。
- C07-19: 図8.1（`8-2-ja.json` block 4）alt/description — 両パネルのラベル群（特に両 δ/δ_t 関係）を欠く（PDF 428）。
- C07-28: 図8.2（`8-3-ja.json` block 5）alt/description — 図中ラベル・関係式を欠き、description の −gβ(T − T∞) は図に現れず符号も図自身の式と逆（PDF 432）。
- C07-57: 図8.14（`8-5-ja.json` block 29）alt/description — 縦軸の量・横軸 Diameter ratio・曲線群 B・B の定義・右パネルのラベルを欠く（PDF 467）。
- C08-F01: 図9.1（`9-1-ja.json` block 6）description が図の上半分（Nukiyama の実験装置と較正曲線）を欠く（PDF 486）。
- C08-F02: 図9.2（同 block 8）description が軸・条件・q_max/q_min の値を欠く（PDF 488）。
- C08-F04: 図9.5（`9-2-ja.json` block 6）alt/description が力のつり合い式とラベル群を欠く（PDF 493）。
- C08-F08: 図9.7（同 block 17）alt/description が軸と6つの圧力系列・凡例を欠く（PDF 499）。
- C08-F14: 図9.8（`9-3-ja.json` block 4）alt が線画を「写真」と誤称（PDF 501）。
- C08-F15: 図9.9（同 block 7）description「基本間隔は λd1。」— block 6 が区別する λ_d2（基本間隔）と λ_d1 の区別を潰している（PDF 502）。
- C08-F18: §9.5 レッスン図（`assets/lesson-diagrams/section-9-5-minimum-heat-flux-berenson.svg` の `<desc>`、`lesson-diagrams.mjs` にも複製）— 描かれた曲線の形状（核沸騰上昇→CHF ピーク→遷移下降→q_min の谷→膜沸騰上昇）を述べていない（図形自体は正しい）。
- C08-F20: 図9.14（`9-6-ja.json` block 3）alt/description が流体・材料（Copper–Pentane)、軸・単位、パネル区別、凡例を欠く（PDF 519）。
- C08-F21: 図9.15（同 block 5）alt/description が第3の曲線（液固接触なしの膜沸騰）と q_max/q_min のレベル線を欠き、description は「接触の増減で2領域が接続される」と描かれていない接続を述べる（PDF 520）。
- C08-F25: 図9.16（`9-7-ja.json` block 6）alt/description が図中注記群と関係 q ∝ (T_w − T_bulk)^(5/4) を欠く（PDF 522）。
- C08-F28: 図9.17（同 block 14）alt/description が下半分のグラフ（ℓn q vs ℓn(T_w − T_sat)、q_FC、q_B、沸騰開始点、q_i）を欠く（PDF 525）。
- C08-F29: 図9.19（`9-8-ja.json` block 5）description が図（領域マップ A–H、3パネル、バーンアウト線）を述べず本文の注意の言い換えになっている（PDF 528）。
- C08-F32: 図9.20（同 block 19）description が7つの描かれた様式のうち成層流しか名指ししない（PDF 533）。
- C08-F33: 図9.21（`9-10-ja.json` block 3）description がパネル (b)（Mikić の写真）を欠く（PDF 537）。
- C08-F34: 図9.22（`9-11-ja.json` block 2）alt/description が Q_in/Q_out、流れ方向、断面 inset を欠く（PDF 539）。
- C08-F38: 図9.4（`9-2-ja.json` block 3）alt/description — "(rms variation of surface height)" ラベルがなく、"Gas pockets" を「蒸気ポケット」と狭めている（PDF 492）。
- C09-01: 図10.1（`10-1-ja.json` block[6]）— 定義注記 Q_net = Q_{1 to 2} − Q_{2 to 1}、双方向矢印、T₁・T₂ ラベルを欠く（PDF 558）。
- C09-09: 図10.5（`10-2-ja.json` block[12]）alt「平行平板の模式図」— 無限の広がりと両ラベルを欠く（PDF 567）。
- C09-10: 図10.6（`10-3-ja.json` block[4]）— 3配置の形態係数の値を伝えない（PDF 569）。C09-11: 図10.7（同 block[5]）— 面番号 (2)(3)(4) と図中総和式を欠く（PDF 570）。
- C09-13: 図10.8（同 block[15]）— 法線ベクトル、T₁/T₂、dA₁/dA₂、関係式 dQ_net = … を欠く（PDF 573）。
- C09-20: 図10.9（同 block[21]）— description が「本文の説明に基づく。」というメタ注記で、線図4パネルの配置・軸・パラメータを示さない（PDF 577）。
- C09-21: 図10.10（同 block[22]）— description が空文字列（PDF 578）。C09-24: 図10.12（同 block[26]）— description が空で図ラベル（T_h = 1200°C、T_s = 100°C、寸法）が伝わらない（PDF 580）。
- C09-22: 図10.11（同 block[24]）— 実面／仮想面の実線・破線の区別を伝えない（PDF 579）。
- C09-25: 図10.13（`10-4-ja.json` block[3]）— 左半分（平板と仮想面）と右回路の3つの抵抗式を欠く（PDF 582）。
- C09-30: 図10.15（同 block[32]）— 円内挿入図、回路下の注記、小キャプションを欠く（PDF 588）。
- C09-32: 図10.16（同 block[38]）— description が空で図ラベル（T₁ = 400 K・ε₁ = 0.3 等）を欠く（PDF 589）。C09-33: 図10.17（同 block[42]）— description が空で図内の2式（H_i、B_i）を欠く（PDF 592）。
- C09-35: 図10.18（同 block[50]）— description が辺と材料・ε・T の対応を伝えない（長さのみ、PDF 594）。
- C09-38: 図10.19（`10-5-ja.json` block[5]）description — モードの数（CO₂ 4つ / H₂O 3つ）と左右の帰属を示さない（PDF 597）。
- C09-39: 図10.20（同 block[8]）— description が空文字列（PDF 599）。
- C09-41: 図10.22・10.23（同 blocks[26][27]）— description が空で alt も一般的名称のみ（PDF 603–604）。
- C09-44: 図10.24・10.25（同 blocks[28][29]）— description が空で alt は「圧力補正係数の線図」のみ（PDF 605–606）。
- C09-45: 図10.26（`10-6-ja.json` block[5]）— description が空（図内数値の一部は caption の補足文に転記されるに留まる、PDF 610）。
- C10-23: 図11.7（`11-4-ja.json` block[4]）— alt「検査体積の模式図」、description 空。導出が参照する図ラベル（R、S、dS、dS⃗ の定義、j⃗_i、v⃗、dR、r_i）が一切ない（PDF 653）。
- C10-24: 図11.8（同 block[16]）— alt「吸収界面の模式図」、description 空。軸 x と m_NH3、表面 s/u、濃度の跳び、拡散方向が描かれる（PDF 655）。
- C10-29: 図11.11（`11-5-ja.json` block[7]）— alt「平板内の濃度分布の模式図」、description 空。m₂ vs x、種1の平板、直線的減少、n₂ の矢印が alt にない（PDF 662）。
- C11-031: 図11.18（`11-8-ja.json` blocks[4]）— description はあるが図中の m_{2,e}/m_{2,s} ラベル、n_{2,s}・j_{2,s} の矢印、乱流平均速度プロファイルと u_e、x 軸に触れていない（PDF 685）。
- C11-036: 図11.19（同 blocks[19]）— description はあるが水側プロファイル、j_salt・v・n_{H2O,s} の矢印、海水の流れ u_e、membrane ラベルに触れていない（PDF 688）。
- C11-040: 図11.28（`11-11-ja.json` blocks[12]）— description は「面積 A のスラブ、厚さ dz。」のみで、x_1 勾配、3つの力の向き、z 軸をほぼ含まない（PDF 716）。

### CF2-043 (P3) クラス: caption の文の追加・欠落・順序の相違 — 出典11件
- 修正方針: caption は原典キャプションの訳文のみとし、図内ラベルや図の内容の説明は alt/description 側へ移す（内容自体が正しい追加も caption からは除く）。欠落・順序も原典に合わせる。
- インスタンス:
  - C01-F15: 図1.10（`1-3-ja.json` block 105）caption が原典の3文のうち第1文のみ（残りは alt/description が部分的に担う、PDF 37）。
  - C05-27: 図6.19（`6-8-ja.json` block[14]）caption 末尾に「Pr = 0.71（空気）。」を追加 — 原典では図内部の枠ラベル（PDF 340）。
  - C06-04: 図6.21（`6-9-ja.json` block 5）caption が凡例の要約を欠く（Eqn. (6.111) with eqn. (6.102)、Nu_lam の式、Reynolds et al. / Kestin et al. のデータ系列、PDF 344）。
  - C08-F37: 図9.3 パネル b（`9-1-ja.json` block 14）caption が2ビューの順序を原典と逆に並べる（原典は methanol → benzene、PDF 489。値の対応付け自体は正しい）。
  - C09-06: 図10.2（`10-1-ja.json` block[16]）caption に「挿入図は ε = 0.6 の灰色体のスペクトルを示す。」を付加（PDF 561）。
  - C09-07: 図10.4（同 block[24]）caption が図内ラベルの転写3文を含む（原典は1文のみ、PDF 564）。
  - C09-40: 図10.22（`10-5-ja.json` block[26]）caption に「曲線は paL（bar-cm）の値ごとに示される。」を付加（PDF 603）。
  - C10-02: 図10.27 対応（`10-6-ja.json` block 13）caption 末尾に「年平均と5年移動平均が示される。」を追加 — 原典 caption は謝辞で終わり、当該文は図中の凡例のみ（PDF 615）。
  - C10-25: 図11.8（`11-4-ja.json` block[16]）caption に「界面の両側の表面 s と u で濃度が異なる。」を追加（PDF 655）。
  - C10-42: 図11.14（`11-5-ja.json` block[31]）caption — 原典 caption の N₂ は平文（矢印なし）だが、アプリは図内部のラベル N⃗₂ の矢印を caption へ過剰適用し、さらに印刷 caption にない文を追加（PDF 668）。
  - C11-013: 図11.17（`11-7-ja.json` blocks[17]）caption に原典にない第2文（m 分布の説明）を追加（原典は1文のみ、PDF 684）。

### CF2-044 (P3) クラス: ページ跨ぎメタデータの誤り（終了ページ +1・図ロケータ・範囲不足） — 出典32件
- 修正方針: 「終了ページ＝その問題・節の最終ページ」の規約に合わせ、各実例の endBookPage/endPdfPage・図の bookPage/pdfPage・節ヘッダの範囲を実終了ページに直す。問題文・内容自体は無事。
- インスタンス:
  - C01-F01: `book.json` appendices[3] が Citation Index と Subject Index を1エントリに統合し、Subject Index の開始（書籍785 = PDF 799）と Indices の部題ページ（書籍775 = PDF 789）が記録されていない（開始777自体は正しい、PDF 13）。
  - C01-F03: `book.json` のメタデータ欠落 — (a) 付録 A/B/C に sourceTitle がない（原典題: A "Some thermophysical properties of selected materials", B "Units and conversion factors", C "Nomenclature")、(b) 第6–11章に backMatter がない（原典の開始: Ch.6 Problems 337 / References 346、Ch.7 399/409、Ch.8 456/466、Ch.9 528/534、Ch.10 604/614、Ch.11 707/721、PDF 9–12）。
  - C01-F23: ページ範囲メタデータの不正確さ6実例 — (a) `1-5-ja.json` の宣言 35/49 に対し実範囲は 35–36 / 49–50、(b) `1-4-ja.json` の宣言 34/48 に対し実範囲は 34–35 / 48–49、(c) problem-1-6 の end 38/52 は正しくは 37/51、(d) 問題1.29・1.35・1.42 の endPdfPage が実終了ページの1ページ先（PDF 49–60）。
  - C02-F06: 図2.18 のブロックが `2-3-ja.json` blocks[113]（bookPage 78 / pdfPage 92）に格納されているが、同ファイルの宣言範囲は PDF 77–91 で、図は §2.4 の冒頭ページ（PDF 92）に印刷され、`2-4-ja.json` には図ブロックがないのに blocks[2] 本文が図2.18 を参照する。
  - C02-F18: `chapter-02.json` の終了ページ +1 ×4 — problem-2-17（106→正しくは 105 ではなく endPdfPage 104、正しくは 103)、problem-2-29（106、正しくは 105)、problem-2-41（108、正しくは 107)、problem-2-48（111/97、正しくは 110/96)。
  - C03-20: 問題3.39 の endBookPage=136 / endPdfPage=150（正しくは書籍135 / PDF 149 で完結、PDF 149）。
  - C03-60: 問題4.7 の figure.bookPage = 185 / figure.pdfPage = 199 は問題文のページで、図4.14 自身の印刷ページは書籍184 / PDF 198。
  - C03-61: 章末問題の終了ページ +1 のクラス6実例 — 問題4.2（現行 end 198、正しくは 197)、4.6（199、正しくは 198)、4.11（200、正しくは 199)、4.17（201、正しくは 200)、4.30（203、正しくは 202)、4.37（204、正しくは 203)。同型はページ末尾で終わる問題にのみ現れる（C03-20 と同クラス、PDF 197–204）。
  - C04-04: `5-3-ja.json` の bookPages/pdfPages「203–206 / 217–220」— blocks 27後半–34 は書籍207 / PDF 221 に印刷され、実範囲は 203–207 / 217–221。
  - C06-10: problem-6-8 の end 338/352（正しくは PDF 351 で完結）。C06-11: problem-6-13 の end 339/353（正しくは PDF 352、PDF 352–353）。C06-19: problem-6-42 の end 344/358（正しくは 343/357)。C06-20: problem-6-47 の end 345/359（正しくは 344/358)。C06-21: problem-6-49 の end 346/360（正しくは 345/359）— `chapter-06.json` 内で計5件の同型異常。
  - C06-38: `7-5-ja.json` ヘッダ「382–386 / 396–400」— 表7.4 と末尾の文は書籍387 / PDF 401 に印刷され blocks 15–16 が収録している（実範囲は 387 / 401 まで）。
  - C07-17: `chapter-07.json` の終了ページ +1 ×3 — 問題7.2（400/414、正しくは PDF 413 で完結)、7.18（402/416、正しくは 415)、7.27（403/417、正しくは 416)。
  - C08-F10: problem-8-50 の end 464/478（正しくは 463/477)。C08-F11: problem-8-57 の end 466/480（正しくは 465/479)。
  - C08-F39: 図9.23（`9-11-ja.json` block 6）の bookPage 528 / pdfPage 542 は参照文のページで、図版自体は書籍529 / PDF 543。
  - C08-F41: problem-9-2 の figureRefs が ["Fig. 9.3"] でパネル文字 b を欠く（本文は「図9.3b」と正しい、PDF 542）。C09-05: problem-9-29 の figureRefs も ["Fig. 9.3"] でパネル d を欠く（PDF 546）。
  - C09-43: 例題10.11（`10-5-ja.json` block[31] と lessons[63]）の図引用「図10.22は…」がパネル文字 a を欠く（原典 "Fig. 10.22a gives ε⁰ as 0.084"、PDF 607）。
  - C10-10: problem-10-16 の figure ブロック bookPage 607 / pdfPage 621 — 図10.34 は書籍608 / PDF 622 冒頭に印刷。C10-19: problem-10-9 の figure ブロック（figureNumber "Fig. 10.29", bookPage 605, pdfPage 619) — 図10.29 は書籍606 / PDF 620 冒頭。
  - C10-12: problem-10-13 の end 607/621（正しくは書籍606 / PDF 620 で完結）。C10-18: problem-10-1 の end 605/619（正しくは 604/618)。C10-17: problem-10-45 / 10-51 / 10-55 の endBookPage がいずれも bookPage + 1（45: 611→612、51: 612→613、55: 613→614）だが3問とも開始ページ内で完結。
  - C11-047: 問題11.9（endPdfPage 723、正しくは 722)、11.13（724、正しくは 723)、11.17（725、正しくは 724）の +1。C11-053: 問題11.41（731、正しくは 730)、11.45（732、正しくは 731)。C11-054: 問題11.55（endPdfPage 734 / endBookPage 720、正しくは 733 で完結）。C11-059: 問題11.22（726/712、正しくは 725/711)、11.30（728/714、正しくは 727/713）— 本クラスは第11章で合計8問。C11-055: problem-11-58 内の figure オブジェクト（図11.29）の bookPage 720 / pdfPage 734 — 図とキャプションの実印刷位置は書籍721 / PDF 735。

### CF2-045 (P3) クラス: 表示式・導出中間形の欠落／未収録 — 出典37件
- 修正方針: 原典の表示式・中間形を formula ブロックまたは表示として追加する（端点と結果は正しく存在するため、表示の補完が中心）。要約転記として許容するかの判断が可能な性質の項目（C04-10 等）はその旨を併記した。
- インスタンス:
  - C01-F04: §1.3 α の定義（`1-3-ja.json` block 61）— 原典の単位相殺チェーン `α ≡ k/(ρc) · J/(m·s·K) · m³/kg · kg·K/J = α m²/s` が表示にない（PDF 32）。C01-F16: 例題1.4（同 block 117）— 中間形 (πD³/6)/(πD²) と単位チェーンが脱落（結果 1.116 s は正しい、PDF 39）。
  - C01-F07: 式(1.5)（`1-2-ja.json` block 26）の下波括弧注記（Ṡ_wall: "= 0, since S_wall must be constant"）が expression にない（PDF 23）。C01-F10: 式(1.10)（`1-3-ja.json` block 23）の下波括弧注記（"since, in steady conduction, q is constant"）が expression にない（PDF 27）。
  - C01-F12: §1.3 の単位換算表示 `1 = 0.0009478 Btu/J · K/1.8°F · 3600 s/h · (0.3048 m)²/ft²` に formula ブロックがない（係数・値は式(1.18) の explanation 内にのみ存在、PDF 33）。
  - C02-F07: 式(2.28)（`2-3-ja.json` blocks[74]）— 中間行 A₁ℱ₁₋₂σ(T₁² + T₂²)(T₁² − T₂²) と下波括弧の恒等式群がなく最終形へ直行（PDF 86）。C02-F08: 例題2.7（同 blocks[87]）— 2つの表示を統合し h_rad の記号形 4σT_m³ε が等式チェーンから脱落（PDF 87）。
  - C02-F26: 例題2.4 Step 2（同 blocks[21]）— 下波括弧注記付きの円筒熱方程式の表示に formula ブロックがなく散文の言い換えのみ（PDF 78）。C02-F31: 例題2.5 Step 4（同 blocks[42]）— 独立表示 "q_convection = q_conduction at the wall" が散文に縮約（PDF 81）。
  - C02-F33: 例題2.5 Step 8（同 blocks[50][51]）— 文 "This can be written in terms of Q (W) = q_radial(2πrl)…" が本文になく blocks[51].explanation 内にのみ残り、(W) 注記も脱落（PDF 83）。
  - C02-F43: 例題3.2（`3-2-ja.json` blocks[45].text）— ロピタルの適用の中間2段階（導関数の比とその簡約）が脱落（開始形 (0/0) と結果は正しい、PDF 126）。
  - C03-08: §4.2 デカルト座標の注記付き表示式（`4-2-ja.json` は block 5 の文章要約のみ、PDF 158）。C03-09: 同 円筒座標の注記付き表示式（block 12 の文章要約のみ）。C03-10: 同 一様温度の場合の全形表示 `∇²T + q̇/k = (1/α) ∂T/∂t`（block 18 は約分形のみ、PDF 159）。C03-33: 式(4.40) と (4.41) の間の中間表示（`4-5-ja.json` block 30 → 31 に直行、PDF 183）。
  - C04-10: §5.2 の無番号中間表示 ×2 — O-1（𝒯₁𝒯₂ d²T₁/dt² − … の表示、PDF 215）、O-2（`0 = [−b/2 + √((b/2)² − c)]C₁ + …` の拘束表示、PDF 216）。番号付き式と両端点・結果は全て存在し、欠けているのは代数整理の中間段のみ（要約として許容する判断も可能な性質として記録された項目）。
  - C05-13: 式(6.9)（`6-2-ja.json` block[9]）が段落内インラインのみで番号付き formula ブロックがない（PDF 293）。C05-15: 式(6.30)（同 block[62]）の原典形 `−d/dx [δ(39/280)] = −ν/(u∞δ) · (3/2)` がなく、整理形と右辺を欠いた断片のみ（PDF 304）。
  - C06-24: 式(7.19) と (7.20) の間の積分定数 C1・C2 の決定過程の段落（C2 = T_b − (7/24)(q_w R/k) の表示結果を含む）がアプリにない（PDF 373）。
  - C07-07: §8.3（`8-3-ja.json` block 18 text）— 式(6.47) の積分左辺が省略され右辺の等式のみ（全形は節ファイル内のどこにもない、PDF 436）。
  - C07-20: 式(8.21)（同 block 25 explanation）— 中間の dδ⁴/dx の行がなく、アプリ発案の略記 G で置換（PDF 439）。C07-21: 同 — エネルギー方程式の代入表示そのものがファイルにない（block 26 に評価値のみ、PDF 439）。C07-22: 同 — 簡約行 3(C₁/30)δ³ dδ/dx = … がなく block 26 が積分結果へ直行（PDF 440）。C07-23: 同 — 式(8.24) の前の中間形 δ⁴ = 240(20/21 + Pr)(…)x がない（block 27 → 28、PDF 440）。C07-24: 式(8.25)（同 block 28 explanation）— 3項のうち中項（下波括弧値 −2 を担う）が省略（PDF 440）。
  - C07-47: 例題8.5（`8-4-ja.json` block 29）— ΔT̄ 表示の数値代入項が省略（記号形と = 144 K のみ、PDF 453）。C07-48: 同 — 修正 ΔT̄ の表示自体が省略（入力と結果 131 K のみ散文、PDF 454）。
  - C07-53: 例題8.7（`8-5-ja.json` block 25）— 式(8.65) が簡約形のみで分数の全形（(cos θ)^{4/3}/(cos θ)^{1/3} の帰属を含む）が現れない（PDF 465）。C07-54: 例題8.8（同 block 26）— 2つの表示が散文に圧縮され、g_eff の表示と h̄ 積分の被積分関数がない（PDF 465）。
  - C08-F36: 式(9.45) と (9.49)（`9-8-ja.json` blocks 9 / 11 の explanation 内インラインのみ）に独立した formula ブロックがない（内容は正しい、PDF 529–530）。
  - C09-12: §10.3（`10-3-ja.json` block[14]）— 式(10.16) の前の無番号表示式 dQ_{1 to 2}・dQ_{2 to 1} の両方が節内にない（PDF 573）。
  - C09-27: 例題10.8（`10-4-ja.json` block[26]）— シールド付き一般形の記号式が表示されない（数値結果は一致、PDF 586）。C09-28: 同 — シールド温度の記号式の行がない（数値行のみ）。
  - C09-29: 式(10.34b)・(10.34c)（(10.34a) のみ block[31] にあり、他は番号への言及のみ。節ファイルにも lessons[62] にもない、PDF 587）。
  - C09-34: 例題10.9 (a)（`10-4-ja.json` block[36]）— 中間連立方程式の表示（2組）がファイル内のどこにもない（解と下流の値は一致、PDF 590）。C09-36: 例題10.10（同 block[49]）— 代入済み B₁/B₂/B₃ 連立方程式が一般形に圧縮されている（PDF 594）。
  - C11-010: 例題11.14（`11-7-ja.json` blocks[13]）— 液滴質量バランス式の下波括弧ラベル "rate of mass increase" / "rate of evaporation" がアプリにない（PDF 682）。

### CF2-046 (P3) クラス: 代入表示の圧縮（単位注記・中間項の脱落） — 出典10件
- 修正方針: 例題の代入行に原典の単位注記・中間項を復元する（数値・結果は全件一致している）。
- インスタンス:
  - C02-F28: 例題2.3（`2-3-ja.json` blocks[15].expression）— 代入の第3因子の単位ラベル [kg H₂O/kg mixture] が脱落（原典 "(0.01 [kg H₂O/kg mixture] / 1 m)"、アプリ "(0.01/1 m)"、PDF 78）。
  - C02-F29: 式(2.21)（同 blocks[34].expression）— 単位注記 "Q (W)" の (W) が脱落（PDF 80）。
  - C07-26: 式(8.26)（`8-3-ja.json` block 30 expression）— 中間項の係数が原典の分数 2/3.936 でなく丸めた 0.508 になっている（0.508 は最終の Ra 形専用、PDF 440）。
  - C10-05: 式(11.7)（`11-2-ja.json` block[9]）— 中間項 `Σ_i c_i/c` が脱落（原典 `Σ_i 𝓍_i = Σ_i c_i/c = 1 and 0 ≤ 𝓍_i ≤ 1`、PDF 639）。
  - C10-09: 例題11.2（同 block[37]）の質量バランス表示 — アプリ「12.0 kg C + 16.0 kg O2 → 28.0 kg CO」、原典 "12.0 kg C + 32.0/2 kg O₂ ⟶ 28.0 kg CO"（値は同一だが反応量論で半分にする代入形の追跡可能性が失われている、PDF 644）。
  - C10-37: 例題11.11（`11-6-ja.json` block[19]）のインライン式(6.68) — 中間項 h̄L/k が脱落（原典 `Nū_L = h̄L/k = 0.664 Re_L^{1/2} Pr^{1/3} (6.68)`。本ページ唯一の h̄ マクロンも同時に落ちる、PDF 674）。
  - C11-002: `11-8-ja.json` block[20] — n_{H2O,s} の代入表示が圧縮され単位注記が脱落（アプリ「−(998)(15×10⁻³)/3600」、原典「−(998 kg/m³)(15 L/m²h)(10⁻³ m³/L)/(3600 s/h)」、PDF 689）。C11-003: lessons §11.8 block[9] の同じ代入表示の圧縮。
  - C11-004: `11-8-ja.json` block[20] — 原典が明示する中間の積の形 𝒢*[ln(1+B_{m,H2O})/B_{m,H2O}]·B_{m,H2O} を経ず最終形のみ（PDF 689）。
  - C11-033: `11-8-ja.json` blocks[11] 式(11.80) — 原典の中間段階 [∫]⁻¹·lim[ln(1+B_{m,2})/B_{m,2}] がなく最終形のみ（PDF 686）。

### CF2-047 (P3) クラス: 積の中点ドット「·」の挿入・過剰 — 出典4件
- 修正方針: 原典が並置の箇所から挿入された中点を除く（真のドット積 u⃗ · n⃗ の箇所は保持）。スカラー同士の区切りは対象外とする実例（C10-21 の注記）に従う。
- インスタンス:
  - C04-08: 式(5.43)（`5-5-ja.json` block 4）の expression「D₁·exp(−λ̂₁²Fo)」— 原典は D₁ と exp の間に中点がない（同ページの式(5.42) には中点が印刷されアプリも正しい、PDF 230）。
  - C05-10: §6.2 の系統的挿入 — `6-2-ja.json` blocks[5][6]（式(6.7)）[7][8]（式(6.8)）[9]（式(6.9)）[23]。現行例: 式(6.7)「dṁ = ρ·u⃗·n⃗·dA = ρ·dψ」（原典「dṁ = ρu⃗ · n⃗ dA = ρdψ」— ドットは真のドット積のみ）。n⃗·dA のような見かけのドット積を生む（PDF 293–296）。
  - C10-21: 式(11.40)・(11.42)（`11-4-ja.json` block[7][9]）の `∇·(ρi·v⃗)` — 原典は並置（PDF 653）。注記: 同種の挿入は式(11.38)/(11.39)（PDF 652）にも存在する（W10 は統一符号化慣行として未登録）。CF2-031（C10-39）の `𝒟im·t` の中点も本クラスの実例。
  - C10-26: §11.5 の体系的挿入 — `11-5-ja.json` blocks[3][4][5][6][9][13][14][16]（式(11.50) `ρi·v⃗`、式(11.51)、式(11.53)、式(11.55)、散文 `mi·n`、`𝒟21·dm2/dx`、`𝒟im1·∂²mi/∂x²` 等）。原典は全て並置（PDF 661–664）。

### CF2-048 (P3) クラス: 評価記号（縦バー）の正規化 — 出典7件
- 修正方針: 原典が平の下付きで書く温度因子等を縦バー形から戻し、原典が下付きで書く評価標記をアプリの縦バー統一から戻す（意味は変わらない表示形の忠実度）。
- インスタンス:
  - C02-F30: 例題2.5（`2-3-ja.json` blocks[43] 境界条件と blocks[45] 式(2.23)）— 原典は LHS が括弧直後の下付き _{r=rₒ}（縦バーは RHS のみ）、式(2.23) は両辺とも括弧＋下付き。アプリは両式とも両辺に |_{r=rₒ}（PDF 81–82）。
  - C03-26: 式(4.22)（`4-4-ja.json` block 13）— 原典 Bi₁(1 − Θ_{ξ=0}) = −Θ′_{ξ=0} 等（下付き ξ=0 / ξ=1、縦バーなし、Bi₂Θ は並置）。アプリは縦バー化＋「·」追加（PDF 175）。
  - C03-37: 式(4.20)（同 block 7）— 原典は温度因子が平の下付き（h̄₁(T₁ − T)_{x=0} 等）、バーは微分因子のみ。アプリは4因子全てに縦バー（PDF 174）。
  - C03-28: 式(4.28)（`4-5-ja.json` block 13）— 最終因子 (T − T∞) は原典では平の下付き _x、アプリはバー付き（PDF 179）。C03-29: 式(4.31a)（同 block 15）の温度因子 ×2（同上、PDF 180）。C03-30: 式(4.31b)（同 block 15）の温度因子（同上）。
  - C05-19: §6.3（`6-3-ja.json` block[19]）の h の導出 — 原典は η=0 が閉じ括弧の外で積全体を評価する（`k ( ∂f′/∂η · ∂η/∂y )_{η=0}`）。現行の線形表記では |η=0 が末尾の因子にのみ係るように読める（PDF 311）。

### CF2-049 (P3) クラス: 制作注記・監査文の本文への混入 — 出典2件
- 修正方針: 学習者向けコンテンツから制作・監査過程の文言を除去する。
- インスタンス:
  - C05-29: `6-7-ja.json` block[9]（式(6.80) 再掲文）— 現行「…= ū + ū′（overline） が得られる（式(6.80)）」と英語の制作注記「（overline）」が日本語本文に残存（あわせて上線は u のみに付き、原典は u′ 全体（プライムを含む）に架かる — CF2-036 の範囲の問題と同根、PDF 330）。
  - C08-F26: `9-7-ja.json` block[13] explanation に「原典PDF p.524（書籍p.510）の画像で、径比の1/3乗とWeDを含む括弧のA乗を別々に確認した。」という一人称の検証過程の文が混入（式(9.40) の内容自体は正しい、PDF 524）。

### CF2-050 (P3) クラス: 添字の平坦化・脱落・付加 — 出典20件
- 修正方針: 入れ子添字・複合添字を原典の構造に復元し、脱落した添字・条件を補い、付加された記号を除く。
- インスタンス:
  - C01-F18: 式(1.30)（`1-3-ja.json` block 157）— 入れ子添字 e_{λ_b} が "e_λb" に平坦化、c_o（添字の文字 o）が c₀（U+2080 数字ゼロ）に置換（PDF 44）。C01-F19: 同 block 145 の α_{λ_b} が "α_λb" に平坦化（PDF 42）。
  - C02-F03: `2-2-ja.json` blocks[46][47] の "R_t,slab"（カンマ形 ×3）— 原典は入れ子添字 R_{t_slab}（式(2.16)、PDF 76）。同種のカンマ線形化は R_t,equiv（原典 R_{t,equiv}）等ファイル全体に及ぶ。C02-F34: `2-3-ja.json` blocks[59] 脚注3 — 原典 R_{t,condensation}（全文添字）が裸の R_t に（PDF 83）。
  - C03-03: `4-1-ja.json` block[8]「T = Ti(x, y, z)」（原典 T = T_i(x, y, z)、PDF 156）。C03-04: lessons[14] blocks[6]・equations[4] の同じ平書き。C03-22: 問題3.43(a)（`chapter-03.json` problem-3-43 items[0]）— 原典の条件 T_{c,in} が T_c に化けている（PDF 151）。
  - C04-20: 例題5.12（`5-8-ja.json` block 12）— 原典は添字 1/2 が比全体 (x/L) に付く（Θ[(x/L)₁ = 0, (x/L)₂ = 1/2, …]）。アプリの「x/L1」「x/L2」は添字が L に付いた形に読める（数値・結果は正しい。記録には P2 格上げの余地の明示あり — 中央裁定により P3 のまま、PDF 264）。
  - C05-08: 問題5.58（`chapter-05.json` problem-5-58 answerHint）「平板：t/T = Bi_L·Fo_L」— 原典 "[slab: t/𝒯 = Bi_L Fo_l]"（Fo の添字は小文字 l。アプリは L に大文字化し原典にない「·」も挿入、PDF 279）。
  - C05-16: 式(6.24)（`6-2-ja.json` block[55]）— 積分上限 δ(x) の (x) が脱落（PDF 303）。C05-17: 式(6.25)（同 block[57]）— τ_w(x) の (x) が脱落（右辺 C_f(x) のみ保持し非対称、PDF 303）。
  - C07-31: `8-4-ja.json` block 8 — 判定式の Gr の長さ添字 "x or L" が脱落（原典 "(x or L)/R < 0.08 Gr_{x or L}^{1/4}"、PDF 446）。C07-32: lessons[46] block 16 の同じ脱落。
  - C09-37: 例題10.10（`10-4-ja.json` block[49]）の最終式が裸の「Q = … = −1294 W/m」で、原典が一貫して使う Q_net1 のラベルがない（PDF 594–595）。
  - C11-025: 式(11.100)（`11-9-ja.json` blocks[31]）の比熱が "cp,if" と平坦化 — 原典 c_{p,i_f}（f は i の入れ子添字、PDF 695）。C11-026: 同 blocks[29] の定義文「cp,if は液体 i の比熱」も同上。C11-027: lessons[73] blocks[8] の式(11.100) 引用の c_p,if。C11-028: 同 equations[6] の expression と meaning の c_p,if。
  - C11-046: 問題11.13 式(11.142)（`chapter-11.json` problem-11-13）— 末尾項にアプリが ‴ (トリプルプライム）を付加（ṙ_i‴)。原典は ṙ_i（ドット1つのみ、プライムなし、PDF 723）。
  - C11-060: problem-11-32 の continuation「c_{p,eth} = 1420 J/kg·K」はカンマ入り — 原典は入れ子添字 c_{p_eth}（カンマなし、PDF 728）。同じ continuation の h_fg は CF2-039 の併記実例。

### CF2-051 (P3) クラス: 散文・文・脚注の脱落 — 出典8件
- 修正方針: 脱落した文・段落・脚注を原典から補う。
- インスタンス:
  - C01-F02: §1.1（`1-1-ja.json` block 12, item 6）— 冷蔵庫の箇条書きが3つの主要過程のみで、原典の "and several lesser ones" に対応物がない（PDF 20）。
  - C01-F09: §1.3（`1-3-ja.json` block 18）— 式(1.9) の後の段落が原典3文のうち第1文のみ（第2・3文は block 17 の explanation 内にのみ残る、PDF 27）。
  - C04-11: §5.7（`5-7-ja.json` block 29 式(5.66)）の explanation — 原典段落の第2文（"For these situations, the heat flow always equals a function of the geometric shape of the body multiplied by kΔT."）が節ファイルのどこにもない（PDF 254）。
  - C06-22: §7.2（`7-2-ja.json` block 13）— 図7.2 に関する文 "Figure 7.2 extends to the [x_{e_t}] where the shape of the temperature profile remains the same except for being further displaced or stretched." に対応する訳文がない（PDF 369）。
  - C07-02: §7.6 閉じの散文（PDF 410–411）— レビュワー名 "El-Genk and Schriener [7.46]" と "Hewitt [7.47]" がアプリになく、要旨のみ block 27 の explanation に参照番号だけで残る。
  - C07-50: §8.5（`8-5-ja.json`）— 脚注8（"Vijay K. Dhir very kindly recalculated his data into the form shown in Fig. 8.10 for use here."）が完全に欠落し、Dhir の引用箇所にマーカーもない（脚注7・9・10・11 はある、PDF 456）。
  - C09-42: §10.5（`10-5-ja.json`）— Table 10.4 と例題10.11 の間の導入散文2文がファイル内にない（PDF 607）。
  - C10-20: §11.4（`11-4-ja.json` block[28]）— 文献参照 [11.14] が脱落し後続の表示式の番号 (11.49) に置換されている（同パケット内の他の引用 [11.12][11.13][11.15][11.16] は保持、PDF 659）。

### CF2-052 (P3) クラス: 単位ベクトルの帽子（サーカムフレックス）対 矢印 — 出典2件
- 修正方針: 単位ベクトルを原典の矢印形（ドットなし ı ȷ と k への U+20D7）に直す（第1次の §2.1 同種所見と同クラス）。
- インスタンス:
  - C01-F26: 式(2.1)（`2-1-ja.json` block 9）— アプリは î ĵ k̂ (U+0302)、原典は ı⃗ ȷ⃗ k⃗（矢印、PDF 64）。
  - C02-F01: `2-1-ja.json` blocks[49].expression — ラプラシアン展開の両因子で同じ帽子形、原典は矢印（PDF 70）。

### CF2-053 (P3) クラス: Table 10.2 / 10.3 の配置ラベルの条件・定義の欠落 — 出典3件
- 修正方針: 各配置のラベルに原典図が与える条件（等幅・等直径・合同等）を補う（式自体は全て正しい。配置4・5 は P2 のため CF2-024 / CF2-025 で別扱い）。
- インスタンス:
  - C09-16: Table 10.2 配置2（`10-3-ja.json` block[19] item2）ラベル「角度 α をなす2面」— 原典図では2帯とも幅 w で共通辺を共有する（等式 F_{1–2} = F_{2–1} の前提、PDF 575）。
  - C09-17: Table 10.2 配置6（同 item6）ラベル「2つの平行円柱」＋ X = 1 + s/D — 等直径であること、s が表面間隔であることを述べない（s を中心間距離と読むと X が誤る、PDF 575）。
  - C09-18: Table 10.3 配置1（同 block[20] item1）ラベル「平行な2つの正方形・長方形、間隔 c」— 両矩形が合同（ともに a×b）で位置合わせされていることを述べない（PDF 576）。

---

## 第4部 P3 個別項目（60件）

### CF2-054 (P3) §1.2 "later in the chapter" の誤訳
- 対象: `data/sections/1-2-ja.json` block 19 / 現行: 「これらの法則は本書の後の章で導入します」 / 原典: "We introduce these laws later in the chapter."（法則は同章 §1.3 で導入される） / 修正方針: 「本章の後で導入します」に直す。 / 出典: C01-F06（PDF 22）

### CF2-055 (P3) 式(1.6) への "res" 添字の付加
- 対象: `data/sections/1-2-ja.json` block 28 / 現行: `Ṡ_res = Q̇_res / T_res` / 原典: Ṡ_res = Q/T_res（分子は添字なしの Q。Q_res 1 / Q_res 2 は後続の散文と式(1.7) のみ） / 修正方針: 分子の添字を除く（ドットの側面は第1次の Q̇ 裁定で閉鎖済みで対象外）。 / 出典: C01-F08（PDF 23）

### CF2-056 (P3) §1.3 レッスンが熱流束を q″ と書く
- 対象: `data/original-deep-lessons.json` §1.3 レッスン blocks[0] / equations[0] / 現行: q″ (U+2033) / 原典: 式(1.8) q = −k dT/dx、q⃗ = −k∇T（節データも q に従う） / 修正方針: レッスン側を q に合わせる。 / 出典: C01-F11（PDF 25）

### CF2-057 (P3) §1.3 レッスンの ρcV 形の式番号帰属の誤り
- 対象: `data/original-deep-lessons.json` §1.3 レッスン / 現行: 𝒯 = ρcV/(h̄A) = mc/(h̄A) に「(1.23)」のラベル / 原典: 式(1.23) は 𝒯 = mc(1/h̄A) のみで、ρcV/h̄A の形が時定数と呼ばれるのは直前の散文 / 修正方針: 第1項への (1.23) 帰属を外す。 / 出典: C01-F13（PDF 36）

### CF2-058 (P3) §2.2 レッスンの壁熱流束チェック文の符号・限定の欠落
- 対象: `data/original-deep-lessons.json` レッスン「2.2」blocks[7].text / 現行: 「片面あたり q̇L/2」 / 原典: q_wall = −q̇L/2（x=0)、+q̇L/2（x=L）の符号付きの値 / 修正方針: 符号と面の指定を補う（大きさの読みは正しい）。 / 出典: C02-F04（PDF 74）

### CF2-059 (P3) 式(2.17a) の ≡ の位置の移動で定義の読みが変わる
- 対象: `data/sections/2-3-ja.json` blocks[4].expression / 現行: "i⃗ = I⃗/A ≡ −γ∇V"（記述子を落とし ≡ を移動） / 原典: "flux of electrical charge = I⃗/A ≡ i⃗ = −γ∇V"（定義されるのは i⃗） / 修正方針: 原典の順序と記述子を復元する。 / 出典: C02-F27（PDF 77）

### CF2-060 (P3) 例題3.4 脚注2 の「do not quite intersect」の誤訳
- 対象: `data/sections/3-2-ja.json`（例題3.4 脚注2） / 現行: 「これらの R と P の線は完全には交わらない」 / 原典: "these R and P lines do not quite intersect"（ほぼ交わるがわずかに届かない、が正しい幾何） / 修正方針: 「あとわずかで交わらない」旨に直す。 / 出典: C02-F48（PDF 134）

### CF2-061 (P3) 第4章タイトルの訳語の内部不整合
- 対象: `data/book.json` ch4 title「熱伝導解析、次元解析、フィン設計」 vs `data/sections/4-1-ja.json` block[0]「第4章　伝導解析、次元解析、フィン設計」 / 原典: "4. Conduction analysis, dimensional analysis, and fin design" / 修正方針: 2レコードの訳を統一する（book.json 側の「熱」は原典見出しに対応語なし）。 / 出典: C03-05（PDF 155）

### CF2-062 (P3) §4.2 円筒座標の波括弧注記の帰属の逆転
- 対象: `data/sections/4-2-ja.json` block 12 / 現行: 「r方向の項は0（r = 一定で考える）…φ方向の項が残る」 / 原典: (1/r)∂/∂r(r ∂T/∂r) 項の下注は "=0"、(1/r²)∂²T/∂φ² 項の下注が "r = constant" / 修正方針: 注記の付け先を原典どおりに入れ替える。 / 出典: C03-07（PDF 158）

### CF2-063 (P3) レッスンの例題4.1「教訓は4つ」の個数誤り
- 対象: `data/original-deep-lessons.json` lessons[15] / 現行: 「原典がこの例から引く教訓は4つある。」とし第4項目に原典の第4・第5項目を統合 / 原典: 箇条書きは5つ（5つ目は書籍 p.150 冒頭、工夫・経験の論点） / 修正方針: 5つに直し第5項目を独立させる。 / 出典: C03-14（PDF 163–164）

### CF2-064 (P3) 式(4.14) の温度差の括弧の脱落
- 対象: `data/sections/4-3-ja.json` block 16 expression / 現行: "Tcout − Tcin = fn(Cmax, Cmin, Thin − Tcin, U, A)" / 原典: (Th_in − Tc_in) を括弧で1引数にまとめ、下注 K もその範囲に対応（例題4.3 の式（block 30）では括弧が保持されており内部不整合でもある） / 修正方針: 括弧を復元する。 / 出典: C03-16（PDF 166）

### CF2-065 (P3) §4.3 の助詞の誤記「ことか」
- 対象: `data/sections/4-3-ja.json` block 22 / 現行: 「…で表せることか期待できる。」 / 修正方針: 「ことが」に直す。 / 出典: C03-17（PDF 167）

### CF2-066 (P3) 問題3.43(a) の dṠ″_gen のダブルプライム脱落
- 対象: `data/chapter-problems/chapter-03.json`、`problem-3-43` formulaBlocks[0] / 現行: "dṠ_gen = …" / 原典: dṠ″_gen（ドット＋ダブルプライム。右辺は一致） / 修正方針: ″ を復元する。 / 出典: C03-23（PDF 151）

### CF2-067 (P3) 参考文献 [3.13] のフィールドへの余分な追加
- 対象: `data/chapter-problems/chapter-03.json`、`reference-3-13` publication / 現行: "Springer, Cham, Switzerland, 2018. Part II" / 原典: "…2018." で終了し "Part II" はページのどこにもない / 修正方針: "Part II" を除く。 / 出典: C03-25（PDF 152）

### CF2-068 (P3) 例題4.9 の h_eff の単位の中点
- 対象: `data/sections/4-5-ja.json` block 76 / 現行: 「heff = 23 W/m²·K」 / 原典: "h_eff = 23 W/m²K"（中点なし。k の単位 W/m·K には中点がある。レッスン block 11 は原典どおり） / 修正方針: 中点を除く。 / 出典: C03-36（PDF 189）

### CF2-069 (P3) 例題4.8 の Bi_ax ステップの記号置換
- 対象: `data/sections/4-5-ja.json` block 52 / 現行: h̄_L·L/k（先端係数による一般定義形） / 原典: Bi_ax = h̄L/k = 120(0.08)/205 = 0.0468（側面係数 h̄ × 全長 L ÷ k) / 修正方針: 原典の形に直す（本例題では h̄ ≃ h̄_L = 120 の仮定があるため数値は不変で、表示の忠実度のみの問題）。 / 出典: C03-40（PDF 186）

### CF2-070 (P3) 式(5.40) の被積分関数の正規化
- 対象: `data/sections/5-4-ja.json` block 15、式(5.40) / 現行: `∫₀ᵗ Q dt` / 原典: 式(5.40) のみ `∫₀ᵗ Q(t) dt`（式(5.37)(5.39) 等は Q と印刷される原典自体の表記ゆれが背景） / 修正方針: 当該箇所を Q(t) に戻す。 / 出典: C04-06（PDF 226）

### CF2-071 (P3) §5.7 レッスンの δs の方向注記が図と矛盾
- 対象: `data/original-deep-lessons.json` §5.7 レッスン block 11 / 現行: 「δs は流線方向・δn は等温線に垂直な方向の寸法」 / 原典: 図5.20 で δs は隣接する流線どうしを結ぶ両矢印（流線に垂直＝等温線に沿う向きのチャネルの幅）。δn 側の注記は正しい / 修正方針: δs の注記を「流線に垂直な方向（チャネルの幅）」に直す。 / 出典: C04-16（PDF 250）

### CF2-072 (P3) §5.6 レッスンの原典帰属の誤り（ダイヤモンドの冷たさ）
- 対象: `data/original-deep-lessons.json` §5.6 レッスン block 12 / 現行: 「熱浸透率・熱拡散率が極めて大きいためだと原典は述べる」 / 原典: 実験5.2 が挙げる理由は熱拡散率 α が既知の最大値であることの1つだけ / 修正方針: 帰属を α のみに直す。 / 出典: C04-17（PDF 247）

### CF2-073 (P3) 問題5.3 の文の重複表示
- 対象: `data/chapter-problems/chapter-05.json`、`problem-5-3` / 現行: text が「…コメントせよ。この問題を解くためのプログラムの提案を次に示す。」で終わるのに continuation にも「解の興味深い側面についてコメントせよ。」を持ち、レンダラが continuation を独立段落として印字するため当該文が2回（2回目は印刷にない位置に）表示される / 原典: 当該文は1回だけ、プログラム提案の文の前に現れる / 修正方針: continuation 側の重複文を除く。 / 出典: C04-21（PDF 266）

### CF2-074 (P3) 問題5.21 の訳語の誤り（rate of heat transfer）
- 対象: `data/chapter-problems/chapter-05.json`、`problem-5-21` text 最終文 / 現行: 「フラックスプロットを使って熱伝達率を求めよ。」 / 原典: "Find the rate of heat transfer using a flux plot. [Q ≃ 39 W]"（求めるのは W 単位の伝熱量） / 修正方針: 「熱移動率（伝熱量）」に直す。 / 出典: C04-27（PDF 270）

### CF2-075 (P3) §6.1 先頭見出しに原典対応のない部の見出し
- 対象: `data/sections/6-1-ja.json` block[0]（subheading) / 現行: 「第III部　対流熱移動／第6章　層流および乱流の境界層」 / 原典: 章扉（書籍 p.271）は章題のみで部の見出しはない（部の扉は PDF 283 に独立ページとして存在し、book.json は part として保持） / 修正方針: アプリ側の構造見出しの可能性があるため事実のみ登録 — 採否は修正側の判断。 / 出典: C05-01（PDF 285）

### CF2-076 (P3) Joseph Black 引用文の省略記号の脱落
- 対象: `data/sections/6-1-ja.json` block[1]（quote) / 現行: 引用が省略標記なしに連続文として訳されている / 原典: 引用中に省略の「…」が3箇所 / 修正方針: 省略箇所に「…」を補う。 / 出典: C05-02（PDF 285）

### CF2-077 (P3) 脚注1 "qualify" の訳
- 対象: `data/sections/6-1-ja.json` block[9]（footnote) / 現行: 「脚注1：境界層を定量的に扱う際に、この発言を修飾する。」 / 原典: "We qualify this remark when we treat the b.l. quantitatively."（qualify は留保・限定を加える意） / 修正方針: 「この発言に留保を加える」旨に直す。 / 出典: C05-03（PDF 286）

### CF2-078 (P3) 問題5.27 の初期温度 300 °C の脱落
- 対象: `data/chapter-problems/chapter-05.json`、`problem-5-27` text / 現行: 「直径0.5 cm の円柱が、1 atmの飽和水に突然浸される」 / 原典: "A 0.5 cm diameter cylinder at 300°C is suddenly immersed in saturated water at 1 atm"（解くために必要な与件の欠落） / 修正方針: 「300 °C の」を補う。 / 出典: C05-05（PDF 273）

### CF2-079 (P3) §6.2 "like" の誤訳
- 対象: `data/sections/6-2-ja.json` block[5] / 現行: 「それらの間の ψ の差に似ている」 / 原典: "…is constant, like the difference in ψ between them"（like は「〜と同様に」） / 修正方針: 「ψ の差と同様に」に直す。 / 出典: C05-11（PDF 293）

### CF2-080 (P3) 式(6.36) 解説の積分番号の自己矛盾
- 対象: `data/sections/6-3-ja.json` block[8]（式(6.36)）explanation / 現行: 右辺だけを数えた番号付けと原典の通し番号付けが混在し、同一積分が第1・第2の両方に呼ばれ、自らの番号付けでは (u⃗·n⃗)dS を含まない伝導積分を指すことになる / 原典: 全項を通し番号で数え (ρĥ) 積分が第2積分 / 修正方針: 番号付けを原典の通し番号に統一する。 / 出典: C05-18（PDF 309）

### CF2-081 (P3) 式(6.51) 右辺の微分作用素（∂ 対 d）
- 対象: `data/sections/6-5-ja.json` block[10]（式(6.51) の再掲形） / 現行: `[∂((T − T∞)/(Tw − T∞))/∂(y/δt)]|y/δt=0` / 原典: 右辺は通常のイタリック d（被微分量は単一変数 y/δt の関数。式(6.56) では原典も ∂ でアプリと一致） / 修正方針: 当該箇所の ∂ を d に戻す。 / 出典: C05-28（PDF 318）

### CF2-082 (P3) T_b の言葉による定義の誤訳（"rate" を「割合」）
- 対象: `data/sections/7-2-ja.json` block 9 explanation / 現行: 「Tb ≡（断面を通るエンタルピーの流れの割合）/（断面を通る熱容量の流れの割合）」 / 原典: "T_b ≡ (rate of flow of enthalpy through a cross section) / (rate of flow of heat capacity through a cross section)"（rate of flow は流量・流率） / 修正方針: 「割合」を「流率」に直す。 / 出典: C06-05（PDF 368）

### CF2-083 (P3) 問題参照 (Problem 7.25) の付け先の誤り
- 対象: `data/sections/7-2-ja.json` block 6 explanation / 現行: 「流線がすべて互いに平行であることです（問題7.25を見よ）」 / 原典: "(see Problem 7.25)" は式(7.2) の発達条件の文を閉じるもの / 修正方針: 参照を発達条件の文側へ移す。 / 出典: C06-06（PDF 367）

### CF2-084 (P3) §7.3 散らばりの段落の訳文の破綻
- 対象: `data/sections/7-3-ja.json` block 48 text / 現行: 「これらの熱物性に課題に加えて、図7.8に示すデータの一部は…」 / 原典: "In addition to these thermophysical issues, some [of] the data shown in Fig. 7.8 are…" / 修正方針: 「これらの熱物性上の課題に加えて」に直す。 / 出典: C06-31（PDF 390）

### CF2-085 (P3) §8.1 の章タイトル見出しの「自然対流」の重複
- 対象: `data/sections/8-1-ja.json` block 0（章タイトル小見出し） / 現行: 「第8章　単相流体における自然対流と膜状凝縮中の自然対流」 / 原典: "Natural convection in single-phase fluids and during film condensation"（book.json の ch.8 タイトル「単相流体の自然対流と膜状凝縮」は正しい） / 修正方針: 節ファイル側を book.json・原典に合わせる。 / 出典: C07-18（PDF 428・433）

### CF2-086 (P3) 式(8.72) の第1の等号が ≡
- 対象: `data/sections/8-5-ja.json` block 32 expression、式(8.72) / 現行: "Rec ≡ ρuavδ/µ = Γc/µ = …" / 原典: "Re_c = ρu_avδ/μ = Γ_c/μ = …"（全体を通して通常の等号） / 修正方針: ≡ を = に戻す。 / 出典: C07-58（PDF 468）

### CF2-087 (P3) §8.5 レッスンの定量的過大表示（「半分以下」）
- 対象: `data/original-deep-lessons.json` lessons[47] block 13（見出しと本文） / 現行: 「質量1%の空気で h が半分以下」 / 原典: "The resulting h can easily be cut by a factor of two if there is as little as 1% by mass of air mixed into the steam [8.41]"（半分になる、であって「半分以下」ではない。節ファイル block 36 は正しい） / 修正方針: 「半分に減りうる」に直す。 / 出典: C07-62（PDF 469）

### CF2-088 (P3) §9.2 散文の非文法的な日本語
- 対象: `data/sections/9-2-ja.json` block 10 第1文 / 現行: 「式(9.1)で記述される半径を持つ平衡気泡は、不安定であることが見るのは容易である。」（「ことが見るのは」が非文法的） / 原典: "It is easy to see that the equilibrium bubble … is unstable." / 修正方針: 「…であることは容易に分かる。」等に直す。 / 出典: C08-F05（§9.2、PDF 492–498 の範囲。記録に個別ページの明示なし）

### CF2-089 (P3) 脚注3 の述語の弱め
- 対象: `data/sections/9-3-ja.json` block 3 / 現行: 「崩壊に最も影響を受けやすい波長が最も「危険な（dangerous）」ものである」 / 原典: "the wavelength most susceptible to collapse is the most 'dangerous' one"（「崩壊しやすい」が正） / 修正方針: 「崩壊しやすい」に直す。 / 出典: C08-F09（PDF 500）

### CF2-090 (P3) "top view" を「上面図」と訳したニュアンスの誤り
- 対象: `data/sections/9-3-ja.json` block 9 / 現行: 「上面図で示されるように」 / 原典: "as is indicated in the top view"（図9.10 の上段の図＝側面の模式図であり、上方から見た平面図ではない） / 修正方針: 「図の上段に示されるように」等に直す。 / 出典: C08-F16（PDF 502）

### CF2-091 (P3) §9.3 レッスンが C = 0.131 の2つの原因を1つに圧縮
- 対象: `data/original-deep-lessons.json` lessons[50] block「理想化した大きな水平面のCHF尺度」 / 現行: 「原書はその理由を誤ったデータへの適合と指摘している」 / 原典: ロシアの値が低かったのは誤ったデータに基づいたため、Zuber の値が低かったのは自らの仮定をロシアの結果に合わせたため、という2つの異なる原因（節データ block 21 は両方を正しく訳す。同文の「約14%低く」は原典の印刷 "lower by 14%" どおりで対象外） / 修正方針: 2つの原因を分けて書く。 / 出典: C08-F17（PDF 509）

### CF2-092 (P3) §9.5 レッスン図のパネル見出しが q_min をライデンフロスト点と同一視
- 対象: レッスン図 SVG のパネル①見出し（`assets/lesson-diagrams/` の §9.5 図、レジストリ複製を含む） / 現行: 「① 沸騰曲線の谷が q_min（ライデンフロスト点）」 / 原典: §9.5 は q_min を最小熱流束としてのみ導入（式(9.33)）し、レッスン自身も q″_min [W/m²] とライデンフロスト温度 [K/℃] を区別している / 修正方針: 見出しから「（ライデンフロスト点）」を除く。 / 出典: C08-F19（PDF 516）

### CF2-093 (P3) "horizontal wires" を「水平線」と訳した語の取り違え（×2箇所）
- 対象: `data/sections/9-5-ja.json` block 3 explanation「水平線に対する並行した予測」と block 4 alt「水平線の qmin」 / 原典: "Lienhard and Wong [9.36] did the parallel prediction for horizontal wires"（線材・ワイヤヒーター） / 修正方針: 「水平ワイヤ（線材）」に直す。 / 出典: C08-F22（PDF 517）

### CF2-094 (P3) "nucleation sites" を沸騰領域の語「発泡サイト」と訳した（×2箇所）
- 対象: `data/sections/9-10-ja.json` block 1 / 現行: 「液滴は表面上の活性発泡サイトから成長し」「その経路の発泡サイトで成長し始める」 / 原典: "Droplets grow from active nucleation sites on the surface" 等（滴状凝縮の文脈。§9.10 レッスンは「核生成サイト」と正しく書く） / 修正方針: 「核生成サイト」に直す。 / 出典: C08-F31（PDF 536）

### CF2-095 (P3) §10.1 レッスンの放射発散度の記号の大文字化
- 対象: `data/original-deep-lessons.json` lessons[59] blocks[1][2] / 現行: E_b=σT⁴、E=εσT_s⁴ / 原典: 黒体放射発散度は小文字 e_b = σT⁴（式(10.3)(10.4) も e_λ・e_b、節データも小文字） / 修正方針: 小文字 e_b / e に合わせる。 / 出典: C09-02（PDF 559）

### CF2-096 (P3) §10.1 レッスン計算例の表示上の丸め不整合
- 対象: `data/original-deep-lessons.json` lessons[59] workedExample steps[3] / 現行: 「q″=J−G=1253.153−459.300=+793.852 W/m²」— 表示された被演算数を引くと 793.853 になる（正確値 793.8524 に対する最終値は正しい） / 修正方針: 表示桁を揃える（原典に対応ページのないアプリ独自コンテンツ内部の表示整合の問題）。 / 出典: C09-03（原典対応ページなし）

### CF2-097 (P3) 文献 [9.64] の題名のダッシュ字形
- 対象: `data/chapter-problems/chapter-09.json` references.blocks[63]（reference-9-64）の originalTitle / 現行: "gas–liquid"（en ダッシュ U+2013) / 原典: 短いハイフン（同じページの [9.63] の "gas-liquid" とページ範囲の en ダッシュを同縮尺で比較して確定） / 修正方針: ハイフンに戻す。 / 出典: C09-19（PDF 553）

### CF2-098 (P3) 形態係数の添字ダッシュの文字コード不統一
- 対象: `data/sections/10-3-ja.json` / 現行: F の添字ダッシュは blocks 1–23 では U+2013（en ダッシュ、63箇所）だが、blocks[25]（6箇所）と blocks[27]（4箇所）の F_{h−s} 等だけ U+2212（マイナス記号） / 原典: 添字ダッシュは全て同一字形 / 修正方針: U+2013 に統一する。 / 出典: C09-23（§10.3、コードポイント集計による確認）

### CF2-099 (P3) レッスンの例題10.10 に関する手順の過大な主張
- 対象: `data/original-deep-lessons.json` lessons[61] blocks[7] / 現行: 「例題10.10 の形態係数は全てこれ（Table 10.2 配置4の交差ひも法の形）で求められている」 / 原典: 交差ひも法（式(10.46)）から直接求められるのは F₁₋₂ = 0.4 のみで、残り5値は総和則と相反則で導かれる（値そのものは全て正しい） / 修正方針: 導出手順の記述を原典どおりに直す。 / 出典: C09-31（PDF 593–594）

### CF2-100 (P3) 図10.27 対応図の description の表示範囲の切り詰め
- 対象: `data/sections/10-6-ja.json` block 13 description / 現行: 「1880年から2020年まで。」 / 原典: 図の両曲線とも 2020 の目盛をわずかに超えて描かれている（軸右端は2022年頃） / 修正方針: 範囲の記述を図に合わせる。 / 出典: C10-03（PDF 615）

### CF2-101 (P3) §10.6 小見出しの狭窄（「太陽光発電の利用」）
- 対象: `data/sections/10-6-ja.json` block 14 subheading / 現行: 「太陽光発電の利用」 / 原典: "The use of solar power"（当該小節は太陽熱の直接利用も含む） / 修正方針: 「太陽エネルギーの利用」等に広げる。 / 出典: C10-04（PDF 616）

### CF2-102 (P3) 第11章タイトルの訳の内部不整合
- 対象: `data/book.json` ch11.title「物質移動の導入」 vs `data/sections/11-1-ja.json` block[1] 見出し「第11章　物質移動への入門」 / 原典: "An introduction to mass transfer"（book.json の sourceTitle と一致） / 修正方針: いずれも忠実な訳だが同一章のタイトルとして統一する。 / 出典: C10-14（PDF 635）

### CF2-103 (P3) 式(11.55) の括弧形状（角括弧 対 丸括弧）
- 対象: `data/sections/11-5-ja.json` block[14] 式(11.55) / 現行: `−∇·[ρi·v⃗ + j⃗i] = −∇·[mi·n⃗ + j⃗i]`（角括弧） / 原典: 両行とも丸括弧 `−∇·(ρ_i v⃗ + j⃗_i) = −∇·(m_i n⃗ + j⃗_i)`（中点の側面は CF2-047 に含む） / 修正方針: 丸括弧に戻す。 / 出典: C10-27（PDF 664）

### CF2-104 (P3) §11.6 "Finally" 表示の ρ の分配
- 対象: `data/sections/11-6-ja.json` block[10] / 現行: `(𝒢m,i/ρ)(ρmi,s − ρmi,e)` と ρ を差の中へ分配 / 原典: `(g_{m,i}/ρ) ρ (m_{i,s} − m_{i,e})`（ρ は括弧の外の独立因子。q_s 行も同型） / 修正方針: 表示形を原典に戻す（数学的には等価な再編成）。 / 出典: C10-33（PDF 672）

### CF2-105 (P3) §11.6 レッスン題と訂正済み節名の不一致
- 対象: `data/original-deep-lessons.json` lessons[70] title / 現行: 「低い移動率での対流物質移動：係数と境界層を区別する」 / 原典・節側: 訂正済み節名は「低率における対流物質移動」（`11-6-ja.json` block[0] は正しく保持。レッスン題は同ファイルの通例として独自の説明的題名であり、本文 blocks[0] は節名の「低率」を明示して説明している） / 修正方針: 題名フィールドのみ中央付託とされた項目（登録どおり取り込み）。節名との整合を取るかは修正側の判断。 / 出典: C10-35（PDF 669）

### CF2-106 (P3) §11.8 レッスン・式側の添字 m_salt（単数形）
- 対象: `data/original-deep-lessons.json` §11.8 レッスン block[8]（本文・eq[6]・eq[7]）の添字が単数形 `m_salt` / 原典: CP の定義と m_{salts,s} の式は複数形 `salts`（節データ block[20] は複数形で一致）。なお図11.19（PDF 688）の図中ラベルは単数形 `m_salt` が原典の形であり、本件は式・本文側のみ / 修正方針: 式・本文側を複数形に直す。 / 出典: C11-001（PDF 689）

### CF2-107 (P3) §11.9 の面積分記号 ∮（×2）
- 対象: `data/sections/11-9-ja.json` block[3] / 現行: ∮ (U+222E) ×2 / 原典: 通常の ∫ に添字 S（400dpi でループなしを確認） / 修正方針: ∫_S に戻す。 / 出典: C11-005（PDF 690）

### CF2-108 (P3) §11.9 式の括弧の脱落
- 対象: `data/sections/11-9-ja.json` block[3] / 原典: ( Σ_i ρ_i ĥ_i v⃗_i ) と括る括弧がある / 修正方針: 括弧を復元する（現行文字列は修正時に原典画像で確定）。 / 出典: C11-006（PDF 690）

### CF2-109 (P3) §11.9 レッスンの条件への絶対値記号の追加と読み替え
- 対象: `data/original-deep-lessons.json` §11.9 レッスン eq[7] meaning / 現行: 原典の条件に絶対値記号を追加し「0.2未満」と読み替えている / 原典: 「n_{i,s}c_{p,i}/h* ≲ 0.2」（絶対値なし。節データ block[8] は原典どおり） / 修正方針: 絶対値を除き「≲ 0.2」に戻す。 / 出典: C11-008（PDF 692）

### CF2-110 (P3) 式(11.75) の角括弧の範囲の相違
- 対象: `data/sections/11-7-ja.json` blocks[14] 式(11.75) / 現行: 分数のみを括る / 原典: [ (8ρ𝒟_{H2O,gas}/ρ_l)(m_{H2O,s} − m_{H2O,e}) ] t と分数＋質量分率差を括り t は外（値は等価だが表示のグルーピングが異なる） / 修正方針: 括弧の範囲を原典に合わせる。 / 出典: C11-012（PDF 683）

### CF2-111 (P3) §11.9 レッスンの Mach 数の記述（≧化と帰属の移動）
- 対象: `data/original-deep-lessons.json` lessons[73] blocks[9] / 現行: 「Mach 30 以上の弓形衝撃波」 / 原典: (1) 厳密な "greater than 30"（>30）が「以上」（≥30）になっている、(2) Mach 数は接近する空気の属性で衝撃波とは別文（レッスンは衝撃波自体に付属させている。節データ blocks[35] は原典に忠実） / 修正方針: 「30を超えるマッハ数で接近する空気の弓形衝撃波」旨に直す。 / 出典: C11-029（PDF 695）

### CF2-112 (P3) §11.8 の星印の位置（𝒢* の位置の系統的ずれ）
- 対象: `data/sections/11-8-ja.json` blocks[11][12][13][15][20] / 現行: 星印が添字の後（𝒢m,2*) / 原典: 𝒢 の直後・添字の前（𝒢*_{m,2}、式(11.80)–(11.82)・吹き出し係数本文・例題11.15 で確認。レッスン側は原典どおり） / 修正方針: 星印を 𝒢 の直後へ移す。 / 出典: C11-034（PDF 686–689）

### CF2-113 (P3) §11.8 低率係数の定義文の添字の置換
- 対象: `data/sections/11-8-ja.json` blocks[1] / 現行: 定義文の添字が m,2 に置き換えられている / 原典: 一般添字 g*_{m,i}（直下の式(11.81) の添字 2 と字形が明確に異なる） / 修正方針: 一般添字 i に戻す（原書側の一般表記か誤植かは判定せず、置換の事実のみを直す）。 / 出典: C11-035（PDF 687）

---

## 検算（総件数の照合）

- 出典の合計: P1 個別 3 + P2 個別 29 + クラス項目の出典（CF2-033: 58、034: 37、035: 4、036: 3、037: 28、038: 32、039: 9、040: 2、041: 2、042: 84、043: 11、044: 32、045: 37、046: 10、047: 4、048: 7、049: 2、050: 20、051: 8、052: 2、053: 3 ＝ 395）+ P3 個別 60 = **487**。登録総数 487 と一致する。
- 統合リスト件数: 3 + 29 + 21 + 60 = **113件**。487 − 113 = 374 がクラス集約による統合分であり、真の重複は0件（ヘッダの内訳参照）。
- 深刻度別の出典内訳: P1 3 / P2 29 / P3 455（登録どおり、変更なし）。
