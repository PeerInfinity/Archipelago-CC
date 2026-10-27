#!/bin/bash
# scratch: rebuild the OPP measurement worktree = base + OPP's three code files + this branch's working diff
set -e
cd /tmp/claude-0/opp && git reset -q --hard HEAD
git apply /tmp/claude-0/opp.patch
cd /home/user/Archipelago-CC && git diff 6f5916203e -- frontend/modules/seedlingDemo/solverBot.js frontend/modules/seedlingDemo/contactFidelity.js > /tmp/claude-0/mine.patch
cd /tmp/claude-0/opp && git apply /tmp/claude-0/mine.patch
git diff --name-only | sed 's/^/  synced: /'
grep -c '<<<<<<<' frontend/modules/seedlingDemo/*.js | grep -v ':0' || echo "  no conflict markers"
# scratch-only: keep every SolverRefusal constructed (globalThis.__keepRefusals), for the witness tape's ticks
python3 - <<'PY'
p='/tmp/claude-0/opp/frontend/modules/seedlingDemo/solverBot.js'; s=open(p).read()
a="        this.name = 'SolverRefusal';\n"
assert s.count(a)==1
s=s.replace(a, a+"        if (globalThis.__keepRefusals) globalThis.__keepRefusals.push(this);\n")
open(p,'w').write(s)
PY
echo "  scratch: __keepRefusals hook"
