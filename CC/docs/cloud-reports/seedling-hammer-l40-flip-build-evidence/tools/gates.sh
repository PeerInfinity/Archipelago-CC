S=/tmp/claude-0/-home-user-Archipelago-CC/7c2c33f2-7a33-5ff0-8add-65efa01a6be3/scratchpad
cd /home/user/Archipelago-CC
while kill -0 22890 2>/dev/null; do sleep 10; done
node scripts/procgen/check-procgen-reference.mjs --wait-for-box=600 > $S/d/checkref-main.txt 2>&1; echo "checkref rc=$?" >> $S/d/gates.txt
bash scripts/procgen/identity-block.sh > $S/d/identity-block.txt 2>&1; echo "identity rc=$?" >> $S/d/gates.txt
node scripts/procgen/check-seedling-wasm-ship.mjs --wait-for-box=600 > $S/d/wasm-ship.txt 2>&1; echo "wasmship rc=$?" >> $S/d/gates.txt
node scripts/procgen/ci-producer-checks.mjs --jobs=4 --timeout-s=900 > $S/d/producers-defaults.txt 2>&1; echo "producers(defaults=flip ON) rc=$?" >> $S/d/gates.txt
env $(cat $S/off13.env) SEEDLING_OPP_PRESS_FALLBACK=0 node scripts/procgen/ci-producer-checks.mjs --jobs=4 --timeout-s=900 > $S/d/producers-off.txt 2>&1; echo "producers(flip OFF) rc=$?" >> $S/d/gates.txt
echo GATES-DONE >> $S/d/gates.txt
