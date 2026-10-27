#!/bin/bash
cd /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/on
python3 - <<'PY' > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probe-cmds.txt
import json
d=json.load(open('scripts/procgen/seedling-probe-batteries.json'))
b=d['batteries']['standard'] if 'batteries' in d else d['standard']
for e in b: print(e['probe'] + '\t' + e.get('args',''))
PY
while IFS=$'\t' read -r p a; do
  echo "=== $p $a" >> /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probes-on.txt
  SEEDLING_PORT=9744 timeout 2400 node scripts/procgen/$p --host=http://localhost:9744 $a --wait-for-box=3600 > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probe-$p.log 2>&1
  echo "exit $?" >> /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probes-on.txt
  grep -a "ALL CHECKS PASSED\|CHECK(S) FAILED\|^FAIL" /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probe-$p.log | head -5 >> /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probes-on.txt
done < /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probe-cmds.txt
echo DONE > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/probes.done
