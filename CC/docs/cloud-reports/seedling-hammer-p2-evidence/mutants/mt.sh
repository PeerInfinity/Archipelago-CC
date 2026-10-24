#!/bin/bash
# mt.sh <label> <file-rel> <old> <new> : mutate in the worktree, run the P2 test rows, restore
S=${S:?scratchpad}
label=$1; f=$S/wt/frontend/modules/seedlingDemo/$2; shift 2
cd $S/wt
$S/mutant.sh "$f" "$1" "$2" sh -c "timeout 900 npx vitest run frontend/modules/seedlingDemo/pressKillCost.test.js -t 'P2' 2>&1 | grep -aE '✓|×|FAIL|Tests ' | sed 's/\x1b\[[0-9;]*m//g' > $S/mut-$label.txt" 
echo "== $label"; grep -aE "×|Tests " $S/mut-$label.txt
