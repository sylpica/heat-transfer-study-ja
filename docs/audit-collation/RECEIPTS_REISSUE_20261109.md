# 変更問題56問の盲検レシート再発行とカバレッジ再確認 — 2026-11-09

対象ツリー：`audit/integration-loop3`、開始 HEAD `febf20a`（全体修正パート2完了後）。
入力：`docs/audit-collation/OVERALL_FIX_PART2_20261109.md` 末尾の変更ID一覧56問。
GitHub への書き込みは本作業では行っていない。

## 方法（第3回 Q01 再発行の先例に準拠）

- パート2で理由文・解説等を書き換えた56問は、内容ハッシュ（`scripts/audit-question-coverage.mjs` の `questionEvidenceHash`）が変わり、旧レシートが無効化した。旧記録（第2回請求・Codex 第2回レシート・第3回レシート）は歴史記録として一切変更していない。
- 盲検パケット：各問の `id`・`prompt`・`choices`・`figure`・`field` のみを収録（answer・explanation・distractors・hints・solutionSteps は含めない）。8問×7パケット（`docs/audit-collation/reissue/packets/`）。
- 解題：7名の解題者がパケット外の答え・解説を含むファイルを開かず、prompt と choices のみから独立に解題（数値問題は実際に計算）。結果は `docs/audit-collation/reissue/results/` に保存し、保存後に保存キーと照合した。
- レシート：`docs/audit-collation/evidence/revised-56-receipts.json`（第3回形式）。各レシートの `content_sha256` は現行データから実測した。

## 照合結果

- **56問全件で、解題者の独立選択が保存キーと一致した（不一致0件）。**
- concerns は1件のみ：`supp-condensation-corrected-latent-v1`。解題者の独立計算は h_fg′ = 2.520×10⁶ J/kg で、選択肢に同値はなく最も近い 2.51×10⁶ J/kg（キー index 2）を選択した。これはパート2記録の分析（新値 2.520×10⁶ に対しキー 2.51×10⁶ が差 0.010×10⁶、次点 2.59×10⁶ が差 0.070×10⁶）どおりであり、キーの妥当性が盲検でも裏付けられた。
- 統括側のスポット検算（3件、再計算で一致）：潜熱問題（0.683−0.228/4.0 = 0.626、×0.080 = 0.05008、h_fg′ = 2.520×10⁶ J/kg）、`supp-chf-capillary-length-v1`（√(0.060/10⁴) = 2.45 mm）、`supp-turbulence-wall-unit-near-wall-v1`（y⁺ = 1.0×10⁻⁴×0.316228/1.5×10⁻⁵ ≈ 2.11）。

## カバレッジ再確認（機械検査）

検査スクリプト：`docs/audit-collation/check-coverage-reissue.mjs`（第3回 `check-coverage-r3.mjs` の構造を踏襲し、全レシートを現行データで再検証）。

| 証拠源 | 総数 | 現行データで有効 | 備考 |
|---|---|---|---|
| Muse 第2回請求（ID集合） | 422 | 422（ID基準） | 変更56問のうち21問を含む |
| Codex 第2回レシート | 41 | 34 | 無効化7件は全て変更56問内 |
| Muse 第3回レシート | 289 | 260 | 無効化29件＝変更56問のうち28問＋Q01 |
| Q01 補足レシート | 1 | 1 | `evidence/q01-revised-receipt.json` |
| **今回の再発行レシート** | **56** | **56** | 本作業で新規発行 |
| **被覆和集合** | | **751 / 751（未カバー 0）** | 検査終了コード 0 |

変更56問の旧被覆の内訳：第2回請求のみ 21問、Codex 第2回レシート 7問、第3回レシート 28問。今回の再発行により、56問全てが現行内容に固定されたレシート（内容ピン付き）で被覆される状態に戻った。

## 全スイート結果（実測）

- 全 Node スイート（`npm test`）：**1,807件 = 合格 1,802 / 失敗 0 / スキップ 5**（パート2完了時と同数。レシート・検査資産の追加で劣化なし）。

## 対象56問と照合結果

