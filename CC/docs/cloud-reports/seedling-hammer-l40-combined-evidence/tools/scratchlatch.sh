#!/bin/bash
# scratch (L40C): the latch chain under SCRATCH arms (needs tools/scratch.patch applied). Usage: scratchlatch.sh <outdir> <name>=<arm>:<extra env>...
T="$(cd "$(dirname "$0")" && pwd)"; O=$1; shift; mkdir -p "$O"
for spec in "$@"; do
  name=${spec%%=*}; rest=${spec#*=}; A=${rest%%:*}; X=${rest#*:}
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  s=$(date +%s); env $ENVS $X OUT="$O/latch-$name.keys.json" timeout 3600 node "$T/latch.mjs" > "$O/latch-$name.txt" 2>&1; echo "scratch $name rc=$? $(( $(date +%s)-s ))s"
done
