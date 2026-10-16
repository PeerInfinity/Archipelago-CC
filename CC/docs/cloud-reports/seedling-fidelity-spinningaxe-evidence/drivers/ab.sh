#!/bin/bash
# ab.sh <keys file> <out jsonl> [ENV=VAL ...] — node solve per leg (matched by KEY) at the baseline sweep row's seamTime
S=/tmp/claude-0/sa; D=$S/sweep/merged
keys=$1; out=$2; shift 2
: > $out
while IFS= read -r key; do
  read id st < <(python3 -c "
import json,sys
k=sys.argv[1]
lid=[json.loads(l)['id'] for l in open('$S/legs.jsonl') if json.loads(l)['key']==k][0]
st=''
for l in open('$D/rows.jsonl'):
    r=json.loads(l)
    if r['key']==k: st=r.get('seamTime') or ''; break
print(lid, st or 'none')
" "$key")
  [ "$st" = none ] && st=
  env "$@" ${st:+SEAM_TIME=$st} timeout 400 node $S/drv/leg.mjs --legs=$S/legs.jsonl --rows=$D/rows.jsonl --dump=$D/delivered-set.json --id=$id >> $out 2>/dev/null || echo "{\"id\":$id,\"key\":\"$key\",\"outcome\":\"timeout-or-crash\"}" >> $out
done < $keys
