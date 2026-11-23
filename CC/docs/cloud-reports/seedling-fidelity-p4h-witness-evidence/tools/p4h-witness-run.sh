#!/bin/bash
# Local p4h witness MEASURE pass (Robert GO 2026-11-22T23:40Z). Records game samples on p4h into an UNTRACKED dir;
# nothing is committed. One fresh page per tape (the probe opens one per run).
W=/home/robert/CC/Archipelago-CC-wt-fidelity-p4h-witness
S=/tmp/claude-1000/-home-robert-CC-Archipelago-CC/027b9cf8-4743-46eb-908d-8c988113baa3/scratchpad
PORT=$1
cd $W
FX=frontend/modules/seedlingDemo/fixtures
mkdir -p $FX/tbw-p4h-scratch $S/p4h-tapes
for f in $FX/tentaclebeast-witness/*.json $FX/whirlpool-witness/*.json; do
  n=$(basename $f .json)
  python3 -c "import json,sys;json.dump(json.load(open(sys.argv[1]))['tape'],open(sys.argv[2],'w'))" $f $S/p4h-tapes/$n.json
done
for f in $FX/p4h-tb-plans/*.json; do cp $f $S/p4h-tapes/; done
for t in $S/p4h-tapes/*.json; do
  n=$(basename $t .json)
  echo "== $n $(date +%T)"
  SEEDLING_PORT=$PORT SEEDLING_PAGE=seedling_bot_ap_p4h timeout 1800 node scripts/procgen/probe-seedling-bosskills.mjs --file=$t --record --name=$n --dir=tbw-p4h-scratch 2>&1 | tail -4
done
echo DONE
