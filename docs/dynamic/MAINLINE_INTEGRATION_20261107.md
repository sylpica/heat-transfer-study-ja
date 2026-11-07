# Muse 本線への実統合 第1弾 記録（2026-11-07、ローカルのみ・未push）

ユーザー決定による本線移管（Codex→Muse）の実行。Codex の収束完了を待たず、現在の先端で完了済みブランチを一括統合した。統合ブランチは `feiris/mainline-integration`、クローンは `~/workspace/dev/heat-mainline`。

## 土台
- `codex/dynamic-heat-simulation` リモート先端 **c52f2a7**（2026-11-07 取得時点、ls-remote で確定）から分岐。

## 統合したブランチ（先端 SHA）
| ブランチ | 先端 | 備考 |
|---|---|---|
| feiris/transient-closure-notes | dcc506d | クリーン |
| feiris/radial-multilayer | ab9f662 | STATUS.md 和集合解消 |
| feiris/annular-fin | ffe7c25 | STATUS.md 和集合解消 |
| feiris/fin-convective-tip | 9f7f267 | STATUS.md 和集合解消 |
| feiris/transient-docs | 4a8b920 | STATUS.md 和集合解消 |
| feiris/transient-view-unify | fe92408 | クリーン（allowlist 修正 fe92408 を含む） |
| feiris/graetz-channel（ローカル系統のみ） | 0942a6c | スライス1＋第3境界条件。リモート feiris/graetz-channel-2 は統合していない |
| feiris/fin-wind-h | adaa7ff | STATUS.md 和集合解消 |
| feiris/heat-sink-ui-expand | 00d7a3a | クリーン |
| feiris/longduct-vertex-ui | 9103ef1 | STATUS.md 和集合解消 |
| feiris/fin-manuals | 57c497c | クリーン |
| feiris/radiation-manuals | 559fbf6 | STATUS.md 和集合解消 |
| feiris/natconv-manuals | 0a100a8 | クリーン |
| feiris/fin-guis | 691b62f | STATUS.md 和集合解消 |
| feiris/wind-h-gui | 61dd7de | STATUS.md 和集合解消 |
| codex/quality-audit-local-pack（翻訳） | 68d2875 | 競合8ファイル（下記） |
| feiris/simulator-tabs-guide | 1429573 | 自動マージでクリーン。**J1/J2 修正は同ブランチの作業ツリーで未コミットのまま進行中であり、本統合には含まれていない。後で再マージする前提** |
| 問題対応表（heat-problem-map） | ffc1f5a | docs のみを cherry-pick |

## 翻訳マージの競合解消（ドライラン第1版の前提どおり）
- README.md／guide.mjs／tests/coverage.test.mjs／tests/audit2-b13.test.mjs：翻訳側を採用。
- sw.js：シミュレーション側（スーパーセット）を採用。
- scripts/build-public-site.mjs：モジュール閉包の起点リストはシミュレーション側（['app.js','dynamic-navigation.mjs']）を採用。「JA節ファイルが正確に76件なければビルド失敗」のゲート（32行目）は無傷。allowlist の `dynamic/radial-analysis.mjs`（transient-view 由来）も保持を確認。
- tests/browser-distribution.mjs：前提アサーション2件（フッター文言・目次ステータス「訳文あり」）は翻訳側を採用。
- app.js：7ハンク。dynamic-navigation.mjs の import（シミュレーション側の追加）のみ保持し、残り（フッター、進捗カード見出し、読書／検索の見出し＝字幕スイープ、問題バンク注記）は翻訳側を採用。renderSimTabs のハンクは翻訳側の採用により、下記の必須処理（ラボリンク除去）も同時に達成された。
- lesson-diagrams.mjs／tests/lesson-diagrams-integration.test.mjs は自動マージでクリーン。

