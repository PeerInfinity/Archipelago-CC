#!/bin/bash
# probes standard on the ON tree (both literals flipped), served on 9753
cd /tmp/claude-0/on
W=/tmp/claude-0/w
python3 - <<'PY' > $W/probe-cmds.txt
import json
d=json.load(open('scripts/procgen/seedling-probe-batteries.json'))
b=d['batteries']['standard'] if 'batteries' in d else d['standard']
for e in b: print(e['probe'] + '\t' + e.get('args',''))
PY
: > $W/probes-on.txt
while IFS=$'\t' read -r p a; do
  echo "=== $p $a" >> $W/probes-on.txt
  SEEDLING_PORT=9753 timeout 2400 node scripts/procgen/$p --host=http://localhost:9753 $a --wait-for-box=7200 > $W/probe-$p.log 2>&1
  echo "exit $?" >> $W/probes-on.txt
  grep -a "ALL CHECKS PASSED\|CHECK(S) FAILED\|^FAIL" $W/probe-$p.log | head -5 >> $W/probes-on.txt
done < $W/probe-cmds.txt
echo DONE > $W/probes.done
