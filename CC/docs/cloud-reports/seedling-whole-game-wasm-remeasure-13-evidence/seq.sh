#!/bin/bash
# remeasure-13 order: smoke, A2, A1, N1, L1, A3, A4, B1, P1  (capture ON: smoke, A1, N1, L1, P1)
S=/tmp/claude-0/-home-user-Archipelago-CC/7041f168-a394-59fa-8cd8-f5a162bca5cc/scratchpad
ALLP='SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_PRESS_KILL_STRIKE_BOMBS=1;SEEDLING_REFUSAL_STAND_BOMBS=1;SEEDLING_HIT_PLAN_RETRY=1;SEEDLING_KILLLOCK_PINNED_SPEAR=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1;SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1;SEEDLING_WALK_BLADE_ARM=1;SEEDLING_SPEAR_PRESS_GATE_WAIT=1;SEEDLING_PRESS_GLIDE_FOLLOW=1'
N="${ALLP%;SEEDLING_PRESS_GLIDE_FOLLOW=1}"
R=$S/run-arm.sh
[ "${1:-}" = smoke ] && { BUDGET_S=150 bash $R smoke --solver-env="$ALLP" --capture-requests=$S/cap/smoke.jsonl; exit; }
bash $R A2 --solver-env="$ALLP"
bash $R A1 --solver-env="$ALLP" --capture-requests=$S/cap/A1.jsonl
bash $R N1 --solver-env="$N" --capture-requests=$S/cap/N1.jsonl
bash $R L1 --capture-requests=$S/cap/L1.jsonl
bash $R A3 --solver-env="$ALLP"
bash $R A4 --solver-env="$ALLP"
bash $R B1 --solver-env="$ALLP" --runtime=js
bash $R P1 --solver-env="$ALLP" --skip-refusals=10 --capture-requests=$S/cap/P1.jsonl
echo "[seq] done $(date -u +%FT%TZ)" >> $S/logs/seq.log
