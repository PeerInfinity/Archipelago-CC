#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/c179e815-a2fb-5d53-9e0f-8512c85c9863/scratchpad
RX='L22-|L40-|-22$|-40$'
TEST_MEASURE_CAPTURE_SERVICE="$RX" $S/run-arm.sh MJ1 3600 --runtime=js --capture-requests=$S/cap/MJ1.jsonl
TEST_MEASURE_CAPTURE_SERVICE="$RX" $S/run-arm.sh MJ2 3600 --runtime=js --capture-requests=$S/cap/MJ2.jsonl
TEST_MEASURE_CAPTURE_SERVICE="$RX" $S/run-arm.sh MW1 2400 --runtime=wasm --capture-requests=$S/cap/MW1.jsonl
echo ALLDONE2 >> $S/logs/seq.log
