#!/bin/bash
# scratch (L40C): the latch chain and ICEST's pocket boot under each arm, sequentially. Usage: latchall.sh <outdir> <arm>...
T="$(cd "$(dirname "$0")" && pwd)"; O=$1; shift; mkdir -p "$O"
for A in "$@"; do
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  s=$(date +%s); env $ENVS OUT="$O/latch-$A.keys.json" timeout 2400 node "$T/latch.mjs" > "$O/latch-$A.txt" 2>&1; echo "latch $A rc=$? $(( $(date +%s)-s ))s"
  s=$(date +%s); env $ENVS AT=480,456 timeout 2400 node "$T/latch.mjs" > "$O/pocket-$A.txt" 2>&1; echo "pocket $A rc=$? $(( $(date +%s)-s ))s"
done
