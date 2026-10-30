#!/bin/bash
# scratch (L40C): one arm over the capture (N shards), the latch chain and the pocket boot.
# Usage: runarm.sh <arm> <capture.jsonl> <outdir> [shards=3]
T="$(cd "$(dirname "$0")" && pwd)"; A=$1; CAP=$2; O=$3; N=${4:-3}
mkdir -p "$O"; ENVS=$(bash "$T/armenv.sh" "$A") || exit 1
rm -f "$O/req-$A".*.jsonl
for i in $(seq 0 $((N-1))); do env $ENVS node "$T/arms.mjs" --requests="$CAP" --out="$O/req-$A.$i.jsonl" --shard=$i/$N > "$O/req-$A.$i.log" 2>&1 & done
env $ENVS OUT="$O/latch-$A.keys.json" timeout 2400 node "$T/latch.mjs" > "$O/latch-$A.txt" 2>&1 &
wait
env $ENVS AT=480,456 timeout 2400 node "$T/latch.mjs" > "$O/pocket-$A.txt" 2>&1
cat "$O/req-$A".?.jsonl > "$O/req-$A.jsonl"; rm -f "$O/req-$A".?.jsonl
echo "ARM $A done"