| パケット | 問題ID | 旧被覆 | 独立選択 | キー照合 |
|---|---|---|---|---|
| 1 | supp-advanced-ch9-calc | Codex第2回レシート | 0 | 一致 |
| 1 | supp-applied-1-1-v1 | Codex第2回レシート | 1 | 一致 |
| 1 | supp-applied-1-2-v1 | Codex第2回レシート | 0 | 一致 |
| 1 | supp-applied-11-3-v1 | 第3回レシート | 1 | 一致 |
| 1 | supp-applied-11-6-v1 | 第3回レシート | 0 | 一致 |
| 1 | supp-applied-3-3-v1 | Codex第2回レシート | 0 | 一致 |
| 1 | supp-applied-4-5-v1 | Codex第2回レシート | 2 | 一致 |
| 1 | supp-applied-6-5-v1 | Codex第2回レシート | 2 | 一致 |
| 2 | supp-applied-8-3-v1 | 第3回レシート | 3 | 一致 |
| 2 | supp-batch2-f-area-ratio-v1 | 第3回レシート | 2 | 一致 |
| 2 | supp-batch3-generated-center-rise-v1 | 第3回レシート | 2 | 一致 |
| 2 | supp-batch3-left-boundary-outward-flux-v1 | 第3回レシート | 0 | 一致 |
| 2 | supp-batch3-neumann-grad-v1 | 第3回レシート | 1 | 一致 |
| 2 | supp-buoyancy-film-richardson-scale-v1 | 第2回請求（ID） | 2 | 一致 |
| 2 | supp-chapter-ch1-storage | 第2回請求（ID） | 2 | 一致 |
| 2 | supp-chapter-ch2-cylinder-watts | 第2回請求（ID） | 2 | 一致 |
| 3 | supp-chapter-ch2-series | 第2回請求（ID） | 3 | 一致 |
| 3 | supp-chapter-ch7-h | 第2回請求（ID） | 2 | 一致 |
| 3 | supp-chapter-ch8-ra | 第2回請求（ID） | 0 | 一致 |
| 3 | supp-chf-capillary-length-v1 | 第3回レシート | 1 | 一致 |
| 3 | supp-chf-surface-tension-scale-v1 | 第3回レシート | 3 | 一致 |
| 3 | supp-condensation-corrected-latent-v1 | 第3回レシート | 2 | 一致 |
| 3 | supp-deep-fin-effectiveness-v1 | 第3回レシート | 1 | 一致 |
| 3 | supp-dropwise-total-resistance-gain-v1 | 第3回レシート | 2 | 一致 |
| 4 | supp-expanded-bi-calc | 第2回請求（ID） | 0 | 一致 |
| 4 | supp-expanded-fo-calc | 第2回請求（ID） | 2 | 一致 |
| 4 | supp-expanded-nu-calc | 第2回請求（ID） | 1 | 一致 |
| 4 | supp-expanded-tau-calc | 第2回請求（ID） | 3 | 一致 |
| 4 | supp-flat-thickness | Codex第2回レシート | 0 | 一致 |
| 4 | supp-forced-condensation-coolant-balance-v1 | 第3回レシート | 1 | 一致 |
| 4 | supp-found-boil-chf-v1 | 第3回レシート | 1 | 一致 |
| 4 | supp-found-boil-regime-v1 | 第3回レシート | 3 | 一致 |
| 5 | supp-found-ntu-config-v1 | 第3回レシート | 3 | 一致 |
| 5 | supp-found-pr-fluid-v1 | 第3回レシート | 1 | 一致 |
| 5 | supp-found-resistor-interface-temperature-v1 | 第3回レシート | 2 | 一致 |
| 5 | supp-found-three-mode-conduction-v1 | 第3回レシート | 2 | 一致 |
| 5 | supp-gas-layer-order-v1 | 第2回請求（ID） | 3 | 一致 |
| 5 | supp-heat-pipe-gravity-assisted-margin-v1 | 第3回レシート | 2 | 一致 |
| 5 | supp-next-cold-outlet-with-loss-v1 | 第3回レシート | 2 | 一致 |
| 5 | supp-next-dimensionless-centre-temperature-v1 | 第3回レシート | 1 | 一致 |
| 6 | supp-next-ntu-eps-ratio-v1 | 第3回レシート | 2 | 一致 |
| 6 | supp-next-nusselt-invert-h-v1 | 第3回レシート | 1 | 一致 |
| 6 | supp-next-parallel-extra-branch-v1 | 第3回レシート | 2 | 一致 |
| 6 | supp-next-parallel-temperature-condition-v1 | 第3回レシート | 3 | 一致 |
| 6 | supp-next-pr-layer-thickness-v1 | 第3回レシート | 2 | 一致 |
| 6 | supp-roadmap-dimension-per-length-v1 | 第2回請求（ID） | 2 | 一致 |
| 6 | supp-roadmap-wall-path-v1 | 第2回請求（ID） | 1 | 一致 |
| 6 | supp-section-11-2 | 第2回請求（ID） | 1 | 一致 |
| 7 | supp-section-11-6 | 第2回請求（ID） | 1 | 一致 |
| 7 | supp-section-5-5 | 第2回請求（ID） | 0 | 一致 |
| 7 | supp-stationary-zero-reference-v1 | 第2回請求（ID） | 3 | 一致 |
| 7 | supp-transient-gap-chart-center-temperature-v1 | 第2回請求（ID） | 2 | 一致 |
| 7 | supp-transient-gap-product-center-v1 | 第2回請求（ID） | 3 | 一致 |
| 7 | supp-tube-boiling-subcooled-budget-v1 | 第3回レシート | 2 | 一致 |
| 7 | supp-turbulence-colburn-matching-average-v1 | 第2回請求（ID） | 1 | 一致 |
| 7 | supp-turbulence-wall-unit-near-wall-v1 | 第2回請求（ID） | 0 | 一致 |

