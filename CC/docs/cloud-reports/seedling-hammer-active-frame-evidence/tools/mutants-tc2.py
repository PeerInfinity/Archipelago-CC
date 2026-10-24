#!/usr/bin/env python3
"""TC2's mutants: each applied to the dev tree, the TC2 rows run, the tree restored. usage: mutants-tc2.py <tree>"""
import subprocess, sys, re
T = sys.argv[1]
SP = f'{T}/frontend/modules/seedlingDemo/solveProgress.js'
SB = f'{T}/frontend/modules/seedlingDemo/solverBot.js'
MUTANTS = [
    ('f1: frame kept as a growing list (every open frame\'s detail)', [(SP,
        'function frameOf(seg) {\n',
        'function frameOf(seg) {\n    const all = [];\n    for (const f of seg.stack) if (f.detail !== null) all.push({ key: (f.cursor ?? f.node).key, ...f.detail });\n    if (all.length > 0) return all;\n')]),
    ('f2: the climb\'s danger from a FRESH probe instead of the hit it was handed', [(SB,
        'if (activeProgress !== null) progressFrame({ danger: hit });',
        'if (activeProgress !== null) progressFrame({ danger: corridor ? probeCorridor(corridor, dangerExcept) : hit });')]),
    ('f3: a frame read outside the null check (setter null-safe, the chaser arm\'s guard dropped)', [(SP,
        '    frameEntries += 1;\n    const seg = activeProgress.seg;',
        '    frameEntries += 1;\n    const seg = activeProgress?.seg ?? null;\n    if (seg === null) return;'),
        (SB, 'if (activeProgress !== null) progressFrame({ target: hunted.id });', 'progressFrame({ target: hunted.id });')]),
]
for name, edits in MUTANTS:
    saved = {}
    for path, old, new in edits:
        s = saved.get(path) or open(path).read()
        saved.setdefault(path, s)
        cur = open(path).read()
        assert cur.count(old) == 1, (name, old)
        open(path, 'w').write(cur.replace(old, new))
    try:
        r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/solveProgress.test.js', '-t', 'TC2'],
                           cwd=T, capture_output=True, text=True, timeout=1800)
        out = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
        red = [l.strip() for l in out.splitlines() if l.strip().startswith('×')]
        tally = [l.strip() for l in out.splitlines() if l.strip().startswith('Tests ')]
        print(f'== {name}\n  exit {r.returncode}; {tally[-1] if tally else "?"}')
        for l in red: print('  RED', l[:200])
    finally:
        for path, s in saved.items(): open(path, 'w').write(s)
