#!/bin/bash
# remeasure-12 part 2, after the container restart at ~22:36Z cut C1 off (t=3330s, botCursor 33): C1 re-run IN FULL, then A4, B1, P1
S=/tmp/claude-0/-home-user-Archipelago-CC/e15e4644-750e-5660-ba6d-061e24b68b90/scratchpad
CORE='SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_REFUSAL_STAND_BOMBS=1;SEEDLING_HIT_PLAN_RETRY=1;SEEDLING_KILLLOCK_PINNED_SPEAR=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1'
ALL="$CORE;SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1"
R=$S/run-arm.sh
echo "[seq2] container restart: C1 re-run in full $(date -u +%FT%TZ)" >> $S/logs/seq.log
bash $R C1 --solver-env="$CORE" --capture-requests=$S/cap/C1.jsonl
bash $R A4 --solver-env="$ALL"
bash $R B1 --solver-env="$ALL" --runtime=js
bash $R P1 --solver-env="$ALL" --skip-refusals=10 --capture-requests=$S/cap/P1.jsonl
echo "[seq2] done $(date -u +%FT%TZ)" >> $S/logs/seq.log
