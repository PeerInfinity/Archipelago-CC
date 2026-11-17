# HIT-TIEBREAK census summary (measure only): reads the per-leg rows (census-leg.mjs, ON) and prints the counts and the
# MIXED legs (both passes returned a plan, model verdicts differ), split into movers (the shipped plan changes) and
# non-movers (the hitless plan already wins on length). Usage: python3 census-summary.py <rows.jsonl>
import json, sys, collections
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
c = collections.Counter()
mixed = []
for r in rows:
    if r.get('crash'): c['crash/over 240 s'] += 1; continue
    if r.get('outcome') == 'no-solver-goal': c['no solver goal'] += 1; continue
    c['solved' if r.get('ok') else 'refused'] += 1
    plans = [p for p in r.get('passes', []) if p.get('ok')]
    if len(plans) >= 2: c['both passes planned'] += 1
    hit = [p for p in plans if p.get('modelHits') and (p['modelHits']['hits'] > 0 or p['modelHits']['deaths'] > 0)]
    if r.get('ok') and r['shippedOff'] and r['shippedOff']['modelHits'] and (r['shippedOff']['modelHits']['hits'] or r['shippedOff']['modelHits']['deaths']):
        c['shipped OFF plan takes a model hit'] += 1
    if r.get('mixed'): mixed.append(r)
print('legs', len(rows)); [print(f'  {k}: {v}') for k, v in sorted(c.items())]
print('mixed (both passes planned, verdicts differ):', len(mixed))
for r in sorted(mixed, key=lambda r: int(r['id'])):
    o, n = r['shippedOff'], r['shippedOn']
    f = lambda s: f"{s['pass']} {s['ticks']} t, {s['modelHits']['hits']} hit(s){', death' if s['modelHits']['deaths'] else ''}"
    print(f"  {'MOVES' if r['moved'] else 'stays'}  {r['key']}\n      OFF {f(o)}  ->  ON {f(n)}   passes: " +
          '; '.join(f"{p['pass']} {p['ticks']} t {p['modelHits']['hits']}h{p['modelHits']['deaths']}d" for p in r['passes'] if p.get('ok')))
