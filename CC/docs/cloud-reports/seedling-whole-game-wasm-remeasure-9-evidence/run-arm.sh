#!/bin/bash
# usage: run-arm.sh <name> [walk-script args ...]   (remeasure-9: re-measure-8's knobs exactly)
set -u
cd /home/user/Archipelago-CC
source .venv/bin/activate
S=/tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad
name=$1; shift
echo "[arm $name] start $(date -u +%FT%TZ) head $(git rev-parse --short HEAD) args: $*" >> "$S/logs/seq.log"
node scripts/procgen/walk-seedling-whole-game.mjs --budget-s=${BUDGET_S:-10800} --stall-s=300 --log="$S/logs/$name.log" "$@" > "$S/logs/$name.summary" 2>&1
echo "[arm $name] rc=$? end $(date -u +%FT%TZ) :: $(tail -1 "$S/logs/$name.summary")" >> "$S/logs/seq.log"
