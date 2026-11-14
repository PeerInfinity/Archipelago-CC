#!/bin/bash
# onlist.sh <tag> <arm> <key> <seam...> : SHOVED_BODY_LOOKAHEAD ON at each clock (env passes through), one JSON line each
S=$(dirname "$0")/..
tag=$1; arm=$2; key=$3; shift 3
for s in "$@"; do SEEDLING_SHOVED_BODY_LOOKAHEAD=1 timeout 1200 node $S/tools/solve.mjs --req=$S/req-$arm.jsonl --key=in_$key --seam=$s 2>/dev/null >> $S/on-$tag.jsonl || echo "{\"seam\":$s,\"err\":true}" >> $S/on-$tag.jsonl; done
