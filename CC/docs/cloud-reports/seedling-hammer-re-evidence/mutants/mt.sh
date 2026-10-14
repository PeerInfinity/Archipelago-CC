#!/bin/bash
# SCRATCH (seedling-hammer-re D2): copy → edit (python replace, asserted unique) → run the gate → restore → md5 check.
#   mt.sh <name> <file> <old> <new> [<old> <new>]...
cd /home/user/Archipelago-CC
name=$1; f=$2; E=CC/docs/cloud-reports/seedling-hammer-re-evidence/mutants
before=$(md5sum "$f" | cut -d' ' -f1); cp "$f" "$f.mutant-orig"
python3 - "$f" "${@:3}" <<'PY' || { mv "$f.mutant-orig" "$f"; exit 2; }
import sys
p = sys.argv[1]; s = open(p).read(); a = sys.argv[2:]
for old, new in zip(a[::2], a[1::2]):
    assert s.count(old) == 1, f'{old!r} occurs {s.count(old)} times'
    s = s.replace(old, new)
open(p, 'w').write(s)
PY
timeout 900 npx vitest run frontend/modules/seedlingDemo/hammerRefugeCut.test.js > "$E/mut-$name.txt" 2>&1
mv "$f.mutant-orig" "$f"
after=$(md5sum "$f" | cut -d' ' -f1)
[ "$before" = "$after" ] || { echo "RESTORE FAILED $name"; exit 3; }
echo "$name: $(grep -a -E 'Tests ' "$E/mut-$name.txt" | sed 's/\x1b\[[0-9;]*m//g' | tr -s ' ')"
grep -a "FAIL\|✗\|×" "$E/mut-$name.txt" | sed 's/\x1b\[[0-9;]*m//g' | grep -a " > " | sort -u | head -5
