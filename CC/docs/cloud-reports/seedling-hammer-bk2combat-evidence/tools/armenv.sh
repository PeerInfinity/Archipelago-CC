#!/bin/bash
# scratch (BK2COMBAT, from POCKET-BURN's): the env of each arm. Usage: armenv <arm> -> "K=V ..." for `env`.
# D0 = defaults (CPAIR-3 default ON); F = LWF + TA + SD + FO + SB (POCKET-BURN's five switches, the brief's replay arm).
# Suffixes: +BC = this slice's switch (SEEDLING_BK2_COMBAT). +X<NAME> = an extra scratch env NAME=1.
LW="SEEDLING_LATCH_WEIGH_FIRST=1"; TA="SEEDLING_TURRET_APPROACH=1"; SD="SEEDLING_APPROACH_DOOR=1"; FO="SEEDLING_FIFTH_ORDER=1"
SB="SEEDLING_STANCE_BURN=1"; BC="SEEDLING_BK2_COMBAT=1"
IFS=- read -r B REST <<< "$1"
case "$B" in D0) OUT="BK2_ARM=D0" ;; F) OUT="$LW $TA $SD $FO $SB" ;; *) echo "unknown arm $B" >&2; exit 1 ;; esac
for s in $(echo "$REST" | tr '+' ' '); do case "$s" in BC) OUT="$OUT $BC";; X*) OUT="$OUT ${s#X}=1";; *) echo "unknown suffix $s" >&2; exit 1;; esac; done
echo "$OUT"
