#!/usr/bin/env bash
# WALLS-CENSUS-2 (measure only): each OFF switch ALONE (env NAME=1, the page channel's spelling) on the captured L39
# requests, replayed by lb-prof.mjs. One line per (switch, case): the LB summary line. Usage: switch-scan.sh <req.jsonl> <out>
REQ=$1; OUT=$2; HERE=$(cd "$(dirname "$0")" && pwd)
SW="NONE AXIS_STRIKE CLEARTAG_STAND CHASER_STAGED_HUNT STANCE_BURN PRESS_ESCAPE_EXACT STRIKE_SLOT APPROACH_DOOR TURRET_APPROACH LATCH_WEIGH_FIRST FIFTH_ORDER OPPORTUNISTIC_STRIKE HAMMER_FIGHT_FALLBACK STAGED_HUNT_SCAN_MEMO CLEARTAG_CHAIN CHOOSER_CUT DETOUR_VIA_BOUND KEYLOCK_TURRET FORECAST_SHIELD_BUMP FINE_STANCE_WALK CHASER_SPINNER_WALLS DASH_SPINNER_FORECAST"
CASES="0:5224 1:5222 1:5181"
for s in $SW; do for c in $CASES; do echo "$s $c"; done; done | xargs -P 2 -L 1 bash -c '
  s=$0; i=${1%%:*}; t=${1##*:}
  if [ "$s" = NONE ]; then E=""; else E="SEEDLING_$s=1"; fi
  line=$(env $E timeout 900 node "'"$HERE"'/lb-prof.mjs" --requests="'"$REQ"'" --id=0 --i=$i --seam=$t 2>&1 | grep -a "^LB" | cut -c1-260)
  echo "$s i$i@$t :: $line"' >> "$OUT"
