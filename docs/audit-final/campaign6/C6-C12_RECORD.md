# 全ページ照合 第6次（収束判定回）— C12 記録（PDF 749–810、62ページ）

- 対象ツリー: heat-c6-c12 クローン `~/workspace/dev/heat-c6-c12`、先端 `8bd6ae4`（基準ツリー 8ca08c7＋第6次ブリーフ）
- 原典: `~/workspace/research_notes/ahtt-reading/AHTTv600.pdf`（PDFページ = 書籍ページ + 14）
- 実施経緯: 先行ラインが記録作成前に終了したため、本記録は再実施ラインが独立に行った確認に基づく。第5次 C12 記録は参照したが、結論は本ライン自身の照合で確定させた。
- 担当範囲の内訳:
  - PDF 749–752: 付録A 参考文献 [A.4]–[A.41] → `data/appendix-references/appendix-a.json` と項目単位・文字単位照合
  - PDF 753–774: 付録A 物性表 A.1–A.8 → アプリに対応物なし（存在確認＋スポット確認のみ。セル単位照合はしていない）
  - PDF 775–780: 付録B（参考文献 [B.1] は PDF 779 → `appendix-b.json` と項目単位照合。表 B.1・B.2 と散文は対応物なし。PDF 780 は空白）
  - PDF 781–787: 付録C 記号表 → 直接の対応物なし（用語集スポット確認のみ。項目単位照合はしていない）
  - PDF 788 空白 / 789 Part VII 扉 / 790 空白 / 791–797 引用索引（対応物なし）/ 798 空白 / 799–810 主題索引（対応物なし）
- 方法: 参考文献は (1) pdftotext -layout 抽出との全フィールド包含チェック（authors・originalTitle・publication・doi・url・noteEn。空白除去＋行末ハイフン除去の正規化でも照合）、(2) 不一致候補は全件、600dpi ページ画像の自読で裁定。表・索引は存在確認とスポット確認。字形の最終判定はテキスト層では行っていない。

## 照合結果サマリ（62/62ページ）

### 項目単位・文字単位で照合した範囲
- **PDF 749–752: 付録A 参考文献 [A.4]–[A.41]、38項目 → 38/38 一致。**
  - 全フィールド包含チェックで不一致候補は1件のみ（[A.22] originalTitle）。残り37項目は全フィールドが正規化包含で一致した。
  - **[A.22] の裁定（600dpi 画像自読、PDF 750）**: 原典は原題末尾を「(HFC- / 134a)」と行末で分けて印刷する。HFC-134a は冷媒の正式な呼称であり、このハイフンは語の一部であるため、JSON の「(HFC-134a)」は原典と文字単位で一致する。チェック側の脱ハイフン正規化が生んだ見かけの不一致であり、データの誤りではない。著者・publication「J. Phys. Chem. Ref. Data, 23:657–729, September 1994」・doi「10.1063/1.555958」も画像で一致を確認した。
  - 同じ画像範囲で [A.20]「Int. J. Thermophys., 25(6):21–69, January 2004. doi: 10.1023/B:IJOT.0000022327.04529.f37」と [A.21]「20(5):917–1021, September 1991. doi: 10.1063/1.555897」も目視し、JSON と一致（ページ範囲は en ダッシュ）。
  - [A.11] は doi「10.18434/T4JS3C」・url「https://www.nist.gov/srd/refprop」（印刷は "https:" の直後でハイフンなし改行）・noteEn まで全フィールドが抽出テキストと一致した。
  - ページメタデータ: 全41項目の bookPage/pdfPage は差14で連番 [A.1]–[A.41]・count=41 と整合。宣言ページ範囲（bookPages 734–738 / pdfPages 748–752）とも整合。[A.1]–[A.3] は PDF 748（本範囲外、C11 側）にある。
  - 構造注記（不一致ではない）: [A.11] は原典の印刷順（doi → url → 注記）と JSON のフィールド格納順が違うだけで文字列は一致する。
- **PDF 779: 付録B 参考文献 [B.1]、1項目 → 一致。** 600dpi 画像で全文を自読: 「[B.1] A. Thompson and B. N. Taylor. Guide for the Use of the International System of Units (SI). National Institute of Standards and Technology, Gaithersburg, MD, 2008. url: http://physics.nist.gov/SP811. NIST Special Pub. 811.」包含チェックで publication が候補に挙がったのは、JSON が url 部分を url フィールドへ分離して格納しているためであり、構成文字列は全て文字単位で一致する（構造注記であり不一致ではない）。メタデータ: count=1、bookPages 765 / pdfPages 779 の宣言と実ページが一致。

