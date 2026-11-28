#!/bin/bash
set -u
cd /home/user/Archipelago-CC
source .venv/bin/activate
S=/tmp/claude-0/-home-user-Archipelago-CC/8dcc06fb-b35c-56fa-991b-26b8235a419f/scratchpad
L=$S/final; mkdir -p $L; echo "start $(date -u +%FT%TZ) head $(git rev-parse --short HEAD)" > $L/seq.txt
timeout 3000 npx vitest run $(cat $S/importers.fast.txt) --maxWorkers=3 > $L/vitest.log 2>&1; echo "vitest rc=$? $(date -u +%T)" >> $L/seq.txt
npm test -- --mode=test-substrates --batch=seedling-js > $L/inapp-seedling-js.log 2>&1; echo "inapp seedling-js rc=$? $(date -u +%T)" >> $L/seq.txt
git checkout -q -B measure2/seedling-js-l57-exit-check claude/js-l57-exit-check-izu8ut && git cherry-pick d1d9da5e a3b1633f > /dev/null 2>&1; echo "measure2 head $(git rev-parse --short HEAD) $(git log --oneline -3 | tr '\n' ' ')" >> $L/seq.txt
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh FJ1 3600 --runtime=js --capture-requests=$S/cap/FJ1.jsonl
TEST_MEASURE_CAPTURE_SERVICE=1 $S/run-arm.sh FW1 2400 --runtime=wasm --capture-requests=$S/cap/FW1.jsonl
git checkout -q claude/js-l57-exit-check-izu8ut; echo "back on $(git rev-parse --abbrev-ref HEAD) $(git rev-parse --short HEAD); status: $(git status --short | wc -l)" >> $L/seq.txt
echo "FINALDONE $(date -u +%T)" >> $L/seq.txt
