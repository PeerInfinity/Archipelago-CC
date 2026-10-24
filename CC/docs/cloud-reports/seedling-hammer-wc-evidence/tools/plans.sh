#!/bin/bash
# SCRATCH (seedling-hammer-wc, the flip table): the producers that reach deriveStrike, --check OFF and ON, at the base.
S=/tmp/claude-0/wc/flip
cd /tmp/claude-0/wc/base
for n in plan-seedling-f1c-l18-phase plan-seedling-hammer-a-escape plan-seedling-hammer-b1-approach plan-seedling-hammer-b2-fight plan-seedling-hammer-g1-ghostkill plan-seedling-hammer-bw-bombstand plan-seedling-hammer-sf-strikefloor; do
  for m in off on; do
    e=""; [ $m = on ] && e="SEEDLING_STRIKE_ETA_FLOOR=1"
    s=$(date +%s)
    env $e timeout 1800 node scripts/procgen/$n.mjs --check > $S/plans/$n.$m.out 2>&1
    echo "$n $m rc=$? s=$(( $(date +%s) - s )) md5=$(grep -v '^# box lock:' $S/plans/$n.$m.out | md5sum | cut -c1-8)"
  done
done
echo PLANS DONE
