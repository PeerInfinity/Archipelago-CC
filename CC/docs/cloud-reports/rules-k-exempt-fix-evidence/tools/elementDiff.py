"""rules-k-exempt-fix: the probe's element rows (derived-rules.json) base -> tip: ADD / DEL / CHG by key, each with its
kind and label, bucketed by level; and the `unpriced` list's level counts. usage: elementDiff.py <base.json> <tip.json>"""
import json, sys, re, collections
a, b = (json.load(open(p)) for p in sys.argv[1:3])
lv = lambda k: (re.search(r'level_(\d+)', k) or [None, '?'])[1]
lab = lambda r: f"{r.get('kind')}:{r.get('label') or r.get('certifierLabel')}:{r.get('arrival')}"
ka, kb = {r['key']: r for r in a['rows']}, {r['key']: r for r in b['rows']}
per = collections.Counter()
for k in sorted(set(ka) | set(kb)):
    x, y = ka.get(k), kb.get(k)
    if x and y and json.dumps(x, sort_keys=True) == json.dumps(y, sort_keys=True): continue
    tag = 'ADD' if not x else 'DEL' if not y else 'CHG'
    per[(lv(k), tag)] += 1
    fields = ''
    if tag == 'CHG': fields = ' fields=' + ','.join(f for f in sorted(set(x) | set(y)) if json.dumps(x.get(f), sort_keys=True) != json.dumps(y.get(f), sort_keys=True))
    print(f"{tag} L{lv(k)} {k}  {lab(x) if x else ''} -> {lab(y) if y else ''}  label {x and x.get('label')} -> {y and y.get('label')}{fields}")
print('PER LEVEL', dict(sorted(per.items())))
ua = collections.Counter(lv(json.dumps(u)) for u in a.get('unpriced', [])); ub = collections.Counter(lv(json.dumps(u)) for u in b.get('unpriced', []))
print('UNPRICED', len(a.get('unpriced', [])), '->', len(b.get('unpriced', [])), {k: (ua[k], ub[k]) for k in sorted(set(ua) | set(ub), key=str) if ua[k] != ub[k]})
print('SUMMARY keys moved:')
def flat(d, p=''):
    for k, v in d.items():
        if isinstance(v, dict): yield from flat(v, f'{p}{k}.')
        else: yield f'{p}{k}', v
fa, fb = dict(flat(a['summary'])), dict(flat(b['summary']))
for k in sorted(set(fa) | set(fb)):
    if fa.get(k) != fb.get(k): print(f'  {k}: {fa.get(k)} -> {fb.get(k)}')
