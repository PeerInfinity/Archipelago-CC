#!/bin/bash
set -u
cd /home/user/Archipelago-CC
source .venv/bin/activate
S=/tmp/claude-0/-home-user-Archipelago-CC/c4458d81-8750-5523-8ca2-e7ce7a513195/scratchpad
env | grep -a "^SEEDLING_" && echo "SEEDLING env present!" >> $S/logs/seq.log
ALL='SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_REFUSAL_STAND_BOMBS=1;SEEDLING_HIT_PLAN_RETRY=1;SEEDLING_KILLLOCK_PINNED_SPEAR=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1;SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1'
git checkout -q claude/js-boot-rng-clock-wz0p4o; echo "[inapp] start $(date -u +%T) head $(git rev-parse --short HEAD)" >> $S/logs/seq.log
npm test -- --mode=test-substrates --batch=seedling-js > $S/logs/inapp-seedling-js.log 2>&1; echo "[inapp] rc=$? end $(date -u +%T)" >> $S/logs/seq.log
$S/run-arm.sh W1 2400 --runtime=wasm
git checkout -q measure/seedling-js-boot-rng-clock
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh J1 3600 --runtime=js --capture-requests=$S/cap/J1.jsonl
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh J2 3600 --runtime=js --capture-requests=$S/cap/J2.jsonl
git checkout -q measure-ja/seedling-js-boot-rng-clock
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh JA 3600 --runtime=js --solver-env="$ALL" --capture-requests=$S/cap/JA.jsonl
git checkout -q claude/js-boot-rng-clock-wz0p4o
echo ALLDONE $(date -u +%T) >> $S/logs/seq.log
