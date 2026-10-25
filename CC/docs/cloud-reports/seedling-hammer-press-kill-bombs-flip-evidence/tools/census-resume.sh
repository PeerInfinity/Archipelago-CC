#!/usr/bin/env bash
# SCRATCH (PKB): census.sh, but only the seams <out> does not hold yet (resumes after a restart).
# Usage: census-resume.sh <tool.mjs> <requests.jsonl> <from> <to> <out.jsonl> [jobs=1]   (switches by env)
set -u
tool=$1; req=$2; from=$3; to=$4; out=$5; jobs=${6:-1}
touch "$out"
python3 -c "
import json,sys
have={json.loads(l)['seam'] for l in open('$out') if l.strip()}
print('\n'.join(str(s) for s in range($from,$to+1) if s not in have))" \
  | xargs -r -P "$jobs" -I{} sh -c "node '$tool' --requests='$req' --seam={} | grep '^RESULT ' | cut -c8- >> '$out'"
