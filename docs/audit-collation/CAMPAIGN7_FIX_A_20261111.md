# 照合第7次 修正台帳 ラインA（用語集 data/glossary.json）2026-11-11

実施: 修正ラインA（クローン heat-c7fix-a）。根拠: CAMPAIGN7_FIXLIST_20261111.md ラインA節、C7-C01_RECORD.md（A-1・A-2）、C7-C05_RECORD.md（A-3・A-4・A-5）、C7-C11_RECORD.md（A-6）。
方法: Python によるコードポイント正確な文字列置換（各置換は旧文字列の出現回数=1 を assert してから実施。relatedSections の2件は対象エントリの範囲内に限定した窓内置換で実施）。編集後に JSON パース検証と、504 エントリ全件の変更前後フィールド差分照合を行い、変更が対象11エントリの意図したフィールドのみ（ファイル差分 17 追加／20 削除行）に限られることを確認した。GitHub 書き込みなし。テストは統合側で実施。

## A-1（C7-C01-01、P3）記号結び付き「熱伝達率」の残存を統一（3箇所）

- enthalpy.detail 変更前: 「熱伝達率を表すh[W/(m²·K)]と比エンタルピーh[J/kg]の記号を単位で区別する。」
- enthalpy.detail 変更後: 「熱伝達係数を表すh[W/(m²·K)]と比エンタルピーh[J/kg]の記号を単位で区別する。」
- enthalpy.confusions 変更前: 「比エンタルピーhの単位は熱伝達率hと異なる。」
- enthalpy.confusions 変更後: 「比エンタルピーhの単位は熱伝達係数hと異なる。」
- internal-energy.confusions 変更前: 「総括熱伝達率 U [W/(m²·K)] と内部エネルギー U [J] は…」
- internal-energy.confusions 変更後: 「総括熱伝達係数 U [W/(m²·K)] と内部エネルギー U [J] は…」
- 検証: 第6次裁定の境界（記号結び付き用法は「熱伝達係数」）に従う置換のみ。複合語・一般言及は対象外とし、両エントリの他フィールド（related 等）は変更していないことを差分照合で確認。

## A-2（C7-C01-02、P3）biot-number: 原典帰属の判定記号を是正

- detail 変更前: 「原典は Bi < 0.1 で集中熱容量解が通常約3%以内の精度になるとしている。」
- detail 変更後: 「原典は Bi ≲ 0.1 で集中熱容量解が通常約3%以内の精度になるとしている。」
- 検証: 原典 §1.3（PDF 38）の印刷は Bi ≲ 0.1（600dpi 確定済み、C7-C01_RECORD による）。meaning／beginner の「0.1未満は近似を検討する目安」はアプリ側の目安表現で原典帰属ではないため変更対象外とした（指示書の対象は detail の帰属文のみ）。

## A-3（C7-C05-01 の用語集分、P3）stanton-number／boundary-layer-shape-factor の「熱伝達率h」（3箇所）

- stanton-number.detail 変更前: 「St=h/(ρUcₚ)=Nu/(RePr)。hは熱伝達率、Uは代表流速…」
- stanton-number.detail 変更後: 「St=h/(ρUcₚ)=Nu/(RePr)。hは熱伝達係数、Uは代表流速…」
- boundary-layer-shape-factor.detail 変更前: 「熱伝達率hやエンタルピーHと記号が重なるときは区別する。」
- boundary-layer-shape-factor.detail 変更後: 「熱伝達係数hやエンタルピーHと記号が重なるときは区別する。」
- boundary-layer-shape-factor.confusions 変更前: 「形状係数Hは熱伝達率h[W/(m²·K)]と記号が似ても全く別の量。」
- boundary-layer-shape-factor.confusions 変更後: 「形状係数Hは熱伝達係数h[W/(m²·K)]と記号が似ても全く別の量。」
- 検証: C7-C05_RECORD が特定した3箇所と一致。stanton-number.related の「対流熱伝達率」は確立した複合語（別エントリ名）であり対象外として変更していない。

## A-4（C7-C05-02、P3）viscous-sublayer／buffer-layer: 原典 §6.7 の境界値を主とする文面に是正

原典 §6.7（書籍 p.321、PDF 335）は式(6.96) の適用範囲を u*y/ν ≲ 7 としこの領域を粘性底層と呼び、緩衝層は同 p.322（PDF 336）で 7 < u*y/ν < 30（C7-C05_RECORD、600dpi 確定済み）。節ファイル 6-7-ja.json も 7 基準で一致していることを実施時に読み戻して確認した。現行の用語集は外部資料由来の汎用慣例（5／5–30）のみで原典値への言及がなかったため、原典値を主とし汎用慣例を断り付きで併記する形に直した。

