#!/bin/bash
# SCRATCH (seedling-hammer-digest-audit D1): XC verify mode over the escape-heavy producers, one JSON line per process.
#   verify-batch.sh <tree> <outdir>
S=/tmp/claude-0/-home-user-Archipelago-CC/1135403e-168f-5fdd-97f0-86b5986dcfdc/scratchpad
T=$1; O=$2; mkdir -p $O
cd $T || exit 2
export REPO=$T SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1 XC_COUNTS_OUT=$O/verify-counts.jsonl
: > $XC_COUNTS_OUT
H="--import $S/tools/xc-count-hook.mjs"
for f in scripts/procgen/plan-seedling-hammer-*.mjs; do
  p=$(basename $f .mjs)
  s=$(date +%s); XC_TAG=$p node $H $f --check > $O/$p.out 2>&1; echo "$p rc=$? $(( $(date +%s)-s ))s"
done
s=$(date +%s); XC_TAG=r9-campaign node $H scripts/procgen/solve-seedling-r9-campaign.mjs --check > $O/r9-campaign.out 2>&1; echo "r9-campaign rc=$? $(( $(date +%s)-s ))s"
s=$(date +%s); XC_TAG=l18-sweep node $H scripts/procgen/sweep-seedling-l18-residues.mjs --json > $O/l18-sweep.out 2>&1; echo "l18-sweep rc=$? $(( $(date +%s)-s ))s"
s=$(date +%s); XC_TAG=lights-solves-on node $H $S/tools/lights-solve.mjs > $O/lights-solves-on.out 2>&1; echo "lights-solves-on rc=$? $(( $(date +%s)-s ))s"
echo BATCH-DONE
