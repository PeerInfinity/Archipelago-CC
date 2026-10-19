#!/bin/bash
# HOUSEKEEP: battery.sh <outdir> <tag> — the W0/AFTER rows on the primary tree (sequential). Port: SEEDLING_PORT (9694).
set -u
O="$1"; T="$2"; E=CC/docs/cloud-reports/seedling-fidelity-housekeep-evidence
mkdir -p "$O"; cd "${ROOT:-/home/user/Archipelago-CC}" || exit 1
git rev-parse HEAD > "$O/sha-$T.txt"; git status --porcelain >> "$O/sha-$T.txt"; date -u +%FT%TZ > "$O/started-$T.txt"
{ for s in census-seedling-solver-surface census-seedling-constants witness-seedling-entities witness-seedling-profile; do
    echo "== $s"; node scripts/procgen/$s.mjs --check 2>&1 | tail -3; echo "rc=${PIPESTATUS[0]}"; done
  echo "== roster"; node -e "const j=require('./frontend/modules/seedlingDemo/fixtures/tapes/index.json'); console.log(Array.isArray(j)?j.length:Object.keys(j.tapes??j).length)"
} > "$O/censuses-$T.txt" 2>&1
npx vitest run frontend/modules/seedlingDemo/tapeRunner.test.js --reporter=json --outputFile="$O/taperunner-$T.json" > /dev/null 2>&1
python3 $E/tools/pairs.py "$O/taperunner-$T.json" > "$O/taperunner-pairs-$T.txt"; rm -f "$O/taperunner-$T.json"
npx vitest run $(cat ${VFILES:-$E/w0/vitest-files.txt}) --reporter=json --outputFile="$O/vitest-$T.json" > "$O/vitest-$T.log" 2>&1; echo "rc=$?" >> "$O/vitest-$T.log"
python3 $E/tools/pairs.py "$O/vitest-$T.json" > "$O/vitest-pairs-$T.txt"
python3 -c "import json,sys; j=json.load(open(sys.argv[1])); [print(a['status'], t['name'].split('seedlingDemo/')[-1], '::', a['fullName']) for t in j['testResults'] for a in t['assertionResults'] if a['status']!='passed']" "$O/vitest-$T.json" > "$O/vitest-nonpass-$T.txt"
gzip -f "$O/vitest-$T.json"
SEEDLING_PORT=${SEEDLING_PORT:-9694} bash scripts/procgen/identity-block.sh . > "$O/identity-$T.txt" 2>&1
date -u +%FT%TZ > "$O/finished-$T.txt"
