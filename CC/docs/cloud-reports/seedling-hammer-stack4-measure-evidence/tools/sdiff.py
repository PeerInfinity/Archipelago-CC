# (copied from PKSW-HITS tools/sdiff.py; addition at the end)
# MEASUREMENT-ONLY: per-step comparison of survey JSONs (verdict, ticks, hits, deaths, end, refusal head); ms ignored.
import json, sys
def load(p):
    d = json.load(open(p)); rows = d.get('steps') or d.get('rows')
    out = {}
    for r in rows:
        rp = r.get('replay') or {}
        out[r['step']] = dict(level=r.get('level'), verdict=r.get('verdict'), ticks=r.get('ticks'), hits=rp.get('hits'), deaths=rp.get('deaths'),
                              end=rp.get('endLevel'), refusal=(r.get('refusal') or '')[:160], ms=r.get('ms'))
    return out
names = sys.argv[1:]
data = {n: load(f'{n}') for n in names}
base = data[names[0]]
print('\t'.join(['step', 'level'] + [f'{n.split("survey-")[-1][:-5]} {k}' for n in names for k in ('verdict', 'ticks', 'hits', 'ms')] + ['same(all but ms)']))
moved = []
for s in sorted(base):
    rows = [data[n].get(s, {}) for n in names]
    key = lambda r: (r.get('verdict'), r.get('ticks'), r.get('hits'), r.get('deaths'), r.get('end'), r.get('refusal'))
    same = all(key(r) == key(rows[0]) for r in rows)
    print('\t'.join([str(s), str(base[s]['level'])] + [str(r.get(k)) for r in rows for k in ('verdict', 'ticks', 'hits', 'ms')] + [str(same)]))
    if not same: moved.append(s)
print('#', len(base), 'steps; moved:', moved, file=sys.stderr)
for n in names:
    d = data[n]; print('#', n.split('survey-')[-1], 'SOLVED', sum(r['verdict'] == 'SOLVED' for r in d.values()), 'hits', sum((r['hits'] or 0) for r in d.values()), 'TIMEOUT', sum(r['verdict'] == 'TIMEOUT' for r in d.values()), file=sys.stderr)
# stack4-measure addition: every step with a hit or a death in ANY variant, per variant (read per step, not totals).
print('# steps with hits/deaths in any variant:', file=sys.stderr)
for s in sorted(base):
    rows = [data[n].get(s, {}) for n in names]
    if any((r.get('hits') or 0) or (r.get('deaths') or 0) for r in rows):
        print('#  step', s, 'L' + str(base[s]['level']), ' '.join(f"{n.split('survey-')[-1][:-5]}={r.get('verdict')}/{r.get('hits')}h/{r.get('deaths')}d" for n, r in zip(names, rows)), file=sys.stderr)