## 未実施事項（正直な残件）

- 配信ブラウザースイート完走、WebKit/Firefox/実機確認は公開段階の作業であり、本作業では実施していない。
- レシートは「記録された作業と内容の結びつき」を示すものであり、専門家レビューではない（従来の限定をそのまま適用）。

## 追記（2026-11-09 同日）：supp-condensation-corrected-latent-v1 の正答選択肢の精密化

- 背景：当該問題は全体修正パート2で印刷形 (0.228/Pr) により再構成され、正解の計算値は h_fg′ = 2.520192×10⁶ J/kg（stage6 オラクルは 2,520,192）となったが、正答選択肢（index 2）の表示値は 2.51×10⁶ J/kg のままで計算値と 0.4% ずれていた。再発行時の盲検解題者も「同値の選択肢がなく最も近いものを選んだ」と所見を残した。「計算すると選択肢の値になる」基準に合わせ、正答選択肢自体を計算値に一致させる仕上げ修正を行った。
- データ変更（data/questions.json、3行のみ）：choices[2] を 2.51×10⁶ J/kg → 2.52×10⁶ J/kg へ変更。あわせて explanation と solutionSteps[3] の旧値への言及（「最も近いのは／選択肢は 2.51×10⁶ J/kg」）を 2.52×10⁶ J/kg へ整合させた。他の選択肢・キー index（2）・ID・revision（v3）は変更していない。当該問題の複製は存在しない（data/ 配下の全 JSON を検索し、含まれていたのは data/questions.json のみ）。
- 選択肢集合の健全性（機械検証）：重複なし。計算値 2,520,192 J/kg に対し index 2 のみが有効数字3桁で一致（相対差 0.0076%）し、他の選択肢はいずれも 2.77% 以上離れる。誤答の理由文が述べる誤操作の帰結も各選択肢へ一意に対応する（符号反転 → 2.28×10⁶ の最寄りは 2.29、無補正 → 2.40 ちょうど、Ja をそのまま加算 → 2.592×10⁶ の最寄りは 2.59）。
- 影響テスト：tests/stage6-section-8-5-reconstruction.test.mjs と tests/audit2-batch3.test.mjs は計 50/50 合格。期待値の更新は不要だった（stage6 オラクルは既に 2,520,192 で、新表示値は許容内でより厳密に一致する）。
- 盲検再解題：変更後の prompt と choices のみを解題者へ渡して解かせた。計算値 2.520192×10⁶ J/kg、選択 index 2 で保存キーと一致した。今回は「最も近いもの」ではなく同値の選択肢を選ぶ形になった。
- レシート差し替え：evidence/revised-56-receipts.json の当該エントリのみ、content_sha256 を現行データで再実測した 7c208c219dc7d49d351d8e5fda97efa149a30441f5b4b5832a01696a0a298690（旧 5219c99c6a4de26c4c81278d0af12496d926cbb6c4fc471d2aab0bf90d2f3ecf）へ差し替え、selected_text・computed_or_physical_result・working・alternative_choices_review を新しい盲検の内容へ更新し、level に精密化の経緯を追記した。他の55件は無変更（ファイルの diff は当該エントリの6行のみ）。
- カバレッジ再確認：check-coverage-reissue.mjs を再実行し、total 751、covered_union 751、uncovered 0、再発行レシート 56/56 有効を確認した。
- 全体検証：全 Node スイート 1,807件 = 1,802 pass / 0 fail / 5 skip。公開ビルド（build:public）成功、dist/data/questions.json に新表示値が含まれることを確認した。
