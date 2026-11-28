cd /home/user/Archipelago-CC
for n in HAMMER_APPROACH HAMMER_BODY_GATE HAMMER_FIGHT SHOVED_BODY_LOOKAHEAD CHASER_SPINNER_WALLS SPINNER_POINT_EXACT PRESS_ESCAPE_EXACT STRIKE_IFRAME_LAPSE HAMMER_FIGHT_FALLBACK; do
  s=$(date +%s); r=$(env SEEDLING_$n=1 node scripts/procgen/replay-seedling-solve-request.mjs --requests=/tmp/claude-0/-home-user-Archipelago-CC/62ce3720-cea3-5a88-bcec-d3b2533d1583/scratchpad/p1-19-26.jsonl --one=19:1 2>&1 | grep -a '^RESULT' | cut -c1-700); echo "$n $(($(date +%s)-s))s $r"
done
