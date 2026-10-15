#!/bin/bash
# SCRATCH (seedling-hammer-sf D3): which plan-seedling-* producers reach deriveStrike at all (the lab, SF_LAB=count).
S=/tmp/claude-0/-home-user-Archipelago-CC/7ab4ddbb-3ffa-5d06-91ee-6935e4e4988c/scratchpad
cd $S/lab
for f in scripts/procgen/plan-seedling-*.mjs; do
  n=$(basename $f .mjs)
  : > $S/count/$n.jsonl
  s=$(date +%s)
  SF_LAB=count SF_LAB_OUT=$S/count/$n.jsonl NODE_OPTIONS="--import $S/tools/sink.mjs" timeout 1200 node $f --check > $S/count/$n.out 2>&1
  rc=$?
  echo "$n rc=$rc derivations=$(wc -l < $S/count/$n.jsonl) s=$(( $(date +%s) - s ))"
done
echo COUNT DONE
