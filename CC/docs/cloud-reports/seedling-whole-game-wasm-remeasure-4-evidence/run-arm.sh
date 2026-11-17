#!/bin/bash
# usage: run-arm.sh <name> [ENV=VAL ...]
set -u
cd /home/user/Archipelago-CC
L=/tmp/claude-0/-home-user-Archipelago-CC/efc8119d-b8dc-5004-bce0-7b3bc3d72f9e/scratchpad/logs
name=$1; shift
echo "[arm $name] start $(date -u +%FT%TZ) env: $*" > "$L/$name.log"
env TEST_AUTO_START_TIMEOUT_MS=10800000 TEST_TIMEOUT=11000000 TEST_MEASURE_STEP_TIMEOUT_MS=10800000 TEST_MEASURE_BOT_STALL_MS=300000 "$@" \
  npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game >> "$L/$name.log" 2>&1
echo "[arm $name] rc=$? end $(date -u +%FT%TZ)" >> "$L/$name.log"
