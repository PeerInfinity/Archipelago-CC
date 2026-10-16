#!/bin/bash
# survey-axe.sh <name> [ENV=VAL ...] — the axe-room survey steps, local
cd /home/user/Archipelago-CC
n=$1; shift
ONLY=65,86,105,109,146,147,151,152,160,161,163,164,172,181,182,183,191,193,201,204,206,210,215
env "$@" SEEDLING_SURVEY_DIR=/tmp/claude-0/ax/sv-$n node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=$ONLY --out=/tmp/claude-0/ax/sv-$n.json > /tmp/claude-0/ax/sv-$n.log 2>&1
echo "$n exit $?"
