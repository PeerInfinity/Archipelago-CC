#!/bin/bash
# scratch (SPIN): one leg's captured requests under an arm, a budget, a seam and the switch. Runs N jobs at once.
# Usage: spinmatrix.sh <capture.jsonl> <outdir> <jobs> <leg>:<arm>:<budget|->:<seam|->:<on|off> ...
T="$(cd "$(dirname "$0")" && pwd)"; CAP=$1; O=$2; J=$3; shift 3; mkdir -p "$O"
for spec in "$@"; do
  IFS=: read -r LEG A B SEAM SW <<< "$spec"
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  X=""; [ "$B" != "-" ] && X="$X L40C_BUDGET_WORK=$B"; [ "$SEAM" != "-" ] && X="$X SPIN_SEAM=$SEAM"
  [ "$SW" = on ] && X="$X SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1"
  name="$LEG-$A-b$B-s$SEAM-$SW"
  ( env $ENVS $X node "$T/arms.mjs" --requests="$CAP" --ids="$LEG" --out="$O/$name.jsonl" > "$O/$name.log" 2>&1; echo "$name $(tail -n 2 "$O/$name.log" | tr '\n' ' ')" ) &
  while [ "$(jobs -rp | wc -l)" -ge "$J" ]; do sleep 2; done
done
wait
