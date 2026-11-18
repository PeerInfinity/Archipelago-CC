# scratch (decides nothing): per-step verdict/ticks/hits across survey arms; prints every step whose row differs from the first arm
import json, sys
arms = [(a.split('=')[0], json.load(open(a.split('=')[1]))) for a in sys.argv[1:]]
def row(r):
    v = r.get('verdict'); h = (r.get('replay') or {}).get('hits'); d = (r.get('replay') or {}).get('deaths')
    ref = (r.get('refusal') or '')[:150].replace('\n', ' ')
    return (v, r.get('ticks'), h, d, ref if v != 'SOLVED' else '')
by = [{(r['step']): r for r in d['rows']} for _, d in arms]
steps = sorted(set().union(*[b.keys() for b in by]), key=lambda s: (isinstance(s, str), s))
for name, d in arms:
    rows = d['rows']; sol = [r for r in rows if r.get('verdict') == 'SOLVED']
    hits = sum(((r.get('replay') or {}).get('hits') or 0) for r in sol)
    hitsteps = [r['step'] for r in sol if ((r.get('replay') or {}).get('hits') or 0) > 0]
    print(f'{name}: {len(rows)} rows, {len(sol)} SOLVED, {hits} hits in solved rows over {len(hitsteps)} step(s) {hitsteps}')
print()
for s in steps:
    rs = [b.get(s) for b in by]
    keys = [row(r) if r else None for r in rs]
    if len(set(map(str, keys))) > 1:
        lv = next(r for r in rs if r)['level']; goals = ' then '.join(g['kind'] + ':' + g.get('why', '')[:50] for g in next(r for r in rs if r)['goals'])
        print(f'== step {s} L{lv} — {goals}')
        for (n, _), k in zip(arms, keys): print(f'   {n:5} {k}')
