# CIのWebKit依存取得中断を切り分け、固定済みブラウザー環境へ移す

2026-11-07（Asia/Tokyo）。対象22a8612/run42279911742、WebKit job128105896495。GitHubの実ログを直接取得した。npm ciまでは成功し、`playwright install --with-deps webkit`が181個/114MBのUbuntu依存をAzureミラーから取得中、19:28:40〜19:43:38 UTCの約15分でcancelled。アプリ側43本のブラウザーコマンドは開始されずskipだった。4他ジョブは成功。アプリのクリック失敗や全CI成功とは記録しない（FLAT_PLATE_UI_CI_20261107.json）。

## 変更

browserジョブを公式Playwrightイメージ `mcr.microsoft.com/playwright:v1.56.1-noble` 内で実行する。既存package.json/package-lockの固定1.56.1と対応させる。OS依存/ブラウザーを含む既成環境で、テストごとの低速apt取得を避ける。Nodeは既存どおり22、ubuntu-24.04ホスト・Chromium/WebKit両マトリクス・15分制限を維持。

ダウンロードstepを、npmの実インストール版/厳密な固定依存/選択engineの正しいrevisionの実行ファイルが `/ms-playwright` に実在することの検査へ置換。版が食い違えばloudに失敗し、別版を暗黙にダウンロードしない。パッケージ更新時は公式imageも同時に更新する。画像の取得自体やCI基盤には依然外部要因があり、ローカルのlock確認を実image検証と混同しない。

## 検査範囲

YAMLを変更前後で構文解析し、全43本の実ブラウザーコマンドが順序/内容とも同一と確認。試験削除・閾値緩和・timeout延長・失敗の成功化はしない。ローカル `node scripts/dynamic-playwright-environment.mjs --lock-only` は1.56.1一致を確認、browserImageVerified=falseと明示。実image取得/起動と全試験の成否はこの変更の対象SHAのGitHub Actionsで確認する。先行ローカルの共役/既存加熱流路の両エンジン成功はCONJUGATE_UI_CHECKPOINTへ分離保存。
