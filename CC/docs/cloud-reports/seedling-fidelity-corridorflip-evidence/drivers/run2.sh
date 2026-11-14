#!/bin/bash
# run.sh <arm 0|1> : one inv-leg per id
S=/tmp/claude-0/-home-user-Archipelago-CC/cac15fcf-e712-565f-b945-265af0af9d60/scratchpad
ARM=$1; OUT=$S/legs/legs-$ARM${TAG:-}.jsonl; : > $OUT
cd /home/user/Archipelago-CC
for id in $(cat $S/legs/ids.txt); do
  SEEDLING_CORRIDOR_BODY_PRICING=$ARM timeout 900 node $S/legs/inv-leg.mjs --legs=$S/sweep/legs.jsonl --rows=$S/sweep/merged/merged/rows.jsonl --dump=$S/sweep/merged/merged/delivered-set.json --id=$id >> $OUT 2>> $S/legs/err-$ARM${TAG:-}.txt || echo "{\"id\":$id,\"crash\":true}" >> $OUT
done
echo DONE >> $S/legs/err-$ARM${TAG:-}.txt
