#!/usr/bin/env bash
# THROWAWAY producer run (needs ../producer-hook.patch applied): rules (atlas + AP_1), maze, seedling_er, with the
# derived-rule table moved aside (a K split renames sub-regions the committed table names; regenerating it is a CI probe).
# Copies every file the run changed to <out>/, then restores the tree (`git checkout`, the table moved back).
# Order (the atlas recipe): rules, partition, maze, er.
# Usage: K_NARROW=<variant> K_NARROW_NO_T=1 sketchRun.sh <out-dir>
set -u
OUT=$1; mkdir -p "$OUT"
T=frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json
mv $T $T.aside
trap 'mv $T.aside $T' EXIT
for p in make-seedling-playthrough-rules make-seedling-subregion-partition make-seedling-playthrough-maze make-seedling-er-preset; do
  node scripts/procgen/$p.mjs > "$OUT/$p.log" 2>&1; echo "$p rc=$?"
done
git status --porcelain | grep -v "rules-k-chaser-narrowing-evidence\|make-seedling-playthrough-rules.mjs\|derived-rules.json" | awk '{print $2}' > "$OUT/changed.txt"
while read -r f; do mkdir -p "$OUT/files/$(dirname "$f")"; cp "$f" "$OUT/files/$f"; done < "$OUT/changed.txt"
git checkout -- $(cat "$OUT/changed.txt") 2>/dev/null
git status --porcelain | grep -v "rules-k-chaser-narrowing-evidence" 
