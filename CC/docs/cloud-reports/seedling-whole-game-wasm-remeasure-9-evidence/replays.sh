#!/bin/bash
# remeasure-9 replays (node, at the measured head 744e85dc). FLIP = BOS+GSW+PM; ALL = FLIP+PKH; GP = GSW+PM (FLIP minus BOS);
# DEF = no SEEDLING_* env = main defaults (SPL, KTA ON; the rest OFF).
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad; C=$S/cap; O=$S/replay
FLIP="SEEDLING_BRIDGE_OPEN_STRAY=1 SEEDLING_GOAL_START_WAIT=1 SEEDLING_PREVIEW_METER=1"
ALL="$FLIP SEEDLING_PRESS_KILL_HOLD=1"; GP="SEEDLING_GOAL_START_WAIT=1 SEEDLING_PREVIEW_METER=1"; DEF="SEEDLING__NONE=1"
rc() { tag=$1; envs=$2; shift 2; ( env $envs node $S/replay-counts.mjs "$@" > $O/counts-$tag.txt 2>&1 ) ; }
rp() { tag=$1; envs=$2; shift 2; ( env $envs node scripts/procgen/replay-seedling-solve-request.mjs "$@" --n=3 --live > $O/$tag.txt 2>&1 ) ; }
rp F1-32-12-FLIP "$FLIP" --requests=$C/F1.jsonl --id=32 --i=12 &
rp F1-32-12-DEF "$DEF" --requests=$C/F1.jsonl --id=32 --i=12 &
rc F1-32-12-ALL "$ALL" $C/F1.jsonl 32 12 &
wait
rc F1-32-12-FLIP "$FLIP" $C/F1.jsonl 32 12 &
rc F1-32-10-FLIP "$FLIP" $C/F1.jsonl 32 10 &
rc F1-32-10-DEF "$DEF" $C/F1.jsonl 32 10 &
wait
rc F1-32-10-ALL "$ALL" $C/F1.jsonl 32 10 &
rc F1-32-10-GP "$GP" $C/F1.jsonl 32 10 &
rc F1-26-9-DEF "$DEF" $C/F1.jsonl 26 9 &
wait
rc F1-26-9-FLIP "$FLIP" $C/F1.jsonl 26 9 &
rc F1-29-11-FLIP "$FLIP" $C/F1.jsonl 29 11 &
rc F1-29-11-DEF "$DEF" $C/F1.jsonl 29 11 &
wait
rp rm8P1-33-5-FLIP "$FLIP" --requests=$C/rm8-P1.stop-requests.jsonl --id=33 --i=5 &
rc rm8P1-33-5-FLIP "$FLIP" $C/rm8-P1.stop-requests.jsonl 33 5 &
rc rm8P1-33-5-DEF "$DEF" $C/rm8-P1.stop-requests.jsonl 33 5 &
wait
rc F1-19-2-FLIP "$FLIP" $C/F1.jsonl 19 2 &
rc F1-32-9-FLIP "$FLIP" $C/F1.jsonl 32 9 &
rc rm8A1-32-10-ALL "$ALL" $C/rm8-A1.stop-requests.jsonl 32 10 &
wait
rp P1-19-2-FLIP "$FLIP" --requests=$C/P1.jsonl --id=19 --i=2 &
rc P1-19-2-FLIP "$FLIP" $C/P1.jsonl 19 2 &
rc P1-19-2-DEF "$DEF" $C/P1.jsonl 19 2 &
wait
rp P1-33-5-FLIP "$FLIP" --requests=$C/P1.jsonl --id=33 --i=5 &
rc P1-33-5-FLIP "$FLIP" $C/P1.jsonl 33 5 &
rc P1-33-5-DEF "$DEF" $C/P1.jsonl 33 5 &
wait
rc P1-33-5-GP "$GP" $C/P1.jsonl 33 5 &
rc P1-32-10-FLIP "$FLIP" $C/P1.jsonl 32 10 &
rp rm8P1-33-5-DEF "$DEF" --requests=$C/rm8-P1.stop-requests.jsonl --id=33 --i=5 &
wait
echo "[replays] done $(date -u +%FT%TZ)"
