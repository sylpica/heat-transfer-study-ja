# 全体修正パート2（問題集の理由文・解説の書き換え）実施記録 — 2026-11-09

対象ツリー：`audit/integration-loop3`、開始 HEAD `6e3cd54`（全体修正パート1完了後）。
入力記録：`docs/audit-final/QUESTION_CLAIMS_RECHECK_20261109.md`（P2 28件）、`docs/audit-final/QUESTION_P3_ADJUDICATION_20261109.md`（P3 確定誤り31件＋確定できない2件）、`docs/audit-collation/OVERALL_FIX_PART1_20261109.md` のパート2引き継ぎ（式(8.61) 伝播1件）。
GitHub への書き込みは本パートでは行っていない。

## 規模

- 対象は **62項目／56問**（P2 28項目・P3 確定誤り31項目・確定できない2項目・(8.61) 伝播1項目。複数項目が同一問題に重なるため問題数は56）。
- 正解キー（answer）と問題 ID・選択肢（choices）は全751問で不変であることを、編集前後データの機械比較で確認した。変更フィールドは distractors・explanation・hints・solutionSteps・prompt（潜熱問題のみ）・revision に限定される。
- 書き換えた理由文は全て、保存前に「文中で述べる誤操作を実際に計算すると当該選択肢の値になる」ことを数値検証した（検証52件・全件合格。検証値は本記録の各表に併記）。

## 同期した複製ファイル

以下のファイルは questions.json と deep-equal な複製を持ち、同一編集を同期した（編集後も deep-equal を機械確認済み）：

- `data/applied-exercises-part1.json`：supp-applied-1-1-v1、1-2-v1、3-3-v1、4-5-v1
- `data/applied-exercises-part2.json`：supp-applied-6-5-v1、8-3-v1、11-3-v1、11-6-v1
- `data/deep-physics-practice.json`：supp-deep-fin-effectiveness-v1
- `data/original-advanced-questions.json`：supp-advanced-ch9-calc

`data/original-section-questions.json` は questions.json とは意図的に異なる著者用ソースだが、対象3問（supp-section-5-5、11-2、11-6）の瑕疵文は同文で存在したため、同一の文言修正と revision 更新を同期した（プロジェクト従来の「変更した節問題は両ファイルで版をそろえる」慣行に沿う）。

さらに、節問題の生成元データにも同じ瑕疵が含まれていたため、生成元側も修正した：

- §5.5：ノートの limits 自体が瑕疵文だった（`data/original-notes.json`、`data/original-notes/ch5.json`）。裁定の代替案どおり「削除」ではなく「λ₁は形状とBiで決まる第1固有値である。」への置換とし、beginnerPitfall・explanation・distractors[0]・solutionSteps の同文も置換で統一した（ノート検証の最小長35字を満たすためでもある）。
- §11.2：誤答選択肢の理由文の生成元は `data/original-question-options/ch11.json` であり、同ファイルの理由文も新しい文へ更新した（公開問題の文は既に新文であり、生成元と一致させた）。

## revision の更新

- revision フィールドを持つ47問は全て1つ上げた（v1→v2 が大半、v2→v3：supp-expanded-bi-calc・supp-section-11-2・supp-applied-6-5-v1・supp-condensation-corrected-latent-v1、v3→v4：supp-section-5-5・supp-section-11-6）。
- revision フィールド自体がない無印レガシー9問（supp-flat-thickness、supp-expanded-fo-calc、supp-expanded-tau-calc、supp-expanded-nu-calc、supp-chapter-ch1-storage、supp-chapter-ch2-cylinder-watts、supp-chapter-ch2-series、supp-chapter-ch7-h、supp-chapter-ch8-ra）は、**フィールドを新設しない**こととした。理由：本パートの変更は理由文・解説のみで、設問文・選択肢・正答キーは不変であり、revision を新設すると既存の学習者の回答記録（revision 'initial' 扱い）が一斉に「旧版」へ再分類され、章ロードマップが誤って未学習扱いになる（章カリキュラムのテストがこれを検出した）。過去にも同一判断の前例がある（Kirchhoff 問題：内容修正でも revision v1 を維持し監査証跡に記録、tests/audit2-batch4.test.mjs）。これら9問も内容ハッシュは変わるため、パート3のレシート再発行対象には含まれる。
- いずれの場合も、変更した56問の内容ハッシュは旧レシートと一致しなくなる。**盲検レシートの再発行はパート3の作業**であり、本パートの変更ID一覧（末尾）がその入力になる。

