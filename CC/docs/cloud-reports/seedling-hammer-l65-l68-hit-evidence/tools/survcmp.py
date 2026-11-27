import json, sys
def load(p):
    d = json.load(open(p))
    return {r['step']: r for r in d['rows']}
a, b = load(sys.argv[1]), load(sys.argv[2])
def key(r): return (r['level'], r['verdict'], r.get('ticks'), (r.get('replay') or {}).get('hits'), (r.get('replay') or {}).get('deaths'), (r.get('refusal') or '')[:300])
def summ(d, n):
    sol = [r for r in d.values() if r['verdict'] == 'SOLVED']
    hit = [r for r in sol if ((r.get('replay') or {}).get('hits') or 0) + ((r.get('replay') or {}).get('deaths') or 0) > 0]
    print(f"{n}: {len(d)} steps, {len(sol)} SOLVED, {len(d)-len(sol)} not; SOLVED with replay hits/deaths: {len(hit)} -> " + ', '.join(f"{r['step']}(L{r['level']}:{r['replay']['hits']}h{r['replay']['deaths']}d)" for r in sorted(hit, key=lambda r: r['step'])))
summ(a, sys.argv[1].split('/')[-1]); summ(b, sys.argv[2].split('/')[-1])
mv = [s for s in sorted(set(a) | set(b)) if s not in a or s not in b or key(a[s]) != key(b[s])]
print('movers', len(mv))
for s in mv:
    ra, rb = a.get(s), b.get(s)
    f = lambda r: 'absent' if r is None else f"L{r['level']} {r['verdict']} {r.get('ticks')}t {(r.get('replay') or {}).get('hits')}h {(r.get('refusal') or '')[:160]}"
    print(f"  step {s}: {f(ra)}  ||  {f(rb)}")
