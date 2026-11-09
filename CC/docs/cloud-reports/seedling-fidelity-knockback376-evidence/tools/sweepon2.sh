#!/bin/bash
# scratch: page sweep of leg 376 with the key ON, 400 s leg budget, N runs
D=/tmp/claude-0/kb; cd /home/user/Archipelago-CC; CF=$(cat $D/on-plus.txt)
for n in 1 2 3 4 5 6 7 8; do
  node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=$D/legs.jsonl --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g --ids=376 --host=http://localhost:9776 --contact-fidelity=$CF --leg-budget-ms=400000 --out=$D/s2-on-$n.jsonl --capture-requests=$D/s2cap-on-$n.jsonl > $D/s2-on-$n.log 2>&1
  python3 -c "
import json
for l in open('$D/s2-on-$n.jsonl'):
  r=json.loads(l)
  if r.get('id')!=376: continue
  pl=[(p.get('ok'),p.get('ticks'),','.join(f\"{x['pass']}:{x['ok']}\" for x in p.get('passes',[]))) for p in (r.get('plans') or [])]
  print('on $n', r.get('end'), 'seam', (r.get('seam') or {}).get('time'), pl, 'roomHits', [(h.get('t'),h.get('hits')) if isinstance(h,dict) else h for h in ((r.get('roomHits') or {}).get('hits') or [])][:4], 'divs', (r.get('divs') or [])[:2])
"
done
