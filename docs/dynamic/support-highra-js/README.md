# サポート依頼5・引き継ぎ

専用codex/support-highra-js-method、起点112140d17081d556d01686edf4a4f253e3c63db6。単独・逐次。本線/Muse/共有実装/Worker/公開は変更していない。

- [件Aの方式・実測・未解決](METHOD_AND_RESULTS.md)
- [件Bの2.33%への直接回答](REQUEST4_CONFIRMATION.md)
- [事前予算](PLAN.md)
- [今回の試験結果](TEST_RESULTS.md)

数値的には既存MGで高RaのDCT参照へ合わせられる候補を確認。**移植版の純JS全cold→定常/ブラウザー受入の完了ではない**。主実装はMuse側が行い、本支援は条件・独立期待値・誤差と再現ハーネスだけを渡す。

## 照合パックの使い分け

**ACCEPTANCE_PACK.json**：Muse移植版の受入候補。単位/物理条件/冷初期値/格子/定義別のDCT定常値・de Vahl Davis参照/許容差・定常判定を収録。

1. 冷初期値θ=.5/u=v=0からの64/128/192の3条件は、元DCTの冷参照へ比較する。保存定常場を与えて短く進めただけで冷成功としない。
2. 定義別Nu/ネイティブ速度最大/位置を集計。同格子DCT一致（Nu相対1e−5等）と文献差（平均1%、局所2%等）を別々に判定する。元snapshotの壁Nuだけを体積値と比較しない。
3. 非零の2連続サンプル区間でθ変化<1e−7/速度相対変化<1e−6/Nu相対変化<1e−6を要求。短い16stepだけではこの定常条件を満たしたことにしない。
4. 全段Pe≤2、θの最大原理、正規化div、熱収支、失敗ステップの原子性を検査。圧力残差だけを物理精度の証拠にしない。
5. 128暖の値と冷の期待失敗は別条件で保存。Ra中間値/Pr/形状/初期場の包括受入はしていない。

**PACK.json/各comparison.json.gz**：同じ初期全場/同じdtを使う投影・1/16stepの厳密な移植照合。必要なu/v/θ/段平均p/期待値/ハッシュを収録。圧力は浮力参照とゲージを合わせる。

**RA1000000_N128_pre_failure.json.gz**：元DCT冷経路の失敗直前全場と小さいdt3種の期待失敗。JSの全cold計算の代わりではない。

**WARM_RUN_PACK.json/暖comparison**：192から保守的に制限/補間・再投影して128で緩和した暖参照。局所Nuの非単調性を残す。

**JS_RESULTS/JS_WARM_RESULTS/JS_*tail.json.gz**：今回実際に元JSを動かした反復/残差/誤差/実温度・速度・段圧力/時間の証拠。基準の原文や原図ではなく、自分たちの計算と必要な参照値。

PACK.jsonのoriginalDctDtはデフォルト**冷**刻みであり、読込定常場のsafeはJS_RESULTS.dctSteadyStateSafeDtにある。Ra1e6で同一ではない。このメタデータの読み方もACCEPTANCE_PACKに記録した。

## 再実行・ソースの識別

Node24.19.0/Python3.12.14、NumPy2.3.5/SciPy1.17.0。開発検証用で利用者向け依存は追加していない。

```
OPENBLAS_NUM_THREADS=1 python3 scripts/support-highra-js/test_pack.py -v
node --test --test-concurrency=1 tests/support-highra-js-method.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
npm run build:public
```

新しい測定を作るスクリプトは下記だが、既存ファイルは排他的作成で保護する。再測定は版名を変えて保存し、既存を削除しない。

```
OPENBLAS_NUM_THREADS=1 python3 scripts/support-highra-js/prepare_pack.py
node scripts/support-highra-js/validate_existing.mjs
OPENBLAS_NUM_THREADS=1 python3 scripts/support-highra-js/supplement.py
node scripts/support-highra-js/validate_existing.mjs --warm-only
```

初回パック/JS_RESULTSは9a6327aのハーネスで生成、暖照合/ACCEPTANCEと試験はa0522b9。後者は暖用の出力選択を追加しただけで元数値式は同一。JSONのgenerator/source SHA256と各圧縮全場SHA256を保持。新しい全スイートもa0522b9のコードで実行した。

診断は元MGの128→192上限、RK2の格子/Ra受入、初期速度/圧力フックだけをメモリー上のコピーへ加える。patchesに全置換を収録。**この診断ハーネスをそのまま公開モデルとして取り込まない**。初期フックはブラウザーの保存復元機能の代わりではなく、今回復元/取消を検証したとも言わない。

## 残る判断

192での数学的動作/短継続は確認できたが、元ガードは128なので実移植が必要。現行の小さいsafeと1step単価から全cold高Raの計算時間は大きく、実端末/Worker/メモリー/長い積分の受入は未検証。128冷はMGでも空間Peで停止し、局所最大の非単調性も残る。条件付きの暖計算、より細かい/境界集積格子、別の安定化/積分を採るなら、別条件の照合を追加する。採否/統合はMuse判断。本支援を保存した後は個別依頼へのサポート待機。
