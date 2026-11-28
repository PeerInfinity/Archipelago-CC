#!/bin/bash
set -u
cd /home/user/Archipelago-CC
source .venv/bin/activate
S=/tmp/claude-0/-home-user-Archipelago-CC/c179e815-a2fb-5d53-9e0f-8512c85c9863/scratchpad
L=$S/final; mkdir -p $L; echo "start $(date -u +%FT%TZ) head $(git rev-parse --short HEAD)" > $L/seq.txt
grep -alr "jsRuntimeSolver\.js\|jsRuntimeCore\.js\|wasmPlayback\.js" frontend/modules --include=*.test.js | grep -v -E "\.(slow|train|calib)\.test\.js$" | sort > $L/vitest-files.txt
timeout 3000 npx vitest run $(cat $L/vitest-files.txt) --maxWorkers=3 > $L/vitest.log 2>&1; echo "vitest rc=$? $(date -u +%T)" >> $L/seq.txt
timeout 1500 node scripts/procgen/replay-seedling-solve-request.mjs --requests=$S/replay2/requests.jsonl --n=1 --jobs=3 --live --out=$L/replay-tip.out.jsonl > $L/replay-tip.txt 2>&1; echo "replay tip rc=$?" >> $L/seq.txt
cp frontend/modules/seedlingDemo/jsRuntimeSolver.js $L/solver.js; cp frontend/modules/seedlingDemo/jsRuntimeCore.js $L/core.js
git show origin/main:frontend/modules/seedlingDemo/jsRuntimeSolver.js > frontend/modules/seedlingDemo/jsRuntimeSolver.js
git show origin/main:frontend/modules/seedlingDemo/jsRuntimeCore.js > frontend/modules/seedlingDemo/jsRuntimeCore.js
timeout 1500 node scripts/procgen/replay-seedling-solve-request.mjs --requests=$S/replay2/requests.jsonl --n=1 --jobs=3 --out=$L/replay-base.out.jsonl > $L/replay-base.txt 2>&1; echo "replay base rc=$?" >> $L/seq.txt
cp $L/solver.js frontend/modules/seedlingDemo/jsRuntimeSolver.js; cp $L/core.js frontend/modules/seedlingDemo/jsRuntimeCore.js
echo "restored tracked changes: $(git status --short | wc -l)" >> $L/seq.txt
npm test -- --mode=test-substrates --batch=seedling-js > $L/inapp-seedling-js.log 2>&1; echo "inapp seedling-js rc=$?" >> $L/seq.txt
npm test -- --mode=test-substrates --batch=seedling-js-solver > $L/inapp-seedling-js-solver.log 2>&1; echo "inapp seedling-js-solver rc=$?" >> $L/seq.txt
echo "FINALDONE $(date -u +%T)" >> $L/seq.txt