## 統合時の必須処理（監査プロンプト v2 第2章）
- **簡易シミュレーター画面内のラボへのテキストリンクを除去**：app.js の renderSimTabs にあった `<p><a class="text-link" href="./dynamic/index.html">動的実験室：温度分布を再生・比較する →</a></p>` が統合後ツリーに存在しないことを確認（grep 件数0）。残る `./dynamic/index.html` へのリンクは通常シミュレーター（lab）画面自身の入口ボタンと、節・問題ごとの動的実験への深リンク（dynamic-navigation 経由）のみ。
- allowlist の `dynamic/radial-analysis.mjs`：含まれていることを確認済み。
- `tests/browser.mjs`（local-pack 側・CI 未実行）：**今回変更していない。扱いの決定は監査フェーズの未決定事項として明示する**（放置ではない）。
- §21 マニュアル：docs/dynamic 配置のまま統合。アプリ内 #manual への反映はしていない（監査フェーズの判断事項）。
- 長ダクト画面：dynamic/dev 配下の開発専用のまま（build スクリプトに long-duct の記載なし＝公開 allowlist 外）。公開判断はしていない。

## 未統合の残ライン（実行中・本統合の対象外）
- J1/J2 修正（heat-app-tabs 作業ツリー、未コミット）
- 強制対流 §21 マニュアル（heat-forced-manuals）
- 自然対流・鉛直加熱壁モデル（heat-natconv-wall）
- 円柱横流れ過渡モデル（heat-cylinder-transient）
- 3次元直方体伝導（heat-3d-conduction）
- 3次元形態係数（heat-viewfactor-3d）
- 動的フィン連成の検証記録（heat-fin-coupling、検証のみでコード変更なし）
- Codex 本線の今後の前進分（収束作業の結果を含む）

