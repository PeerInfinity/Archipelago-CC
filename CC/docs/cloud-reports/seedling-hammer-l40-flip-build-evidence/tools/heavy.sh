S=/tmp/claude-0/-home-user-Archipelago-CC/7c2c33f2-7a33-5ff0-8add-65efa01a6be3/scratchpad
cd $S/flip-wt
while kill -0 6741 2>/dev/null; do sleep 5; done
F=frontend/modules/seedlingDemo
timeout 7000 npx vitest run --config vitest.slow.config.js $F/hammerBk2Combat.slow.test.js $F/hammerDashShape.slow.test.js $F/hammerEscapeExact.slow.test.js $F/hammerEscapeGenerated.slow.test.js $F/strategySwitchApproach.slow.test.js $F/strategySwitchEscape.slow.test.js $F/strategySwitchGrade.slow.test.js $F/strategySwitchTable.slow.test.js $F/fidelityCorpseBump2.slow.test.js > $S/flip-slow.log 2>&1
timeout 7000 npx vitest run --config vitest.train.config.js $(ls $F/hammer*.train.test.js) > $S/flip-train.log 2>&1
echo HEAVY-DONE >> $S/flip-train.log
