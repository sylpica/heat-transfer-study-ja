# 公開ステージ作業メモ（2026-11-11、メイン経由のユーザー指示）

## アプリアイコンの差し替え（全学習アプリ共通の新デザイン）
- 熱伝達のアイコンは「赤→青のグラデーションを白い矢印が流れる（壁を熱が伝わる）」ピクトグラム。
- ファイル一式: ~/workspace/app-icons/dist/heat/（icon.svg / icon-192.png / icon-512.png / apple-touch-icon.png / icon-maskable-512.png）。実在を確認済み（2026-11-11）。
- 公開ステージで実施すること:
  1. 上記5ファイルをアプリの公開アセット配置場所へ置く。
  2. manifest.json に icons を追加する（現行 manifest には icons が無い）。192/512/maskable-512 を含める。
  3. index.html に icon（SVG＋PNG）と apple-touch-icon のリンクを追加する。
- PNG は push-files で配信できない（バイナリ不可）ため、C1-04 のワークフローファイルと同様に GitHub Web UI 経由で配置する。SVG はテキストのため通常配信に含められる。
- メイン側では熱伝達リポジトリへの書き込みは行われていない（本メモが引き継ぎの正本）。
- 配信経路の実証（2026-11-11、メイン側で g-ai-master のアイコンPNGで実証済み）: バイナリは GitHub Web UI の「Add file → Upload files」（https://github.com/sylpica/heat-transfer-study-ja/upload/<branch>/<dir>）から直接コミットする。順序は「先に Web UI でバイナリ、後から push-files でテキスト」が安全（push-files は HEAD のツリーに重ねるため、先に置いたバイナリは消えない）。
