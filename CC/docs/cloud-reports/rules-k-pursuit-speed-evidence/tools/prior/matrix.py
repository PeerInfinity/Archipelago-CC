"""The route matrix: every route K moved (route-diff-K.txt), and whether each candidate moves it too.
Usage: matrix.py runs/route-diff-{K,b,c,bc,bcr,r}.txt -> markdown rows (L12 / L40-L43 fan-out collapsed to counts)."""
import sys, re, collections
V = ['K', 'b', 'c', 'bc', 'bcr', 'r', 'bcR', 'bR', 'R', 'bcrJ', 'bcRJ', 'bRJ', 'RJ']
def load(p):
    out = {}; key = None
    for line in open(p):
        if line.startswith('MOVED'): break
        if not line.startswith('    '): key = line.strip(); out[key] = {}
        else:
            k, v = line.strip().split(' ', 1); out[key][k] = v
    return out
d = {v: load(f'runs/route-diff-{v}.txt') for v in V}
def grp(k):
    m = re.search(r'=> (?:exit|loc):(level_\d+|L\d+|Level \d+)', k)
    g = m.group(1) if m else '?'
    g = re.sub(r'level_0*(\d+)', r'L\1', g); g = re.sub(r'Level 0*(\d+)', r'L\1', g)
    return g
groups = collections.OrderedDict()
for k in d['K']: groups.setdefault(grp(k), []).append(k)
print('| route | base | K tip | ' + ' | '.join(V[1:]) + ' |'); print('|---|---|---|' + '---|' * (len(V) - 1))
for g, keys in groups.items():
    if len(keys) > 12:
        cnt = {v: sum(1 for k in keys if k in d[v]) for v in V}
        print(f"| **{g}** fan-out ({len(keys)} routes) | | | " + ' | '.join(f"{cnt[v]}/{len(keys)}" for v in V[1:]) + ' |')
        continue
    for k in keys:
        print(f"| `{k}` | {d['K'][k]['base']} | {d['K'][k]['tip']} | " + ' | '.join(('**moves**' + ('' if d[v][k]['tip'] == d['K'][k]['tip'] else f" → {d[v][k]['tip']}")) if k in d[v] else 'stays' for v in V[1:]) + ' |')
extra = {v: [k for k in d[v] if k not in d['K']] for v in V[1:]}
for v, ks in extra.items():
    for k in ks: print(f"| (not a K row) `{k}` | {d[v][k]['base']} | — | {v}: {d[v][k]['tip']} |")
