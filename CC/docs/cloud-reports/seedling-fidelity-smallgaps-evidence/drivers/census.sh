#!/bin/bash
S=$(dirname "$0")
for f in frontend/modules/seedlingDemo/fixtures/chaser-witness/*.json; do
  n=$(basename $f .json)
  tc=$(python3 -c "import json;print(json.load(open('$f'))['tape']['tick_count'])")
  SEEDLING_PORT=9672 timeout 1200 node $S/two-instruments.mjs $f $S/census-$n.json $tc > $S/census-$n.log 2>&1
  python3 - "$S/census-$n.json" "$n" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); n=sys.argv[2]
diff_fl=[r['t'] for r in d['rows'] if r['firstPoll'] and r['lastPoll'] and r['firstPoll'][:2]!=r['lastPoll'][:2]]
diff_lb=[r['t'] for r in d['rows'] if r['lastPoll'] and r['botObs'] and r['lastPoll'][:2]!=r['botObs']]
diff_fb=[r['t'] for r in d['rows'] if r['firstPoll'] and r['botObs'] and r['firstPoll'][:2]!=r['botObs']]
miss=[r['t'] for r in d['rows'] if not r['firstPoll']]
print(n, 'rows',len(d['rows']),'first!=last',diff_fl[:12],'last!=bot',diff_lb[:12],'first!=bot',diff_fb[:12],'unpolled',len(miss))
PY
done
