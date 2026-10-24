#!/bin/bash
# SCRATCH: a CPU profile of one L18 sweep at the pristine base, floor OFF / ON.
m=$1; d=/tmp/claude-0/wc/prof/l18-$m; rm -rf $d; mkdir -p $d; cd /tmp/claude-0/wc/base
[ $m = on ] && export SEEDLING_STRIKE_ETA_FLOOR=1
node --cpu-prof --cpu-prof-dir=$d --cpu-prof-interval 1000 scripts/procgen/sweep-seedling-l18-residues.mjs > $d/out.txt 2>&1
echo "prof $m done"
