#!/usr/bin/env bash
# Beam (model chooses keys) for each row of rows.mjs; tapes to tapes/beam, logs to runs/beam. 2 at a time.
D=CC/docs/cloud-reports/rules-k-chaser-narrowing-evidence; W=CC/docs/cloud-reports/rules-l77-trap-chase-witness-evidence
one() { timeout ${TO:-1500} node $W/tools/chase/beam.mjs --boot=$2 --goal=$3 --items=$4 $5 ${ARGS:---width=48 --seg=4 --depth=200} --margin=2 --out=$D/tapes/beam/$1.tape.json > $D/runs/beam/$1.log 2>&1; echo "$1 $(tail -1 $D/runs/beam/$1.log | cut -c1-200)"; }
node $D/tools/rows.mjs | grep -E "${1:-.}" | python3 -c "
import sys,json
for l in sys.stdin:
    r=json.loads(l)
    print(r['id'], r['boots'][0], r['goals'][0], ','.join(r['items']) or '', '--lava' if 'hasDarkSuit' in r['items'] else '')
" | while read -r id boot goal items lava; do one "$id" "$boot" "$goal" "$items" "$lava" & sleep 1; done; wait
