S=/tmp/claude-0/-home-user-Archipelago-CC/7c2c33f2-7a33-5ff0-8add-65efa01a6be3/scratchpad
cd /home/user/Archipelago-CC
M=SEEDLING_STAGED_HUNT_SCAN_MEMO=1; C=SEEDLING_CHASER_STAGED_HUNT=1; O=SEEDLING_OPPORTUNISTIC_STRIKE=1
for arm in "CSHM:$C $M" "OCM:$O $C $M" "OCM_CUT:$O $C $M SEEDLING_CHOOSER_CUT=1" "OCM_DVB:$O $C $M SEEDLING_DETOUR_VIA_BOUND=1" "OCM_CC_SB:$O $C $M SEEDLING_CLEARTAG_CHAIN=1 SEEDLING_STANCE_BURN=1" "OCM_KT:$O $C $M SEEDLING_KEYLOCK_TURRET=1"; do
  l=${arm%%:*}; e=${arm#*:}
  echo "== $l" ; env $e timeout 900 node $S/tools/near.mjs --requests=$S/w0/w6-off-req.jsonl --id=394 --i=1 --from=1 --to=0 2>&1 | grep -a -E "^answer|^hits"
done
