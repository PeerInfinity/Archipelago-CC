#!/bin/bash
# the OPP arm's seam census for legs 853/854 request 1: offsets -3..3, OPP alone vs OPP + both keys (node, OPP worktree)
W=/tmp/claude-0/w; T=/tmp/claude-0/tools
for id in 853 854; do for d in -3 -2 -1 0 1 2 3; do
  for arm in O OB; do
    E="SEEDLING_OPPORTUNISTIC_STRIKE=1"; [ $arm = OB ] && E="$E SEEDLING_ORBIT_FREE_AIM=1 SEEDLING_STRATEGY_BOUND_DISTINCT=1"
    echo "$id $d $arm"
  done
done; done | xargs -P 2 -L 1 bash -c 'id=$0; d=$1; arm=$2; E="SEEDLING_OPPORTUNISTIC_STRIKE=1"; [ $arm = OB ] && E="$E SEEDLING_ORBIT_FREE_AIM=1 SEEDLING_STRATEGY_BOUND_DISTINCT=1"; env ROOT=/tmp/claude-0/opp LEN=260 $E node /tmp/claude-0/tools/rep.mjs /tmp/claude-0/w/w0-cap.jsonl $id 1 $d > /tmp/claude-0/w/seam-$id-$d-$arm.txt 2>&1'
echo SEAMSDONE > $W/seams.done
