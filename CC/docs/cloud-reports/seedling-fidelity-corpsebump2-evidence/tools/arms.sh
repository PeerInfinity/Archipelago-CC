#!/bin/bash
# D2 table + the disagreement arm; one file per arm. $1 = tag (before/after)
cd /tmp/claude-0/cb
T=$1
L=SEEDLING_LATCH_WEIGH_FIRST=1
CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"
TA=SEEDLING_TURRET_APPROACH=1
OF="SEEDLING_ORBIT_FREE_AIM=1"
run() { name=$1; shift; env "$@" node latch.mjs > "$T-$name.txt" 2>&1 & }
run base X=1
run L $L
run CP $CP
run TA $TA
wait
run L-CP $L $CP
run L-TA $L $TA
run CP-TA $CP $TA
run L-CP-TA $L $CP $TA
wait
run L-CP-OF $L $CP $OF
run L-CP-TA-OF $L $CP $TA $OF
run CP-OF $CP $OF
run L-OF $L $OF
wait
