# SCRATCH (seedling-hammer-sf2 D2): apply one mutant in place to solverBot.js (restored by `git`-free copy afterwards).
import sys
p, m = sys.argv[1], sys.argv[2]
s = open(p).read()
M = {
  'M5-cap-ignored': ("        if (known === undefined && scanned >= previewCap) {", "        if (false && known === undefined && scanned >= previewCap) {"),
  'M6-past-cap-admissible-floor': ("            if (i - 1 < minTicksBetween(run.state, c)) { capSkipped += 1; return false; }\n", ""),
  'M7-past-cap-stop-previewing-only': ("            if (i - 1 < minTicksBetween(run.state, c)) { capSkipped += 1; return false; }\n            return opportunityAt(i, c, mine);",
                                       "            capSkipped += 1;\n            return false;"),
  'M8-cap-off-by-one': ("        if (known === undefined && scanned >= previewCap) {", "        if (known === undefined && scanned > previewCap) {"),
}
old, new = M[m]
assert s.count(old) == 1, m
open(p, 'w').write(s.replace(old, new))
print('applied', m)
