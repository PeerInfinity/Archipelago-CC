#!/bin/bash
# usage: censuses.sh <tree> <out-prefix>
cd "$1"
{
node scripts/procgen/witness-seedling-entities.mjs --check 2>&1 | tail -1
node scripts/procgen/witness-seedling-profile.mjs --check 2>&1 | tail -2
node scripts/procgen/census-seedling-solver-surface.mjs --check 2>&1 | tail -1
node scripts/procgen/census-seedling-constants.mjs --check 2>&1 | tail -2
python3 -c "import json;print('roster', len(json.load(open('frontend/modules/seedlingDemo/fixtures/tapes/index.json'))['tapes'] if isinstance(json.load(open('frontend/modules/seedlingDemo/fixtures/tapes/index.json')),dict) else len(json.load(open('frontend/modules/seedlingDemo/fixtures/tapes/index.json'))))"
} > "$2-censuses.txt" 2>&1
npx vitest run frontend/modules/seedlingDemo/tapeRunner.test.js --reporter=json --outputFile="$2-taperunner.json" > /dev/null 2>&1
python3 -c "
import json,sys
d=json.load(open('$2-taperunner.json'))
rows=sorted(f\"{a['status']}\t{a['fullName']}\" for t in d['testResults'] for a in t['assertionResults'])
open('$2-tape-runner-pairs.txt','w').write('\n'.join(rows)+'\n')
print(len(rows))"
md5sum "$2-tape-runner-pairs.txt"
