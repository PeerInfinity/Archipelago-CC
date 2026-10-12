#!/bin/bash
# usage: mutant.sh <file> <python-replace-old> <python-replace-new> <command...> — copy, edit, run, restore, verify
S=${S:?scratchpad}
f=$1; old=$2; new=$3; shift 3
cp "$f" $S/mutant-backup; before=$(md5sum < "$f")
OLD="$old" NEW="$new" F="$f" python3 -c "
import os;p=os.environ['F'];s=open(p).read();o=os.environ['OLD'];n=os.environ['NEW']
assert s.count(o)==1, 'pattern count %d' % s.count(o)
open(p,'w').write(s.replace(o,n))" || { echo "EDIT FAILED"; exit 2; }
"$@"
cp $S/mutant-backup "$f"; after=$(md5sum < "$f")
[ "$before" = "$after" ] && echo "restored ok" || echo "RESTORE MISMATCH"
