#!/bin/bash
# table.sh <tag> <legs "L39 L43"> <from> <to> [-P jobs=4] : every (leg, clock) solved by clock.mjs with the env passed
# through, 4 at a time, into ../clocks/<tag>.jsonl (one line each; a crash or a 1800 s timeout is an {err} line).
S=$(cd "$(dirname "$0")/.." && pwd); tag=$1; legs=$2; from=$3; to=$4; P=${5:-4}
out=$S/clocks/$tag.jsonl; : > "$out"
for l in $legs; do for s in $(seq "$from" "$to"); do echo "$l $s"; done; done \
  | xargs -P "$P" -L 1 bash -c 'timeout 1800 node '"$S"'/tools/clock.mjs --leg=$0 --seam=$1 2>/dev/null >> '"$out"' || echo "{\"leg\":\"$0\",\"seam\":$1,\"err\":true}" >> '"$out"
