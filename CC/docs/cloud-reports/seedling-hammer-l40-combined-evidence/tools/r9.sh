#!/bin/bash
# scratch (L40C): solve-seedling-r9-campaign --check under each arm, sequentially. Usage: r9.sh <outdir> <arm>...
T="$(cd "$(dirname "$0")" && pwd)"; O=$1; shift; R="$T/../../../../.."
for A in "$@"; do
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  s=$(date +%s); (cd "$R" && env $ENVS node scripts/procgen/solve-seedling-r9-campaign.mjs --check > "$O/r9-$A.txt" 2>&1); rc=$?
  echo "r9 $A rc=$rc $(( $(date +%s)-s ))s md5=$(grep -av '[0-9]\+ *ms\|took' "$O/r9-$A.txt" | md5sum | cut -c1-12) $(tail -1 "$O/r9-$A.txt" | cut -c1-120)"
done
