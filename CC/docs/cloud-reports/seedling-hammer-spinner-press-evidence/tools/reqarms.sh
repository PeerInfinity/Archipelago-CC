#!/bin/bash
# scratch (SPIN, from L40C's reqall.sh): every captured request under <arm>[+spin], N shards at once.
# Usage: reqarms.sh <capture.jsonl> <outdir> <N> <arm>[+spin] ...   (+spin adds SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1)
T="$(cd "$(dirname "$0")" && pwd)"; CAP=$1; O=$2; N=$3; shift 3; mkdir -p "$O"
for spec in "$@"; do
  A=${spec%+spin}; X=""; [ "$spec" != "$A" ] && X="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1"
  ENVS=$(bash "$T/armenv.sh" "$A") || continue
  rm -f "$O/req-$spec".*.jsonl; s=$(date +%s)
  for i in $(seq 0 $((N-1))); do env $ENVS $X node "$T/arms.mjs" --requests="$CAP" --out="$O/req-$spec.$i.jsonl" --shard=$i/$N > "$O/req-$spec.$i.log" 2>&1 & done
  wait; cat "$O/req-$spec".*.jsonl > "$O/req-$spec.jsonl"; rm -f "$O/req-$spec".?.jsonl
  echo "req $spec $(wc -l < "$O/req-$spec.jsonl") rows $(( $(date +%s)-s ))s"
done
