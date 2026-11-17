#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/efc8119d-b8dc-5004-bce0-7b3bc3d72f9e/scratchpad
T=$S/tools
$T/run-arm.sh P1 TEST_MEASURE_SKIP_REFUSALS=10
cd /home/user/Archipelago-CC
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2 > $S/logs/gen-seed2.log 2>&1
echo "gen rc=$?" >> $S/logs/gen-seed2.log
git status --porcelain >> $S/logs/gen-seed2.log
$T/run-arm.sh Aprime1 TEST_MEASURE_PLAYTHROUGH_SEED=2
echo SEQ2-DONE > $S/logs/seq2.done
