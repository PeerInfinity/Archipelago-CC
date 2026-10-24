#!/bin/bash
# usage: runlegs.sh <keysfile> <outfile> [env assignments...]
keys=$1; out=$2; shift 2
: > $out
while IFS= read -r k; do
  env "$@" node /tmp/claude-0/w/drivers/leg.mjs --key="$k" --legs=/tmp/claude-0/w/legs.jsonl 2>/dev/null | python3 -c "
import json,sys
t=sys.stdin.read(); i=t.find('{')
try:
  o=json.loads(t[i:])
except Exception as e:
  print(json.dumps({'key':sys.argv[1],'err':t[-400:]})); sys.exit()
print(json.dumps({'key':sys.argv[1],'id':o['id'],'ok':o['ok'],'ms':o['ms'],'ticks':o.get('ticks'),'kind':o.get('kind'),'msg':(o.get('message') or '')[:600],'forcedHits':o.get('forcedHits'),'end':o.get('end')}))
" "$k" >> $out
done < $keys
