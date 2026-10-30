#!/bin/bash
# scratch (L40C): every captured request under each arm, N shards at once. Usage: reqall.sh <cap> <outdir> <N> <arm>...
T="$(cd "$(dirname "$0")" && pwd)"; CAP=$1; O=$2; N=$3; shift 3; mkdir -p "$O"
for A in "$@"; do
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  rm -f "$O/req-$A".*.jsonl; s=$(date +%s)
  for i in $(seq 0 $((N-1))); do env $ENVS node "$T/arms.mjs" --requests="$CAP" --out="$O/req-$A.$i.jsonl" --shard=$i/$N > "$O/req-$A.$i.log" 2>&1 & done
  wait; cat "$O/req-$A".?.jsonl > "$O/req-$A.jsonl"; rm -f "$O/req-$A".?.jsonl
  echo "req $A $(wc -l < "$O/req-$A.jsonl") rows $(( $(date +%s)-s ))s"
done
