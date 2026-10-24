#!/bin/bash
# SCRATCH (XF D1): every pressEscape call of the committed workloads, by level / beam tower / how it ended.
S=/tmp/claude-0/-home-user-Archipelago-CC/6a6a426f-aaa8-5880-b2ef-d30475870a6b/scratchpad
cd /home/user/Archipelago-CC
export XF_CENSUS_OUT=$S/ev/d1/census.jsonl
: > $XF_CENSUS_OUT
H="--import $S/tools/d1-census-hook.mjs"
for p in solve-seedling-r8-battery solve-seedling-r8-d2-chain solve-seedling-r8-l18 solve-seedling-r8-tail solve-seedling-r9-l3 solve-seedling-r9-campaign; do
  XF_TAG=$p node $H scripts/procgen/$p.mjs --check > $S/ev/d1/$p.out 2>&1; echo "$p rc=$?"
done
for s in 2 5 9; do XF_TAG=killgate-$s node $H scripts/procgen/census-seedling-killgate-clears.mjs --seeds=$s-$s > $S/ev/d1/killgate-$s.out 2>&1; echo "killgate-$s rc=$?"; done
XF_TAG=l18-sweep node $H scripts/procgen/sweep-seedling-l18-residues.mjs --json > $S/ev/d1/l18.out 2>&1; echo "l18 rc=$?"
echo D1-CENSUS-DONE
