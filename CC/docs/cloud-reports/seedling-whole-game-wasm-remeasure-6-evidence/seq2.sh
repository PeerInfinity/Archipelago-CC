#!/bin/bash
# remeasure-6 seq 2: A'1 by hand (the walk script's seed path doubles the AP_ prefix), then A3 via the walk script.
set -u
cd /home/user/Archipelago-CC
source .venv/bin/activate
S=/tmp/claude-0/-home-user-Archipelago-CC/65b7d073-1ea8-5c82-b3e2-37898876384d/scratchpad
L=$S/logs
echo "[arm Aprime1] start $(date -u +%FT%TZ) head $(git rev-parse --short HEAD) (by hand: Generate.py seed 2 + npm test, the walk script's env)" >> $L/seq.log
python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2 > $L/gen-seed2.log 2>&1
echo "[arm Aprime1] generate rc=$? $(ls -d frontend/presets/seedling_playthrough/AP_01043188731678011336 2>&1)" >> $L/seq.log
env TEST_MEASURE_STEP_TIMEOUT_MS=10800000 TEST_MEASURE_BOT_STALL_MS=300000 TEST_AUTO_START_TIMEOUT_MS=11100000 TEST_TIMEOUT=11400000 TEST_MEASURE_PLAYTHROUGH_SEED=2 \
  npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game > $L/Aprime1.log 2>&1
echo "[arm Aprime1] rc=$? end $(date -u +%FT%TZ) :: $(node -e "import('./scripts/procgen/walk-seedling-whole-game.mjs').then(m=>{const s=m.summarize(require('fs').readFileSync('$L/Aprime1.log','utf8'));console.log(s?m.summaryLine(s,0):'no MEASURE end')})")" >> $L/seq.log
git checkout -- frontend/presets/preset_files.json
rm -rf frontend/presets/seedling_playthrough/AP_01043188731678011336
rm -f output/AP_01043188731678011336.zip
echo "[arm Aprime1] reverted; status: $(git status --porcelain | wc -l) line(s)" >> $L/seq.log
bash $S/run-arm.sh A3 --capture-requests=$S/cap/A3.jsonl
echo "[seq2] done $(date -u +%FT%TZ)" >> $L/seq.log
