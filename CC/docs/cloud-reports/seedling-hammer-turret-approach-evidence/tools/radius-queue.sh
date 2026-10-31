#!/bin/bash
# scratch (APPROACH): the CPU-bound ON radius, in order, after the request arms. Usage: radius-queue.sh <evidence dir> <scratch dir>
E=$1; S=$2; cd /home/user/Archipelago-CC && source .venv/bin/activate
ON="SEEDLING_TURRET_APPROACH=1 SEEDLING_FIFTH_ORDER=1"
until grep -q "^exit " "$S/req/reqarms.log" 2>/dev/null; do sleep 30; done
step() { echo "$(date +%T) $*" >> "$E/radius-queue.log"; }
step producer OFF; node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-off.txt" 2>&1; step "rc $?"
step producer ON; env $ON node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-on.txt" 2>&1; step "rc $?"
FAST=$(grep -av slow "$E/bounded-files.txt"; echo frontend/modules/seedlingDemo/hammerTurretApproach.test.js)
step bounded ON; env $ON npx vitest run $FAST > "$E/bounded-on.txt" 2>&1; step "rc $?"
step bounded OFF-after; npx vitest run frontend/modules/seedlingDemo/hammerTurretApproach.test.js > "$E/bounded-new-off.txt" 2>&1; step "rc $?"
SLOW="frontend/modules/seedlingDemo/hammerTurretApproach.slow.test.js frontend/modules/seedlingDemo/hammerLatchWeigh.slow.test.js frontend/modules/seedlingDemo/hammerIceTurretStatic.slow.test.js frontend/modules/seedlingDemo/fidelityL40Latch.slow.test.js frontend/modules/seedlingDemo/fidelityL40Bk2.slow.test.js"
step slow OFF; npx vitest run --config vitest.slow.config.js $SLOW > "$E/slow-off.txt" 2>&1; step "rc $?"
step slow ON; env $ON npx vitest run --config vitest.slow.config.js $SLOW > "$E/slow-on.txt" 2>&1; step "rc $?"
step identity after; bash scripts/procgen/identity-block.sh . > "$E/identity-after.txt" 2>&1; step "rc $?"
step wasm ship; node scripts/procgen/check-seedling-wasm-ship.mjs > "$E/wasm-ship.txt" 2>&1; step "rc $?"
step survey OFF; node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-off.json" > "$S/survey-off.log" 2>&1; step "rc $?"
step survey ON; env $ON node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-on.json" > "$S/survey-on.log" 2>&1; step "rc $?"
step done
