#!/usr/bin/env bash
# rules-l77-trap-chase-witness: beam every mover row (boot x goal) on the JS model; tapes to tapes/movers/, logs to
# runs/movers/. Skips a row whose log already ends in a BEAM line. 2 rows in parallel.
# usage: tools/runMovers.sh [<id-regex>]
# (an earlier xargs -L 1 version joined lines ending in a blank field and skipped every row after an item-less one)
set -u
# WIDE=1: a second pass over the rows whose first pass said NO MODEL ROUTE (width 96, seg 3, depth 300, 25 min), logs *-wide.log
SUF=''; ARGS='--width=32 --seg=4 --depth=150'; TO=900
if [ -n "${WIDE:-}" ]; then SUF='-wide'; ARGS='--width=96 --seg=3 --depth=300'; TO=1500; fi
D=CC/docs/cloud-reports/rules-l77-trap-chase-witness-evidence
mkdir -p $D/tapes/movers $D/runs/movers
one() {
    local name=$1 boot=$2 goal=$3 items=$4 lava=$5
    [ "$items" = "-" ] && items=""; [ "$lava" = "-" ] && lava=""
    if grep -q "^BEAM" "$D/runs/movers/$name$SUF.log" 2>/dev/null; then return; fi
    if [ -n "$SUF" ] && ! grep -q "NO MODEL ROUTE" "$D/runs/movers/$name.log" 2>/dev/null; then return; fi
    timeout $TO node $D/tools/chase/beam.mjs --boot=$boot --goal=$goal --items=$items $lava $ARGS --margin=2 \
        --out=$D/tapes/movers/$name$SUF.tape.json > $D/runs/movers/$name$SUF.log 2>&1
    echo "$name$SUF $(tail -1 $D/runs/movers/$name$SUF.log | cut -c1-260)"
}
node $D/tools/movers.mjs | grep -E "${1:-.}" | python3 -c "
import sys,json
for l in sys.stdin:
    r=json.loads(l)
    for bi,b in enumerate(r['boots']):
        for gi,g in enumerate(r['goals']):
            name=r['id']+('' if len(r['boots'])==1 else '-b%d'%bi)+('' if len(r['goals'])==1 else '-g%d'%gi)
            print(name, b, g, ','.join(r['items']) or '-', '--lava' if 'hasDarkSuit' in r['items'] else '-')
" > $D/runs/movers-rows.txt
n=0
while read -r name boot goal items lava; do
    one "$name" "$boot" "$goal" "$items" "$lava" &
    n=$((n + 1)); if [ $((n % 2)) -eq 0 ]; then wait; fi
done < $D/runs/movers-rows.txt
wait
