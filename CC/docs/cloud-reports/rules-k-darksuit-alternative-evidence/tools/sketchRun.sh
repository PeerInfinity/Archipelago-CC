#!/usr/bin/env bash
# THROWAWAY producer run (the rules-k-chaser-narrowing recipe): rules (atlas + AP_1), partition, maze, seedling_er, with
# the derived-rule table moved aside (a K re-cut renames sub-regions the committed table names). Copies every file the run
# changed to <out>/files/, then restores the tree (`git checkout`, the table moved back). The variant is read from
# K_SUIT_ALT (needs ../sketch.patch applied; unset = main's rule).  Usage: [K_SUIT_ALT=<v>] sketchRun.sh <out-dir>
set -u
OUT=$1; mkdir -p "$OUT"
T=frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json
mv $T $T.aside
trap 'mv $T.aside $T' EXIT
for p in make-seedling-playthrough-rules make-seedling-subregion-partition make-seedling-playthrough-maze make-seedling-er-preset; do
  node scripts/procgen/$p.mjs > "$OUT/$p.log" 2>&1; echo "$p rc=$?"
done
git status --porcelain | grep -v "rules-k-darksuit-alternative-evidence\|seedlingChaserPursuitGuard.js\|derived-rules.json" | awk '{print $2}' > "$OUT/changed.txt"
while read -r f; do mkdir -p "$OUT/files/$(dirname "$f")"; cp "$f" "$OUT/files/$f"; done < "$OUT/changed.txt"
[ -s "$OUT/changed.txt" ] && git checkout -- $(cat "$OUT/changed.txt") 2>/dev/null
git status --porcelain | grep -v "rules-k-darksuit-alternative-evidence"
