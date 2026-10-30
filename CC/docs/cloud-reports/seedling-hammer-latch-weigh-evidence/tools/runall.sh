#!/bin/bash
# scratch: the latch chain under each switch set; one output file per arm
cd "$(dirname "$0")"
L=SEEDLING_LATCH_WEIGH_FIRST=1
CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"
IC=SEEDLING_ICETURRET_STATIC_KILL=1
OP=SEEDLING_OPPORTUNISTIC_STRIKE=1
OF="SEEDLING_ORBIT_FREE_AIM=1 SEEDLING_STRATEGY_BOUND_DISTINCT=1"
run() { name=$1; shift; env "$@" node latch.mjs > "m-$name.txt" 2>&1 & }
run on $L
run off-all $CP $IC $OP
run on-all $L $CP $IC $OP
run on-cp3 $L $CP
wait
run on-of $L $OF
run on-icest $L $IC
run on-opp $L $OP
run on-allof $L $CP $IC $OP $OF
wait
run pocket-off AT=480,456
run pocket-on AT=480,456 $L
wait
