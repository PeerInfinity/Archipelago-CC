#!/usr/bin/env bash
# rules-deterministic-boss-draws: the single-site B options (each = option A with ONE site switched), Sword, orbit nw2.
E=CC/docs/cloud-reports/rules-deterministic-boss-draws-evidence
for v in aim=zero scale=mean barrage=vdc grenade=room; do
  n=B-${v/=/-}
  DET_OWL=$v node $E/tools/owl-executor.mjs --weapon=sword --seed=101 --orbit=nw2 --out=$E/tapes/det-owl-sword-$n.json \
    --report=$E/logs/plan-det-sword-$n.json > $E/logs/plan-det-sword-$n-nw2.log 2>&1
  echo "$n exit $?"
done
