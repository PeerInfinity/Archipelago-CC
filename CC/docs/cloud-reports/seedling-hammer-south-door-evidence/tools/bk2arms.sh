#!/bin/bash
# scratch (SOUTHDOOR): see the report
# scratch: BK2 legs under arms, budget B ("" = captured). Usage: bk2arms.sh <tag> <budget|-> <arm>...
S=/tmp/claude-0/-home-user-Archipelago-CC/234eba87-8dde-5b53-bca5-a04b790b6db6/scratchpad
E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-south-door-evidence
cd /home/user/Archipelago-CC; TAG=$1; B=$2; shift 2
for A in "$@"; do
  BE=""; [ "$B" != "-" ] && BE="L40C_BUDGET_WORK=$B"
  rm -f $S/bk2-$TAG-$A.jsonl
  env $(bash $E/tools/armenv.sh $A) $BE node $E/tools/arms.mjs --requests=$S/cap/bk2both.jsonl --out=$S/bk2-$TAG-$A.jsonl > $S/bk2-$TAG-$A.log 2>&1
  echo "$TAG $A rc $?" >> $S/bk2arms.status
done
