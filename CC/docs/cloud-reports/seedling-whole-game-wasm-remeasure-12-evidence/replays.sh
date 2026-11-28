#!/bin/bash
# remeasure-12 replays (node). A = ALL, C = CORE, D = no SEEDLING_* env = base defaults at d1725843a2 (LHM etc. ON; the 13 OFF).
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/e15e4644-750e-5660-ba6d-061e24b68b90/scratchpad; C=$S/cap; O=$S/replay; mkdir -p $O
CORE="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_OPP_AIM_CHASERS=1 SEEDLING_HIT_AVOID_STAND_BOMBS=1 SEEDLING_REFUSAL_STAND_BOMBS=1 SEEDLING_HIT_PLAN_RETRY=1 SEEDLING_KILLLOCK_PINNED_SPEAR=1 SEEDLING_PRESS_KILL_HOLD=1 SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1"
ALL="$CORE SEEDLING_WAND_SHOT_TRAP_BODIES=1 SEEDLING_WAND_SHOT_ENEMY_BODIES=1 SEEDLING_AXE_TIMING_SWORD_SWAP=1"; D="SEEDLING__NONE=1"
RC=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-whole-game-wasm-remeasure-12-evidence/replay-counts.mjs
rc() { tag=$1; envs=$2; shift 2; ( env $envs node $RC "$@" > $O/counts-$tag.txt 2>&1 ) ; }
rp() { tag=$1; envs=$2; f=$3; id=$4; i=$5; ( env $envs node scripts/procgen/replay-seedling-solve-request.mjs --requests=$f --id=$id --i=$i --n=3 --live > $O/$tag.txt 2>&1 ) ; }
both() { tag=$1; envname=$2; shift 2; local E1; [ $envname = A ] && E1="$ALL" || E1="$CORE"
  rp $tag-$envname "$E1" "$@" & rp $tag-D "$D" "$@" & rc $tag-$envname "$E1" "$@" & rc $tag-D "$D" "$@" & wait; }
# stops
both A1-38-2 A $C/A1.jsonl 38 2
both C1-37-8 C $C/C1.jsonl 37 8
both L1-37-8 A $C/L1.jsonl 37 8
# hits
both A1-5-7 A $C/A1.jsonl 5 7
both A1-24-3 A $C/A1.jsonl 24 3
both A1-37-9 A $C/A1.jsonl 37 9
both C1-24-3 C $C/C1.jsonl 24 3
both C1-26-7 C $C/C1.jsonl 26 7
# switch witnesses: 18:11, 19:1/19:2 (PKH), 37:7/37:8 (AXE under the wand keys)
both A1-18-11 A $C/A1.jsonl 18 11
both A1-19-1 A $C/A1.jsonl 19 1
both A1-19-2 A $C/A1.jsonl 19 2
both A1-37-7 A $C/A1.jsonl 37 7
both A1-37-8 A $C/A1.jsonl 37 8
both L1-24-3 A $C/L1.jsonl 24 3
echo "[replays] done $(date -u +%FT%TZ)"
