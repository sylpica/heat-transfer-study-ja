# 全ページ照合 第7次（収束判定回）— C12 記録（PDF 749–810、62ページ）

- 対象ツリー: heat-c7-c12 クローン `~/workspace/dev/heat-c7-c12`、先端 `787e8b5`（第7次ブリーフ時点の統合ツリー）
- 原典: `~/workspace/research_notes/ahtt-reading/AHTTv600.pdf`（PDFページ = 書籍ページ + 14）
- データの状態: `data/appendix-references/` は commit `bba7cb3` 以来変更がなく、第6次で照合したデータと同一。本記録は同一データに対する本ライン自身の再照合に基づく（第6次記録は参照したが、結論は下記の自前の照合で確定させた）。
- 担当範囲の内訳:
  - PDF 749–752: 付録A 参考文献 [A.4]–[A.41] → `data/appendix-references/appendix-a.json` と項目単位照合。あわせて、参考文献の全件確認の定めにより [A.1]–[A.3]（PDF 748、本範囲の直前ページ）も同じ方法で照合した
  - PDF 753–774: 付録A 物性表 A.1–A.8 → アプリに対応物なし（存在確認のみ。セル単位照合はしていない）
  - PDF 775–780: 付録B（参考文献 [B.1] は PDF 779 → `appendix-b.json` と項目単位照合。表 B.1・B.2 と散文は対応物なし。PDF 780 は空白）
  - PDF 781–787: 付録C 記号表 → 直接の対応物なし（開始ページの存在確認のみ。項目単位照合はしていない）
  - PDF 788 空白 / 789 Part VII 扉 / 790 空白 / 791–797 引用索引（対応物なし）/ 798 空白 / 799–810 主題索引（対応物なし）
- 方法: 参考文献は (1) pdftotext -layout 抽出との全フィールド包含チェック（authors・originalTitle・publication・doi・url・noteEn。空白除去の正規化と、行末ハイフン除去の正規化の双方で照合）、(2) 各項目の authors 先頭が宣言された pdfPage の抽出テキストに現れることの確認（41件全件）、(3) 不一致候補は全件、600dpi ページ画像の自読で裁定。表・索引は存在確認。字形の最終判定はテキスト層では行っていない。

## 照合結果サマリ（62/62ページ）

### 項目単位で照合した範囲
- **PDF 748–752: 付録A 参考文献 [A.1]–[A.41]、41項目 → 41/41 一致。**
  - 全フィールド包含チェックで不一致候補は1件のみ（[A.22] originalTitle）。残り40項目は全フィールドが空白除去の正規化包含で一致した。各項目の宣言 pdfPage と実際の出現ページも 41/41 で一致（bookPage との差14も全件整合、count=41・宣言ページ範囲 bookPages 734–738 / pdfPages 748–752 とも整合）。
  - **[A.22] の裁定（600dpi 画像自読、PDF 750）**: 原典は原題を「standard formula- / tion of … (HFC- / 134a)」と2箇所で行末分割して印刷する。「formula-tion」のハイフンは語 "formulation" の行末分割（見かけ）である一方、「HFC-134a」のハイフンは冷媒呼称の一部（実在）であり、単一の正規化では両方を同時に解決できないことが包含チェック不一致の原因である。画像で著者「R. Tillner-Roth and H. D. Baehr」、publication「J. Phys. Chem. Ref. Data, 23:657–729, September 1994」、doi「10.1063/1.555958」も含め全文を読み、JSON の「(HFC-134a)」を含む原題が原典と文字単位で一致することを確定した。データの誤りではない。
  - 同じ画像範囲で [A.20]「Int. J. Thermophys., 25(6):21–69, January 2004. doi: 10.1023/B:IJOT.0000022327.04529.f37」と [A.21]「20(5):917–1021, September 1991. doi: 10.1063/1.555897」も目視し、JSON と一致した（包含チェックでも一致済み）。
- **PDF 779: 付録B 参考文献 [B.1]、1項目 → 一致。** ページ全文を抽出テキストで読み、構成文字列（authors・originalTitle・publication の両断片「National Institute of Standards and Technology, Gaithersburg, MD, 2008.」と「NIST Special Pub. 811.」・url「http://physics.nist.gov/SP811」）が全て文字単位で含まれることを確認した。包含チェックで publication が候補に挙がったのは、原典では publication の途中に「url: …」が挿入される印刷順を、JSON が url フィールドへ分離して格納しているためであり、構造注記であって不一致ではない。メタデータ: count=1、bookPages 765 / pdfPages 779 の宣言と実ページが一致。

