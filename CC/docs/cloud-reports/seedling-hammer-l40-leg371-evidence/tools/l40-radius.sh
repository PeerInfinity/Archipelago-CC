#!/usr/bin/env bash
# Measure-only (slice L371): the blast radius on L40. Every captured request of every L40 leg (`--capture-requests`
# of the page probe), replayed at its OWN seam in a fresh node process per (arm, leg, request), RESULT → <out> with
# the arm's name. Usage: l40-radius.sh <requests.jsonl> <out.jsonl> <jobs>
set -u
req=$1; out=$2; jobs=$3
tool="$(dirname "$0")/l371-solve.mjs"
python3 -c "
import json,sys
for l in open('$req'):
    d=json.loads(l)
    for q in d['requests']:
        for a in ('default=L371_ARM_DEFAULT=1','pressKillBombs-ON=SEEDLING_PRESS_KILL_BOMBS=1','strikeEtaFloor-ON=SEEDLING_STRIKE_ETA_FLOOR=1'):
            n,e=a.split('=',1); print(n,e,d['id'],q['i'])
" | xargs -P "$jobs" -L1 sh -c 'env $1 node "'"$tool"'" --requests="'"$req"'" --id=$2 --i=$3 | grep "^RESULT " | cut -c8- | sed "s/^{/{\"arm\":\"$0\",/" >> "'"$out"'"'
