#!/usr/bin/env python3
"""SXC: one arm's census dir (one sxc-solve RESULT json per seam) -> per-seam rows, phases solving of 45, the
overlap check (s vs s+45, answer + work), the class tally over 5226..5270, the band rows with their stacks, and the
counters. `--rows` prints only the per-seam TSV (seam, phase, ok, work, answer, class, dashless, full, flags).
Usage: sxc-phases.py <dir> [--rows] [--lo=5226]"""
import json, sys, os, re, glob
from collections import Counter

BAND = re.compile(r'Game\.shake|jiggle|shake band')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
lo = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--lo=')), 5226)
rows = {}
for f in glob.glob(os.path.join(args[0], '*.json')):
    if os.path.getsize(f):
        d = json.load(open(f)); rows[d['seam']] = d

def stance(m):
    # the deepest verb of the refusal's chain head (`contact -> hold stance (…) -> break stance (…) -> kill (…) by press:`)
    vs = re.findall(r'-> ([a-z]+)', m.split(': ', 1)[0])
    return vs[-1] if vs else 'walk'

def pcls(p):
    if p['ok']: return f"SOLVE {p['ticks']}t"
    m = p['message'] or ''
    if 'nowhere to be' in m: w = 'NOWHERE'  # its PKSG text names the band; the class is the kill's refusal
    elif BAND.search(m): w = 'SHAKE-BAND'
    elif 'shadow advanced' in m: w = 'DIVERGE'
    elif 'the hold stands still' in m: w = 'HOLD-WAIT'
    elif 'player died' in m: w = 'DEATH'
    elif 'There is no step out' in m: w = 'NO-STEP-OUT'
    elif "the caller's anytime deadline" in m[:120]: w = 'DEADLINE'
    elif 'HAMMER_SAFETY' in m or 'hammer' in m[:300].lower() and 'safety' in m[:300].lower(): w = 'HAMMER_SAFETY'
    elif 'EXHAUSTED' in m: w = 'EXHAUSTED'
    else: w = (p['code'] or p['kind'] or '?') + ':' + m[:50]
    if 'PRESS_KILL_SHAKE_GUARD' in m: w += '+PKSG'
    if p['kind'] == 'deadline': w += '⏱'
    return f"{w}@{stance(m)}"

def klass(d):
    ps = {p['pass']: p for p in d['passes']}
    if d['ok']: return 'SOLVE ' + ('dashless' if ps.get('dashless', {}).get('ok') else 'full-only')
    return pcls(ps['dashless']) + ' | ' + pcls(ps['full'])

def isband(d):
    return any(not p['ok'] and (BAND.search(p['message'] or '') or 'PRESS_KILL_SHAKE_GUARD' in (p['message'] or ''))
               for p in d['passes'])

if '--rows' in sys.argv:
    for s in sorted(rows):
        d = rows[s]; ps = {p['pass']: p for p in d['passes']}
        print('\t'.join(map(str, [s, s % 45, 'OK' if d['ok'] else 'NO', d['work'], d['answer'], klass(d),
                                  pcls(ps['dashless']), pcls(ps['full']),
                                  f"shakeRefused={d['guards']['shakeRefused']} rebootRefused={d['guards']['rebootRefused']} "
                                  f"bandBuilt={d['bandBuilt']['count']} refugeRefused={d['bombCounts']['refugeRefused']}"])))
    sys.exit(0)

period = [s for s in range(lo, lo + 45) if s in rows]
print(f"arm dir: {args[0]}; seams present {len(rows)}; switches shakeExactSplit={rows[period[0]]['shakeExactSplit']} pressKillBombs={rows[period[0]]['pressKillBombs']}")
assert len(period) == 45, f'missing seams: {sorted(set(range(lo, lo + 45)) - set(rows))}'
solves = [s for s in period if rows[s]['ok']]
print(f'phases solving: {len(solves)} of 45  (seams {solves})')
pairs = [(s, s + 45) for s in period if s + 45 in rows]
same = [p for p in pairs if (rows[p[0]]['answer'], rows[p[0]]['work']) == (rows[p[1]]['answer'], rows[p[1]]['work'])]
print(f'overlap pairs: {len(pairs)}; identical answer+units {len(same)}; differing {[p for p in pairs if p not in same]}')
print('counters over the period: shakeRefused', sum(rows[s]['guards']['shakeRefused'] for s in period),
      '(seams>0:', sum(1 for s in period if rows[s]['guards']['shakeRefused']), ')',
      'rebootRefused', sum(rows[s]['guards']['rebootRefused'] for s in period),
      'bandBuilt', sum(rows[s]['bandBuilt']['count'] for s in period),
      '(seams>0:', [s for s in period if rows[s]['bandBuilt']['count']], ')',
      'refugeRefused', sum(rows[s]['bombCounts']['refugeRefused'] for s in period))
print('classes over the period:')
for k, v in Counter(klass(rows[s]) for s in period).most_common():
    print(f'- {v}x {k}')
bs = [s for s in sorted(rows) if isband(rows[s])]
print(f'band answers (a pass whose text is the band or carries PRESS_KILL_SHAKE_GUARD), all seams: {bs}')
for s in bs:
    d = rows[s]
    for p in d['passes']:
        m = p['message'] or ''
        if p['ok'] or not (BAND.search(m) or 'PRESS_KILL_SHAKE_GUARD' in m): continue
        print(f"\n## seam {s} pass {p['pass']}: {m[:400]}")
        hit = next((k for k in d['bandBuilt']['stacks'] if k[:120] in m), None)
        if hit:
            print('   stack (construction, top frames):')
            for fr in d['bandBuilt']['stacks'][hit][:14]: print('     ', fr)
        else:
            print('   (no constructed band error matched this text)')
