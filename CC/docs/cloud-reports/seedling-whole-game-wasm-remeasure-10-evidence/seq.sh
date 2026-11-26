#!/bin/bash
# remeasure-10 order: smoke, S2, S1, R1, S3, C1, S4, R2, B1, P1
STACK=SEEDLING_PRESS_KILL_START_WAIT=1,SEEDLING_PRESS_KILL_REFUGE_BOMBS=1,SEEDLING_DASH_STAND_SIGHT=1,SEEDLING_LATCHED_HOLD_MOVE=1
NOPKRB=SEEDLING_PRESS_KILL_START_WAIT=1,SEEDLING_DASH_STAND_SIGHT=1,SEEDLING_LATCHED_HOLD_MOVE=1

BUDGET_S=150 bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh smoke --solver-env=$STACK --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/cap/smoke.jsonl
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh S2 --solver-env=$STACK
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh S1 --solver-env=$STACK --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/cap/S1.jsonl
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh R1 --solver-env=$NOPKRB
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh S3 --solver-env=$STACK
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh C1
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh S4 --solver-env=$STACK
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh R2 --solver-env=$NOPKRB
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh B1 --solver-env=$STACK --runtime=js
bash /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/run-arm.sh P1 --solver-env=$STACK --skip-refusals=10 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/cap/P1.jsonl
echo "[seq] done $(date -u +%FT%TZ)" >> /tmp/claude-0/-home-user-Archipelago-CC/a0d3ec2c-83c1-5121-ae7e-258401c46338/scratchpad/logs/seq.log
