#!/bin/bash
# mutants.sh: apply each mutant to solverBot.js, run the two row files, restore from HEAD
cd /home/user/Archipelago-CC
F=frontend/modules/seedlingDemo/solverBot.js
run() {
  local name=$1; shift
  python3 - "$F" "$@" <<'PY'
import sys
p=sys.argv[1]; a=sys.argv[2]; b=sys.argv[3]; s=open(p).read()
assert s.count(a)==1, ('mutant anchor', a[:60]); s=s.replace(a,b); open(p,'w').write(s)
PY
  echo "== $name"
  timeout 600 npx vitest run frontend/modules/seedlingDemo/hammerBombPhase.test.js 2>&1 | grep -a "✓\|×\|Tests " | sed 's/\x1b\[[0-9;]*m//g'
  timeout 900 npx vitest run --config vitest.train.config.js frontend/modules/seedlingDemo/hammerBombPhase.train.test.js 2>&1 | grep -a "✓\|×\|Tests " | sed 's/\x1b\[[0-9;]*m//g'
  git checkout -- "$F"
}
run M1-arrival21 "    arrivalTicks: 31," "    arrivalTicks: 21,"
run M2-bombsonly-identity "    if (!d.danger) return d;
    const sources = d.sources.filter((s) => s.kind === 'bomb');" "    return d;
    const sources = d.sources.filter((s) => s.kind === 'bomb');"
run M3-no-arrival-ask "            if (hit === null && stand === null && BOMB_PHASE_WAIT.enabled && rewind !== null) {" "            if (false && hit === null && stand === null && BOMB_PHASE_WAIT.enabled && rewind !== null) {"
run M4-no-rewind "        stillWhy ??= \`\${BOMB_PHASE_WAIT.maxStill} still tick(s), none re-probes clean\`;
        back();" "        stillWhy ??= \`\${BOMB_PHASE_WAIT.maxStill} still tick(s), none re-probes clean\`;"
run M5-no-marker "phase: 'dwell', wp: wpIndex, ...(standBombsOnly ? { bombsOnly: true } : {}) };" "phase: 'dwell', wp: wpIndex };"
git diff --stat
