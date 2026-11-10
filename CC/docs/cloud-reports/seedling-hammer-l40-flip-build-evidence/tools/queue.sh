S=/tmp/claude-0/-home-user-Archipelago-CC/7c2c33f2-7a33-5ff0-8add-65efa01a6be3/scratchpad
cd /home/user/Archipelago-CC
while kill -0 864 2>/dev/null; do sleep 5; done
P="node scripts/procgen/probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g"
W6=$(cat $S/w0/w6.env)
LTS="SEEDLING_LATCH_WEIGH_FIRST=1;SEEDLING_TURRET_APPROACH=1;SEEDLING_APPROACH_DOOR=1"
# C: W6 + LTS + BOMB_PHASE_WAIT, door carried
$P --legs=$S/legs/carry.jsonl --ids=869,870,395,412,394,411,376,377,871,872 --solver-env="$W6;$LTS;SEEDLING_BOMB_PHASE_WAIT=1" --capture-requests=$S/w0/c-req.jsonl --out=$S/w0/c-rows.jsonl > $S/w0/c.log 2>&1
# B: defaults, no carry (control)
$P --legs=$S/legs/off.jsonl --ids=376,377,394,411,871,872 --capture-requests=$S/w0/b-req.jsonl --out=$S/w0/b-rows.jsonl > $S/w0/b.log 2>&1
echo QUEUE-DONE
