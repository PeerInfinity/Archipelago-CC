#!/bin/bash
# survey-full.sh <name> [ENV=VAL ...] — the whole route survey (--through=end --route=full), local
cd /home/user/Archipelago-CC
n=$1; shift
env "$@" SEEDLING_SURVEY_DIR=/tmp/claude-0/ax/full-$n node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --out=/tmp/claude-0/ax/full-$n.json > /tmp/claude-0/ax/full-$n.log 2>&1
echo "$n exit $?" >> /tmp/claude-0/ax/full.done
