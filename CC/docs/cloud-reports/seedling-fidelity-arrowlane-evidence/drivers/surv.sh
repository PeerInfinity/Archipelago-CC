cd /home/user/Archipelago-CC
#SEEDLING_ARROW_LANE_CROSSING=0 node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=4,5,8,18,26,37,132 --out=/tmp/claude-0/w/surv-off.json > /tmp/claude-0/w/surv-off.log 2>&1
SEEDLING_ARROW_LANE_CROSSING=1 node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=4,5,8,18,26,37,132 --out=/tmp/claude-0/w/surv-on.json > /tmp/claude-0/w/surv-on.log 2>&1
echo done > /tmp/claude-0/w/surv.done
