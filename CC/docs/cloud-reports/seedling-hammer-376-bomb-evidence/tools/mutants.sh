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
run M1p-no-break-stand "                                ...(plan.strategy === 'break' && BOMB_PHASE_WAIT.enabled" "                                ...(false && plan.strategy === 'break' && BOMB_PHASE_WAIT.enabled"
run M2p-bombsonly-identity "    if (!d.danger) return d;
    const k = sample?.escape ?? 0;" "    return d;
    const k = sample?.escape ?? 0;"
run M3p-no-stop-hook "            if (BOMB_PHASE_WAIT.enabled && rewind !== null && cleanFirst && standAsked === null" "            if (false && BOMB_PHASE_WAIT.enabled && rewind !== null && cleanFirst && standAsked === null"
run M4p-no-rewind "        stillWhy ??= \`\${BOMB_PHASE_WAIT.maxStill} still tick(s), none re-probes clean\`;
        back();" "        stillWhy ??= \`\${BOMB_PHASE_WAIT.maxStill} still tick(s), none re-probes clean\`;"
run M5p-no-marker "                ...(standBombsOnly === false ? {} : { bombsOnly: true, escape: Math.max(0, i + 1 - standBombsOnly) }) };" "                ...{} };"
run M6p-no-escape-test "        if (k === 0) return true;" "        if (k >= 0) return true;"
git diff --stat
