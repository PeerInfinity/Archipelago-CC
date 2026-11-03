#!/bin/bash
# scratch (BK2COMBAT): the D gates in order. Usage: gate-queue.sh <evidence dir> <scratch dir>
E=$1; S=$2; cd /home/user/Archipelago-CC && source .venv/bin/activate
step() { echo "$(date +%T) $*" >> "$E/gate-queue.log"; }
step producer OFF; node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-off.txt" 2>&1; step "rc $?"
step producer ON; SEEDLING_CHASER_STAGED_HUNT=1 node scripts/procgen/ci-producer-checks.mjs --jobs=4 > "$E/producer-on.txt" 2>&1; step "rc $?"
step identity; bash scripts/procgen/identity-block.sh . > "$E/identity-after.txt" 2>&1; step "rc $?"
step wasm ship; node scripts/procgen/check-seedling-wasm-ship.mjs > "$S/wasm-ship.txt" 2>&1; step "rc $?"
SLOW=$(grep -a 'slow' "$E/bounded-files.txt" | grep -a 'hammer' | tr '\n' ' ')
step slow ON $SLOW; SEEDLING_CHASER_STAGED_HUNT=1 npx vitest run --config vitest.slow.config.js $SLOW > "$S/slow-on.txt" 2>&1; step "rc $?"
step slow OFF; npx vitest run --config vitest.slow.config.js $SLOW > "$S/slow-off.txt" 2>&1; step "rc $?"
step done
