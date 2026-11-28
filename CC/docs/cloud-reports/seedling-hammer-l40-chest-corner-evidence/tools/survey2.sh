while kill -0 9748 2>/dev/null; do sleep 20; done
cd /home/user/Archipelago-CC
env SEEDLING_PRESS_KILL_HOLD=1 node scripts/procgen/survey-seedling-route.mjs --through=end --out=/tmp/claude-0/-home-user-Archipelago-CC/2ed3e211-e3df-565c-8597-40e8fa24de8d/scratchpad/survey/survey-DP.json > /tmp/claude-0/-home-user-Archipelago-CC/2ed3e211-e3df-565c-8597-40e8fa24de8d/scratchpad/survey/survey-DP.log 2>&1; echo "DP exit $?" >> /tmp/claude-0/-home-user-Archipelago-CC/2ed3e211-e3df-565c-8597-40e8fa24de8d/scratchpad/survey/done.txt
