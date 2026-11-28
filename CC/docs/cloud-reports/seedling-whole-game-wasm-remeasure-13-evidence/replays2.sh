#!/bin/bash
# remeasure-11 replays part 2: replay-seedling-solve-request.mjs on the earlier runs' requests (the script reads plain jsonl, so gunzipped first)
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/aa470272-4638-5261-a237-6a1ea84c7816/scratchpad; O=$S/replay
F="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_OPP_AIM_CHASERS=1 SEEDLING_HIT_AVOID_STAND_BOMBS=1"; D="SEEDLING__NONE=1"
rp() { tag=$1; envs=$2; f=$3; id=$4; i=$5; ( env $envs node scripts/procgen/replay-seedling-solve-request.mjs --requests=$f --id=$id --i=$i --n=3 --live > $O/$tag.txt 2>&1 ) ; }
two() { tag=$1; shift; rp $tag-F "$F" "$@" & rp $tag-D "$D" "$@" & wait; }
two rm10C2-32-10 $S/rm10/C2.stop-requests-32.jsonl 32 10
two rm10C2-32-12 $S/rm10/C2.stop-requests-32.jsonl 32 12
two rm10S1-32-10 $S/rm10/S1.stop-requests-32-33-37.jsonl 32 10
two rm9P1-19-2 $S/rm9/P1.stop-requests.jsonl 19 2
echo "[replays2] done $(date -u +%FT%TZ)"
