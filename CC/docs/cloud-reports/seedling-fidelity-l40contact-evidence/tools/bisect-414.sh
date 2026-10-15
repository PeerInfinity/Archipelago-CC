#!/bin/bash
# L40CONTACT D4: one bisect step — 414's atlas boot (ghost) solved by G1's own g1-solve at the checked-out commit.
# exit 1 = throws in the chaser forecast's `Game.shake` band (bad); 0 = any other answer; 125 = the instrument broke.
S=/tmp/claude-0/-home-user-Archipelago-CC/c23ac379-8125-5180-a86f-96127ed60ce2/scratchpad
T=$(git rev-parse --short=10 HEAD)
out=$(cd $S && SEEDLING_GHOST_KILL_RUNG=1 REPO=$S/bis timeout 1800 node tools/g1-solve-g1.mjs --view=d4/boot-414.json --goal=collect:880,816 --ghost=1 2>&1); rc=$?
echo "$T rc=$rc $(echo "$out" | head -c 300)" >> $S/d4/bisect.log
echo "$out" > $S/d4/bisect-$T.out
if echo "$out" | grep -aq "Game.shake"; then exit 1; fi
if echo "$out" | grep -aq '"verdict"'; then exit 0; fi
exit 125
