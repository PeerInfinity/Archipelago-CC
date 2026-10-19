#!/bin/bash
# usage: run1.sh <producer> <mode: pin|unpin>
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/6f8cb257-c0d0-5512-9faf-5f8714505200/scratchpad
f=$1; m=$2
echo "start $(date +%T)" > /dev/null
if [ $m = pin ]; then
  node scripts/procgen/plan-seedling-$f.mjs --check > $S/logs/$f.pin.log 2>&1; echo "exit $? at $(date +%T)" >> $S/logs/$f.pin.log
else
  mkdir -p $S/out/$f; SCRATCH_OUT=$S/out/$f node scripts/procgen/zz-scratch-unpin-$f.mjs > $S/logs/$f.unpin.log 2>&1; echo "exit $? at $(date +%T)" >> $S/logs/$f.unpin.log
fi
