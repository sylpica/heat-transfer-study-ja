# 全ページ照合 第5次（収束判定回）— C12 記録（PDF 749–810、62ページ）

- 対象ツリー: heat-c5-c12 クローン `~/workspace/dev/heat-c5-c12`、先端 `9188b36`（基準ツリー adcf366＋第5次ブリーフ）
- 原典: `~/workspace/research_notes/ahtt-reading/AHTTv600.pdf`（PDFページ = 書籍ページ + 14）
- 担当範囲の内訳（第4次 C12 の確定範囲を踏襲し、本ラウンドで独立に再確認）:
  - PDF 749–752: 付録A 参考文献 [A.4]–[A.41] → `data/appendix-references/appendix-a.json` と項目単位・文字単位照合
  - PDF 753–774: 付録A 物性表 A.1–A.8 → アプリに対応物なし（存在確認＋スポット転記のみ。セル単位照合はしていない）
  - PDF 775–780: 付録B（参考文献 [B.1] は PDF 779 → `appendix-b.json` と項目単位照合。表 B.1・B.2 と散文は対応物なし。PDF 780 は空白）
  - PDF 781–787: 付録C 記号表 → 直接の対応物なし（用語集スポット確認のみ。項目単位照合はしていない）
  - PDF 788 空白 / 789 Part VII 扉 / 790 空白 / 791–797 引用索引（対応物なし）/ 798 空白 / 799–810 主題索引（対応物なし）
- 方法: 参考文献は (1) pdftotext -layout 抽出との全フィールド包含チェック（authors・originalTitle・publication・doi・url・noteEn）、(2) 不一致候補は全件、行分割位置の目視確認と 600dpi ページ画像の自読で裁定。表・索引は存在確認とスポット転記。字形・数字の最終判定はテキストレイヤでは行っていない（画像自読した項目を明記）。

## 照合結果サマリ（62/62ページ）

### 項目単位・文字単位で照合した範囲
- **PDF 749–752: 付録A 参考文献 [A.4]–[A.41]、38項目 → 38/38 一致。**
  - 全フィールド包含チェックで不一致候補は 17 フィールド（A.8 publication / A.11 url / A.13 publication / A.14 authors / A.17・A.18・A.19・A.21・A.22・A.23・A.30・A.32・A.41 originalTitle / A.20・A.28・A.33 publication / A.40 url）。全てテキストレイヤの行分割（行末ハイフン脱落・語中改行・URL のハイフンなし改行）による見かけの不一致で、原典と文字単位で一致することを確認した。裁定の内訳:
    - 600dpi 画像自読で確認: [A.8]「J. Phys. Chem. Ref. Data, 45(1):013102, February 2016. doi: 10.1063/1.4940892」（コロン後の改行が候補原因）。[A.11]「doi: 10.18434/T4JS3C. url: https://www.nist.gov/srd/refprop. Properties based upon the most accurate standard reference formulations then available.」— url は "https:" の直後でハイフンなし改行、JSON の url・doi・noteEn と全て一致。[A.13]「ASM, International, Materials Park, OH, 10th ed., 1990」（"Mate-rials" の語中改行）。[A.14] 著者名「American Society of Heating, Refrigerating, and Air-Conditioning Engineers」および原題の em ダッシュ「Handbook—Fundamentals」まで一致。[A.20]「Int. J. Thermophys., 25(6):21–69, January 2004. doi: 10.1023/B:IJOT.0000022327.04529.f37」。[A.21]「20(5):917–1021, September 1991. doi: 10.1063/1.555897」。[A.22] 原題末尾「(HFC-134a)」は印刷でも行末ハイフン「(HFC- / 134a)」であり、「J. Phys. Chem. Ref. Data, 23:657–729, September 1994. doi: 10.1063/1.555958」まで JSON と完全一致。[A.23] 原題の em ダッシュ「Pure Fluids — NIST Pure Fluids」を画像で確認。同一切り出し内で [A.5]・[A.6]・[A.7]・[A.9]・[A.10]・[A.12]・[A.24] も画像自読し全て一致（DOI・ページ範囲の en ダッシュ含む）。
    - -layout 抽出の行分割位置の目視で裁定（文字シーケンスは空白・ハイフン除去後も完全一致）: [A.17]「prop- / erties」、[A.18]「Fluid State-12」（改行なしで抽出され JSON と同一）, [A.19]「ni- / trogen」、[A.28]「J. Food Engr., 30: / 155–162, 1996」、[A.30]「Thermo- / dynamic」、[A.32]「conduc- / tivity」、[A.33]「12 / (6):965–984」、[A.40] url「https://physics.nist. / gov/cuu/Constants/」（ハイフンなし改行）、[A.41]「thermo- / dynamic … sci- / entific use」、原題冒頭の小文字「The iapws formulation 1995」も印刷どおりで一致。
  - ページメタデータ: 全 41 項目の bookPage/pdfPage は差 14 で連番 [A.1]–[A.41]・count=41 とも整合。宣言ページ範囲（bookPages 734–738 / pdfPages 748–752）とも整合。[A.1]–[A.3] は PDF 748（本範囲外、C11 側）にある。
  - 構造注記（不一致ではない）: [A.11] は原典の印刷順（doi → url → 注記）と JSON のフィールド格納順が違うだけで文字列は一致（第4次と同一所見）。
