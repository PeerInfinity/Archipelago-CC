#!/bin/bash
# SCRATCH (SF3 M2): the re-record table's rows, OFF then ON (SEEDLING_STRIKE_ETA_FLOOR=1), sequential, after M1.
S=${S:?}; R=/home/user/Archipelago-CC; cd $R
log() { echo "$(date +%T) load $(cut -d' ' -f1 /proc/loadavg) $*" >> $S/m2.log; }
for m in off on; do
  e=""; [ $m = on ] && e="SEEDLING_STRIKE_ETA_FLOOR=1"
  log "identity $m start"
  env $e SEEDLING_PORT=9587 bash scripts/procgen/identity-block.sh . > $S/identity-$m.txt 2> $S/identity-$m.err; log "identity $m rc=$?"
  log "vitest $m start"
  env $e npx vitest run $(cat $S/vitest-files-sf2.txt) > $S/vitest-sf2-$m.txt 2>&1; log "vitest-sf2 $m rc=$?"
  env $e npx vitest run $(cat $S/vitest-files-new.txt) > $S/vitest-new-$m.txt 2>&1; log "vitest-new $m rc=$?"
  log "producers $m start"
  env $e node scripts/procgen/ci-producer-checks.mjs --jobs=4 > $S/producers-$m.txt 2>&1; log "producers $m rc=$?"
done
log M2-DONE
