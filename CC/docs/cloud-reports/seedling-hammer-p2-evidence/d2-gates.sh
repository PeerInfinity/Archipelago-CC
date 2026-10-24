#!/bin/bash
cd /home/user/Archipelago-CC
for m in on off; do
  E=X=1; [ $m = off ] && E=SEEDLING_STRIKE_SCAN_COST=0
  ( env $E node scripts/procgen/sweep-seedling-l18-residues.mjs --json=$S/l18-$m.json > $S/l18-$m.txt 2>&1;
    env $E node CC/docs/cloud-reports/seedling-hammer-c2-evidence/scripts/ghost-sweep.mjs > $S/ghost-sweep-$m.txt 2>&1;
    for t in r9-solve-18 r8-solve-18; do env $E node CC/docs/cloud-reports/seedling-hammer-c2-evidence/scripts/stage-ghost.mjs --tape=$t > $S/stage-ghost-$t-$m.txt 2>&1; done;
    env $E node scripts/procgen/solve-seedling-r9-campaign.mjs --check > $S/campaign-$m.txt 2>&1; echo "rc $?" >> $S/campaign-$m.txt ) &
done
wait
echo done > $S/gates.done
