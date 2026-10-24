#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/db8997fd-051c-55e6-975e-a574208b0427/scratchpad
O=$S/d3/rounds.jsonl; : > $O
for r in 1 2 3; do
  for t in "r5-l40-part5|--goal=collect:160,640" "r9-solve-18|--goal=exit:176,112 --residue=21"; do
    tape=${t%%|*}; g=${t#*|}
    for arm in after-none after-100 base-100; do
      case $arm in after-*) R=$S/wt;; base-*) R=/home/user/Archipelago-CC;; esac
      iv=${arm#*-}
      l=$(cut -d' ' -f1 /proc/loadavg)
      j=$(cd $R && REPO=$R node $S/hbprobe.mjs --tape=$tape $g --interval=$iv)
      echo "{\"round\":$r,\"arm\":\"$arm\",\"load\":$l,\"r\":$j}" >> $O
    done
  done
done