## P2 28項目の実施内容と数値検証

| # | 問題ID・箇所 | 書き換え後の由来（検証計算 → 選択肢の値） |
|---|---|---|
| 1 | supp-expanded-bi-calc [3] | Lc を掛け忘れた h/k_s = 40/20 = 2.0 |
| 2 | supp-expanded-tau-calc [2] | A_s を 0.010 m² と読み違え hA_s=0.2 → 4000/0.2 = 20,000 s |
| 3 | supp-expanded-nu-calc [2] | L/k_f の換算を落とし h の数値 100 そのもの |
| 4 | supp-chapter-ch1-storage [0] | ΔT を掛けない m×c = 2.0×500 = 1,000 J |
| 5 | supp-chapter-ch1-storage [1] | 比熱の数値 500 そのもの |
| 6 | supp-chapter-ch2-cylinder-watts [1] | ΔT=1 K として 1/0.050 = 20 W |
| 7 | supp-chapter-ch2-series [1] | 0.30 を 0.03 と読み違え合計 0.33 → 12/0.33 ≈ 36 W（P3 #3 と組の入れ替わり解消） |
| 8 | supp-chapter-ch7-h [1] | Nu を 2 倍の 7.32 → 7.32×0.60/0.020 = 219.6 |
| 9 | supp-chapter-ch8-ra [2] | 分母 να の指数誤りで正解の 1/100 → 1.5×10⁴（「3桁の差」の誤記も是正し2桁と明記） |
| 10 | supp-section-11-2 [2] | A を 1 mol と数え違え 1/5 = 0.2 |
| 11 | supp-advanced-ch9-calc [3] | Q̇=60,000 W を面積 2.0 m² で割った 3.0×10⁴ |
| 12 | supp-applied-1-2-v1 [3] | 加熱時間 1 s として 100×1×0.75/(2.0×750) = 0.05 K |
| 13 | supp-applied-3-3-v1 [2] | C_c で求めた ε≈0.286 を 1 から引いた 0.71（出口 40℃ は正しい熱収支と明記） |
| 14 | supp-applied-3-3-v1 [3] | 出口は C_h を使った 55℃＋ ε は上記 0.71 の重なりと明記 |
| 15 | supp-applied-4-5-v1 [3] | tanh(1.5)=0.9051 を mL²=2.25 で割った 0.402 |
| 16 | supp-applied-11-6-v1 [3] | D_AB=6.0×10⁻⁷ とすると Sc=2.0、Sh=1.0 |
| 17 | supp-found-resistor-interface-temperature-v1 [1] | 全温度差 60 K の数値を温度と読み替えた 60 ℃ |
| 18 | supp-next-cold-outlet-with-loss-v1 [3] | 失熱 50 kW の数値 50 を出口温度と読み替えた 50 ℃ |
| 19 | supp-next-nusselt-invert-h-v1 [2] | Nu を 2 倍の 400 → 20（入れ替わり解消） |
| 20 | supp-next-nusselt-invert-h-v1 [3] | Nu を 4 倍の 800 → 40（入れ替わり解消） |
| 21 | supp-chf-capillary-length-v1 [3] | 分母を落とし √σ=√0.060≈0.245 m → 245 mm |
| 22 | supp-tube-boiling-subcooled-budget-v1 [1] | 蒸発用熱量を顕熱の 2 倍の 4000 W → 4000/(0.020×2.0×10⁶) = 0.1000 |
| 23 | supp-dropwise-total-resistance-gain-v1 [1] | 凝縮抵抗を新旧双方へ二重加算 (0.0500+0.0200)/(0.0350+0.0050) = 1.75 |
| 24 | supp-heat-pipe-gravity-assisted-margin-v1 [1] | 流動損失の項を落とし 3000−(−1600) = 4600 Pa |
| 25 | supp-roadmap-wall-path-v1 [0] | 合計抵抗を 4 倍の 2.0 K/W → 60/2.0 = 30 W |
| 26 | supp-transient-gap-chart-center-temperature-v1 [1] | 温度差に周囲温度 20℃ を使い 20+0.773×20 ≈ 35.5 ℃ |
| 27 | supp-transient-gap-product-center-v1 [1] | 応答の和 1.50×80 K で周囲温度を加えず 120 ℃ |
| 28 | supp-turbulence-wall-unit-near-wall-v1 [3] | 逆組み立て 0.474 に 100 倍の桁誤り → 47.4 |

