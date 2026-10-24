#!/bin/bash
# ab.sh <ids file> <out jsonl> [ENV=VAL ...] — node solve per leg at the sweep row's seamTime
S=/tmp/claude-0/-home-user-Archipelago-CC/4ee07d96-6856-5502-8024-f803d6f233ab/scratchpad; D=$S/sweep-38343649914/merged
ids=$1; out=$2; shift 2
: > $out
for id in $(cat $ids); do
  st=$(python3 -c "
import json,sys
legs={json.loads(l)['id']:json.loads(l) for l in open('$S/d3/legs.jsonl')}
k=legs[$id]['key']
for l in open('$D/rows.jsonl'):
    r=json.loads(l)
    if r['key']==k: print(r.get('seamTime') or ''); break
")
  env "$@" SEAM_TIME=$st timeout 300 node $S/d3/leg.mjs --legs=$S/d3/legs.jsonl --rows=$D/rows.jsonl --dump=$D/delivered-set.json --id=$id >> $out 2>/dev/null || echo "{\"id\":$id,\"outcome\":\"timeout-or-crash\"}" >> $out
done