### 存在確認＋スポット確認の範囲（セル単位・項目単位の照合はしていない）
- **PDF 753–774: 付録A 物性表 A.1–A.8。** 全ページにランニングヘッド「Appendix A: Some thermophysical properties of selected materials」を確認し、表題を全数確認: A.1 Properties of metallic solids / A.2 Properties of nonmetallic solids / A.3 Thermophysical properties of saturated liquids / A.4 Some latent heats of vaporization / A.5 Thermophysical properties of saturated vapors / A.6 Thermophysical properties of gases at atmospheric pressure（PDF 769 で表題を確認、継続ページは「gases at 1 atm…continued」）/ A.7 Physical constants / A.8 Additional physical property data given in the text。600dpi スポット確認（PDF 755、書籍 p.741）: Table A.2 の列構成 Material / Temperature Range (°C) / Density ρ (kg/m³) / Specific Heat c_p (J/kg·K) / Thermal Conductivity k (W/m·K) / Thermal Diffusivity α (m²/s) を画像で自読し、冒頭行 Aluminum oxide (Al₂O₃) の plasma sprayed coating 20°C・k ≈ 4、HVOF sprayed coating 20°C・k ≈ 14 も抽出と整合した。アプリ側に対応データは存在しない（book.json の付録A translationStatus は not_started、data/ 配下に物性表データなし）ため、転記値との照合先はない。
- **PDF 775–780: 付録B。** PDF 775 に「B. Units and conversion factors」の開始を確認（book.json の pdfStart 775 / bookStart 761 と一致）。表 B.1・B.2 の存在を確認。スポット: 式 (B.1)「1 Btu = 1055.05 J」と Table B.2 の Energy 行の「1055.05」が原典内で整合。PDF 779 は参考文献（上記）、PDF 780 は空白ページであることを確認。
- **PDF 781–787: 付録C 記号表。** PDF 781 に「C. Nomenclature」の開始を確認（book.json の pdfStart 781 / bookStart 767 と一致）。用語集（data/glossary.json、504 項目）とのスポット確認: 記号表の「h, h̄, h_rad — local heat transfer coefficient」「k — thermal conductivity (W/m·K)」「Nu_x, Nu_L — local Nusselt number, h_x/k_fluid」等の定義とアプリ用語集の用法に矛盾なし（スポット確認であり全項目照合ではない）。
- **PDF 788–810: 索引部。** 788 空白 / 789「Part VII Indices」扉 / 790 空白 / 791「Citation Index」開始（book.json pdfStart 791 と一致）/ 797 まで引用索引が継続 / 798 空白 / 799「Subject Index」開始（同 799 と一致）/ 810（書籍 p.796）が主題索引の最終ページであることを確認。索引項目自体の照合はしていない（対応物なし）。

### メタデータ・コードポイント
- book.json 付録エントリ: A (pdfStart 745 / bookStart 731)・B (775 / 761)・C (781 / 767)・indices (789 / 775)・citation-index (791 / 777)・subject-index (799 / 785) の全てが実開始ページと一致（差は全て14で整合）。付録A の開始は本範囲外だが、PDF 745 が付録A の扉ページ（「A. Some thermophysical properties of selected materials」）であることを本ラインでも確認した（PDF 744 は空白）。
- book.json 全体のキー重複チェック（object_pairs_hook 相当）: 重複 0 件。本範囲に関するページメタデータの退行なし。
- appendix-a.json / appendix-b.json のコードポイント走査: U+224A（≊）・U+2126（Ω）・U+00D0（Ð）・U+00B5・U+03BC・𝒯（U+1D4AF）・U+FFFD の混入はいずれも 0 件。

## 所見集計
- P0: 0 件
- P1: 0 件
- P2: 0 件
- P3: 0 件

**新規の実質的所見は全重大度でゼロ。** 参考文献は [A.4]–[A.41] 38/38＋[B.1] 1/1 が文字単位で一致し、付録表・記号表・索引は存在確認＋スポットの範囲で原典・book.json メタデータと整合した。

## 未確認・照合限界（正直な記録）
- 付録A 物性表 A.1–A.8 のセル単位の数値照合はしていない（アプリに対応物がなく、本ブリーフの定めどおり存在確認＋スポット確認に留めた）。
- 付録C 記号表は用語集とのスポット確認のみで、全記号の項目単位照合はしていない。
- 引用索引・主題索引の項目単位照合はしていない（対応物なし、存在確認のみ）。
- [A.1]–[A.3]（PDF 748）は本範囲外のため項目単位照合はしていない（付録A 扉ページ PDF 745 の存在確認は行った）。
- 参考文献の日本語フィールド（titleJa・noteJa）はアプリ側の翻訳であり、英語原典との文字照合の対象外とした（英文字段は全て照合済み）。
