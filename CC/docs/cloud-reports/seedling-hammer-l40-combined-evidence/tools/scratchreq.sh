#!/bin/bash
# scratch (L40C): selected captured requests under SCRATCH arms. Usage: scratchreq.sh <cap> <outdir> <ids> <name>=<arm>:<extra env>...
T="$(cd "$(dirname "$0")" && pwd)"; CAP=$1; O=$2; IDS=$3; shift 3; mkdir -p "$O"
for spec in "$@"; do
  name=${spec%%=*}; rest=${spec#*=}; A=${rest%%:*}; X=${rest#*:}
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  rm -f "$O/req-$name.jsonl"; s=$(date +%s)
  env $ENVS $X node "$T/arms.mjs" --requests="$CAP" --out="$O/req-$name.jsonl" --ids="$IDS" > "$O/req-$name.log" 2>&1
  echo "scratchreq $name $(( $(date +%s)-s ))s"
done
