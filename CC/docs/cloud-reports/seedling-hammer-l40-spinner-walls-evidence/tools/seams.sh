#!/bin/bash
# seams.sh <arm nocarry|carry> <key L39|L43> <from> <to> <out.jsonl> : the worker's dispatch at each arrival clock (env passes through)
S=$(dirname "$0")/..
for s in $(seq $3 $4); do timeout 900 node $S/tools/solve.mjs --req=$S/req-$1.jsonl --key=in_$2 --seam=$s 2>/dev/null >> $5 || echo "{\"seam\":$s,\"err\":true}" >> $5; done
