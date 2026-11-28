#!/bin/bash
# usage: run-arm.sh <name> <budget-s> [walk-script args ...]   (seedling-js-boot-rng-clock measuring runs)
set -u
cd /home/user/Archipelago-CC
source .venv/bin/activate
S=/tmp/claude-0/-home-user-Archipelago-CC/c4458d81-8750-5523-8ca2-e7ce7a513195/scratchpad
name=$1; shift; b=$1; shift
echo "[arm $name] start $(date -u +%FT%TZ) head $(git rev-parse --short HEAD) branch $(git rev-parse --abbrev-ref HEAD) args: $*" >> "$S/logs/seq.log"
node scripts/procgen/walk-seedling-whole-game.mjs --budget-s=$b --stall-s=300 --log="$S/logs/$name.log" "$@" > "$S/logs/$name.summary" 2>&1
echo "[arm $name] rc=$? end $(date -u +%FT%TZ) :: $(tail -1 "$S/logs/$name.summary")" >> "$S/logs/seq.log"
