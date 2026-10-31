#!/bin/bash
# scratch (SOUTHDOOR, from APPROACH's radius-queue.sh): the CPU-bound ON radius, in order, after the capture.
# Usage: radius-queue.sh <evidence dir> <scratch dir>
E=$1; S=$2; cd /home/user/Archipelago-CC && source .venv/bin/activate
T=$E/tools; SD="SEEDLING_APPROACH_DOOR=1"; ALL="SEEDLING_TURRET_APPROACH=1 SEEDLING_FIFTH_ORDER=1 SEEDLING_APPROACH_DOOR=1"
until grep -q "^all rc" "$S/cap/status" 2>/dev/null; do sleep 30; done
step() { echo "$(date +%T) $*" >> "$E/radius-queue.log"; }
step reqarms; ROOT=$PWD bash $T/reqarms.sh "$S/cap/all.jsonl" "$S/req" 4 D0 D0-SD L-TA L-TA+SD L-TA+FO L-TA+SD+FO >> "$S/req/reqarms.log" 2>&1; step "rc $?"
step producer OFF; node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-off.txt" 2>&1; step "rc $?"
step producer ON; env $SD node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-on.txt" 2>&1; step "rc $?"
FAST=$(grep -av slow "$E/bounded-files.txt")
step bounded OFF; npx vitest run $FAST > "$E/bounded-off.txt" 2>&1; step "rc $?"
step bounded ON; env $ALL npx vitest run $FAST > "$E/bounded-on.txt" 2>&1; step "rc $?"
SLOW=$(grep -a slow "$E/bounded-files.txt")
step slow OFF; npx vitest run --config vitest.slow.config.js $SLOW > "$E/slow-off.txt" 2>&1; step "rc $?"
step slow ON; env $SD npx vitest run --config vitest.slow.config.js $SLOW > "$E/slow-on.txt" 2>&1; step "rc $?"
step identity; bash scripts/procgen/identity-block.sh . > "$E/identity-after.txt" 2>&1; step "rc $?"
step wasm ship; node scripts/procgen/check-seedling-wasm-ship.mjs > "$E/wasm-ship.txt" 2>&1; step "rc $?"
step survey OFF; node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-off.json" > "$S/survey-off.log" 2>&1; step "rc $?"
step survey ON; env $ALL node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-on.json" > "$S/survey-on.log" 2>&1; step "rc $?"
step done
