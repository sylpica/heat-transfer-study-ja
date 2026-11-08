# シミュレーションのガイド機能（ポップアップ式）実装記録 2026-11-08

ユーザー指示（2026-11-08）：開発中のシミュレーションにガイド機能が欲しい。説明書（アプリ内マニュアル #manual）とは別に、ガイド機能を ON にするとポップアップ的な案内が出てくる形にする。

ブランチ `feiris/sim-guide-popups`（基点＝説明書アプリ内反映の先端 `1e087e4`、クローン `~/workspace/dev/heat-sim-guide`）。ローカルコミットのみ、push・PRなし。

## 設計

- 汎用エンジン `dynamic/sim-guide.mjs`（`attachSimGuide`）。画面側はステップ定義（対象要素・見出し・文）だけを持ち、機構は全画面で共用する。新しい画面への適用は「定義ファイル1つ＋script タグ1つ」で済む。
- トグル：各画面に「ガイド」ボタン（aria-pressed）を置く。ON/OFF は画面ごとに `localStorage` の `heat-sim-guide:<画面ID>` へ保存し、次回も維持する。既定は OFF。ON のまま離脱した画面は、次回ひらいたときにガイドが自動で開く。
- ポップアップ：現在ステップの対象要素にアンカーする吹き出し（position:fixed）。配置は純関数 `popupPlacement` で決め、対象の下→上の順に試し、常時ビューポート内にクランプする（余白8px）。ページの横スクロールは増やさない。対象要素には `.sim-guide-target` の輪郭を付ける。対象が画面外にある場合だけ `scrollIntoView({block:'nearest'})` で最小限に寄せる。
- 操作：「戻る／次へ／閉じる」で辿る。Esc と、ポップアップ外（トグル以外）のクリックでも閉じる（閉じると OFF として保存）。開くとフォーカスはポップアップ内へ移り、閉じると元の要素（取れなければトグル）へ戻す。
- 用語：ステップ文はプレーンテキストで保持し、表示時に既存の `linkTermTextNodes`（term-links.mjs）で用語リンク化する。用語を押すと用語集の該当項目（`<アプリトップ>#term-<id>`）を新しいタブで開く（この画面の計算状態を壊さないため遷移ではなく別タブにした）。
- 文の内容：各画面の導入文・注記と §21 説明書に基づく操作手順と観察ポイントのみ。新しい物理の主張は作っていない。最後のステップでは説明書（#manual）へ誘導し、ガイド（操作の順序）と説明書（理論・仮定・限界）の役割を分けている。
- 公開ビルド：`dynamic/sim-guide.mjs` と `dynamic/lab-guide.mjs` を `scripts/build-public-site.mjs` の許可リストと `sw.js` の APP_SHELL に追加（model-manuals.mjs と同じ扱い）。スタイルは `dynamic/lab.css` と開発画面共用の `dynamic/dev/cavity.css` に `.sim-guide-*` を追加（開発画面側は light-dark() で両テーマ対応）。

## 適用画面（10画面・計60ステップ）

| 画面 | 定義ファイル | ステップ数 |
|---|---|---|
| ラボ本体 dynamic/index.html | dynamic/lab-guide.mjs | 8 |
| 自然対流キャビティ dev/cavity.html | dev/sim-guide-cavity.mjs | 5 |
| 鉛直加熱壁 dev/natural-convection-wall.html | dev/sim-guide-natconv-wall.mjs | 5 |
| 環状フィン dev/annular-fin.html | dev/sim-guide-annular-fin.mjs | 6 |
| 直線フィン dev/fin-convective-tip.html | dev/sim-guide-fin-tip.mjs | 6 |
| ヒートシンク dev/heat-sink.html | dev/sim-guide-heat-sink.mjs | 6 |
| 放射3D箱 dev/box-radiation-3d.html | dev/sim-guide-box-radiation.mjs | 6 |
| 長ダクト放射 dev/long-duct.html | dev/sim-guide-long-duct.mjs | 6 |
| 3次元直方体 dev/transient-brick-3d.html | dev/sim-guide-brick-3d.mjs | 6 |
| 径方向多層 dev/radial-multilayer.html | dev/sim-guide-radial-multilayer.mjs | 6 |

