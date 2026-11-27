#!/bin/bash
# remeasure-11 replays (node, at the measured head 10a138a2). F = FIVE (PKSW+PKRB+DSS+OAC+HSB); D = no SEEDLING_* env = base
# defaults at be493c453a (BOS, GSW, PM, SPL, KTA, LHM ON; the rest OFF).
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/aa470272-4638-5261-a237-6a1ea84c7816/scratchpad; C=$S/cap; O=$S/replay; mkdir -p $O
F="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_OPP_AIM_CHASERS=1 SEEDLING_HIT_AVOID_STAND_BOMBS=1"; D="SEEDLING__NONE=1"
rc() { tag=$1; envs=$2; shift 2; ( env $envs node $S/replay-counts.mjs "$@" > $O/counts-$tag.txt 2>&1 ) ; }
rp() { tag=$1; envs=$2; f=$3; id=$4; i=$5; ( env $envs node scripts/procgen/replay-seedling-solve-request.mjs --requests=$f --id=$id --i=$i --n=3 --live > $O/$tag.txt 2>&1 ) ; }
both() { tag=$1; shift; rp $tag-F "$F" "$@" & rp $tag-D "$D" "$@" & wait; rc $tag-F "$F" "$@" & rc $tag-D "$D" "$@" & wait; }
both S1-37-8 $C/S1.jsonl 37 8
both S1-32-10 $C/S1.jsonl 32 10
both S1-18-11 $C/S1.jsonl 18 11
both L1-37-8 $C/L1.jsonl 37 8
both L1-32-10 $C/L1.jsonl 32 10
both L1-32-12 $C/L1.jsonl 32 12
both L1-18-10 $C/L1.jsonl 18 10
both rm10C2-32-10 $S/rm10/C2.stop-requests-32.jsonl.gz 32 10
both rm10C2-32-12 $S/rm10/C2.stop-requests-32.jsonl.gz 32 12
both rm10S1-32-10 $S/rm10/S1.stop-requests-32-33-37.jsonl.gz 32 10
both rm9P1-19-2 $S/rm9/P1.stop-requests.jsonl.gz 19 2
both P1-32-10 $C/P1.jsonl 32 10
both P1-38-6 $C/P1.jsonl 38 6
both P1-39-1 $C/P1.jsonl 39 1
echo "[replays] done $(date -u +%FT%TZ)"
