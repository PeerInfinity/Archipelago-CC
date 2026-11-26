#!/bin/bash
# remeasure-10 replays, part 2: C2's (base defaults, capture ON) bad-mode entry-32 requests under ST / NR / DEF
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad; C=$S/cap; O=$S/replay
ST="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_LATCHED_HOLD_MOVE=1"
NR="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_LATCHED_HOLD_MOVE=1"; DEF="SEEDLING__NONE=1"
rc() { tag=$1; envs=$2; shift 2; ( env $envs node $S/replay-counts.mjs "$@" > $O/counts-$tag.txt 2>&1 ) ; }
rp() { tag=$1; envs=$2; shift 2; ( env $envs node scripts/procgen/replay-seedling-solve-request.mjs "$@" --n=3 --live > $O/$tag.txt 2>&1 ) ; }
for e in ST NR DEF; do rp C2-32-10-$e "${!e}" --requests=$C/C2.jsonl --id=32 --i=10 & done; wait
for e in ST NR DEF; do rp C2-32-12-$e "${!e}" --requests=$C/C2.jsonl --id=32 --i=12 & done; wait
for e in ST NR DEF; do rc C2-32-10-$e "${!e}" $C/C2.jsonl 32 10 & done; wait
for e in ST NR DEF; do rc C2-32-12-$e "${!e}" $C/C2.jsonl 32 12 & done; wait
echo "[replays2] done $(date -u +%FT%TZ)"
