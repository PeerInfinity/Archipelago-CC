#!/bin/bash
# SCRATCH (XC D2): verify mode (every hit recomputed and compared) over the six producers and the L18 sweep, floor
# OFF and ON; each process appends its cache counts to verify-counts.jsonl (xc-count-hook.mjs).
S=/tmp/claude-0/-home-user-Archipelago-CC/2f4d6e0e-1690-55e4-985b-1d7061ddd905/scratchpad
cd /home/user/Archipelago-CC
export SEEDLING_ESCAPE_CROSS_PASS_CACHE=1 SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1 XC_COUNTS_OUT=$S/d2/verify-counts.jsonl
: > $XC_COUNTS_OUT
H="--import $S/tools/xc-count-hook.mjs"
for p in solve-seedling-r8-battery solve-seedling-r8-d2-chain solve-seedling-r8-l18 solve-seedling-r8-tail solve-seedling-r9-l3 solve-seedling-r9-campaign; do
  XC_TAG=$p node $H scripts/procgen/$p.mjs --check > $S/d2/verify-$p.out 2>&1; echo "$p rc=$? $(tail -1 $S/d2/verify-$p.out | md5sum | cut -c1-8)"
done
XC_TAG=l18-off node $H scripts/procgen/sweep-seedling-l18-residues.mjs --json > $S/d2/verify-l18-off.out 2>&1; echo l18-off rc=$?
XC_TAG=l18-on SEEDLING_STRIKE_ETA_FLOOR=1 node $H scripts/procgen/sweep-seedling-l18-residues.mjs --json > $S/d2/verify-l18-on.out 2>&1; echo l18-on rc=$?
python3 $S/tools/norm.py $S/d2/verify-l18-*.out
echo VERIFY-DONE