## 検証結果（実測、統合ツリー feiris/mainline-integration 先端 1309896 時点）
- **全 Node スイート**：`npm test` exit=0。**1,565件＝1,560合格／0失敗／5スキップ**（duration_ms 501,933、約8.4分）。統合起因の失敗なし。
- **公開ビルド**：`npm run build:public` 成功。dist 棚卸し：日本語節ファイル（dist/data/sections/*-ja.json）**ちょうど76件**；dist/dynamic **47エントリ**（index.html、`radial-analysis.mjs` を含む）；開発専用モジュールの混入 **0件**（graetz／annular／multilayer／convective-tip／long-duct／heat-sink／wind-heat のいずれも dist/dynamic に存在しない）。
- **ブラウザー配布スイート（Chromium）**：`BROWSER_ENGINE=chromium node tests/browser-distribution.mjs` **exit=0、全チェック合格**。合格内容の要約（スイート出力）：全76詳細講義の目標・本文・例題・参照・未校閲表示を確認；公開配信物について原本PDFとオフラインの範囲取得、訳文・抽出原図なし、ガイド・演習・計算・保存・画面幅・数字キーとEnter・3種類の表示モードを確認。なお初回実行はランタイム再起動で約8分時点で強制終了し結果が得られなかったため再実行した（再実行の所要 約69分、ログ `~/workspace/dev/mainline-browser-dist.log`）。WebKit は本環境では未実行。

---

# Muse 本線への実統合 第2弾 記録（2026-11-07、ローカルのみ・未push）

第1弾の先端 5594c9d の上に、完了済みの4ラインを追加統合した。

## 統合したブランチ（先端 SHA とマージコミット）
| ブランチ | 先端 | マージコミット | 備考 |
|---|---|---|---|
| feiris/cylinder-crossflow-transient | 6125dd7 | b40d6e0 | STATUS.md 和集合解消 |
| feiris/transient-3d-brick | 2bf6f9f | 0693053 | STATUS.md 和集合解消 |
| feiris/view-factor-3d | 0de2d4e | 7f32316 | STATUS.md 和集合解消 |
| feiris/forced-manuals（heat-forced-manuals） | b443350 | d0b7c3a | STATUS.md 和集合解消。文書のみ |

## 競合と解消
- 競合は4マージとも **docs/dynamic/STATUS.md の追記位置の衝突のみ**。いずれも両側の追記を全て保持する和集合で解消し、統合後の STATUS.md 末尾に円柱横流れ→3次元直方体→3次元形態係数→強制対流マニュアルの順で4件の追記が並ぶことを確認した。
- その他のファイルの競合はなし。判断に迷う競合は発生しなかった。
- 円柱横流れブランチの取り込みコミット（風速→hモジュールのハッシュ一致取り込み a5f9feb）のファイルは、第1弾で統合済みの feiris/fin-wind-h のコピーと同一内容だったため競合なく統合され、二重実装は生じていない。
- 変更ファイルは dynamic/dev の開発専用モジュール3件、scripts の参照生成器3件、tests 3件、docs/dynamic の文書・記録9件のみ。**公開経路のファイル（app.js、ビルドスクリプト scripts/build-public-site.mjs、allowlist、sw.js、公開データ）への変更はゼロ**（5594c9d..HEAD の diff で確認）。

## 検証結果（実測、統合ツリー feiris/mainline-integration 先端 d0b7c3a 時点）
- **全 Node スイート**：`npm test` exit=0。**1,594件＝1,589合格／0失敗／5スキップ**（duration_ms 296,950、約5.0分）。第1弾の1,565件から **+29件**で、内訳は円柱9件＋3次元直方体12件＋3次元形態係数8件と一致。統合起因の失敗なし。
- **公開ビルド**：`npm run build:public` 成功。dist 棚卸し：日本語節ファイル（dist/data/sections/*-ja.json）**ちょうど76件**；dist/dynamic **47エントリ**（第1弾と同数、`radial-analysis.mjs` を含む）；開発専用モジュールの混入 **0件**（今回の cylinder-crossflow-transient／transient-brick-3d／view-factor-3d／wind-heat-transfer を含め、第1弾で確認した dev モジュール群も dist/dynamic に存在しない）。
- **ブラウザー配布スイート**：**今回の統合では実行していない**。理由：本統合の変更は開発専用モジュール（dynamic/dev）と参照スクリプト、テスト、文書のみで、公開経路のファイル（app.js、ビルドスクリプト、allowlist、sw.js、公開データ）に変更が一切入っていないため。公開画面の振る舞いは第1弾の合格状態から変わっていない。

## 未統合の残ライン（今回統合しない）
- 自然対流・鉛直加熱壁モデル（実行中）
- 用語集拡充＋用語リンク配線（実行中。シェル側の最終形になる）
- Codex 本線の収束作業による前進分（枠回復後）

---

# Muse 本線への実統合 第3弾 記録（2026-11-07、ローカルのみ・未push）

第2弾の先端 e4e47d3 の上に、自然対流・鉛直加熱壁モデルのラインを追加統合した。

## 統合したブランチ（先端 SHA とマージコミット）
| ブランチ | 先端 | マージコミット | 備考 |
|---|---|---|---|
| feiris/natconv-vertical-wall（heat-natconv-wall） | 1c55b40 | 7f1be6f | STATUS.md 和集合解消 |

## 競合と解消
- 競合は **docs/dynamic/STATUS.md の追記位置の衝突のみ**（末尾1ハンク）。両側の追記を全て保持する和集合で解消した。解消後の STATUS.md で、統合側の最終追記（強制対流 §21 説明書）の直後に新規エントリ「鉛直等温平板の自然対流・相似解モデル」が続くことを確認し、新規エントリの本文が元ブランチ側とバイト単位で一致することを抽出 diff で照合した。
- その他のファイルの競合はなし。判断に迷う競合は発生しなかった。
- 変更ファイルは6件のみ：開発モジュール dynamic/dev/natural-convection-wall.mjs、参照生成器 scripts/dynamic-natural-convection-wall-reference.py、テスト tests/dynamic-natural-convection-wall.test.mjs、docs/dynamic の文書3件（開発文書・参照JSON・STATUS.md）。**公開経路のファイル（app.js、ビルドスクリプト scripts/build-public-site.mjs、allowlist、sw.js、公開データ）への変更はゼロ**（e4e47d3..HEAD の diff で確認）。

## 検証結果（実測、統合ツリー feiris/mainline-integration 先端 7f1be6f 時点）
- **全 Node スイート**：`npm test` exit=0。**1,605件＝1,600合格／0失敗／5スキップ**（duration_ms 289,349、約4.8分）。第2弾の1,594件から **+11件**で、新規テスト11件と一致。統合起因の失敗なし。
- **公開ビルド**：`npm run build:public` 成功。dist 棚卸し：日本語節ファイル（dist/data/sections/*-ja.json）**ちょうど76件**；dist/dynamic **47エントリ**（第1弾・第2弾と同数、`radial-analysis.mjs` を含む）；開発専用モジュールの混入 **0件**（今回追加の natural-convection-wall を含め、cylinder-crossflow-transient／transient-brick-3d／view-factor-3d／wind-heat-transfer／graetz／annular／multilayer／convective-tip／long-duct／heat-sink のいずれも dist/dynamic に存在しない）。
- **ブラウザー配布スイート**：**今回の統合では実行していない**。理由：第2弾と同一で、本統合の変更は開発専用モジュール（dynamic/dev）と参照スクリプト、テスト、文書のみで、公開経路のファイルに変更が一切入っていないため（上記 diff で確認済み）。公開画面の振る舞いは第1弾の合格状態から変わっていない。

## 未統合の残ライン（今回統合しない）
- 用語集拡充＋用語リンク配線（実行中。シェル側の最終形になる）
- Codex 本線の収束作業による前進分（枠回復後）


---

# Muse 本線への実統合 第4弾 記録（2026-11-07、ローカルのみ・未push）

第3弾の先端 2dbffb6 の上に、Codex 本線の収束作業による前進分（c52f2a7 → ca8fc25）を統合した。これで Codex 側の取り込みは完了した。

## 差分の棚卸し（c52f2a7..ca8fc25、ファイル単位）

差分は単一コミット ca8fc25「Hand main development to Muse with clean stop, exact HEAD suite and CI results, scopes and unresolved gates」のみで、4ファイル・全て文書（+233行、削除0行）。**コード・テスト・依存関係への変更はゼロ**であり、想定外の実装変更はなかった。

| ファイル | 変更 | 内容 |
|---|---|---|
| docs/dynamic/MUSE_MAINLINE_TRANSFER_20261107.md | +98（新規） | 引き継ぎ文書：保存先と基準、先端での全NodeとCI結果、Phaseごとの停止状態、Phase 3 分野別の実装と範囲、Phase 4 の検証済み限定範囲、最後の作業（壁連成）、保持すべき未達・制限、Muse側の成果と次の作業、今後のCodexの役割 |
| docs/dynamic/MUSE_TRANSFER_NODE_20261107.txt | +22（新規） | 移管時全Node実行の原ログ抜粋（c52f2a7 で 1501件＝1496成功・失敗0・スキップ5・取消0） |
| docs/dynamic/MUSE_TRANSFER_VERIFICATION_20261107.json | +102（新規） | 検証記録：先端スイート結果と実CI（PR run 42330789373、全5ジョブ success）の結果 |
| docs/dynamic/STATUS.md | +11 | 末尾に「所有者指示によるMuseへの本線移管・Codex停止点」を追記 |

## 統合と競合解消

- マージコミット **04003c1**（`git merge --no-ff origin/codex/dynamic-heat-simulation`）。
- 競合は **docs/dynamic/STATUS.md の末尾追記位置の衝突のみ**（1ハンク）。従来どおり両側の追記を全て保持する和集合で解消した。解消の検証：`## ` 見出しは統合側88件＋Codex側の新規1件＝89件で、統合側の見出し欠落が0件であること、移管セクションの本文が元ブランチ側と一致することを機械的に照合した。新規3文書は競合なく追加された。

## 検証結果（実測、統合ツリー feiris/mainline-integration 先端 04003c1 時点）

- **全 Node スイート**：`npm test` exit=0。**1,605件＝1,600合格／0失敗／0取消／5スキップ**（duration_ms 243,732、約4.1分）。第3弾と同数で、文書のみの差分であることと整合する。注記：初回実行は環境要因により約223秒時点で SIGTERM 中断し結果が得られなかったため、ログ出力付きで再実行して上記を確定した（再実行の exit=0）。
- **公開ビルド**：`npm run build:public` 成功。dist 棚卸し：日本語節ファイル（dist/data/sections/*-ja.json）**ちょうど76件**；dist/dynamic **47エントリ**（第1弾〜第3弾と同数、`radial-analysis.mjs` を含む）；開発専用モジュールの混入 **0件**（graetz／annular／multilayer／convective-tip／long-duct／heat-sink／wind-heat-transfer／cylinder-crossflow-transient／transient-brick-3d／view-factor-3d／natural-convection-wall のいずれも dist/dynamic に存在しない）。
- **ブラウザー配布スイート**：**今回の統合では実行していない**。理由：本統合の変更は docs/dynamic の文書4件のみで、公開経路のファイル（app.js、ビルドスクリプト、allowlist、sw.js、公開データ）への変更が一切ないため（2dbffb6..04003c1 の diff で確認済み）。公開画面の振る舞いは第1弾の合格状態から変わっていない。

## 残ライン

- **Codex 側の取り込みは本第4弾で完了した。**
- 未統合の残ラインは **用語集拡充＋用語リンク配線（実行中。シェル側の最終形になる）のみ**。


---

# Muse 本線への実統合 第5弾（最終波）記録（2026-11-07、ローカルのみ・未push）

第4弾の先端 3f44bc2 の上に、残っていた全ライン（加速第1波7本＋第2波4本＋殻の用語集拡充・用語リンク配線）を取り込んだ。これにより記録上の未統合ラインは消滅した。あわせて放射受理に伴うアプリ内マニュアル文の更新を行った。

## 統合したブランチ（取り込み順・先端 SHA・マージコミット）

| # | ブランチ | 先端 | マージコミット | 競合 |
|---|---|---|---|---|
| 1 | feiris/viewfactor3d-network | b4cacd9 | 2476642 | なし |
| 2 | feiris/box-radiation-gui（基点 b4cacd9 のため #1 の直後） | 8af404a | e9ba582 | なし |
| 3 | feiris/manuals-item15 | cf2ccaa | 6f5a286 | なし |
| 4 | feiris/radiation-acceptance | edfb540 | 69fd775 | STATUS.md 末尾（和集合） |
| 5 | feiris/fin-coupling-acceptance | 3d3bd9d | 5d2d5e1 | STATUS.md 末尾（和集合）。dynamic/thermal.mjs・dynamic/index.html は自動マージ |
| 6 | feiris/cylinder-transient-gui | f76cc82 | 6f971ca | なし |
| 7 | feiris/vertical-wall-gui | a59c9c9 | 7343aff | なし |
| 8 | feiris/wind-heatsink-handoff | 269cbea | 5995c20 | なし |
| 9 | feiris/cavity-ui-params | 5790174 | e2f3871 | なし |
| 10 | feiris/radial-multilayer-gui | eddf9d0 | ffe1ec7 | STATUS.md 末尾（和集合） |
| 11 | feiris/brick-3d-gui | 3d422ec | 605a309 | STATUS.md 末尾（和集合） |
| 12 | feiris/transient-item9-final（記録文書のみ） | 351a120 | a8f9705 | なし |
| 13 | feiris/term-link-wiring（殻の最終形、最後に取り込み） | 82b903b | 46931eb | なし（基点 1429573 は本線履歴内） |

## 競合と解消

- 競合は **docs/dynamic/STATUS.md の末尾追記位置の衝突のみ（4回）**。いずれも両側の追記節を全て保持する和集合で解消した。
- dynamic/thermal.mjs は radiation-acceptance（同時境界の変物性ガード解除＋ snapshot 診断の現況 k(T) 評価への修正）と fin-coupling-acceptance（フィン連成）の双方が変更したが、自動マージで解消し、下記の中間スイートで健全性を確認した。
- 殻マージ（#13）は app.js・styles.css・term-links.mjs・data/glossary.json・tests/browser-distribution.mjs を含む最大のマージだったが、競合は発生しなかった。

## 殻マージの必須保持項目の照合（マージ後に機械的に確認）

- (a) app.js 内の `./dynamic/index.html` リンクはラボタブ自身の入口ボタン（1383行目）のみで、簡易シミュレーター画面内の重複したラボ本文リンクは存在しない。
- (b) app.js 1行目に `dynamic-navigation.mjs` の import（readerSectionFromHash／dynamicLinkForSection／dynamicLinkForQuestion）が残存し、節・問題へのディープリンクは同モジュール経由で維持されている。
- (c) scripts/build-public-site.mjs 32行目の「日本語節ファイルがちょうど76件でなければビルド失敗」ゲートは健在。
- (d) dist の用語集は **504語**（下記）。J1 の用語集行表示（ui.expandedTerms による行内展開）、J2 の簡易シミュレーター入力畳み（details.sim-reference）、用語リンク配線（renderTermLinksFast／compileTermMatcher）が app.js・term-links.mjs に存在する。

## 放射受理に伴うアプリ内マニュアル文の更新（コミット 84ad87c）

- dynamic/index.html の #manual 第1段落を更新した。変更前は「『対流＋放射』は一定物性の表面に…」とし、対象外リストに「温度依存物性」を含んでいた。
- 変更後：物性は一定値のほか手動の k(T)・cp(T) 表による温度依存物性も使える旨を明記し、対象外リストから温度依存物性を外した。受理条件として「矩形格子の計算で自由輪郭を使わない場合に限る」「表面温度 Ts も物性表の範囲内にあることが条件で、範囲外では外挿せずに停止する」を併記した。根拠は docs/dynamic/SURFACE_EXCHANGE.md の受理節（受理範囲は thermal.mjs の矩形FVM・自由輪郭なし、Ts も表範囲内）。
- fin-coupling 側が同ファイル #manual の別領域に記した記述（フィン側面の流体温度の段差変化と対流＋放射の面境界との同時使用は対象外、学習画面のフィンは教育設計として固定）は、別の制限であり変更していない（両立を確認）。

## 検証結果（実測）

- **中間実測**（#1〜#12 取り込み時点、先端 a8f9705）：全 Node スイート **1,666件＝1,661合格／0失敗／0取消／5スキップ**（duration_ms 222,486）。公開ビルド成功、dist 棚卸し：日本語節ファイル76件・dist/dynamic 47エントリ・開発モジュール混入0件・用語集475語（殻マージ前として正）。
- **最終実測**（先端 84ad87c）：全 Node スイート `npm test` exit=0、**1,671件＝1,666合格／0失敗／0取消／5スキップ**（duration_ms 226,018）。中間値との差 +5件は用語リンク配線の新規テストと一致する。
- **公開ビルド**：`npm run build:public` 成功。dist 棚卸し：日本語節ファイル（dist/data/sections/*-ja.json）**ちょうど76件**；dist/dynamic **47エントリ**；開発専用モジュールの混入 **0件**（dist/dynamic/dev は存在しない）；dist の用語集 **504語**。
- **ブラウザー配布スイート**（Chromium）：`npm run test:browser:distribution` **完走・合格（exit=0、約25分）**。全76詳細講義の目標・本文・例題・参照・未校閲表示、問題バンク検証 444問分、公開配信物（原本PDFとオフラインの範囲取得、訳文・抽出原図なし、ガイド・演習・計算・保存・画面幅・数字キーと Enter・3種類の表示モード）の確認まで完了した。

## 配布スイート519行目例外の切り分け

- 加速第1波の調整ライン（基点 3f44bc2）で「配布スイートが519行目付近（公開アプリのテーマ／経路表示チェック）で例外終了した」と報告された件は、**今回の統合ツリーでは再現しなかった**（上記のとおり完走・合格）。
- 根拠：(1) 当該ラインの dist は本線とバイト同一であり、その本線では第1弾時点で同スイートの全合格が得られていた。(2) 当該実行が使った tests/browser-distribution.mjs は適応前の版（既定タイムアウト30秒）だった。用語配線ラインの記録では、パネルの hidden 判定レースは配線前のマージコミット b42997e でも再現するテスト側の既存問題であり、751項目・約10万px のパネル描画は本 VM で実測25〜50秒を要して旧既定30秒を超える。(3) 現行ファイルの519行目はテーマ（dark）確認直後の `nav('settings')` クリックで、既定タイムアウトの支配を受ける位置にある。(4) 統合ツリーで当該ファイルに入った変更は、テスト側の適応（レース修正・既定タイムアウト180秒化・バンク操作のタイムアウト引き上げ・進捗ログ）のみであり、テーマ／経路表示のアプリコードには変更がない。
- 判定：当該例外は **VM 負荷下でのテスト側タイミング／レース（環境要因）であり、アプリの実欠陥ではない**。ただし当該実行の例外スタック自体は本クローンに保存されていないため、この判定は行番号と上記記録に基づくものである点を明記する。

## 未実施事項

- **WebKit は未実施**：本環境では起動できない（MiniBrowser が libgstreamer-1.0.so.0 欠落で終了する）。両エンジン確認済みとはしていない。配布スイートは Chromium のみで実施した。
- 実機・支援技術による確認（非定常の締め項目10相当）は本環境では実施不可能なため対象外であり、実施したことにしていない（従来どおり）。

## 残ライン

- 記録上の未統合ラインは消滅した（Codex 側の取り込みは第4弾で完了、Muse 側の全ラインは本第5弾で完了）。
- 残るのは監査フェーズの判断事項であり、統合の残件ではない：旧 tests/browser.mjs（ローカルパック用スイート）の扱い、§21 説明書（文書）のアプリ内 #manual への反映可否、章末問題・参考文献の翻訳範囲。
