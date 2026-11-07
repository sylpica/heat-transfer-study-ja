# 今回の検証結果

2026-11-07 UTC、Linux/Node24.19.0/Python3.12.14/NumPy2.3.5/SciPy1.17.0、単独・逐次、BLAS1スレッド。コードa0522b9で全スイートを実行し、その後は文書/実行記録だけを追記。[TEST_METADATA.json](TEST_METADATA.json)に実ファイルSHA256と環境、[TEST_OUTPUT.txt](TEST_OUTPUT.txt)に結果抜粋を保存。

| 対象 | 実施結果 |
|---|---|
| 64/128/192の元MG投影 | fresh/warmとtol1e−12/1e−10、9ケースでDCTと事前予算内。fresh反復11/9、warm定常初期値は0反復なので性能根拠へ使わない |
| 3定常場の元共同SSPRK2実継続 | 各16刻みを実行。θ最大差≤3.34e−16、速度≤3.42e−13、Nu指標≤3.74e−14 |
| 128暖定常場の元JS実継続 | 別16刻みでDCTと一致、局所最大18.023767682を保持 |
| 128冷失敗直前からの元JS | dt/半分/4分の1の3試行で3/6/12刻みを受理後、いずれもPe>2で停止。失敗前後の全snapshot同一 |
| 独立DCT再確認 | 同じ前失敗場で同じ受理刻み数、各実JS場との差も予算内。強い過渡での圧力不収束ではない |
| 局所最大の非単調性 | MGでも128暖18.023768→192冷17.750825、参照17.925を挟む挙動が残る |
| `OPENBLAS_NUM_THREADS=1 python3 scripts/support-highra-js/test_pack.py -v` | **7件成功、失敗0**。入力hash、独立DCT全RHS、実失敗再試行、誤差/定義/非単調性を検査 |
| 新規Node関連 | **2件成功、失敗0**。元MGで保存RHSを再実行、元192ゲート拒否/元ソース不変更、保存証拠を確認 |
| `node --test --test-concurrency=1 tests/*.test.mjs` | **1,511件中成功1,506、失敗0、スキップ5、取消0**。117357.044316ms |
| `npm run build:public` | 成功。支援パック/診断用開発モデルの非配信を実確認 |

5skipは既存のクラウド未充足ローカル原稿に依存し、成功へ数えない（legacy原稿、校閲済み日英/図、18問、8章冒頭、鉛直自然対流原稿。正確な試験名は出力抜粋）。

dist/dynamic/dev、dist/scripts/support-highra-js、dist/docs/dynamic/support-highra-js、今回のcomparison圧縮パックは配信物にない。生成Worker SHA256は`b55d6a055c88f59e10d5127b59cb7cac13b85eb9476f2bb6e02e6b50d0ab3f52`、キャッシュ名`heat-study-ja-app-4a24eb30c8fdd98c`で支援前と同一。共有数値実装/アプリ/Worker/Service Worker/依存/ロック/公開契約は変更なし。

今回未実施：純JS t=0冷スタートから3条件の定常まで、Euler版の高格子冷過渡、Muse移植版/ブラウザー/実端末、Workerの保存復元/取消/長い性能、256以上や集積格子の局所最大照合、全Ra/Pr/形状の受入、外部専門家承認/公開確認/最新リモートCI。過去のPython全cold結果はその過去の証拠として区別する。

件Bの水力2.33449%→.685497%は支援4の保存済み結果の確認であり、今回の7試験へ新たな再実行件数として足していない。統合/公開可否はMuse判断。
