# Remaining Exporter Issues for Super Metroid

This file tracks outstanding issues in the Super Metroid exporter (`exporter/games/sm.py`).

## Issues to be identified

Run the generation script and spoiler test to identify issues:
- `python Generate.py --weights_file_path "Templates/Super Metroid.yaml" --multi 1 --seed 1 > generate_output.txt`
- `npm test --mode=test-spoilers --game=sm --seed=1`

Issues will be documented here after the initial test run.
