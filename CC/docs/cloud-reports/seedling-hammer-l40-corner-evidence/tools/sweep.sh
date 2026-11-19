#!/bin/bash
# sweep.sh <outfile.jsonl> <fx...> — every clock 5213..5257 (one hammer period) per fixture, budget 2560, 4 jobs.
out=$1; shift
for fx in "$@"; do for s in $(seq 5213 5257); do echo "$fx $s"; done; done \
 | xargs -P4 -n2 sh -c 'node CC/docs/cloud-reports/seedling-hammer-l40-corner-evidence/tools/seam.mjs --fx=$0 --seam=$1 --budget=2560' >> "$out"
