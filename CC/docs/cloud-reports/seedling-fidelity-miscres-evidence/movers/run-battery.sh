#!/bin/bash
# run the `standard` probe battery from tree $1 against host $2, one probe at a time
T="$1"; H="$2"; cd "$T" || exit 1
node -e "const b=require('./scripts/procgen/seedling-probe-batteries.json').batteries.standard;for(const e of b)console.log(e.probe+'\t'+e.args)" | while IFS=$'\t' read -r p a; do
  echo "== $p $a"
  out=$(timeout 2400 node scripts/procgen/$p --host=$H $a 2>&1); rc=$?
  echo "$out" > "/tmp/claude-0/mv/probe-$(basename $p .mjs).log"
  echo "rc=$rc $(echo "$out" | grep -ac '^PASS') PASS $(echo "$out" | grep -ac '^FAIL') FAIL $(echo "$out" | grep -a 'ALL CHECKS PASSED\|CHECK(S) FAILED' | tail -1)"
done
echo ALLDONE
