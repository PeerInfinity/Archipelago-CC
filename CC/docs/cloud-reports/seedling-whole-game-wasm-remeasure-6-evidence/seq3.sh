#!/bin/bash
cd /home/user/Archipelago-CC
echo "[replay P1 26:11] start $(date -u +%FT%TZ)" >> /tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/logs/seq.log
timeout 1500 node scripts/procgen/replay-seedling-solve-request.mjs --requests=/tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/cap/P1.jsonl --id=26 --i=11 --n=1 --live --out=/tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/replay/P1-26-11.jsonl > /tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/replay/P1-26-11.txt 2>&1
echo "[replay P1 26:11] rc=$? end $(date -u +%FT%TZ)" >> /tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/logs/seq.log
bash /tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/run-arm.sh A4
echo "[seq3] done $(date -u +%FT%TZ)" >> /tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad/logs/seq.log
