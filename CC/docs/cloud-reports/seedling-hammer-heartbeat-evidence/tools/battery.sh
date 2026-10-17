#!/bin/bash
# battery.sh <outdir> <tag> — the W0/D4 rows on /home/user/Archipelago-CC (run sequentially; ~CPU bound).
set -u
O="$1"; T="$2"; S=/tmp/claude-0/-home-user-Archipelago-CC/db8997fd-051c-55e6-975e-a574208b0427/scratchpad
mkdir -p "$O"; cd /home/user/Archipelago-CC || exit 1
git rev-parse HEAD > "$O/sha-$T.txt"
date -u +%FT%TZ > "$O/started-$T.txt"
# censuses
{ for s in census-seedling-solver-surface census-seedling-constants witness-seedling-entities witness-seedling-profile; do
    echo "== $s"; node scripts/procgen/$s.mjs --check 2>&1 | tail -3; echo "rc=$?"; done
  echo "== roster"; node -e "const j=require('./frontend/modules/seedlingDemo/fixtures/tapes/index.json'); console.log(Array.isArray(j)?j.length:Object.keys(j.tapes??j).length)"
} > "$O/censuses-$T.txt" 2>&1
# tapeRunner pairs
npx vitest run frontend/modules/seedlingDemo/tapeRunner.test.js --reporter=json --outputFile="$O/taperunner-$T.json" > /dev/null 2>&1
python3 $S/tools/pairs.py "$O/taperunner-$T.json" > "$O/taperunner-pairs-$T.txt"; rm -f "$O/taperunner-$T.json"
# bounded vitest
npx vitest run $(cat "$O/vitest-files-$T.txt") > "$O/vitest-$T.txt" 2>&1; echo "rc=$?" >> "$O/vitest-$T.txt"
# identity block (+ the six --checks + reference)
SEEDLING_PORT=9594 bash scripts/procgen/identity-block.sh . > "$O/identity-$T.txt" 2>&1
date -u +%FT%TZ > "$O/finished-$T.txt"
