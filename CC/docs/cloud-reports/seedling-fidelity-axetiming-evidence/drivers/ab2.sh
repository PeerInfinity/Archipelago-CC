#!/bin/bash
# ab2.sh <ids file> <outdir> [ENV=VAL ...] — ab.sh's per-leg solve, P jobs at a time (P env, default 2)
S=/tmp/claude-0/ax; D=$S/sweep/merged
ids=$1; out=$2; shift 2; mkdir -p $out
export S D out; export EXTRA="$*"
one() {
  id=$1
  st=$(python3 -c "
import json
for l in open('$D/rows.jsonl'):
    r=json.loads(l)
    if r['id']==$id: print(r.get('seamTime') or ''); break")
  env SEAM_TIME=$st PAGE_BUDGET=1 $EXTRA timeout 900 node $S/drv/leg.mjs --legs=$S/legs.jsonl --rows=$D/rows.jsonl --dump=$D/delivered-set.json --id=$id > $out/$id.json 2>$out/$id.err || echo "{\"id\":$id,\"outcome\":\"timeout-or-crash\"}" > $out/$id.json
}
export -f one
xargs -P ${P:-2} -I{} bash -c 'one {}' < $ids
