#!/bin/bash
# fidelity L1516: one leg, OFF then ON (both switches), node, 180 s each.
id=$1
for v in 0 1; do
  out=$(SEEDLING_CHEST_PROBE_LINE_END=$v SEEDLING_ENCLOSED_PIT_CORNER=$v SEAM_TIME=1 timeout 180 node /tmp/claude-0/-home-user-Archipelago-CC/b0f2c71e-9517-5b5c-955a-6763d103c4e8/scratchpad/drivers/inv-leg.mjs --legs=/tmp/claude-0/-home-user-Archipelago-CC/b0f2c71e-9517-5b5c-955a-6763d103c4e8/scratchpad/legs.jsonl --rows=/tmp/claude-0/-home-user-Archipelago-CC/b0f2c71e-9517-5b5c-955a-6763d103c4e8/scratchpad/sweep39623239529/merged/rows.jsonl --dump=/tmp/claude-0/-home-user-Archipelago-CC/b0f2c71e-9517-5b5c-955a-6763d103c4e8/scratchpad/sweep39623239529/merged/delivered-set.json --id=$id 2>/dev/null | tail -1)
  [ -z "$out" ] && out="{\"id\":$id,\"timeout\":true}"
  echo "$out" >> /tmp/claude-0/-home-user-Archipelago-CC/b0f2c71e-9517-5b5c-955a-6763d103c4e8/scratchpad/legab/$v.jsonl
done
