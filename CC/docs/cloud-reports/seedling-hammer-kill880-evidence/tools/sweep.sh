#!/bin/bash
# KILL880: seam.mjs over a list of (seam offset, wait) pairs, JOBS at once, one JSON line each into OUT.
#   OUT=<jsonl> JOBS=2 BUDGET=<work|empty> bash sweep.sh <d> <w-from> <w-to>
cd "${REPO:-/home/user/Archipelago-CC}"
E=CC/docs/cloud-reports/seedling-hammer-kill880-evidence
d=$1; from=$2; to=$3
seq "$from" "$to" | xargs -P "${JOBS:-2}" -I{} sh -c "node $E/tools/seam.mjs --req=$E/req/P1-19-1.json.gz --seam=\$((33487+$d)) --wait={} ${BUDGET:+--budget=$BUDGET} 2>/dev/null >> $OUT"
