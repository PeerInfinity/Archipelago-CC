#!/bin/bash
while kill -0 $(cat /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/chain.pid) 2>/dev/null; do sleep 15; done
bash /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/tools/survey2.sh
echo SURVEY-DONE > /tmp/claude-0/-home-user-Archipelago-CC/c1f54890-e81b-5038-ba9e-d806679828c9/scratchpad/survey.done
