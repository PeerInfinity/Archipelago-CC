#!/bin/bash
while kill -0 1023 2>/dev/null; do sleep 5; done
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh F2 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh F1 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/cap/F1.jsonl
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh A1 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1,SEEDLING_PRESS_KILL_HOLD=1
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh F3 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh C1
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh F4 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh A2 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1,SEEDLING_PRESS_KILL_HOLD=1
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh B1 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1 --runtime=js
bash /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/run-arm.sh P1 --solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1,SEEDLING_GOAL_START_WAIT=1,SEEDLING_PREVIEW_METER=1 --skip-refusals=10 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/cap/P1.jsonl
echo "[seq] done $(date -u +%FT%TZ)" >> /tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad/logs/seq.log
