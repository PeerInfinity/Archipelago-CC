#!/bin/bash
# remeasure-12 order: smoke, A2, A1, C2, L1, A3, C1, A4, B1, P1  (capture ON: smoke, A1, L1, C1, P1)
S=/tmp/claude-0/-home-user-Archipelago-CC/e15e4644-750e-5660-ba6d-061e24b68b90/scratchpad
CORE='SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_REFUSAL_STAND_BOMBS=1;SEEDLING_HIT_PLAN_RETRY=1;SEEDLING_KILLLOCK_PINNED_SPEAR=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1'
ALL="$CORE;SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1"
R=$S/run-arm.sh
BUDGET_S=150 bash $R smoke --solver-env="$ALL" --capture-requests=$S/cap/smoke.jsonl
bash $R A2 --solver-env="$ALL"
bash $R A1 --solver-env="$ALL" --capture-requests=$S/cap/A1.jsonl
bash $R C2 --solver-env="$CORE"
bash $R L1 --capture-requests=$S/cap/L1.jsonl
bash $R A3 --solver-env="$ALL"
bash $R C1 --solver-env="$CORE" --capture-requests=$S/cap/C1.jsonl
bash $R A4 --solver-env="$ALL"
bash $R B1 --solver-env="$ALL" --runtime=js
bash $R P1 --solver-env="$ALL" --skip-refusals=10 --capture-requests=$S/cap/P1.jsonl
echo "[seq] done $(date -u +%FT%TZ)" >> $S/logs/seq.log
