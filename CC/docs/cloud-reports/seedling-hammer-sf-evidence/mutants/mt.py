# SCRATCH (seedling-hammer-sf D1): apply one named mutant to solverBot.js in place (the runner restores it by md5).
import sys
p, name = sys.argv[1], sys.argv[2]
s = open(p).read()
M = {
  'M1-floor-only': ("    const keep = measured ? measuredPair : opportunityAt;", "    const keep = opportunityAt;"),
  'M2-walk-speed': ("    const cap = 2 * (ice || from.hazard?.onIce ? SLIDING_SPEED : WALK_SPEED);",
                    "    const cap = (ice || from.hazard?.onIce ? SLIDING_SPEED : WALK_SPEED);"),
  'M3-no-tolerance': ("        return Math.ceil(Math.max(0, reach - DEFAULT_TOLERANCE) / v);",
                      "        return Math.ceil(Math.max(0, reach) / v);"),
  'M4-v0-ignored': ("    const v = Math.max(cap, Math.abs(from.vx ?? 0), Math.abs(from.vy ?? 0));", "    const v = cap;"),
}
old, new = M[name]
assert s.count(old) == 1, name
open(p, 'w').write(s.replace(old, new))
