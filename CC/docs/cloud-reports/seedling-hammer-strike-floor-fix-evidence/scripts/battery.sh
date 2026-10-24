#!/bin/bash
# SCRATCH (SFF2): battery at the current tree. OUT=dir, MODES="on off", PARTS="identity producers vitest"
S=/tmp/claude-0/-home-user-Archipelago-CC/10647883-4400-56c1-99d0-f964881444b6/scratchpad; O=${OUT:?}; cd /home/user/Archipelago-CC
log() { echo "$(date +%T) load $(cut -d' ' -f1 /proc/loadavg) $*" >> $O/battery.log; }
for m in ${MODES:-on off}; do
  e="SEEDLING_STRIKE_ETA_FLOOR=0"; [ $m = on ] && e="SEEDLING_STRIKE_ETA_FLOOR=1"
  for p in ${PARTS:-identity producers vitest}; do
    log "$p $m start"
    case $p in
      identity) env $e SEEDLING_PORT=9587 bash scripts/procgen/identity-block.sh . > $O/identity-$m.txt 2> $O/identity-$m.err ;;
      producers) env $e node scripts/procgen/ci-producer-checks.mjs --jobs=4 > $O/producers-$m.txt 2>&1 ;;
      vitest) env $e npx vitest run --maxWorkers=3 $(cat ${FILES:-$S/bounded.txt}) > $O/vitest-$m.txt 2>&1 ;;
    esac
    log "$p $m rc=$?"
  done
done
log DONE
