#!/bin/bash
# usage: run-arm.sh <name> <budget-s> [walk-script args ...]   (seedling-js-held-retry measuring runs)
set -u
cd /home/user/Archipelago-CC
source .venv/bin/activate
S=/tmp/claude-0/-home-user-Archipelago-CC/c179e815-a2fb-5d53-9e0f-8512c85c9863/scratchpad
name=$1; shift; b=$1; shift
echo "[arm $name] start $(date -u +%FT%TZ) head $(git rev-parse --short HEAD) branch $(git rev-parse --abbrev-ref HEAD) args: $*" >> "$S/logs/seq.log"
node scripts/procgen/walk-seedling-whole-game.mjs --budget-s=$b --stall-s=300 --log="$S/logs/$name.log" "$@" > "$S/logs/$name.summary" 2>&1
echo "[arm $name] rc=$? end $(date -u +%FT%TZ) :: $(tail -1 "$S/logs/$name.summary")" >> "$S/logs/seq.log"