## 未適用画面（開発画面24画面中15画面）と理由

機構は汎用化済みで、未適用はステップ文の用意がまだないため：conjugate-channel、cylinder-crossflow-transient、flat-plate、gpu-diffusion、graetz、heated-channel、heated-pipe、lid-cavity、orthogonal-diffusion、pipe-wall-temperature、rans、thermal-wall、triangle-diffusion、triangle-linear、wind-heat-transfer。代表画面として過渡系（直方体・径方向）／フィン系（環状・直線・ヒートシンク）／放射系（箱・長ダクト）／自然対流系（キャビティ・鉛直壁）を先に適用した。

## 変更ファイル

- 新規：dynamic/sim-guide.mjs、dynamic/lab-guide.mjs、dynamic/dev/sim-guide-*.mjs（9件）、tests/dynamic-sim-guide.test.mjs、tests/dynamic-sim-guide-browser.mjs、tests/dynamic-sim-guide-screens-browser.mjs、本記録
- 変更：dynamic/lab.mjs（import と initLabGuide() 呼び出しの2行のみ）、dynamic/lab.css、dynamic/dev/cavity.css、開発画面HTML 9件（script タグ各1つ）、scripts/build-public-site.mjs、sw.js
- 計算コア・実験機構（experiment.mjs 等）と、走行中のチュートリアルライン（feiris/model-tutorials）の作業には触れていない。

## 検証実測

- 全 Node スイート：基点 1,674件＝1,669合格／0失敗／5スキップ → 変更後 **1,679件＝1,674合格／0失敗／5スキップ**（増分は新規テスト5件 exactly、失敗0維持）。新規テストは配置計算（下優先・上フォールバック・375pxクランプ・中央配置）、保存設定（画面IDごとに独立・既定OFF・保存不可環境でも例外なし）、全ガイドのステップ対象が実画面に存在すること、公開ビルド／アプリシェルへの配線を固定する。
- 公開ビルド成功。dist 棚卸し：節ファイル76件、dist/dynamic 50エントリ（基点48からガイド2モジュール分 +2）、総240ファイル、dynamic/dev の混入0件。
- Chromium 実レンダリング（tests/dynamic-sim-guide-browser.mjs）：ラボ本体を幅 375／390／1280／1920 × ライト／ダークの8組合せで検証し、全8ステップを実際に辿って、ポップアップのビューポート内収納・横はみ出し0・文字切れなし・対象ハイライト1件・pageerror 0 を確認。Esc でトグル OFF まで戻ること、フォーカスがトグルへ戻ること、ON の保存→再読み込みで自動で開くこと、閉じるで OFF が保存されること、ポップアップ外クリックで閉じることも確認。用語リンクはステップ3の「熱伝導率」が `../index.html#term-thermal-conductivity` を新しいタブで開くことを実測した。
- 開発画面スイープ（tests/dynamic-sim-guide-screens-browser.mjs）：適用9画面すべてで、375px でガイドが開きポップアップが画面内に収まり Esc で閉じることを確認。cavity.html は 1280px ダークでも全5ステップを辿って確認した。
- 注記：初回のブラウザ実行では、全スイートとの並行実行による VM 高負荷の中で cavity.html の読み込みが ERR_ABORTED で落ちた。単独で再実行して全項目合格したため環境要因と切り分けた（画面側に location 操作はないことを確認済み）。

## 未実施事項

- WebKit は本環境で起動できないため未実施（従来どおりの制限）。
- 実機・支援技術での確認は未実施。支援技術向けには role="dialog"・aria-label・フォーカス移動/復帰までを実装し、画面リーダーでの実測は監査フェーズの項目とする。
- 未適用の開発画面15画面へのステップ文の追加は、機構が汎用であるため定義ファイルの追加だけで可能（本ラインの範囲外とした）。
