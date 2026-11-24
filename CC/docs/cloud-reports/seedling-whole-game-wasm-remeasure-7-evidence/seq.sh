#!/bin/bash
R=/tmp/claude-0/-home-user-Archipelago-CC/5287f6ca-5cac-56c0-8b01-bfb707191431/scratchpad/run-arm.sh
bash $R A1 --solver-env=SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/5287f6ca-5cac-56c0-8b01-bfb707191431/scratchpad/cap/A1.jsonl
bash $R C1 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/5287f6ca-5cac-56c0-8b01-bfb707191431/scratchpad/cap/C1.jsonl
bash $R A2 --solver-env=SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1
bash $R C2
bash $R B1 --solver-env=SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1 --runtime=js
bash $R P1 --solver-env=SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1 --skip-refusals=10 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/5287f6ca-5cac-56c0-8b01-bfb707191431/scratchpad/cap/P1.jsonl
bash $R A3 --solver-env=SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1
echo "[seq] done $(date -u +%FT%TZ)" >> /tmp/claude-0/-home-user-Archipelago-CC/5287f6ca-5cac-56c0-8b01-bfb707191431/scratchpad/logs/seq.log
