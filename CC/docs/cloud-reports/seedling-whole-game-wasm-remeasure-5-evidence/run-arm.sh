#!/bin/bash
# usage: run-arm.sh <name> [ENV=VAL ...]   (re-measure-4's run-arm.sh, scratchpad path changed)
set -u
cd /home/user/Archipelago-CC
L=/tmp/claude-0/-home-user-Archipelago-CC/9f8d4571-911f-5f1e-81f6-c0a589d9556d/scratchpad/logs
name=$1; shift
echo "[arm $name] start $(date -u +%FT%TZ) head $(git rev-parse --short HEAD) env: $*" > "$L/$name.log"
env TEST_AUTO_START_TIMEOUT_MS=10800000 TEST_TIMEOUT=11000000 TEST_MEASURE_STEP_TIMEOUT_MS=10800000 TEST_MEASURE_BOT_STALL_MS=300000 "$@" \
  npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game >> "$L/$name.log" 2>&1
echo "[arm $name] rc=$? end $(date -u +%FT%TZ)" >> "$L/$name.log"
