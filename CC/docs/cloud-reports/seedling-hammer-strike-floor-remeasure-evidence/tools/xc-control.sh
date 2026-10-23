#!/bin/bash
# SCRATCH (SF3 M1 attribution): the L18 sweep with the cross-pass escape cache OFF, floor OFF / ON, 3 rounds side by side.
S=${S:?}
export SEEDLING_ESCAPE_CROSS_PASS_CACHE=0
for r in 1 2 3; do
  if (( r % 2 )); then a=off; b=on; else a=on; b=off; fi
  printf "x$r-$a $a l18\nx$r-$b $b l18\n" | xargs -P 2 -L 1 sh -c 'TAG=$0 bash '$S'/tools/sf3-run.sh $1 $2' >> $S/xc-walls.jsonl
done
echo XC-DONE >> $S/xc-walls.jsonl
