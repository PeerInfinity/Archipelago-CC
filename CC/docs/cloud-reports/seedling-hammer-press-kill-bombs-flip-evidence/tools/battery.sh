#!/bin/bash
# SCRATCH (PKB): battery at the current tree. OUT=dir, MODES="dflt on off" (dflt = no env; on = =1; off = =0),
# PARTS="identity producers vitest", FILES=<list>
S=/tmp/claude-0/-home-user-Archipelago-CC/a99380a2-6002-5d1d-b8ac-a23d951225da/scratchpad; O=${OUT:?}; mkdir -p $O; cd /home/user/Archipelago-CC
log() { echo "$(date +%T) load $(cut -d' ' -f1 /proc/loadavg) $*" >> $O/battery.log; }
for m in ${MODES:-dflt on}; do
  case $m in dflt) e="PKB_ARM=dflt";; on) e="SEEDLING_PRESS_KILL_BOMBS=1";; off) e="SEEDLING_PRESS_KILL_BOMBS=0";; esac
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
