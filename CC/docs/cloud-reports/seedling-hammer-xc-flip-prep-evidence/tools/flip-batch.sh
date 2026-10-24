#!/bin/bash
# SCRATCH (XF D3): the flip branch's local evidence — the battery (censuses, tapeRunner, hammer tier + progress rows,
# identity block with the six --checks), then verify mode over the six producers and the L18 sweep.
S=/tmp/claude-0/-home-user-Archipelago-CC/6a6a426f-aaa8-5880-b2ef-d30475870a6b/scratchpad
cd /home/user/Archipelago-CC
PORT=9603 bash $S/tools/battery.sh $S/ev/flip flip
export SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1 XC_COUNTS_OUT=$S/ev/flipverify/verify-counts.jsonl
: > $XC_COUNTS_OUT
H="--import $S/tools/xc-count-hook.mjs"
for p in solve-seedling-r8-battery solve-seedling-r8-d2-chain solve-seedling-r8-l18 solve-seedling-r8-tail solve-seedling-r9-l3 solve-seedling-r9-campaign; do
  XC_TAG=$p node $H scripts/procgen/$p.mjs --check > $S/ev/flipverify/verify-$p.out 2>&1; echo "$p rc=$?"
done
XC_TAG=l18-off node $H scripts/procgen/sweep-seedling-l18-residues.mjs --json > $S/ev/flipverify/verify-l18-off.out 2>&1; echo l18-off rc=$?
XC_TAG=l18-on SEEDLING_STRIKE_ETA_FLOOR=1 node $H scripts/procgen/sweep-seedling-l18-residues.mjs --json > $S/ev/flipverify/verify-l18-on.out 2>&1; echo l18-on rc=$?
python3 $S/tools/norm.py $S/ev/flipverify/verify-l18-*.out
echo FLIP-DONE
