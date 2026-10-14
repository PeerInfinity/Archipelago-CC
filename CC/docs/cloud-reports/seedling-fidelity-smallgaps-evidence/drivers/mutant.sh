#!/bin/bash
# mutant.sh <name> <file> <python replace old> <new> — copy, mutate, run the three test files, restore
S=/tmp/claude-0/-home-user-Archipelago-CC/4ee07d96-6856-5502-8024-f803d6f233ab/scratchpad
cd $S/dev; name=$1; f=$2
cp $f $S/mut-backup
python3 -c "
import sys
p='$f'; s=open(p).read(); a=open('$S/mut-old').read(); b=open('$S/mut-new').read()
assert s.count(a)==1, 'anchor count %d' % s.count(a)
open(p,'w').write(s.replace(a,b))"
npx vitest run frontend/modules/seedlingDemo/fidelityL74Arrival.test.js frontend/modules/seedlingDemo/fidelityWaypointSlide.test.js frontend/modules/seedlingDemo/fidelityLavaChainPlayer.test.js frontend/modules/seedlingDemo/contactFidelity.test.js --reporter=json --outputFile=$S/mut-$name.json > /dev/null 2>&1
cp $S/mut-backup $f
python3 -c "
import json
d=json.load(open('$S/mut-$name.json'))
red=[a['fullName'] for t in d['testResults'] for a in t['assertionResults'] if a['status']!='passed']
print('$name: %d red' % len(red)); [print('   ', r[:170]) for r in red]"
git -C $S/dev diff --quiet -- $f && echo "   restored clean"
