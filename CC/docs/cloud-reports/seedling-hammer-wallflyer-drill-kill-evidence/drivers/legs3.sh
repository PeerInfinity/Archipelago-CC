#!/bin/bash
# legs3.sh <tag> [env...]: the three lost legs by key, one inv-leg each
S=/tmp/claude-0/-home-user-Archipelago-CC/8c778e1a-081b-511c-96d6-cf60918b2646/scratchpad
TAG=$1; OUT=$S/repro/legs-$TAG.jsonl; : > $OUT
cd /home/user/Archipelago-CC
for k in "level_27 <- in_L28_128_304 -> exit:out_teleporter_32_0" "level_88 <- in_L12_304_0 -> exit:out_teleporter_32_0" "level_88 <- in_L12_304_0 -> exit:out_teleporter_192_0"; do
  timeout 900 node $S/drivers/inv-leg.mjs --legs=$S/sweep/legs/legs.jsonl --rows=$S/sweep/merged/merged/rows.jsonl --dump=$S/sweep/merged/merged/delivered-set.json "--key=$k" >> $OUT 2>> $S/repro/legs-$TAG.err || echo "{\"key\":\"$k\",\"crash\":true}" >> $OUT
done
