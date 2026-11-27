#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/ac8a0d4e-1888-5cf8-9bb1-6f858e267ef4/scratchpad
:
TEST_MEASURE_SOLVER_NO_LIMIT=1 TEST_MEASURE_CAPTURE_SERVICE='L22-|L40-' $S/run-arm.sh J0 5400 --runtime=js --capture-requests=$S/cap/J0.jsonl
TEST_MEASURE_CAPTURE_SERVICE='L22-|L40-' $S/run-arm.sh J1 1200 --runtime=js --capture-requests=$S/cap/J1.jsonl
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh W2 1500 --runtime=wasm --capture-requests=$S/cap/W2.jsonl
TEST_MEASURE_CAPTURE_SERVICE='L22-|L40-' $S/run-arm.sh J2 1200 --runtime=js --capture-requests=$S/cap/J2.jsonl
echo ALLDONE >> $S/logs/seq.log