### 存在確認の範囲（セル単位・項目単位の照合はしていない）
- **PDF 753–774: 付録A 物性表 A.1–A.8。** 表題を全数確認: A.1 Properties of metallic solids（753）/ A.2 Properties of nonmetallic solids（755）/ A.3 Thermophysical properties of saturated liquids（759）/ A.4 Some latent heats of vaporization（765）/ A.5 Thermophysical properties of saturated vapors（766）/ A.6 Thermophysical properties of gases at atmospheric pressure（769）/ A.7 Physical constants（774）/ A.8 Additional physical property data given in the text（774）。ランニングヘッド「Appendix A」は 22 ページ中 20 ページで確認（残りは表の継続・区切りページ）。アプリ側に対応データは存在しない（book.json の付録A translationStatus は not_started）ため、転記値との照合先はない。
- **PDF 775–780: 付録B。** PDF 775 に「B. Units and conversion factors」の開始と式 (B.1)「1 Btu = 1055.05 J」を確認。表 B.1「SI Multiplying Factors」は PDF 776、表 B.2「Selected Conversion Factors」は PDF 777–778（continued 含む）に存在。PDF 780 は空白ページ（抽出テキスト 0 文字）であることを確認。
- **PDF 781–787: 付録C 記号表。** PDF 781 に「C. Nomenclature」の開始を確認（book.json の pdfStart 781 / bookStart 767 と一致）。記号表そのものはアプリに直接の対応物がなく、項目単位照合はしていない。
- **PDF 788–810: 索引部。** 788 空白（0文字）/ 789「Part VII Indices」扉 / 790 空白（0文字）/ 791「Citation Index」開始（book.json pdfStart 791 と一致）/ 797 まで引用索引が継続 / 798 空白（0文字）/ 799「Subject Index」開始（同 799 と一致）/ 810（書籍 p.796）が主題索引の最終ページであることを確認。索引項目自体の照合はしていない（対応物なし）。
- 付録A の開始は本範囲外だが、PDF 745 が付録A の扉ページ（「A. Some thermophysical properties of selected materials」）であることを本ラインでも確認した。

### メタデータ・コードポイント
- book.json 付録エントリ: A (pdfStart 745 / bookStart 731)・B (775 / 761)・C (781 / 767)・indices (789 / 775)・citation-index (791 / 777)・subject-index (799 / 785) の全てが実開始ページと一致（差は全て14で整合）。
- book.json 全体のキー重複チェック（object_pairs_hook）: 重複 0 件。本範囲に関するページメタデータの退行なし。
- appendix-a.json / appendix-b.json のコードポイント走査: U+224A（≊）・U+2126（Ω）・U+00D0（Ð）・U+00B5・U+03BC・𝒯（U+1D4AF）・U+FFFD の混入はいずれも 0 件。

## 所見集計
- P0: 0 件
- P1: 0 件
- P2: 0 件
- P3: 0 件

**新規の実質的所見は全重大度でゼロ。** 参考文献は [A.1]–[A.41] 41/41＋[B.1] 1/1 が項目単位で一致し（[A.1]–[A.3] を含む全件確認）、付録表・記号表・索引は存在確認の範囲で原典・book.json メタデータと整合した。第6次修正・第11回・R11-2 追随修正のうち本範囲に該当するデータ変更はなく、定着確認の対象は存在しない（参考文献データ自体が第6次照合時から不変であることは上記のとおり確認済み）。

## 未確認・照合限界（正直な記録）
- 付録A 物性表 A.1–A.8 のセル単位の数値照合はしていない（アプリに対応物がなく、確定事項どおり存在確認に留めた。第6次で行われた PDF 755 の 600dpi スポット読みの再実施はしていない）。
- 付録C 記号表は開始ページの存在確認のみで、用語集とのスポット突合を含む項目単位照合は本ラインでは行っていない（直接の対応物なし）。
- 引用索引・主題索引の項目単位照合はしていない（対応物なし、存在確認のみ）。
- [A.1]–[A.3] は PDF 748（本範囲の直前ページ）にあり、参考文献の全件確認として包含チェック＋宣言ページ確認の対象に含めたが、600dpi 画像での自読はしていない（包含チェックで全フィールド一致のため候補に挙がらなかった）。
- 参考文献の日本語フィールド（titleJa・noteJa）はアプリ側の翻訳であり、英語原典との文字照合の対象外とした（英文字段は全て照合済み）。
- 包含チェックはテキスト層に基づく。字形レベルの判定を行ったのは不一致候補 [A.22] のみ（600dpi 自読で裁定済み）。
