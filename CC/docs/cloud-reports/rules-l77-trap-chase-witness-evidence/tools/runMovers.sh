#!/usr/bin/env bash
# rules-l77-trap-chase-witness: beam every mover row (boot x goal) on the JS model; tapes to tapes/movers/, logs to runs/movers/.
# usage: tools/runMovers.sh [<id-regex>]   (2 rows in parallel)
set -u
D=CC/docs/cloud-reports/rules-l77-trap-chase-witness-evidence
mkdir -p $D/tapes/movers $D/runs/movers
node $D/tools/movers.mjs | grep -E "${1:-.}" | python3 -c "
import sys,json
for l in sys.stdin:
    r=json.loads(l)
    for bi,b in enumerate(r['boots']):
        for gi,g in enumerate(r['goals']):
            name=r['id']+('' if len(r['boots'])==1 else '-b%d'%bi)+('' if len(r['goals'])==1 else '-g%d'%gi)
            lava='--lava' if 'hasDarkSuit' in r['items'] else ''
            print(name, b, g, ','.join(r['items']) or '-', lava)
" | xargs -P 2 -L 1 bash -c 'it=$3; [ "$it" = "-" ] && it=""; timeout 900 node '$D'/tools/chase/beam.mjs --boot=$1 --goal=$2 --items=$it $4 --width=32 --seg=4 --depth=150 --margin=2 --out='$D'/tapes/movers/$0.tape.json > '$D'/runs/movers/$0.log 2>&1; echo "$0 $(tail -1 '$D'/runs/movers/$0.log | cut -c1-260)"'
