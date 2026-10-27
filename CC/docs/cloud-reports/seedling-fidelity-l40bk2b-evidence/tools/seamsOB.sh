#!/bin/bash
for id in 853 854; do for d in -3 -2 -1 0 1 2 3; do echo "$id $d"; done; done | xargs -P 2 -L 1 bash -c 'env ROOT=/tmp/claude-0/opp LEN=2000 SEEDLING_OPPORTUNISTIC_STRIKE=1 SEEDLING_ORBIT_FREE_AIM=1 SEEDLING_STRATEGY_BOUND_DISTINCT=1 node /tmp/claude-0/tools/rep.mjs /tmp/claude-0/w/w0-cap.jsonl $0 1 $1 > /tmp/claude-0/w/seam-$0-$1-OB.txt 2>&1'
cd /tmp/claude-0/opp && env SEEDLING_OPPORTUNISTIC_STRIKE=1 SEEDLING_ORBIT_FREE_AIM=1 SEEDLING_STRATEGY_BOUND_DISTINCT=1 node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=67,95 --out=/tmp/claude-0/w/survey-oppB.json > /tmp/claude-0/w/survey-oppB.log 2>&1
echo DONE > /tmp/claude-0/w/seamsOB.done
