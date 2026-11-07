# サポート依頼3・引き継ぎ

2026-11-07 UTC。専用枝`codex/support-forced-pressure-fingap`。起点cc932b70146ad88a0ba4ff22d46b80af7afa7430。支援1/2の履歴を祖先に含むが、今回の成果はその後のコミットのみ。主開発枝`codex/dynamic-heat-simulation`、Muse枝、公開承認に変更を加えていない。単独・逐次実行。外部資料の生表/文章/図はGitへ追加していない。

- [事前予算](PLAN.md)
- [件A：圧力棚卸し・誤差・参照・未達](PRESSURE_REVIEW.md)
- [件B：フィン間定式化・既存試作の独立検算](FIN_GAP_FORMULATION.md)
- [今回のテスト結果](TEST_RESULTS.md)

本支援は公開実装追加ではない。`releaseApproved=false`、一般の`pressureAccuracyApproved=false`を維持する。

## 再現

Node24.19.0/Python3.12.14、NumPy2.3.5/SciPy1.17.0/SymPy/mpmathを開発環境で使用。一般利用者にはPython/Nodeは不要。新しいnpm依存/ロック変更なし。

既存測定をそのまま使って独立経路を再実行する試験：

```
python3 scripts/support-forced/test_independent.py -v
node --test --test-concurrency=1 tests/support-forced-pressure.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
npm run build:public
```

新しい測定出力を生成するスクリプトは既存JSONを上書きしない（排他的作成）。再測定時はスクリプト/出力に新しい版名を付け、古い証拠を保持すること。

1. `node scripts/support-forced/pressure_cases.mjs`：元JSの実投影/7本の実時間軌道。終了まで他の計算を起動しない。
2. `node scripts/support-forced/projection_fresh.mjs`：定数初期値からの実反復。
3. `python3 scripts/support-forced/independent_pressure.py`：DCT/密LU、記号外力/NumPy運動量、過去保存ψ–ω場の運動量積分。
4. `python3 scripts/support-forced/graetz_reference.py`：独立な連続quartic/固有値。
5. Muse実装を読み取り専用で取得し、`node scripts/support-forced/channel_cases.mjs`。取得先はGit対象外workで、ブランチ切替/マージしない：

```
git fetch --no-tags origin feiris/graetz-channel-2
git show 1eb670ba4eec9caa85ad678904b8de0371d6e91e:dynamic/dev/graetz-channel.mjs > work/support3-muse-graetz-channel.mjs
```

CHANNEL_CASESのMuse source SHA256が一致することを確認。実装を本支援枝にコピーしない。将来のMuse先端の結果と、この固定コミットの結果は区別する。

6. `python3 scripts/support-forced/independent_channel.py`：断面粘性/全応力積分、quarticセル平均、独立固有値と照合。

7. `node scripts/support-forced/algebraic_pipe_cases.mjs`、次に`python3 scripts/support-forced/algebraic_pipe_reference.py`：既存の通常円管モデルの実出力を測定し、Poiseuille/教科書7.42/滑面Colebrookと区別して照合。

`PRESSURE_CASES`（約6MB）と`PRESSURE_PROJECTION_FRESH`（約2.4MB）は自分たちの温度/速度/圧力全場・反復結果。段階的な圧力定義を再確認できるよう保存している。`INDEPENDENT_*`は参照/方法/誤差/入力ハッシュ。元の原本PDFや公刊表の複製ではない。

## 引き継ぐ判断

1. 非増分Eulerの`pressure`の時間評価点と、SSPRK2の`pressureStageMeanPa`の違いを維持する。単にpラベルで混ぜない。
2. 64格子の製造圧力誤差約6.84%は未解決。ゲージ/Poisson精度の改善と物理圧力の空間精度改善を混同しない。
3. Re1000のBotella–Peyret圧力表をRe100へ転用しない。将来範囲拡大する場合は壁速度の正負/鏡像対応、角特異性、圧力基準、定常/格子収束を先に固定する。
4. フィン間の限定Graetzは既存Muse成果。今回の極限照合をその証拠として利用できるが、速度入口/3D/フィン効率連成/入口圧損は残る。
5. Muse Graetzの列値と描画座標の位置解釈を統合時に確認する（件B文書末尾）。
6. ソルバー/公開Worker/公開キャッシュを変更していない。ブラウザー/実機/最新GitHub CI/公開URL動作を今回新たに確認済みとはしない。

統合はMuse側が判断し、本支援後は個別依頼へのサポート待機に戻る。
