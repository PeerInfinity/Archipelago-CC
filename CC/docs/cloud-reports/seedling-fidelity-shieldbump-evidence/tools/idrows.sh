#!/bin/bash
# the three identity rows SPIN moved, one arm: $1 = key (0|1), $2 = spin (0|1)
cd /home/user/Archipelago-CC
m() { md5sum | cut -d' ' -f1; }
export SEEDLING_FORECAST_SHIELD_BUMP=$1 SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=$2
echo "key=$1 spin=$2"
echo "c3 $(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=3 2>/dev/null | m)"
echo "c6 $(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=6 2>/dev/null | m)"
echo "c4 $(node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=winding,rooms,branchy,bushy,loopy,open --seeds=1-12 --count=4 2>/dev/null | m)"
