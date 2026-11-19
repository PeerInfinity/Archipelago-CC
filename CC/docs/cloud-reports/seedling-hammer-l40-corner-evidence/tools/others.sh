#!/bin/bash
# others.sh <out.jsonl> — the refused flag-12 clocks asked with each existing OFF hammer switch ON (base tree), 3 jobs.
out=$1
for sw in PRESS_ESCAPE_SHIELD_CLAIM SHOVED_BODY_LOOKAHEAD HAMMER_BODY_GATE; do for s in 5241 5242 5225; do echo "$sw $s"; done; done \
 | xargs -P3 -n2 sh -c 'env SEEDLING_$0=1 node CC/docs/cloud-reports/seedling-hammer-l40-corner-evidence/tools/seam.mjs --fx=flag12-L39 --seam=$1 --budget=2560' >> "$out"
