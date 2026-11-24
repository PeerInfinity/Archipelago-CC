#!/bin/bash
# KILL880: 19:1 at the page's held-retry budget (2560), one arm (ARM=on|off) over the given seam offsets, one line each.
cd "${REPO:-/home/user/Archipelago-CC}"
E=CC/docs/cloud-reports/seedling-hammer-kill880-evidence
for d in "$@"; do
  SEEDLING_PRESS_KILL_HOLD=$([ "$ARM" = on ] && echo 1 || echo 0) node $E/tools/seam.mjs --req=$E/req/P1-19-1.json.gz --seam=$((33487+d)) --budget=2560 2>/dev/null >> $E/retry/retry-$ARM.jsonl
done
