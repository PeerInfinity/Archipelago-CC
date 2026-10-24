#!/bin/bash
# ab.sh <ids (space sep)> <outdir> [ENV=VAL ...] — node solve per leg at the baseline row's seamTime (SEAM_TIME env overrides), parallel
S=/tmp/claude-0/ax; D=$S/sweep/merged
ids=$1; out=$2; shift 2; mkdir -p $out
for id in $ids; do
  st=$(python3 -c "
import json,sys
for l in open('$D/rows.jsonl'):
    r=json.loads(l)
    if r['id']==$id: print(r.get('seamTime') or ''); break")
  ( env SEAM_TIME=$st "$@" timeout 900 node $S/drv/leg.mjs --legs=$S/legs.jsonl --rows=$D/rows.jsonl --dump=$D/delivered-set.json --id=$id > $out/$id.json 2>$out/$id.err || echo "{\"id\":$id,\"outcome\":\"timeout-or-crash\"}" > $out/$id.json ) &
done
wait