## P3 確定誤り31項目の実施内容

裁定記録の方向性どおりに実施した。数値系は P2 と同じ再現検証を通過している。

- supp-flat-thickness [3]：面積2倍×厚さ半分 → 4倍、と書き換え。
- supp-expanded-fo-calc [0]：特性長さを 0.20 m と読み違えた値（4.0×10⁻⁴/0.040 = 0.010）。
- supp-chapter-ch2-series [2]：P2 #7 と組で入れ替わりを解消（12×0.60 = 7.2 W の理由をこちらへ）。
- supp-chapter-ch8-ra explanation：末尾の内部見直しメモ「見直し注意：…」を削除（数値は不変）。
- supp-section-5-5：前提のない「λ₁=1は説明用の仮定値…」の文を、裁定の代替案どおり「λ₁は形状とBiで決まる第1固有値である。」へ置換（explanation・distractors[0]・solutionSteps・beginnerPitfall の4箇所と、生成元のノート limits 2ファイル）。
- supp-section-11-6：Sh の文章定義を「物質移動係数に代表長さを掛けたものと分子拡散係数の比」へ修正（explanation・distractors[1] の2箇所）。
- supp-applied-1-1-v1 [0]：総熱率 280 W を片方の面積 0.08 m² で割った 3,500。
- supp-applied-6-5-v1 [0]：平板長さ L=1.0 m とした 66.4×0.030/1.0 ≈ 1.99。なお同問 distractors[1]（3.98）の現行理由文「平板長さを 0.50 m とした」は 66.4×0.030/0.50 = 3.984 で再現可能であり、裁定でも対象外とされたため不変更。
- supp-applied-8-3-v1 [2]：分母 να を約 8×10⁻⁹ で割った 2.94×10⁵ と書き換え。
- supp-applied-11-3-v1 [2]：正解の 1/1000（桁を3桁誤った）値と書き換え。
- supp-deep-fin-effectiveness-v1 [2]：理想放熱量 6.0 W の数値を無次元比と読み替えた値。
- supp-found-three-mode-conduction-v1 [0]：厚さを 0.20 m と取り違えた 100 W（h は与えられていない旨の誤った混同記述を除去）。
- supp-next-parallel-extra-branch-v1 [3]：第3枝 200 W の代わりに第1枝 600 W を再計数した 1500 W。
- supp-next-ntu-eps-ratio-v1 [0]：実熱量を半分（3.0 kW）とした ε=0.25。
- supp-next-dimensionless-centre-temperature-v1 [0]：超過温度の半分 40 K を温度と誤認した値と明記。
- supp-batch2-f-area-ratio-v1 [3]：F の差ではなく和（1.0+0.80 = 1.80）。
- supp-batch3-neumann-grad-v1 [3]（R3-06 追加観察）：k で割らず符号も落とし流束の数値 200 を勾配とした値。
- supp-batch3-left-boundary-outward-flux-v1 [2]：符号反転に大きさ半分が重なった +100。
- supp-batch3-generated-center-rise-v1 [0]：分母を 4k とした（円柱の式との混同）1.25 K。
- supp-chf-surface-tension-scale-v1 [2]：指数の符号反転 16^(−1/4) = 1/2。
- supp-forced-condensation-coolant-balance-v1 [0]：比熱を 1000 と取り違えた（ΔT=60 K）80.0 ℃。存在しない飽和温度への言及を除去。
- supp-gas-layer-order-v1 [0]：両方向とも層Aの放出 100×0.25 = 25 を流用した値。
- supp-stationary-zero-reference-v1 explanation：例示を質量側へ書き換え（N_B=0 でも N_A≠0 なら全質量流束 M_A·N_A≠0 で質量平均速度は 0 にならない）。
- supp-buoyancy-film-richardson-scale-v1 [1]：Gr/Re=5056 に ×10⁻⁹ の桁ずれが重なった 5.06×10⁻⁶。
- supp-found-ntu-config-v1 hints[0]：ε–NTU が配置と C_r で変わることへの誘導へ書き換え（定型文を除去）。
- supp-found-boil-chf-v1 hints[0]：CHF の条件依存性への誘導へ書き換え。
- supp-found-boil-regime-v1 hints[0]：沸騰曲線と CHF 付近の壁温急変への誘導へ書き換え。
- supp-next-pr-layer-thickness-v1 solutionSteps：数値のない概念問題に即した手順（Pr=ν/α_f の大小と境界層厚さの傾向判断）へ全面書き換え。
- supp-next-parallel-temperature-condition-v1 solutionSteps：並列で ΔT 共通・Q̇=ΔT/R は枝ごとに異なることの確認手順へ全面書き換え。
- supp-roadmap-dimension-per-length-v1 solutionSteps[1]：割り算の向きを「Q̇′を kΔT で割る」へ修正。
- supp-turbulence-colburn-matching-average-v1 [2]：前提を正し「C_f,x は無次元、h̄_L は W/(m²·K) で次元自体が異なる。同一の量どうしでも局所値と平均値は一般に異なる」へ書き換え。

