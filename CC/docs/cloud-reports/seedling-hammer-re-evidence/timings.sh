#!/bin/bash
# SCRATCH (seedling-hammer-re D3): 3 interleaved rounds, OFF/ON order alternating per round, one process at a time, on
# the real tree (REFUGE_ETA_CUT 0/1; BW OFF). Each row: mode, workload, rc, load at start, wall seconds.
E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-re-evidence
for r in 1 2 3; do
  if [ $((r % 2)) = 1 ]; then order="off on"; else order="on off"; fi
  for wl in A-sword A-ghost leg-397-ghost leg-414-ghost; do
    for m in $order; do
      c=0; [ $m = on ] && c=1
      ROOT=/home/user/Archipelago-CC TAG=t$r-$m SEEDLING_REFUGE_ETA_CUT=$c bash $E/lab-run.sh $m $wl
    done
  done
done
