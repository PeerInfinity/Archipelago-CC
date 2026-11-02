#!/bin/bash
# scratch (BK2COMBAT, from POCKET-BURN's radius-queue.sh): the CPU-bound ON radius, in order, after the L40 capture.
# Usage: radius-queue.sh <evidence dir> <scratch dir>. SH = SEEDLING_CHASER_STAGED_HUNT=1 (this slice's switch);
# F = LWF+TA+SD+FO+SB (POCKET-BURN's five); OPP = OPPORTUNISTIC_STRIKE (the press's chasers; needed for the walk's first fight).
E=$1; S=$2; cd /home/user/Archipelago-CC && source .venv/bin/activate
T=$E/tools; SH="SEEDLING_CHASER_STAGED_HUNT=1"
F="SEEDLING_LATCH_WEIGH_FIRST=1 SEEDLING_TURRET_APPROACH=1 SEEDLING_APPROACH_DOOR=1 SEEDLING_FIFTH_ORDER=1 SEEDLING_STANCE_BURN=1 SEEDLING_OPPORTUNISTIC_STRIKE=1"
step() { echo "$(date +%T) $*" >> "$E/radius-queue.log"; }
step reqarms; ROOT=$PWD bash $T/reqarms.sh "$S/cap/l40.jsonl" "$S/req" 4 D0 D0-BC F-XSEEDLING_OPPORTUNISTIC_STRIKE F-XSEEDLING_OPPORTUNISTIC_STRIKE+BC >> "$S/req-reqarms.log" 2>&1; step "rc $?"
step survey OFF; node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-off.json" > "$S/survey-off.log" 2>&1; step "rc $?"
step survey ON; env $SH node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-on.json" > "$S/survey-on.log" 2>&1; step "rc $?"
step survey F; env $F node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-F.json" > "$S/survey-F.log" 2>&1; step "rc $?"
step survey F-SH; env $F $SH node scripts/procgen/survey-seedling-route.mjs --through=end --out="$S/survey-F-SH.json" > "$S/survey-F-SH.log" 2>&1; step "rc $?"
step done
