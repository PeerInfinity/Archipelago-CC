#!/bin/bash
# scratch (L40C): the two L40 hammer producer pins under single switches. Usage: pins.sh <outdir> "<name>=<env>"...
O=$1; shift; R="$(cd "$(dirname "$0")/../../../../.." && pwd)"
for spec in "$@"; do
  name=${spec%%=*}; X=${spec#*=}
  for p in plan-seedling-hammer-g1-ghostkill plan-seedling-hammer-sf-strikefloor; do
    (cd "$R" && env $X node scripts/procgen/$p.mjs --check > "$O/pin-$name-$p.txt" 2>&1; echo "pin $name $p rc=$?") &
  done; wait
done
