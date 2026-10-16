#!/bin/bash
H=/tmp/claude-0/w/hammer
while [ ! -f /tmp/claude-0/w/bounded.done ]; do sleep 20; done
for wl in A-sword A-ghost leg-397-ghost leg-414-ghost leg-108-sword l18 ghost-sweep; do
  ROOT=/home/user/base-wt TAG=base bash $H/lab-run.sh base $wl
  ROOT=/home/user/Archipelago-CC TAG=on SEEDLING_ARROW_LANE_CROSSING=1 bash $H/lab-run.sh on $wl
  ROOT=/home/user/Archipelago-CC TAG=off bash $H/lab-run.sh off $wl
done
echo ALLDONE > $H/all.done
