#!/bin/bash
# scratch: the latch chain's switch arms, re-run with the hit guard in place
cd "$(dirname "$0")"
L=SEEDLING_LATCH_WEIGH_FIRST=1
CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"
IC=SEEDLING_ICETURRET_STATIC_KILL=1
OP=SEEDLING_OPPORTUNISTIC_STRIKE=1
OF="SEEDLING_ORBIT_FREE_AIM=1 SEEDLING_STRATEGY_BOUND_DISTINCT=1"
run() { name=$1; shift; env "$@" OUT=g-$name.json timeout 1500 node latch.mjs > "g-$name.txt" 2>&1 & }
run on-all $L $CP $IC $OP
run on-allof $L $CP $IC $OP $OF
wait
run on-cp3of $L $CP $OF
run off-allof $CP $IC $OP $OF
wait
