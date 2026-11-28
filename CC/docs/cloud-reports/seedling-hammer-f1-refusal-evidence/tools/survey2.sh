#!/bin/bash
# MEASUREMENT-ONLY (f1-refusal): survey --through=end under five and five+RSB, in parallel, with the reach preload.
. /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/tools/variants.sh; mkdir -p /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/survey; cd /home/user/Archipelago-CC || exit 1
for v in five fiversb; do
  ( env $(venv2 $v) NODE_OPTIONS=--import=/tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/tools/reach-preload2.mjs COUNTS_FILE=/tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/survey/reach-$v.jsonl node scripts/procgen/survey-seedling-route.mjs --through=end --out=/tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/survey/survey-$v.json > /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/survey/survey-$v.log 2>&1; echo "$v exit $?" >> /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/survey/done.txt ) &
done; wait
