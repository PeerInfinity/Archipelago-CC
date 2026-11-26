#!/bin/bash
# MEASUREMENT-ONLY (chaser-stand): variant env sets on top of the base defaults (LHM ON at base e06722c153).
# usage: source variants.sh; venv <name>.  OAC = SEEDLING_OPP_AIM_CHASERS, PSB = SEEDLING_PRESS_KILL_STRIKE_BOMBS.
A4="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1"
PP="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1"
PS="SEEDLING_PRESS_KILL_START_WAIT=1"
OAC="SEEDLING_OPP_AIM_CHASERS=1"; PSB="SEEDLING_PRESS_KILL_STRIKE_BOMBS=1"
venv() { case $1 in
  off) echo "";;
  oac) echo "$OAC";; psb) echo "$PSB";; both) echo "$OAC $PSB";;
  all4) echo "$A4";; all4oac) echo "$A4 $OAC";; all4psb) echo "$A4 $PSB";; all4both) echo "$A4 $OAC $PSB";;
  pp) echo "$PP";; ppoac) echo "$PP $OAC";; pppsb) echo "$PP $PSB";; ppboth) echo "$PP $OAC $PSB";;
  ps) echo "$PS";; psoac) echo "$PS $OAC";; pspsb) echo "$PS $PSB";; psboth) echo "$PS $OAC $PSB";;
  *) echo "BAD_VARIANT=1";; esac; }
VARIANTS=${VARIANTS:-"off all4 all4oac all4both"}
