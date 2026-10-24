import sys
src, dst, name = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(src).read()
M = {
 'helper': [("        return previewWalk(run, wps, tolerance, opts);\n    } catch (e) {\n        if (!(e instanceof PhysicsV2Error)) throw e;", "        return previewWalk(run, wps, tolerance, opts);\n    } catch (e) {\n        throw e;")],
 'paced': [("    const step = previewOrDeath(run.previewStepper());\n    const NONE = new Set();\n    const others", "    const step = run.previewStepper();\n    const NONE = new Set();\n    const others")],
 'lean': [("function previewLean(run, from, key) {\n    const step = previewOrDeath(run.previewStepper());", "function previewLean(run, from, key) {\n    const step = run.previewStepper();")],
 'tap': [("    const step = previewOrDeath(run.previewStepper());\n    let p = { ...run.state, x: from.x, y: from.y, vx: 0, vy: 0, direction", "    const step = run.previewStepper();\n    let p = { ...run.state, x: from.x, y: from.y, vx: 0, vy: 0, direction")],
 'encounter': [("    const stepper = previewOrDeath(run.previewStepper());\n    let best = null;", "    const stepper = run.previewStepper();\n    let best = null;"),
               ("    const stepper = previewOrDeath(run.previewStepper());\n    const scored", "    const stepper = run.previewStepper();\n    const scored")],
}
for o, n in M[name]:
    assert s.count(o) == 1, (name, o[:60]); s = s.replace(o, n)
open(dst, 'w').write(s)
