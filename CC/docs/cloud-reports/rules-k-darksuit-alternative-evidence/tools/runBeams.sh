#!/usr/bin/env bash
# Beam (the JS model only chooses keys) for each row of rows.mjs; tapes to tapes/, logs to runs/beam/. All in parallel.
D=CC/docs/cloud-reports/rules-k-darksuit-alternative-evidence
one() { timeout ${TO:-2400} node $D/tools/chase/beam.mjs --boot=$2 --goal=$3 --items=$4 $5 ${ARGS:---width=48 --seg=4 --depth=200} --margin=2 --out=$D/tapes/$1.tape.json > $D/runs/beam/$1.log 2>&1; echo "$1 $(tail -1 $D/runs/beam/$1.log | cut -c1-300)"; }
node $D/tools/rows.mjs | grep -E "${1:-.}" | python3 -c "
import sys,json
for l in sys.stdin:
    r=json.loads(l)
    print(r['id'], r['boots'][0], r['goals'][0], ','.join(r['items']) or '', '--lava' if 'hasDarkSuit' in r['items'] else '')
" | while read -r id boot goal items lava; do one "$id" "$boot" "$goal" "$items" "$lava" & sleep 1; done; wait
