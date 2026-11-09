#!/bin/bash
# scratch: the copied probe (400 s leg budget) on leg 376 until a diverged play is captured
D=/tmp/claude-0/kb; cd /home/user/Archipelago-CC
for n in 1 2 3 4 5 6 7 8; do
  node $D/tools/cdprobe.mjs --legs=$D/legs.jsonl --ids=376 --host=http://localhost:9776 --page=seedling_bot_ap_p4g --out=$D/ce$n.jsonl --capture=$D/capdirE$n > $D/ce$n.log 2>&1
  echo "try $n rc=$? $(ls $D/capdirE$n 2>/dev/null) $(grep -ao '"ticks": [0-9]*' $D/ce$n.jsonl | head -2 | tr '\n' ' ')"
  if ls $D/capdirE$n/*.json >/dev/null 2>&1; then echo CAPTURED; break; fi
done
