"""rules-k-exempt-entry: the rows of a rules doc that touch a census hit's sub-region, as readable DNF (min item sets).
usage: hitrows.py <rules.json> level_77__r12c6 [...]"""
import json, sys, itertools
def items(r, out):
    if not r: return
    if r.get('rule') == 'Has': out.add((r['args']['item_name'], r['args'].get('count', 1)))
    for c in r.get('children') or []: items(c, out)
def ev(r, h):
    if r is None: return True
    k = r['rule']
    if k == 'True_': return True
    if k == 'Has': return h.get(r['args']['item_name'], 0) >= r['args'].get('count', 1)
    if k == 'And': return all(ev(c, h) for c in r['children'])
    if k == 'Or': return any(ev(c, h) for c in r['children'])
    raise ValueError(k)
def dnf(r):
    its = set(); items(r, its)
    at = {}
    for n, c in its: at[n] = max(at.get(n, 0), c)
    at = sorted(at.items()); mins = []
    for k in range(len(at) + 1):
        for combo in itertools.combinations(at, k):
            h = dict(combo)
            if ev(r, h) and not any(set(m) <= set(combo) for m in mins): mins.append(combo)
    return ' | '.join(' & '.join(f"{n}x{c}" if c > 1 else n for n, c in m) or 'FREE' for m in mins) or 'NEVER'
if __name__ == "__main__":
  doc = json.load(open(sys.argv[1])); regs = doc['regions']['1']
  for sub in sys.argv[2:]:
      for n, g in regs.items():
          for e in g.get('exits', []):
              if sub in (n, e['connected_region']): print(f"{n} -> {e['connected_region']}  =  {dnf(e.get('access_rule'))}")
          if n == sub:
              for l in g.get('locations', []): print(f"{n} : loc {l['name']}  =  {dnf(l.get('access_rule'))}")
