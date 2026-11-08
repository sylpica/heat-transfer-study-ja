# 二重監査 第1回（Muse）開始ゲート実測記録

2026-11-08（Asia/Tokyo）。監査指令書（SHA-256 `22205d584a28857f87c1dd9fabdfbce0c65007c038dca42837278894f424d5cf`、第0章〜第38章＋追記その1〜その3）の第1章に基づき実測した。

## S0（監査基準コミット）

- **S0 = `dbd42cb3e9ba51c7cf58d0b171800266f04f57d1`**（`feiris/mainline-integration`、統合ツリー本体 `f39b77a`＋統合記録・訂正コミット）
- リモート `feiris/mainline-integration` 先端 `ed35d8c1a96b9e5f0f76b343a5c3c9e88d3b1c5d` のツリー（1,520ファイル）は S0 のツリーとバイト単位で同一（配信時に照合済み）。
- 監査ブランチ：`audit/muse-round-01`（S0 から分岐、クローン `~/workspace/dev/heat-audit-r1`）。

## リモート実測（2026-11-08、git ls-remote）

| ブランチ | HEAD |
|---|---|
| main | `73b31c0f1eebf27f1e01ba7de7f42b9c537ccf2f` |
| codex/dynamic-heat-simulation | `ca8fc25af5a2f19f4869eb9a83a8cef6e4417d15` |
| codex/quality-audit-local-pack | `68d28756227effd413a347753b93ab1f367716ee` |
| feiris/mainline-integration | `ed35d8c1a96b9e5f0f76b343a5c3c9e88d3b1c5d` |
| feiris/graetz-channel-2 | `1eb670ba4eec9caa85ad678904b8de0371d6e91e`（統合対象外の系統。S0 の祖先ではないことを確認＝二重系統なし） |

PR 状態（GitHub 読み取り実測）：PR #18（codex/dynamic-heat-simulation → main）は open・Draft のまま（本線移管済みの記録どおり）。PR #1 は merged。その他の開発系 PR はすべて closed（大半 merged）。

## G1：Codex 動的シミュレーション開発完了 — 充足

- Codex の最終 wrap-up `ca8fc25` は S0 の祖先であることを `git merge-base --is-ancestor` で確認。
- 完成／未完成モデル、検証済み範囲、公開承認範囲は `docs/dynamic/MUSE_MAINLINE_TRANSFER_20261107.md` と STATUS.md に記録され、サポート依頼1〜5の記録で裏付けられる。Codex はサポート待機に移行済み（本線の自律再開なし）。

## G2：Muse 並行開発完了 — 充足

- 全21ラインの先端がすべて S0 の祖先であることを全件確認（heatsink-coupled-js `c940d4b`／同 GUI `6ddbd98`／conjugate-model-js `221cb53`／同 GUI `2858b8e`／manuals-inapp `1e087e4`／chapter-problems-translation `0a6ffbc`／chapter-problems-inapp `2f11b4a`／browser-test-modernize `846be9c`／solver-settings `6ebf281`／linkage-expand `615d2ec`／phase57-inventory `c57f2b0`／model-tutorials `a888ba2`／sim-guide-popups `7d92bea`／chapter-problems-search `b78cc5c`／glossary-flashcards `3750695`／appendix-references `c373243`／guide-review `717075f`／case-intake-expand `28f933b`／highra-cavity-js `479326c`／fingap-flow-js `3ca3710`／fingap-flow-gui `9bd0c8d`）。
- 翻訳配信 `68d2875` も S0 の祖先。各ラインの検証資料・未解決事項は各クローンの docs/ に記録あり。

## G3：実統合ツリーでのテスト・ビルド — 充足（監査クローンで再実測）

- 全 Node スイート（S0、監査クローンで再実行）：**1,782件＝1,777合格／0失敗／0中止／5スキップ**、終了コード0（所要 286.6 秒）。統合時の2回実測と一致。
- スキップ5件はすべて local-pack 系の条件付きテスト（私用ローカルパック不在時にスキップ。理由を確認済みで、成功には数えない）。
- 公開ビルド（S0 で再実行）：成功。dist 棚卸し＝節76件・章末問題データ11件・付録参考文献2件・用語集504語・dynamic 51エントリ・総255ファイル・`dynamic/dev/` 混入0（`dynamic/developed-channel.mjs` は公開モジュール）。

## G4：第6章 統合時必須チェックリスト — 全項目確認

1. 簡易シミュレーター画面内の通常ラボへの重複テキストリンク除去：統合第1弾で除去済み。残る `app.js` の実験室導線は専用タブ内の正式入口ボタン（項目2）のみ。第1回監査のブラウザー確認で再検証する。
2. 通常シミュレーター専用タブが正式入口：`app.js` に専用タブ＋「実験室を開く」ボタンを確認。
3. allowlist に `dynamic/radial-analysis.mjs`：`scripts/build-public-site.mjs` の公開ファイル一覧に含まれることを実測。
4. コミット `fe92408`（allowlist への radial-analysis 追加）の内容が最終ツリーに存在：上記3と同一差分であり、実在を確認。
5. Graetz チャネルは正しい系統（スライス1＋第3境界条件）：`dynamic/dev/graetz-channel.mjs` に3境界条件（wall-temperature／wall-heat-flux／wall-heat-flux-insulated）すべてが存在。
6. `feiris/graetz-channel-2` との二重実装なし：同ブランチ先端 `1eb670b` は S0 の祖先ではなく、統合されていない（系統はローカル系統のみ）。
7. `tests/browser.mjs` の現行化：第6・7弾統合の対象ライン（browser-test-modernize）で完了。第1回監査で再実行して確認する。
8. ・9. §21マニュアルとアプリ内 #manual の整合：`scripts/generate-model-manuals.mjs` を再実行し、`dynamic/model-manuals.mjs` がバイト単位で再現されることを確認（生成の再現性）。内容の正確さは第1回監査で照合する。
10. 長ダクト放射の公開可否：現行は開発側のみ（公開 dist に長ダクト画面なし）。公開可否の判断は追記 A2-1 として第1回監査で判断し記録する。
11. 章末問題・参考文献の収録範囲：問題563件・参考文献410件（全11章）＋付録A41件・B1件を dist に収録済み。未決定事項なし（ユーザーの「全部追加する」決定 2026-11-08 に基づく）。
12. 全76節の日本語翻訳が公開ビルドに収録：dist の `data/sections/` に76件、dist の book.json で全76節の translationStatus='translated' を確認。付録A・B・C・索引は not_started（付録本文は未収録である旨をアプリ内で明示済み）。
13. releaseApproved=false の開発専用モデルが公開ビルドに混入していない：dist に `dynamic/dev/` は存在しない。
14. Muse と Codex の重複実装なし：統合は系統管理のもとで実施され、二重系統（Graetz、問題データ等）は記録上で排除済み。
15. 過去の数値ベンチマーク維持：全 Node スイート（ベンチマーク固定テストを含む）が S0 で失敗0。第1回監査で主要参照値を独立再計算する。
16. 最新の Node テストと公開ビルドが統合 HEAD で成功：上記 G3 の再実測どおり。

## 結論

**G1〜G4 すべて充足。S0 = `dbd42cb` を固定し、Muse 第1回監査を開始する。**
