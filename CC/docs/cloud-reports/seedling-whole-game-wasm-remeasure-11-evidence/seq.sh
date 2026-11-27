#!/bin/bash
# remeasure-11 order: smoke, S2, S1, L2, S3, L1, S4, B1, P1
S=/tmp/claude-0/-home-user-Archipelago-CC/aa470272-4638-5261-a237-6a1ea84c7816/scratchpad
FIVE='SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1'
BUDGET_S=150 bash $S/run-arm.sh smoke --solver-env="$FIVE" --capture-requests=$S/cap/smoke.jsonl
bash $S/run-arm.sh S2 --solver-env="$FIVE"
bash $S/run-arm.sh S1 --solver-env="$FIVE" --capture-requests=$S/cap/S1.jsonl
bash $S/run-arm.sh L2
bash $S/run-arm.sh S3 --solver-env="$FIVE"
bash $S/run-arm.sh L1 --capture-requests=$S/cap/L1.jsonl
bash $S/run-arm.sh S4 --solver-env="$FIVE"
bash $S/run-arm.sh B1 --solver-env="$FIVE" --runtime=js
bash $S/run-arm.sh P1 --solver-env="$FIVE" --skip-refusals=10 --capture-requests=$S/cap/P1.jsonl
echo "[seq] done $(date -u +%FT%TZ)" >> $S/logs/seq.log
