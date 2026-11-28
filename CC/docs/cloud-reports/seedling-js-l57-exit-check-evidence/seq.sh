#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/8dcc06fb-b35c-56fa-991b-26b8235a419f/scratchpad
env | grep -a "^SEEDLING_" && echo "SEEDLING env present!" >> $S/logs/seq.log
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh J1 3600 --runtime=js --capture-requests=$S/cap/J1.jsonl
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh J2 3600 --runtime=js --capture-requests=$S/cap/J2.jsonl
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh W1 2400 --runtime=wasm --capture-requests=$S/cap/W1.jsonl
echo ALLDONE >> $S/logs/seq.log