## 確定できない2項目の書き換え

- supp-found-pr-fluid-v1 [3]（#15）：「逆比 α_f/ν≈1.33 に、選択肢の中で最も近い値を選んでいます」へ調整（裁定の任意方向性どおり、近接の度合いが伝わる表現）。
- supp-batch3-generated-center-rise-v1 [1]（#24）：再現可能な由来「L²=0.0025 を 0.0020 と誤計算した値」（20000×0.0020/(2×10) = 2.00 K）へ書き換え（裁定の推奨どおり）。

## 式(8.61) 伝播1件（supp-condensation-corrected-latent-v1、v2→v3）

パート1で原典印刷形へ直した式(8.61)（0.228/Pr）に合わせ、√Pr 前提だった設問を再構成した。

- prompt の式を (0.683−0.228/Pr) へ。係数 0.683−0.228/4.0 = 0.626、補正率 0.626×0.080 = 0.0501、**h_fg′ = 2.40×10⁶×1.0501 ≈ 2.520×10⁶ J/kg**。
- 正答キー（index 2、2.51×10⁶ J/kg）は不変（新値との差 0.010×10⁶、次点 2.59×10⁶ との差 0.070×10⁶ で依然最も近い）。
- explanation・hints[0]・solutionSteps・distractors[0][2][3] を新しい計算に整合させた。distractors[0]（符号反転）は新計算で ≈2.28×10⁶ となり選択肢 2.29×10⁶ が最も近いことを明記、distractors[3]（Ja をそのまま加算）は 2.40×10⁶×1.080 = 2.59×10⁶ で従来どおり再現可能。

## テスト期待値の更新（裁定に沿うもののみ）

誤った現行文・旧 revision を固定していた期待値を、裁定に沿って4ファイル更新した。テストの緩和や削除は行っていない。

1. `tests/stage6-section-8-5-reconstruction.test.mjs`：潜熱オラクルが誤った √Pr 形（0.228/√4.0、期待値 2,509,248）を固定していたため、印刷形 0.228/4.0・期待値 2,520,192 へ更新。onlyChoiceNear の許容 0.5% は不変で、新値でも正答選択肢が一意に該当する（相対差 0.40%）。
2. `tests/audit2-batch3.test.mjs`（R4-8-005）：潜熱問題の revision 期待値 v2 → v3。
3. `tests/applied-exercises.test.mjs`：revision 期待値に今回の更新（6-5 は v3、1-1・1-2・3-3・4-5・8-3・11-3・11-6 は v2）を反映。
4. `tests/advanced-numeric.test.mjs`：revision 期待値の v2 リストに supp-advanced-ch9-calc を追加。
5. `tests/deep-physics-practice.test.mjs`：一括 v1 期待に supp-deep-fin-effectiveness-v1 の v2 例外を追加。
6. `tests/flow-phase-practice.test.mjs`：一括 v1 期待に、本パートで改訂した4問（supp-tube-boiling-subcooled-budget-v1、supp-forced-condensation-coolant-balance-v1、supp-dropwise-total-resistance-gain-v1、supp-heat-pipe-gravity-assisted-margin-v1）の v2 例外を追加。

