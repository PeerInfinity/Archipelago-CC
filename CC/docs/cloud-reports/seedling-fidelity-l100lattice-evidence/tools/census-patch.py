# L100LATTICE W0 census instrument (measurement only, applied to a SCRATCH worktree's botDriverV2.js, never committed):
# every planWaypoints call whose goal node was SUBSTITUTED by nearestGoalNode (goal !== to) appends one JSONL row to
# $L100L_CENSUS: the level size, from/to/goal, lattice, the kept path, and whether the LAST kept segment (into the
# target) passes controllerPathClear (the smoother's own test) — i.e. whether the fallback kept an unchecked segment.
import sys
p = sys.argv[1]
s = open(p).read()
old = "    return stringPull(level, points, allowTeleporter, opts, fast, true);\n}"
new = """    const keptOut = stringPull(level, points, allowTeleporter, opts, fast, true);
    if (globalThis.process?.env?.L100L_CENSUS && goal !== to) {
        const a = keptOut.length > 1 ? keptOut[keptOut.length - 2] : from;
        const clear = controllerPathClear(level, a, to, allowTeleporter, opts);
        // eslint-disable-next-line no-undef
        globalThis.__l100lFs ??= process.getBuiltinModule('node:fs');
        globalThis.__l100lFs.appendFileSync(globalThis.process.env.L100L_CENSUS, JSON.stringify({
            w: level.width, h: level.height, lattice: opts.lattice ?? DEFAULT_LATTICE, from: [from.x, from.y],
            to: [to.x, to.y], goal: [goal.x, goal.y], kept: keptOut.map((q) => [q.x, q.y]), lastClear: clear,
            manhattan: !!opts.manhattan }) + '\\n');
    }
    return keptOut;
}"""
assert s.count(old) == 1, s.count(old)
open(p, 'w').write(s.replace(old, new))
print('patched', p)
