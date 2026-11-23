#!/bin/bash
R=/tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/run-arm.sh
bash $R A1 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/cap/A1.jsonl
bash $R A2
bash $R B1 --runtime=js
bash $R P1 --skip-refusals=10 --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/cap/P1.jsonl
bash $R Aprime1 --seed=2
echo "[seq1] done $(date -u +%FT%TZ)" >> /tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/logs/seq.log
