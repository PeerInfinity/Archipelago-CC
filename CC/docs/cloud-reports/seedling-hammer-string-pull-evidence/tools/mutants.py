#!/usr/bin/env python3
# SP D2 mutants: apply each to the SCRATCH tree's botDriverV2.js, run the gate rows, revert. Usage: mutants.py <tree> <outdir>
import json, os, subprocess, sys
T, O = sys.argv[1], sys.argv[2]
F = os.path.join(T, 'frontend/modules/seedlingDemo/botDriverV2.js')
ORIG = open(F).read()
M = {
 'm1-memo-outlives-call (module-wide, key (level, x, y): no opts, no world)': [(
  "function stringPullBlockedAt(level, allowTeleporter, opts) {\n    const rows = new Map();",
  "const M1 = new Map();\nfunction stringPullBlockedAt(level, allowTeleporter, opts) {\n    if (!M1.has(level.level)) M1.set(level.level, new Map());\n    const rows = M1.get(level.level);")],
 'm2-memo-per-opts-object (survives the call; misses a family moved in place)': [(
  "function stringPullBlockedAt(level, allowTeleporter, opts) {\n    const rows = new Map();",
  "const M2 = new WeakMap();\nfunction stringPullBlockedAt(level, allowTeleporter, opts) {\n    if (!M2.has(opts)) M2.set(opts, new Map());\n    const rows = M2.get(opts);")],
 'm3-key-missing-y (one answer per x)': [(
  "        let v = row.get(y);", "        let v = row.get(0);"), ("            row.set(y, v);", "            row.set(0, v);")],
 'm4-non-conservative-skip (fast arm drops the X-first corner query)': [(
  "function controllerPathClearBy(blockedAt, a, b) {", "function controllerPathClearBy(blockedAt, a, b, skipCorner = false) {"),
  ("            if (blockedAt(p.x, prev.y)) return false;", "            if (!skipCorner && blockedAt(p.x, prev.y)) return false;"),
  ("        ? ((blockedAt) => (a, b) => controllerPathClearBy(blockedAt, a, b))(", "        ? ((blockedAt) => (a, b) => controllerPathClearBy(blockedAt, a, b, true))(")],
 'm5-search-order-nearest-first (fast arm keeps the NEAREST clear point)': [(
  "        for (let j = points.length - 1; j > anchor; j--) {\n            if (beat) { if (activeProgress !== null) progressHeartbeat('plan-pull'); } // ⛓ HB: emit-only, once a string-pull ask\n            if (clear(points[anchor], points[j])) {\n                next = j;\n                break;\n            }\n        }",
  "        for (let j = points.length - 1; j > anchor; j--) {\n            if (beat) { if (activeProgress !== null) progressHeartbeat('plan-pull'); } // ⛓ HB: emit-only, once a string-pull ask\n            if (fast) { if (j === points.length - 1) { for (let k = anchor + 1; k < points.length; k++) { if (clear(points[anchor], points[k])) { next = k; break; } } } break; }\n            if (clear(points[anchor], points[j])) {\n                next = j;\n                break;\n            }\n        }")],
 'm6-search-order-binary (fast arm bisects j; empirically equal, not provably)': [(
  "        for (let j = points.length - 1; j > anchor; j--) {\n            if (beat) { if (activeProgress !== null) progressHeartbeat('plan-pull'); } // ⛓ HB: emit-only, once a string-pull ask\n            if (clear(points[anchor], points[j])) {\n                next = j;\n                break;\n            }\n        }",
  "        if (fast) { let lo = anchor + 1, hi = points.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (clear(points[anchor], points[mid])) { next = mid; lo = mid + 1; } else hi = mid - 1; } } else\n        for (let j = points.length - 1; j > anchor; j--) {\n            if (beat) { if (activeProgress !== null) progressHeartbeat('plan-pull'); } // ⛓ HB: emit-only, once a string-pull ask\n            if (clear(points[anchor], points[j])) {\n                next = j;\n                break;\n            }\n        }")],
}
res = {}
for name, edits in M.items():
    s = ORIG
    for a, b in edits:
        assert s.count(a) == 1, (name, a[:60])
        s = s.replace(a, b)
    open(F, 'w').write(s)
    try:
        jf = os.path.join(O, 'm.json')
        subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/stringPullFast.test.js', '--reporter=json', f'--outputFile={jf}'], cwd=T, capture_output=True)
        d = json.load(open(jf)); os.remove(jf)
        red = [a['title'] for r in d['testResults'] for a in r['assertionResults'] if a['status'] != 'passed']
        c = subprocess.run(['node', 'scripts/procgen/check-seedling-string-pull-fast.mjs', '--only=killgate s2,killgate s5,solve-seedling-r8-d2-chain'], cwd=T, capture_output=True, text=True)
        corpus = [l for l in c.stdout.splitlines() if l.startswith('FAIL') or l.startswith('PASS')]
    finally:
        open(F, 'w').write(ORIG)
    res[name] = {'vitest_red': red, 'corpus': corpus}
    print(name, json.dumps(res[name], ensure_ascii=False), flush=True)
json.dump(res, open(os.path.join(O, 'mutants.json'), 'w'), indent=1, ensure_ascii=False)
