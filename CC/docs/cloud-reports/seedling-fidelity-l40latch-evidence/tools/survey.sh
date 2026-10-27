#!/bin/bash
cd /home/user/Archipelago-CC
node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --out=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/survey-A.json > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/survey-A.log 2>&1
SEEDLING_HOLD_WAIT_PRICED=1 SEEDLING_CHASER_ORBIT_KILL=1 node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --out=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/survey-B.json > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/survey-B.log 2>&1
echo DONE > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/survey.done
