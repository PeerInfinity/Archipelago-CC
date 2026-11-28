# extract.sh <arm> [entries...] : measure log, stop status, capture summary + stop requests into the evidence dir
S=/tmp/claude-0/-home-user-Archipelago-CC/2a8ad7fa-a001-588c-bb05-b165d184676d/scratchpad
E=/home/user/rm9-evidence/CC/docs/cloud-reports/seedling-whole-game-wasm-remeasure-9-evidence; mkdir -p $E
a=$1; shift
grep -a "MEASURE\|^\[PROGRESS\|tutorial-walk-timing\|box lock\|^\[walk\]" $S/logs/$a.log | grep -av "MEASURE capture\] entry" > $E/$a.measure.log
tail -1 $S/logs/$a.summary > $E/$a.summary.txt
grep -a "MEASURE end" $S/logs/$a.log | python3 -c "import sys,re; l=sys.stdin.read(); m=re.search(r'status=\"(.*?)\" walkEnd=',l,re.S); print((m.group(1) if m else l).encode().decode('unicode_escape','ignore') if False else (m.group(1) if m else l))" > $E/$a.stop-status.txt
if [ -f $S/cap/$a.jsonl ]; then
  python3 $S/sumcap.py $S/cap/$a.jsonl > $E/$a.capture-summary.txt
  if [ $# -gt 0 ]; then python3 -c "
import json,sys
want=set(sys.argv[2:])
with open(sys.argv[1]) as f:
  for l in f:
    if str(json.loads(l)['id']) in want: sys.stdout.write(l)" $S/cap/$a.jsonl "$@" | gzip -9 > $E/$a.stop-requests.jsonl.gz; fi
fi
ls -la $E | grep " $a\."
