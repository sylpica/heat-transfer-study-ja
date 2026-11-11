# 全ページ照合 第4次（収束判定回）— C12 記録（PDF 749–810、62ページ）

- 対象ツリー: heat-c4-c12 クローン `~/workspace/dev/heat-c4-c12`、先端 `403f735`（第3次＋第8回修正済み基準ツリー、ブリーフ指定どおり）
- 原典: `~/workspace/research_notes/ahtt-reading/AHTTv600.pdf`（PDFページ = 書籍ページ + 14）
- 担当範囲の内訳（第3次 C12 の確定範囲を踏襲し、本ラウンドで独立に再確認）:
  - PDF 749–752: 付録A 参考文献 [A.4]–[A.41] → `data/appendix-references/appendix-a.json` と項目単位・文字単位照合
  - PDF 753–774: 付録A 物性表 A.1–A.8 → アプリに対応物なし（存在確認＋スポット転記のみ。セル単位照合はしていない）
  - PDF 775–780: 付録B（参考文献 [B.1] は PDF 779 → `appendix-b.json` と項目単位照合。表・散文は対応物なし。PDF 780 は空白）
  - PDF 781–787: 付録C 記号表 → 直接の対応物なし（用語集スポット確認のみ。項目単位照合はしていない）
  - PDF 788 空白 / 789 Part VII 扉 / 790 空白 / 791–797 引用索引（対応物なし）/ 798 空白 / 799–810 主題索引（対応物なし）
- 方法: 参考文献は (1) pdftotext 抽出との全フィールド包含チェック（著者・原題・出版情報・DOI・URL・noteEn）、(2) 不一致候補は全件 600dpi ページ画像で裁定、(3) さらに [A.18]–[A.22] は画像から全文を自読して裏取り。表・索引はページ画像による存在確認とスポット転記。字形・数字の判定はテキストレイヤでは行っていない。

## 照合結果サマリ（62/62ページ）

### 項目単位・文字単位で照合した範囲
- **PDF 749–752: 付録A 参考文献 [A.4]–[A.41]、38項目 → 38/38 一致。**
  - 全フィールド包含チェックで 31 項目は全フィールドがそのまま一致。残り 7 件のフィールド不一致候補（A.8 publication / A.11 url / A.20 publication / A.22 originalTitle / A.28 publication / A.33 publication / A.40 url）は全てテキストレイヤの改行分断（行末ハイフン脱落を含む）による見かけの不一致で、原典画像では JSON と文字単位で一致することを確認した。代表裁定:
    - [A.22] 原題末尾「(HFC-134a)」は印刷では行末ハイフン「(HFC- / 134a)」であり、テキストレイヤがハイフンを脱落させていた。600dpi 画像で「1,1,1,2-tetrafluoroethane (HFC-134a) covering temperatures from 170 K to 455 K at pressures up to 70 MPa. J. Phys. Chem. Ref. Data, 23:657–729, September 1994. doi: 10.1063/1.555958」を自読し JSON と完全一致。
    - [A.20] 画像自読: 「Int. J. Thermophys., 25(6):21–69, January 2004. doi: 10.1023/B:IJOT.0000022327.04529.f37」— JSON と一致。
    - [A.19] 画像自読: Span et al., 29(6):1361–1433, November 2000, doi 10.1063/1.1349047 — 一致。[A.21] Stewart et al., 20(5):917–1021, September 1991, doi 10.1063/1.555897 — 一致。[A.18] の noteEn（IUPAC 後援）も画像で一致。
  - ページメタデータ: 全 38 項目の bookPage/pdfPage は差 14 で、宣言ページ範囲（bookPages 734–738 / pdfPages 748–752、項目数 41 [A.1]–[A.41]）とも整合。[A.1]–[A.3] は PDF 748（本範囲外、C11 側）にある。
  - 構造注記（不一致ではない）: [A.11] は原典と JSON で doi/url/注記の並び順が違うだけで文字列は一致（第3次と同一所見）。
- **PDF 779: 付録B 参考文献 [B.1]、1項目 → 一致。** 原典「A. Thompson and B. N. Taylor. Guide for the Use of the International System of Units (SI). National Institute of S
...[truncated 2700 chars]