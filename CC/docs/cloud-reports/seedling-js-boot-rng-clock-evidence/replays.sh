#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/c4458d81-8750-5523-8ca2-e7ce7a513195/scratchpad
for w in tip base; do
  cd $S/wt-$w && timeout 5400 node scripts/procgen/replay-seedling-solve-request.mjs --requests=$S/rp/all.jsonl --n=1 --jobs=1 --live --out=$S/rp/replay-$w.out.jsonl > $S/rp/replay-$w.txt 2>&1; echo "replay $w rc=$? $(date -u +%T)" >> $S/rp/seq.txt
done
