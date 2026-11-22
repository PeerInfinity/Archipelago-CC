#!/usr/bin/env bash
# rules-l112-owl-executor Q4: plan one weapon over a seed list (sequentially), one tape + report per seed.
# A seed with no plan on the first orbit is retried on the others (a NOPLAN is the PLANNER's, not the game's).
#   bash sweep.sh <weapon> <seed> [<seed> ...]
E=CC/docs/cloud-reports/rules-l112-owl-executor-evidence
w=$1; shift
for s in "$@"; do
  for o in ${ORBITS:-nw2 se nw}; do
    [ -f $E/logs/plan-$w-s$s.json ] && grep -q '"ok": true' $E/logs/plan-$w-s$s.json && break
    node $E/tools/owl-executor.mjs --weapon=$w --seed=$s --orbit=$o --out=$E/tapes/owl-$w-s$s.json \
      --budget-sec=${BUDGET:-900} --report=$E/logs/plan-$w-s$s.json > $E/logs/plan-$w-s$s-$o.log 2>&1
    echo "$w s$s orbit $o exit $?"
  done
done