- viscous-sublayer.formula 変更前: `U⁺≈y⁺（滑らかな壁、y⁺≲5）`
- viscous-sublayer.formula 変更後: `U⁺≈y⁺（滑らかな壁、原典 §6.7 の粘性底層は y⁺≲7）`
- viscous-sublayer.detail 変更前: 「滑らかな壁の典型的な壁法則ではy⁺≲5を粘性底層の目安とし、U⁺≈y⁺という線形近似が成り立つ。…」（後段は不変）
- viscous-sublayer.detail 変更後: 「原典 §6.7 では、式(6.96) が成り立つ y⁺≲7 の薄い領域を粘性底層と呼び、U⁺≈y⁺という線形近似が成り立つ。汎用的な壁法則の慣例では、y⁺≲5 を粘性底層の目安とすることもある。…」（後段は不変）
- buffer-layer.formula 変更前: `5≲y⁺≲30（代表的な緩衝層範囲）`
- buffer-layer.formula 変更後: `7 < y⁺ < 30（原典 §6.7 の緩衝層範囲）`
- buffer-layer.detail 変更前: 「滑らかな乱流壁面の代表的な分類では5≲y⁺≲30を緩衝層と呼ぶ。…」（後段は不変）
- buffer-layer.detail 変更後: 「原典 §6.7 では、7 < y⁺ < 30 の範囲を緩衝層と呼ぶ。汎用的な分類では 5≲y⁺≲30 を緩衝層とすることもある。…」（後段は不変）
- buffer-layer.example 変更前: 「y⁺=15の位置は、滑らかな壁面の代表的な緩衝層範囲内にある。」
- buffer-layer.example 変更後: 「y⁺=15の位置は、原典 §6.7 の緩衝層範囲内にある。」
  - 理由: example が参照する「代表的な緩衝層範囲」という枠組み自体を原典基準へ付け替えたため。y⁺=15 は原典の範囲（7–30）にも汎用慣例（5–30）にも含まれ、記述の真偽は変わらない。
- 変更しなかったもの: viscous-sublayer.example「y⁺=3の典型的な粘性底層ではU⁺≈3」は y⁺=3 が原典・慣例の双方の範囲内であり、特定の境界値への言及がないため不変とした。

## A-5（C7-C05-03、P3）節帰属の誤り2件

### (a) mean-free-path: §6.2 → §6.4
- detail 変更前: 「原典では §6.2 の粘度の分子論モデルと、§11.10 の混合物の輸送物性で使われる。…」
- detail 変更後: 「原典では §6.4 の粘度の分子論モデルと、§11.10 の混合物の輸送物性で使われる。…」
- relatedSections 変更前: ["6.2", "11.10"] → 変更後: ["6.4", "11.10"]
- 検証: 分子論モデル（平均自由行程 ℓ、式(6.45a–d)）の所在は原典 §6.4（書籍 pp.299–301、PDF 313）。章末問題6.26 の文面「In Sect. 6.4, we noted that the kinetic theory…」も §6.4 を明示（C7-C05_RECORD のコーディネーター親検証による）。定義・見積もり式は正しいため変更していない。source.reference は §11.10 帰属であり誤りがないため不変。

### (b) sutherland-formula: §6.8 帰属 → 章末問題6.35
- source.reference 変更前: 「原典第6章 §6.8に基づく独立執筆の補足。原書翻訳・転載ではなく専門家校閲前。」
- source.reference 変更後: 「原典第6章の章末問題6.35（式(6.122)、書籍 p.341）に基づく独立執筆の補足。原書翻訳・転載ではなく専門家校閲前。」
- relatedSections ["6.8"] は削除した（キー自体を除去）。
  - 理由: relatedSections は全504エントリを通じて節番号（"N.M" 形式）のみを格納する慣例であり、問題番号を格納する先例がない。「6.35」と入れると存在しない節へのリンクとして誤読されるため、帰属の是正は source.reference の文面で行い、relatedSections は除去した。除去は他の125エントリが同キーを持たない既存パターンと整合する。
- 変更しなかったもの: detail・formula の「原典 (6.122)」の式番号引用は正確なため指示書どおり不変（編集後のデータでも detail が変更前と完全一致することを差分照合で assert 済み）。

## A-6（C7-C11-04、P3）「低移動速度」→「低移動率」（2箇所）

- convective-mass-transfer-coefficient.detail 変更前: 「…低移動速度・希薄成分近似ではN_A≈k_c(c_A,s−c_A,∞)と表せる。…」
- convective-mass-transfer-coefficient.detail 変更後: 「…低移動率・希薄成分近似ではN_A≈k_c(c_A,s−c_A,∞)と表せる。…」
- stagnant-film-model.detail 変更前: 「これは希薄・低移動速度などの条件下での近似で、…」
- stagnant-film-model.detail 変更後: 「これは希薄・低移動率などの条件下での近似で、…」
- 検証: 確立訳語は「低移動率」（low mass-transfer rate。レッスン側は「低移動率」13件・「低移動速度」0件、C7-C11_RECORD による）。編集後の用語集全体で「低移動速度」は0件、「低移動率」は2件となったことを走査で確認。stagnant-film-model.formula の「低流束近似」は別表現であり対象外として変更していない。
