#!/bin/bash
cd /tmp/claude-0/c4b
jobs=()
for id in 622 624 626 628 629; do for lapse in 0 1; do for mode in none append probe; do
  echo "$id $lapse $mode"
done; done; done | xargs -P 4 -L 1 bash -c 'id=$0; lapse=$1; mode=$2; ev=(); [ $lapse = 1 ] && ev+=(SEEDLING_STRIKE_IFRAME_LAPSE=1); [ $mode != none ] && ev+=(C4B_MODE=$mode); ./run.sh m-$id-L$lapse-$mode $id "${ev[@]}" X=1'
echo MATRIX DONE
