#!/bin/bash
# idrows.sh <tree> <label>   (env: SEEDLING_* arms)  — c3 / c6 / c4 identity rows
cd "$1"
m() { md5sum | cut -d' ' -f1; }
s=$(date +%s)
echo "$2 c3 $(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=3 2>/dev/null | m) $(( $(date +%s)-s ))s"
s=$(date +%s)
echo "$2 c6 $(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=6 2>/dev/null | m) $(( $(date +%s)-s ))s"
s=$(date +%s)
echo "$2 c4 $(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=winding,rooms,branchy,bushy,loopy,open --seeds=1-12 --count=4 2>/dev/null | m) $(( $(date +%s)-s ))s"
