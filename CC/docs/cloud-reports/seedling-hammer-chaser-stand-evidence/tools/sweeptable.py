# MEASUREMENT-ONLY: the P1/F1 32:10 seam sweep (one JSON line per seam × variant) → one row per seam.
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1])]
by = {}
for d in rows: by.setdefault(d['seam'], {})[d['variant']] = d
def f(d):
    if not d: return '-'
    if not d['ok']: return 'REFUSED (' + ('deadline' if 'shouldStop' in (d['msg'] or '') else 'rung') + ')'
    hs = ' '.join(h.split(' <-')[0] for h in d['hits'])
    return f"{d['ticks']} t {len(d['hits'])} h{(' ' + hs) if hs else ''} [pksw {d['reach']['pksw']}]"
print('seam (P1 capture = 82082; F1 = P1-97; A1 = P1-2939) | off | all4 | noPKRB')
for s in sorted(by): print(f"P1{s:+d} (F1{s + 97:+d}) | {f(by[s].get('off'))} | {f(by[s].get('all4'))} | {f(by[s].get('noPKRB'))}")
