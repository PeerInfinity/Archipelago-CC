S=/tmp/claude-0/-home-user-Archipelago-CC/84150dfc-8a1f-5429-bb3f-6de83eb3af04/scratchpad
cd $S
for id in 624 625 626; do for v in 0 1; do
  G=''; [ $id = 626 ] && G='{"kind":"location","level":74,"name":"Level 074 - Darkshield","placement":{"x":48,"y":32}}'
  echo "=== leg $id ARM=$v"
  REPO=$S/wt SEEDLING_ARRIVAL_BUTTON_ARM=$v BUDGET=2560 GOAL="$G" TAPE_OUT=$S/plan-$id-arm$v.json TAPE_NAME=l74arrival-$id-arm$v timeout 1500 node leg.mjs --legs=$S/legs.jsonl --rows=$S/rows589.jsonl --id=$id 2>&1 | python3 -c "
import sys,json
t=sys.stdin.read()
try:
  i=t.index('{'); d=json.loads(t[i:t.rindex('}')+1]); print(json.dumps({k:d.get(k) for k in ['id','ok','ms','ticks','verbs','end','kind']}), '|', (d.get('message') or '')[:300].replace(chr(10),' '))
  print('passes', json.dumps(d.get('passes')))
except Exception as e: print('RAW', t[-1500:])
"
done; done
echo DONE
