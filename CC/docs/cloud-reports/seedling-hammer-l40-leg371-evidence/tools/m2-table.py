#!/usr/bin/env python3
"""Measure-only (slice L371): the switch-by-switch rows (m2-switches.sh) -> a markdown table, one row per arm, one
column per seam; each cell is the answer class (SOLVE <ticks>, or the dashless / full refusal classes) and its units.
A cell equal to the default arm's answer (sha, work) is marked '='. Usage: m2-table.py <switches.jsonl>"""
import json, sys, importlib.util, os
spec = importlib.util.spec_from_file_location('cls', os.path.join(os.path.dirname(__file__), 'cls.py'))
src = open(spec.origin).read().replace('\nmain()\n', '\n')
ns = {}
exec(compile(src, spec.origin, 'exec'), ns)
cls = ns['cls']

rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
seams = sorted({r['seam'] for r in rows})
arms = []
for r in rows:
    if r['arm'] not in arms: arms.append(r['arm'])
arms.sort(key=lambda a: (a != 'default', a))
by = {(r['arm'], r['seam']): r for r in rows}

def cell(r, base):
    if r is None: return '—'
    if base is not None and (r['answer'], r['work']) == (base['answer'], base['work']): return '='
    ps = {p['pass']: p for p in r['passes']}
    if r['ok']:
        best = [p for p in r['passes'] if p['ok']]
        return f"**SOLVE {min(p['ticks'] for p in best)} t** ({r['work']} u)"
    d, f = cls(ps['dashless']), cls(ps['full'])
    return f"{d}{'' if d == f else ' / ' + f} ({r['work']} u)"

print('| arm | ' + ' | '.join(str(s) for s in seams) + ' |')
print('|---|' + '---|' * len(seams))
for a in arms:
    print(f'| {a} | ' + ' | '.join(cell(by.get((a, s)), None if a == 'default' else by.get(('default', s))) for s in seams) + ' |')
