#!/bin/bash
# battery.sh <outdir> <tag> — the W0/D4 rows (run sequentially; CPU bound). HB's battery, this slice's paths/port.
set -u
O="$1"; T="$2"; R=/home/user/Archipelago-CC; E=$R/CC/docs/cloud-reports/seedling-hammer-active-frame-evidence
mkdir -p "$O"; cd "$R" || exit 1
git rev-parse HEAD > "$O/sha-$T.txt"
date -u +%FT%TZ > "$O/started-$T.txt"
{ for s in census-seedling-solver-surface census-seedling-constants witness-seedling-entities witness-seedling-profile; do
    echo "== $s"; node scripts/procgen/$s.mjs --check 2>&1 | tail -3; echo "rc=${PIPESTATUS[0]}"; done
  echo "== roster"; node -e "const j=require('./frontend/modules/seedlingDemo/fixtures/tapes/index.json'); console.log(Array.isArray(j)?j.length:Object.keys(j.tapes??j).length)"
} > "$O/censuses-$T.txt" 2>&1
npx vitest run frontend/modules/seedlingDemo/tapeRunner.test.js --reporter=json --outputFile="$O/taperunner-$T.json" > /dev/null 2>&1
python3 $E/tools/pairs.py "$O/taperunner-$T.json" > "$O/taperunner-pairs-$T.txt"; rm -f "$O/taperunner-$T.json"
npx vitest run $(cat "$O/vitest-files-$T.txt") > "$O/vitest-$T.txt" 2>&1; echo "rc=$?" >> "$O/vitest-$T.txt"
SEEDLING_PORT=9599 bash scripts/procgen/identity-block.sh . > "$O/identity-$T.txt" 2>&1
date -u +%FT%TZ > "$O/finished-$T.txt"
