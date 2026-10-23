#!/bin/bash
# SCRATCH (SF3 M1): 3 interleaved rounds, OFF and ON of one workload side by side (PAR=2), the workload order
# rotated by round and the mode order alternated. Each run: sf3-run.sh, TAG=r<k>-<mode>.
S=${S:?}
WL=(l18 A-sword A-ghost leg-387-ghost leg-404-ghost ghost-sweep campaign prod-solve-seedling-r8-l18 prod-solve-seedling-r8-d2-chain killgate-2 killgate-5 killgate-9)
n=${#WL[@]}
for r in 1 2 3; do
  q=$S/queue-r$r.txt; : > $q
  for ((i=0;i<n;i++)); do
    w=${WL[$(( (i + (r-1)*4) % n ))]}
    if (( (r + i) % 2 )); then a=off; b=on; else a=on; b=off; fi
    echo "r$r-$a $a $w" >> $q; echo "r$r-$b $b $w" >> $q
  done
  xargs -P 2 -L 1 sh -c 'TAG=$0 bash '$S'/tools/sf3-run.sh $1 $2' < $q >> $S/m1-walls.jsonl
  echo "ROUND $r DONE $(date +%T)" >> $S/m1-walls.jsonl
done
echo M1-DONE >> $S/m1-walls.jsonl
