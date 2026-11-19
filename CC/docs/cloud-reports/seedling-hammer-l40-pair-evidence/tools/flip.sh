#!/bin/bash
# flip.sh <outdir> <off|pair|claim|pkc> — flip readiness under one arm: the bounded vitest over the files that name either
# switch (+ the SPIN slice's four hammer files whose rows read the env), default tier then train tier (json reporter, one
# file per tier), and the three identity rows the SPIN slice saw move (empty pairs c3/c6, carved pairs c4).
o=$1; arm=$2
case $arm in off) envs="";; pair) envs="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1 SEEDLING_PRESS_KILL_CHASERS=1";;
  claim) envs="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1";; pkc) envs="SEEDLING_PRESS_KILL_CHASERS=1";; esac
D=frontend/modules/seedlingDemo
DEF="$D/hammerEscapeExact.test.js $D/hammerPressKillChasers.test.js $D/hammerSpinnerPress.test.js $D/hammerStrikeEtaFloor.test.js $D/hammerOpportunisticStrike.test.js $D/hammerPressKillGuards.test.js $D/hammerRefugeBandText.test.js"
TRN="$D/hammerEscapeExact.train.test.js $D/hammerGhostKillRung.train.test.js $D/hammerSpinnerPress.train.test.js $D/hammerChooserPair.train.test.js"
env $envs npx vitest run $DEF --reporter=json --outputFile="$o/vitest-default-$arm.json" > "$o/vitest-default-$arm.log" 2>&1
env $envs npx vitest run --config vitest.train.config.js $TRN --reporter=json --outputFile="$o/vitest-train-$arm.json" > "$o/vitest-train-$arm.log" 2>&1
m () { md5sum | cut -d' ' -f1; }
{ echo "arm $arm ($envs)"
  echo "empty pairs c3   $(env $envs node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=3 2>/dev/null | tee "$o/c3-$arm.txt" | m)"
  echo "empty pairs c6   $(env $envs node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=empty --seeds=1-40 --count=6 2>/dev/null | tee "$o/c6-$arm.txt" | m)"
  echo "carved pairs c4  $(env $envs node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=winding,rooms,branchy,bushy,loopy,open --seeds=1-12 --count=4 2>/dev/null | tee "$o/c4-$arm.txt" | m)"
} > "$o/identity-$arm.txt"
