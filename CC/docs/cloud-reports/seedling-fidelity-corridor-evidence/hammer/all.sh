#!/bin/bash
# base (base worktree), on (this tree, corridorBodyPricing=1), off (this tree, default) — the six hammer workloads
H=/tmp/claude-0/-home-user-Archipelago-CC/e1f8ea7c-6ce7-5606-8d32-f0c078a14144/scratchpad/hammer
for wl in A-sword A-ghost leg-397-ghost leg-414-ghost l18 ghost-sweep; do
  ROOT=/home/user/base-wt TAG=base bash $H/lab-run.sh base $wl
  ROOT=/home/user/Archipelago-CC TAG=on SEEDLING_CORRIDOR_BODY_PRICING=1 bash $H/lab-run.sh on $wl
  ROOT=/home/user/Archipelago-CC TAG=off bash $H/lab-run.sh off $wl
done
echo ALLDONE
