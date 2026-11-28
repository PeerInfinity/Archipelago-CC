#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/c179e815-a2fb-5d53-9e0f-8512c85c9863/scratchpad
RX='L22-|L40-|-22$|-40$'
TEST_MEASURE_CAPTURE_SERVICE="$RX" $S/run-arm.sh J1 3600 --runtime=js --capture-requests=$S/cap/J1.jsonl
TEST_MEASURE_CAPTURE_SERVICE="$RX" $S/run-arm.sh J2 3600 --runtime=js --capture-requests=$S/cap/J2.jsonl
TEST_MEASURE_CAPTURE_SERVICE="$RX" $S/run-arm.sh W1 2400 --runtime=wasm --capture-requests=$S/cap/W1.jsonl
echo ALLDONE >> $S/logs/seq.log
