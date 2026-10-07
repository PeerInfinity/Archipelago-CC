#!/usr/bin/env bash
# Run Generate.py --seed 1 N times for one template and md5 every output file,
# optionally with PYTHONHASHSEED fixed, to measure run-to-run byte drift.
# Usage: measure-generate-determinism.sh "<Template>.yaml" <preset_dir> <N> [hashseed|random] [keep_dir]
# Restores the committed preset files afterwards (git checkout).
set -u
tmpl=$1; preset=$2; n=$3; hs=${4:-random}; keep=${5:-}
dir="frontend/presets/$preset/AP_14089154938208861744"
for i in $(seq 1 "$n"); do
  if [ "$hs" = random ]; then unset PYTHONHASHSEED; else export PYTHONHASHSEED=$hs; fi
  python Generate.py --weights_file_path "Templates/$tmpl" --multi 1 --seed 1 >/dev/null 2>&1 || { echo "run $i FAILED"; continue; }
  line="run=$i hashseed=$hs"
  for f in "$dir"/*; do
    m=$(md5sum "$f" | cut -c1-8); line="$line ${f##*_}=$m"
    if [ -n "$keep" ]; then mkdir -p "$keep"; cp --update=none "$f" "$keep/$m.${f##*.}"; fi
  done
  echo "$line"
done
git checkout -- "$dir" 2>/dev/null
