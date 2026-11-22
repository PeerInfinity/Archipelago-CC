#!/bin/bash
# LOOKAHEAD census driver: every sibling-group leg (keys.txt) through pit-landing.mjs, 3 in parallel, a 120 s cap each.
E=CC/docs/cloud-reports/seedling-hammer-lookahead-evidence
i=0
while IFS= read -r k; do
  i=$((i+1))
  ( timeout 120 node $E/tools/pit-landing.mjs --legs="${LEGS:?gunzip legs.jsonl.gz and set LEGS}" --spheres=$E/sphere-items.jsonl --key="$k" --idle=0 > $E/census/rows/$i.jsonl 2>/dev/null || echo "{\"key\":$(printf '%s' "$k" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'),\"outcome\":\"cap-or-error\"}" > $E/census/rows/$i.jsonl ) &
  while [ "$(jobs -r | wc -l)" -ge 3 ]; do sleep 1; done
done < $E/census/keys.txt
wait
echo CENSUS-DONE
