#!/bin/bash
# SCRATCH (SFF W0): SF3's M2 battery at the guards-ON base, OFF then ON (SEEDLING_STRIKE_ETA_FLOOR=1), sequential.
S=${S:?}; R=/home/user/Archipelago-CC; cd $R
log() { echo "$(date +%T) load $(cut -d' ' -f1 /proc/loadavg) $*" >> $S/m2.log; }
for m in ${MODES:-off on}; do
  e="SEEDLING_STRIKE_ETA_FLOOR=0"; [ $m = on ] && e="SEEDLING_STRIKE_ETA_FLOOR=1"
  log "identity $m start"
  env $e SEEDLING_PORT=9587 bash scripts/procgen/identity-block.sh . > $S/identity-$m.txt 2> $S/identity-$m.err; log "identity $m rc=$?"
  env $e npx vitest run --maxWorkers=3 $(cat $S/vitest-files-sf2.txt) > $S/vitest-sf2-$m.txt 2>&1; log "vitest-sf2 $m rc=$?"
  env $e npx vitest run --maxWorkers=3 $(cat $S/vitest-files-new.txt) > $S/vitest-new-$m.txt 2>&1; log "vitest-new $m rc=$?"
  env $e node scripts/procgen/ci-producer-checks.mjs --jobs=4 > $S/producers-$m.txt 2>&1; log "producers $m rc=$?"
done
log W0-DONE
