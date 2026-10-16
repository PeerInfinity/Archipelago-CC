#!/bin/bash
# usage: run1.sh <name> <outdir>
cd /home/user/Archipelago-CC
n=$1; o=$2
s=$(date +%s.%N)
SEEDLING_PORT=9688 timeout 5400 node scripts/procgen/$n.mjs --check > $o/$n.log 2>&1
rc=$?
e=$(date +%s.%N)
printf "%s\t%d\t%.1f\n" "$n" "$rc" "$(echo "$e - $s" | bc)" >> $o/summary.tsv