## テスト・ビルド結果（実測）

- 全 Node スイート（`npm test`）：**1,807件 = 合格 1,802 / 失敗 0 / スキップ 5**（パート1完了時の 1,807 = 1,802/0/5 と同数。テストの追加・削除はない）。
- 公開ビルド（`npm run build:public`）：最終ツリーで成功。
- 途中経過として、初回実行では11件の失敗（ノート最小長・生成元データの不整合・章ロードマップの revision 意味論・一括 revision 期待）が出たが、いずれも上記のとおり生成元データの修正、裁定の代替案（置換）への切替、revision 方針の前例準拠、期待値の対象ID限定更新で解消し、握りつぶした失敗はない。

## 変更した問題ID一覧（パート3：盲検レシート再発行の入力）

計56問：

supp-advanced-ch9-calc、supp-applied-1-1-v1、supp-applied-1-2-v1、supp-applied-11-3-v1、supp-applied-11-6-v1、supp-applied-3-3-v1、supp-applied-4-5-v1、supp-applied-6-5-v1、supp-applied-8-3-v1、supp-batch2-f-area-ratio-v1、supp-batch3-generated-center-rise-v1、supp-batch3-left-boundary-outward-flux-v1、supp-batch3-neumann-grad-v1、supp-buoyancy-film-richardson-scale-v1、supp-chapter-ch1-storage、supp-chapter-ch2-cylinder-watts、supp-chapter-ch2-series、supp-chapter-ch7-h、supp-chapter-ch8-ra、supp-chf-capillary-length-v1、supp-chf-surface-tension-scale-v1、supp-condensation-corrected-latent-v1、supp-deep-fin-effectiveness-v1、supp-dropwise-total-resistance-gain-v1、supp-expanded-bi-calc、supp-expanded-fo-calc、supp-expanded-nu-calc、supp-expanded-tau-calc、supp-flat-thickness、supp-forced-condensation-coolant-balance-v1、supp-found-boil-chf-v1、supp-found-boil-regime-v1、supp-found-ntu-config-v1、supp-found-pr-fluid-v1、supp-found-resistor-interface-temperature-v1、supp-found-three-mode-conduction-v1、supp-gas-layer-order-v1、supp-heat-pipe-gravity-assisted-margin-v1、supp-next-cold-outlet-with-loss-v1、supp-next-dimensionless-centre-temperature-v1、supp-next-ntu-eps-ratio-v1、supp-next-nusselt-invert-h-v1、supp-next-parallel-extra-branch-v1、supp-next-parallel-temperature-condition-v1、supp-next-pr-layer-thickness-v1、supp-roadmap-dimension-per-length-v1、supp-roadmap-wall-path-v1、supp-section-11-2、supp-section-11-6、supp-section-5-5、supp-stationary-zero-reference-v1、supp-transient-gap-chart-center-temperature-v1、supp-transient-gap-product-center-v1、supp-tube-boiling-subcooled-budget-v1、supp-turbulence-colburn-matching-average-v1、supp-turbulence-wall-unit-near-wall-v1

## 未実施事項（正直な残件）

- 変更56問の盲検レシート再発行とカバレッジ 751/751 の回復確認はパート3の作業（本パートでは未実施）。本パート完了時点では、これら56問の内容ハッシュは旧レシートと一致しない。
- 配信ブラウザースイートの完走、WebKit/Firefox/実機確認は公開段階の作業であり、本パートでは実施していない。
- GitHub 配信は親側の別ステップ（本パートでは書き込みコール 0 件）。
