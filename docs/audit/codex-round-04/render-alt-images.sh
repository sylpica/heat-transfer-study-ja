#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root; renders unchanged application SVGs only.
for entry in '3.2:section-3-2-counterflow-lmtd.svg' '4.3:section-4-3-bi-fo-similarity-scaling.svg' '11.8:section-11-8-blowing-factor-reverse-osmosis.svg'; do
  id=${entry%%:*}
  name=${entry#*:}
  inkscape "assets/lesson-diagrams/$name" --export-type=png --export-filename="$PWD/docs/audit/codex-round-04/evidence/alt-$id.png"
done
