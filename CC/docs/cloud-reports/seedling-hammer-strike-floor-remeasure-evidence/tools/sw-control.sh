#!/bin/bash
# SCRATCH (SF3 M1 attribution): the L18 sweep with one other default opted out (lapse, STRING_PULL_FAST), floor OFF / ON side by side, 2 rounds.
S=${S:?}
for sw in SEEDLING_STRIKE_IFRAME_LAPSE SEEDLING_STRING_PULL_FAST; do
  for r in 1 2; do
    if (( r % 2 )); then a=off; b=on; else a=on; b=off; fi
    printf "$sw-$r-$a $a l18\n$sw-$r-$b $b l18\n" | env $sw=0 xargs -P 2 -L 1 sh -c 'TAG=$0 bash '$S'/tools/sf3-run.sh $1 $2' >> $S/sw-walls.jsonl
  done
done
echo SW-DONE >> $S/sw-walls.jsonl
