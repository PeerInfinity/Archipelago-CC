#!/usr/bin/env python3
"""SCRATCH (seedling-fidelity-digest D3.3): the mutant hook, into a SCRATCH copy of levelRun.js only — `stateDigest`
eval's `globalThis.__MUT.apply` before its parts and `.restore` after, inside the run's closure."""
import sys
p = sys.argv[1]
assert '/scratchpad/' in p, p
s = open(p).read()
old = "            const p = stateDigestParts({ fresh });\n"
assert s.count(old) == 1
s = s.replace(old, """            const mut = globalThis.__MUT ?? null;
            if (mut) eval(mut.apply);
            let p;
            try { p = stateDigestParts({ fresh }); } finally { if (mut) eval(mut.restore); }
""")
open(p, 'w').write(s)
print('mutant hook applied', p)
