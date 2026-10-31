#!/bin/bash
# scratch (L40C): the env of each arm. Usage: armenv <arm>  -> prints "K=V ..." for `env`
CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"
IC="SEEDLING_ICETURRET_STATIC_KILL=1"
OP="SEEDLING_OPPORTUNISTIC_STRIKE=1"
LW="SEEDLING_LATCH_WEIGH_FIRST=1"
OF="SEEDLING_ORBIT_FREE_AIM=1"
SB="SEEDLING_STRATEGY_BOUND_DISTINCT=1"
case "$1" in
  A0) echo "L40C_ARM=A0" ;;
  A1) echo "$CP" ;;
  A2) echo "$CP $IC" ;;
  A3) echo "$CP $IC $OP" ;;
  A4) echo "$CP $IC $OP $LW" ;;
  A5) echo "$CP $IC $OP $LW $OF $SB" ;;
  A5-CP) echo "$IC $OP $LW $OF $SB" ;;
  A5-IC) echo "$CP $OP $LW $OF $SB" ;;
  A5-OP) echo "$CP $IC $LW $OF $SB" ;;
  A5-LW) echo "$CP $IC $OP $OF $SB" ;;
  A5-OF) echo "$CP $IC $OP $LW $SB" ;;
  A5-SB) echo "$CP $IC $OP $LW $OF" ;;
  *) echo "unknown arm $1" >&2; exit 1 ;;
esac
