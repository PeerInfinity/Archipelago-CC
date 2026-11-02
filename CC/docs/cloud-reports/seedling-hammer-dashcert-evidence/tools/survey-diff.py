# DASHCERT: per-step verdict/ticks/hits/refusal diff of two extended-survey JSONs. Usage: survey-diff.py A B
import json, sys
def load(p):
    out = {}
    for r in json.load(open(p))['rows']:
        res = r.get('result') or r.get('solve') or {}
        out[r['step']] = r
    return out
def key(r):
    s = {k: r.get(k) for k in ('verdict', 'ticks', 'replans', 'refusal', 'traceRows', 'passes', 'replay', 'level')}
    return json.dumps(s, sort_keys=True, default=str)
A, B = load(sys.argv[1]), load(sys.argv[2])
sa = sum(1 for r in A.values() if r.get('verdict') == 'SOLVED'); sb = sum(1 for r in B.values() if r.get('verdict') == 'SOLVED')
print(f'steps {len(A)} / {len(B)}; SOLVED {sa} / {sb}')
n = 0
for st in sorted(set(A) | set(B)):
    if st not in A or st not in B or key(A[st]) != key(B[st]):
        n += 1
        print('MOVER step', st, 'L', A.get(st, B.get(st)).get('level'), '\n  A', key(A.get(st, {}))[:400], '\n  B', key(B.get(st, {}))[:400])
print('movers', n)
