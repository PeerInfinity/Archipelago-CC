#!/usr/bin/env bash
# SCRATCH (PKB): the L40 radius, P1's tree vs P2's — every captured request of every L40 leg replayed at its OWN seam,
# at the defaults, in a fresh node process per (arm, leg, request); RESULT -> <out> tagged with the arm. Resumable:
# a (arm, id, i) already in <out> is skipped. Usage: l40-radius-trees.sh <requests.jsonl> <out.jsonl> <jobs>
set -u
req=$1; out=$2; jobs=$3
D="$(dirname "$0")"
touch "$out"
python3 -c "
import json
have={(r['arm'],r['id'],r['i']) for r in map(json.loads, open('$out')) }
for l in open('$req'):
    d=json.loads(l)
    for q in d['requests']:
        for arm,tool in (('P1','$D/../tools-p1/l371-solve.mjs'),('P2','$D/l371-solve.mjs')):
            if (arm,d['id'],q['i']) not in have: print(arm,tool,d['id'],q['i'])
" | xargs -r -P "$jobs" -L1 sh -c 'node "$1" --requests="'"$req"'" --id=$2 --i=$3 | grep "^RESULT " | cut -c8- | sed "s/^{/{\"arm\":\"$0\",/" >> "'"$out"'"'
