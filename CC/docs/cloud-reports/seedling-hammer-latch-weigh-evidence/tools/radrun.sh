#!/bin/bash
# scratch: the capture replayed in 4 shards under the env ($1 = arm name)
cd "$(dirname "$0")"
for i in 0 1 2 3; do LW_TRACE=1 env $ENVX node radius.mjs --requests=../cap.jsonl --out=rad-$1.$i.jsonl --shard=$i/4 > rad-$1.$i.log 2>&1 & done
wait
cat rad-$1.?.jsonl > rad-$1.jsonl
