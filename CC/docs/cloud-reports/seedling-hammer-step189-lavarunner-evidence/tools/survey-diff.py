# MEASUREMENT-ONLY (step189): per-step survey diff (verdict, ticks, hits) between two survey JSONs.
import json, sys, collections
def load(p):
    d = json.load(open(p)); return {r['step']: r for r in d['rows']}
def hits(r):
    rp = r.get('replay') or {}
    if isinstance(rp, dict): return rp.get('hits', rp.get('playerHits'))
    return None
names = sys.argv[1::2]; paths = sys.argv[2::2]
runs = [load(p) for p in paths]
for n, r in zip(names, runs):
    v = collections.Counter(x['verdict'] for x in r.values())
    print(f'{n}: {len(r)} steps {dict(v)}')
base = runs[0]
for n, r in zip(names[1:], runs[1:]):
    diff = []
    for s in sorted(base):
        a, b = base[s], r.get(s)
        ka = (a['verdict'], a.get('ticks'), json.dumps(a.get('replay'), sort_keys=True)[:4000], a.get('refusal'))
        kb = (b['verdict'], b.get('ticks'), json.dumps(b.get('replay'), sort_keys=True)[:4000], b.get('refusal')) if b else None
        if ka != kb: diff.append((s, a['level'], a['verdict'], a.get('ticks'), b and b['verdict'], b and b.get('ticks'), (b or {}).get('refusal', '')[:160] if b and b['verdict'] != 'SOLVED' else ''))
    print(f'{names[0]} vs {n}: {len(diff)} step(s) differ')
    for d in diff: print('  ', d)
