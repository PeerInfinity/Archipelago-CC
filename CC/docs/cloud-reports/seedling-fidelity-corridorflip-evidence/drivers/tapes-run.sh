#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/cac15fcf-e712-565f-b945-265af0af9d60/scratchpad
ARM=$1; OUT=$S/tapes/streams-$ARM.txt; : > $OUT
cd /home/user/Archipelago-CC
for n in $(cat $S/tapes/names.txt); do
  r=$(SEEDLING_CORRIDOR_BODY_PRICING=$ARM SEEDLING_CORRIDOR_FORECAST_MEMO=$ARM timeout 300 node scripts/procgen/run-seedling-tape.mjs $n 2>&1 | grep -ao "stream md5: [0-9a-f]\{32\}" | head -1)
  echo "$n ${r:-ERROR}" >> $OUT
done
