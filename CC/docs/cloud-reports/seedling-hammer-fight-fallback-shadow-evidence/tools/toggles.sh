#!/usr/bin/env bash
# SCRATCH (FF): the M2 toggle table — one fresh process per (arm, seam), one file per cell.
S=$(cd "$(dirname "$0")/.." && pwd); cd "$S"
cells=()
for seam in "$@"; do
  for arm in rep xc0 xcverify whole pkb0 sef0 escape0; do cells+=("$arm:$seam"); done
done
printf '%s\n' "${cells[@]}" | xargs -P 3 -I{} sh -c '
  arm=${1%%:*}; seam=${1##*:}; o=out/toggles/$arm-$seam.json; [ -s "$o" ] && exit 0
  case $arm in
    rep) e="";; xc0) e="SEEDLING_ESCAPE_CROSS_PASS_CACHE=0";; xcverify) e="SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1";;
    whole) e="SEEDLING_HAMMER_FIGHT_FALLBACK_MODE=whole";; pkb0) e="SEEDLING_PRESS_KILL_BOMBS=0";;
    sef0) e="SEEDLING_STRIKE_ETA_FLOOR=0";; escape0) e="SEEDLING_HAMMER_ESCAPE=0";;
  esac
  env SEEDLING_HAMMER_FIGHT_FALLBACK=1 $e node tools/ff-solve.mjs --requests=req-r1.jsonl --seam=$seam 2>/dev/null | grep "^RESULT " | cut -c8- > $o.tmp && mv $o.tmp $o
' _ {}
