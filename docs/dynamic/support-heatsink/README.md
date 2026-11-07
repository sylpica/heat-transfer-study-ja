# サポート依頼4・引き継ぎ

専用`codex/support-heatsink-performance`。起点は支援3の18360923a6dbfbc6bb30c63d1e53a3cdbe5706ee。支援1〜3の履歴を祖先に含むため、今回の追加だけを識別して採用する。本線・Muse・UI・公開allowlist/Worker・依存/ロックを変更していない。採否/統合/公開はMuse判断。

- [方式/方程式/適用範囲](METHOD.md)
- [条件/数値/既存モデルとの差](RESULTS.md)
- [事前基準と未達後の改善方針](PLAN.md)
- [今回のテスト結果](TEST_RESULTS.md)

結論は、限定した**3D基部＋薄板フィン＋指定発達流の温度輸送＋局所長ダクト放射**を結ぶことが可能で、標準参照/極限検証を実測したこと。実機/一般3D CFD/自然対流/全方向放射の完成ではない。

## 保存済み証拠

- 1322c04：条件/予算を事前登録。
- 0ff05a1：初回REFERENCE.json/FIELD。流量係数最細2.33449%の未達を保持。
- 09ed5fa：速度副格子/保存的移送のREFERENCE_v2/FIELD_v2を保存。VALIDATION初回の基部抵抗3.6347%未達も保持。
- 58eb34e：基部試験の追加格子で1.33215%へ改善、実フィン伝導ブロックの解析極限/元JS比較・試験を保存。

古いSOURCEコミットは計算開始時のHEADで、その時点の未コミット追加コードが次の上記コミットに保存されている。各JSONのコードSHA256/全場SHA256で実内容を識別する。初回prototype/run_referenceは0ff05a1、初回validationは09ed5faで再現可能。最終のコードは58eb34e。初回結果を最新版の結果で置き換えていない。

## 再実行

Linux/Python3.12.14、NumPy2.3.5/SciPy1.17.0、Node24.19.0。Pythonは開発検証用で、利用者向けの依存を追加していない。サブエージェント/同時実行なし。BLASも単独スレッドに固定する。

保存全場を使って実行する独立/回帰試験：

```
OPENBLAS_NUM_THREADS=1 python3 scripts/support-heatsink/test_reference.py -v
node --test --test-concurrency=1 tests/support-heatsink-performance.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
npm run build:public
```

新しい測定は次のスクリプトだが、既存JSON/NPZを**排他的作成で保護**している。再測定時は新しい版名を使い、古いものを削除しない。

```
OPENBLAS_NUM_THREADS=1 python3 scripts/support-heatsink/run_reference.py
OPENBLAS_NUM_THREADS=1 python3 scripts/support-heatsink/validation.py
node scripts/support-heatsink/learning_model.mjs
```

run_referenceは標準v2の3格子/放射0/無発熱と現行モデルの独立定常点、validationは連続級数/単一フィン/実伝導ブロック/圧力配分/射度の独立極限を生成。learning_modelは元JSを実行する。REFERENCE/VALIDATION初回版の再生成には前記の当時のコードを参照する。

指定圧力差はprototype.allocate_flowの`pressure=`、指定総流量は`flow=`を排他的に使う。熱参照のbuildは総流量条件を使うため、指定圧力から得た総流量をConditionsへ渡す。異なる隙間の検証は水力配分までで、標準の熱場は同じ幅の8流路に限定。

## 未完了・統合判断

1. 停止流は自然対流へ切り替える必要があり、この参照は明確に拒否する。開放境界/Boussinesq/混合対流の別検証は未実施。
2. 仮想的な上面、発達入口、一定物性、1次風上、薄板近似、放射の局所断面/セル温度近似にはモデル誤差がある。格子収束だけで実機精度へ昇格しない。
3. 現行との+10.45Kはモデル条件の差。現行モデルへspreading抵抗/放射hを足すだけで同じ解になるとはしない。
4. 一般の3D速度/入口損失/流量配分マニホールド/ファン/全方向形態係数/実測を含める採用は別工程。
5. 新しいUI/Worker/用語配線/最終統合は触らない。全公開ソフトや全教材の完成を宣言しない。

本支援を保存して渡した後、Codexは個別依頼へのサポート待機に戻る。
