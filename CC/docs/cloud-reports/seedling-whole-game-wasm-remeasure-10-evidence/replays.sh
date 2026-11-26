#!/bin/bash
# remeasure-10 replays (node, at the measured head 4bf42ffc). ST = STACK (PKSW+PKRB+DSS+LHM); NR = NOPKRB (STACK minus PKRB);
# DEF = no SEEDLING_* env = base defaults at d8bd5bb578 (BOS, GSW, PM, SPL, KTA ON; the rest OFF).
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad; C=$S/cap; O=$S/replay; R9=$S/rm9; mkdir -p $O
ST="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_LATCHED_HOLD_MOVE=1"
NR="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_LATCHED_HOLD_MOVE=1"; DEF="SEEDLING__NONE=1"
rc() { tag=$1; envs=$2; shift 2; ( env $envs node $S/replay-counts.mjs "$@" > $O/counts-$tag.txt 2>&1 ) ; }
rp() { tag=$1; envs=$2; shift 2; ( env $envs node scripts/procgen/replay-seedling-solve-request.mjs "$@" --n=3 --live > $O/$tag.txt 2>&1 ) ; }
# the stops (S1 37:8 = the S/R/C stop; P1 38:6, 39:1 = skips 2/3) and the 32:10 good-mode solve, --n=3 --live
rp S1-37-8-ST "$ST" --requests=$C/S1.jsonl --id=37 --i=8 & rp S1-37-8-NR "$NR" --requests=$C/S1.jsonl --id=37 --i=8 & rp S1-37-8-DEF "$DEF" --requests=$C/S1.jsonl --id=37 --i=8 & wait
rp S1-32-10-ST "$ST" --requests=$C/S1.jsonl --id=32 --i=10 & rp S1-32-10-NR "$NR" --requests=$C/S1.jsonl --id=32 --i=10 & rp S1-32-10-DEF "$DEF" --requests=$C/S1.jsonl --id=32 --i=10 & wait
rp P1-38-6-ST "$ST" --requests=$C/P1.jsonl --id=38 --i=6 & rp P1-38-6-NR "$NR" --requests=$C/P1.jsonl --id=38 --i=6 & rp P1-38-6-DEF "$DEF" --requests=$C/P1.jsonl --id=38 --i=6 & wait
rp P1-39-1-ST "$ST" --requests=$C/P1.jsonl --id=39 --i=1 & rp P1-37-8-ST "$ST" --requests=$C/P1.jsonl --id=37 --i=8 & rp P1-32-10-ST "$ST" --requests=$C/P1.jsonl --id=32 --i=10 & wait
# counters + plan ticks/hits, one run each
for e in ST NR DEF; do rc S1-32-10-$e "${!e}" $C/S1.jsonl 32 10 & done; wait
for e in ST NR DEF; do rc S1-37-8-$e "${!e}" $C/S1.jsonl 37 8 & done; wait
for e in ST NR DEF; do rc S1-32-9-$e "${!e}" $C/S1.jsonl 32 9 & done; wait
for e in ST NR DEF; do rc S1-19-2-$e "${!e}" $C/S1.jsonl 19 2 & done; wait
for e in ST NR DEF; do rc S1-26-8-$e "${!e}" $C/S1.jsonl 26 8 & done; wait
for e in ST NR DEF; do rc S1-26-10-$e "${!e}" $C/S1.jsonl 26 10 & done; wait
for e in ST NR DEF; do rc S1-29-11-$e "${!e}" $C/S1.jsonl 29 11 & done; wait
for e in ST NR DEF; do rc S1-33-5-$e "${!e}" $C/S1.jsonl 33 5 & done; wait
rc S1-20-1-ST "$ST" $C/S1.jsonl 20 1 & rc S1-30-1-ST "$ST" $C/S1.jsonl 30 1 & rc S1-34-7-ST "$ST" $C/S1.jsonl 34 7 & wait
rc S1-20-1-DEF "$DEF" $C/S1.jsonl 20 1 & rc S1-30-1-DEF "$DEF" $C/S1.jsonl 30 1 & rc S1-34-7-DEF "$DEF" $C/S1.jsonl 34 7 & wait
for e in ST NR DEF; do rc P1-38-6-$e "${!e}" $C/P1.jsonl 38 6 & done; wait
rc P1-32-10-ST "$ST" $C/P1.jsonl 32 10 & rc P1-19-2-ST "$ST" $C/P1.jsonl 19 2 & rc P1-32-9-ST "$ST" $C/P1.jsonl 32 9 & wait
# re-measure-9's bad-mode L40 requests under the stack (its F1 32:10 / 32:12, its P1 19:2 = S2's 880 corner)
for e in ST NR DEF; do rc rm9F1-32-10-$e "${!e}" $R9/F1.stop-requests.jsonl.gz 32 10 & done; wait
for e in ST NR DEF; do rc rm9F1-32-12-$e "${!e}" $R9/F1.stop-requests.jsonl.gz 32 12 & done; wait
for e in ST NR DEF; do rc rm9P1-19-2-$e "${!e}" $R9/P1.stop-requests.jsonl.gz 19 2 & done; wait
echo "[replays] done $(date -u +%FT%TZ)"
