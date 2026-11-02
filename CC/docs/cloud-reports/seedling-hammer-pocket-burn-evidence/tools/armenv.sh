#!/bin/bash
# scratch (POCKET-BURN, from SOUTHDOOR's armenv.sh): the env of each arm. Usage: armenv <arm> -> "K=V ..." for `env`.
# CPAIR-3 is the default on this main. Base: D0 = defaults; F = LWF + TA + SD + FO (the brief's replay arm).
# Suffixes: +SB = this slice's STANCE_BURN (design 2); +TH = the scratch tree hypothesis (design 1, never committed).
LW="SEEDLING_LATCH_WEIGH_FIRST=1"; TA="SEEDLING_TURRET_APPROACH=1"; SD="SEEDLING_APPROACH_DOOR=1"; FO="SEEDLING_FIFTH_ORDER=1"
SB="SEEDLING_STANCE_BURN=1"; TH="SCRATCH_TREE_HYP=1"
IFS=- read -r B REST <<< "$1"
case "$B" in D0) OUT="POCKET_ARM=D0" ;; F) OUT="$LW $TA $SD $FO" ;; *) echo "unknown arm $B" >&2; exit 1 ;; esac
for s in $(echo "$REST" | tr '+' ' '); do case "$s" in SB) OUT="$OUT $SB";; TH) OUT="$OUT $TH";; *) echo "unknown suffix $s" >&2; exit 1;; esac; done
echo "$OUT"
