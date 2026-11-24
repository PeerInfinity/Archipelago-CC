# FEWER-HITS census summary: python3 census-summary.py <census.jsonl>
import json, sys, statistics
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
c = {'legs': len(rows), 'crash/over 240 s': 0, 'no solver goal': 0, 'refused': 0, 'solved': 0}
both, moved, avoid_rows = [], [], []
for r in rows:
    if r.get('crash'): c['crash/over 240 s'] += 1; continue
    if r.get('outcome') == 'no-solver-goal': c['no solver goal'] += 1; continue
    c['solved' if r['ok'] else 'refused'] += 1
    if r.get('bothHit'): both.append(r)
    if r.get('moved'): moved.append(r)
    av = [p for p in r.get('passes', []) if p['pass'] == 'hit-avoid']
    if av: avoid_rows.append((r, av[0]))
for k, v in c.items(): print(f'  {k}: {v}')
def mh(m): return '-' if not m else f"{m['hits']}h{m['deaths']}d"
print(f'both passes hit (every planned pass of dashless/full takes a model hit): {len(both)}')
for r in both:
    av = next((p for p in r['passes'] if p['pass'] == 'hit-avoid'), None)
    ps = '; '.join(f"{p['pass']} {p.get('ticks')} t {mh(p.get('modelHits'))} w{p.get('work')}" for p in r['passes'] if p['pass'] != 'hit-avoid')
    a = f"hit-avoid {'OK delay '+str(av.get('delay'))+' '+str(av.get('ticks'))+' t' if av and av['ok'] else 'none'} tries {av and av.get('tries')} work {av and av.get('work')} cut {av and av.get('cut')}"
    print(f"  {r['id']:>4} {r['key']}\n       {ps} | {a}\n       base {r['shippedBase']['pass']} {r['shippedBase']['ticks']} t {mh(r['shippedBase']['modelHits'])} -> ON {r['shippedOn']['pass']} {r['shippedOn']['ticks']} t {mh(r['shippedOn']['modelHits'])}")
print(f'moved (shipped pass or ticks differ, base rule -> ON): {len(moved)}')
for r in moved:
    print(f"  {r['id']:>4} {r['key']}: {r['shippedBase']['pass']} {r['shippedBase']['ticks']} t {mh(r['shippedBase']['modelHits'])} -> {r['shippedOn']['pass']} {r['shippedOn']['ticks']} t {mh(r['shippedOn']['modelHits'])} redrive {r.get('redrive')}")
gain = [r for r in moved if r['shippedOn']['modelHits'] and r['shippedBase']['modelHits'] and (r['shippedOn']['modelHits']['hits'] > r['shippedBase']['modelHits']['hits'] or r['shippedOn']['modelHits']['deaths'] > r['shippedBase']['modelHits']['deaths'])]
print(f'moved toward MORE hits/deaths: {len(gain)}')
w = [p.get('work', 0) for _, p in avoid_rows]
if w: print(f'hit-avoid pass ran on {len(w)} leg(s); work median {statistics.median(w)} max {max(w)}; tries {[p.get("tries") for _, p in avoid_rows]}; ok {sum(1 for _, p in avoid_rows if p["ok"])}')
