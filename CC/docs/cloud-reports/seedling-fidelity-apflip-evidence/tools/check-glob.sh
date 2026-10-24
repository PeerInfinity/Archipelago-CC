#!/bin/bash
# check-glob.sh <out> — every plan-seedling-*.mjs --check, one line each: name rc md5(stdout+stderr) last line.
O="$1"; cd "${ROOT:-/home/user/Archipelago-CC}" || exit 1; : > "$O"
for f in scripts/procgen/plan-seedling-*.mjs; do
  out=$(timeout 900 node "$f" --check 2>&1); rc=$?
  echo "$(basename $f) rc=$rc $(printf '%s' "$out" | md5sum | cut -c1-8) | $(printf '%s' "$out" | tail -1 | cut -c1-160)" >> "$O"
done
echo "glob $(ls scripts/procgen/plan-seedling-*.mjs | wc -l) done" >> "$O"