- **PDF 779: 付録B 参考文献 [B.1]、1項目 → 一致。** 600dpi 画像で全文を自読: 「[B.1] A. Thompson and B. N. Taylor. Guide for the Use of the International System of Units (SI). National Institute of Standards and Technology, Gaithersburg, MD, 2008. url: http://physics.nist.gov/SP811. NIST Special Pub. 811.」JSON は publication から url 部分を url フィールドへ分離して格納しているが、構成文字列は全て文字単位で一致する（[A.11] と同型の構造注記であり不一致ではない）。第4次記録がこの項目の途中で物理的に切断されていたため、本ラウンドで画像自読まで完了させた。
  - メタデータ: count=1、bookPages 765 / pdfPages 779 の宣言と実ページが一致。

### 存在確認＋スポット確認の範囲（セル単位・項目単位の照合はしていない）
- **PDF 753–774: 付録A 物性表 A.1–A.8。** 全ページにランニングヘッド「Appendix A: Some thermophysical properties of selected materials」を確認し、表題を全数確認: A.1 Properties of metallic solids / A.2 Properties of nonmetallic solids / A.3 Thermophysical properties of saturated liquids / A.4 Some latent heats of vaporization / A.5 Thermophysical properties of saturated vapors / A.6 Thermophysical properties of gases at atmospheric pressure / A.7 Physical constants / A.8 Additional physical property data given in the text。600dpi スポット転記（PDF 755、書籍 p.741）: Table A.2 の列構成 Material / Temperature Range (°C) / Density ρ (kg/m³) / Specific Heat c_p (J/kg·K) / Thermal Conductivity k (W/m·K) / Thermal Diffusivity α (m²/s)、冒頭行 Aluminum oxide (Al₂O₃): plasma sprayed coating 20°C・k ≈ 4、HVOF sprayed coating 20°C・k ≈ 14。アプリ側に対応データは存在しない（book.json の付録A translationStatus は not_started、data/ 配下に物性表データなし）ため、転記値との照合先はない。
- **PDF 775–780: 付録B。** PDF 775 に「B. Units and conversion factors」の開始を確認（book.json の pdfStart 775 / bookStart 761 と一致）。表 B.1・B.2 の存在を確認。スポット: 式 (B.1)「1 Btu = 1055.05 J」と Table B.2 の Energy 行「J = 1055.05 × Btu」が原典内で整合。PDF 779 は参考文献（上記）、PDF 780 は空白ページであることを確認。
- **PDF 781–787: 付録C 記号表。** PDF 781 に「C. Nomenclature」の開始を確認（book.json の pdfStart 781 / bookStart 767 と一致）。用語集（data/glossary.json、504 項目）とのスポット確認: 記号表の「h, h̄, h_rad — local heat transfer coefficient」「k — thermal conductivity (W/m·K)」「Nu_x, Nu_L — local Nusselt number, h_x/k_fluid」等の定義とアプリ用語集の用法に矛盾なし（スポット確認であり全項目照合ではない）。
- **PDF 788–810: 索引部。** 788 空白 / 789「Part VII Indices」扉 / 790 空白 / 791「Citation Index」開始（book.json pdfStart 791 と一致）/ 797 まで引用索引が継続 / 798 空白 / 799「Subject Index」開始（同 799 と一致）/ 810（書籍 p.796）が主題索引の最終ページであることを確認。索引項目自体の照合はしていない（対応物なし）。

### メタデータ・コードポイント
- book.json 付録エントリ: 本範囲内で開始する B (775)・C (781)・indices (789)・citation-index (791)・subject-index (799) の pdfStart/bookStart が全て実開始ページと一致。付録A の pdfStart 745 は本範囲外のため本ラウンドでは未確認（C11 範囲）。
- book.json 全体のキー重複チェック（object_pairs_hook 相当）: 重複 0 件。
- appendix-a.json / appendix-b.json のコードポイント走査: U+224A（≊）・U+2126（Ω）・U+00D0（Ð）・U+00B5・U+03BC・𝒯（U+1D4AF）の混入はいずれも 0 件。

### 記録側の注記（データ所見ではない）
- 第4次記録 `docs/audit-final/campaign4/C4-C12_RECORD.md` は、[B.1] の行の途中で物理的に切断されて終わっている（末尾に切断マーカー文字列がそのまま残っている）。そのため第4次の付録表・記号表・索引に関する記録は現存しない。本ラウンドでは当該範囲（[B.1] の画像自読、表 A.1–A.8・B.1・B.2 の存在確認、記号表スポット、索引存在確認）を独立にやり直してカバーした。

## 所見集計
- P0: 0 件
- P1: 0 件
- P2: 0 件
- P3: 0 件

**新規の実質的所見は全重大度でゼロ。** 参考文献は [A.4]–[A.41] 38/38＋[B.1] 1/1 が文字単位で一致し、付録表・記号表・索引は存在確認＋スポットの範囲で原典・book.json メタデータと整合した。

## 未確認・照合限界（正直な記録）
- 付録A 物性表 A.1–A.8 のセル単位の数値照合はしていない（アプリに対応物がなく、本ブリーフの定めどおり存在確認＋スポット転記に留めた）。
- 付録C 記号表は用語集とのスポット確認のみで、全記号の項目単位照合はしていない。
- 引用索引・主題索引の項目単位照合はしていない（対応物なし、存在確認のみ）。
- [A.1]–[A.3]（PDF 748）と付録A 開始ページ（PDF 745）は本範囲外のため未確認。
- 参考文献の日本語フィールド（titleJa・noteJa）はアプリ側の翻訳であり、英語原典との文字照合の対象外とした（英文字段は全て照合済み）。
