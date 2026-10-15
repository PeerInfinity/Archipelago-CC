#!/bin/bash
cd /home/user/Archipelago-CC
run() { n=$1; shift; env "$@" SEEDLING_SURVEY_DIR=/tmp/claude-0/sa/full-$n node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --out=/tmp/claude-0/sa/full-$n.json > /tmp/claude-0/sa/full-$n.log 2>&1; echo "$n exit $?" >> /tmp/claude-0/sa/survey4.done; }
run off X=0
run d1 SEEDLING_SPINNING_AXE_PLAYER_HIT=1
run d2 SEEDLING_PARTIAL_DODGE_REPROBE=1
run both SEEDLING_SPINNING_AXE_PLAYER_HIT=1 SEEDLING_PARTIAL_DODGE_REPROBE=1
