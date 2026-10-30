#!/bin/bash
# scratch (L40C): the route survey (--through=end) under each arm, sequentially. Usage: survarm.sh <outdir> <arm>...
T="$(cd "$(dirname "$0")" && pwd)"; O=$1; shift; R="$T/../../../../.."
for A in "$@"; do
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  s=$(date +%s); (cd "$R" && env $ENVS node scripts/procgen/survey-seedling-route.mjs --through=end --out="$O/survey-$A.json" > "$O/survey-$A.log" 2>&1)
  echo "survey $A rc=$? $(( $(date +%s)-s ))s"
done
