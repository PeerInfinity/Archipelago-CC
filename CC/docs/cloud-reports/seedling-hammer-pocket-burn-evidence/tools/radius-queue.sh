#!/bin/bash
# scratch (POCKET-BURN, from SOUTHDOOR's radius-queue.sh): the CPU-bound ON radius, in order, after the capture.
# Usage: radius-queue.sh <evidence dir> <scratch dir>
E=$1; S=$2; cd /home/user/Archipelago-CC && source .venv/bin/activate
T=$E/tools; SB="SEEDLING_STANCE_BURN=1"; ALL="SEEDLING_LATCH_WEIGH_FIRST=1 SEEDLING_TURRET_APPROACH=1 SEEDLING_APPROACH_DOOR=1 SEEDLING_FIFTH_ORDER=1 SEEDLING_STANCE_BURN=1"
step() { echo "$(date +%T) $*" >> "$E/radius-queue.log"; }
step reqarms; ROOT=$PWD bash $T/reqarms.sh "$S/cap/all.jsonl" "$S/req" 4 D0 D0-SB F F-SB >> "$S/req-reqarms.log" 2>&1; step "rc $?"
step producer OFF; node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-off.txt" 2>&1; step "rc $?"
step producer ON; env $SB node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-on.txt" 2>&1; step "rc $?"
FAST=$(grep -av slow "$E/bounded-files.txt")
step bounded OFF; npx vitest run $FAST > "$S/bounded-off.txt" 2>&1; step "rc $?"
step bounded ON; env $SB npx vitest run $FAST > "$S/bounded-on.txt" 2>&1; step "rc $?"
SLOW=$(grep -a slow "$E/bounded-files.txt")
step slow OFF; npx vitest run --config vitest.slow.config.js $SLOW > "$S/slow-off.txt" 2>&1; step "rc $?"
step slow ON; env $SB npx vitest run --config vitest.slow.config.js $SLOW > "$S/slow-on.txt" 2>&1; step "rc $?"
step identity; bash scripts/procgen/identity-block.sh . > "$E/identity-after.txt" 2>&1; step "rc $?"
step checkref; node scripts/procgen/check-procgen-reference.mjs > "$E/gate-checkref.txt" 2>&1; step "rc $?"
step wasm ship; node scripts/procgen/check-seedling-wasm-ship.mjs > "$S/wasm-ship.txt" 2>&1; step "rc $?"
step survey OFF; node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-off.json" > "$S/survey-off.log" 2>&1; step "rc $?"
step survey ON; env $SB node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-on.json" > "$S/survey-on.log" 2>&1; step "rc $?"
step survey F; env SEEDLING_LATCH_WEIGH_FIRST=1 SEEDLING_TURRET_APPROACH=1 SEEDLING_APPROACH_DOOR=1 SEEDLING_FIFTH_ORDER=1 node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-F.json" > "$S/survey-F.log" 2>&1; step "rc $?"
step survey F-SB; env $ALL node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-F-SB.json" > "$S/survey-F-SB.log" 2>&1; step "rc $?"
step done
