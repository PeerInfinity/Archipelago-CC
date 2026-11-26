# MEASUREMENT-ONLY: matrix-raw.jsonl -> one row per (request, variant), the matrix-32-10 table shape.
import json, sys
KEYS = {'leg376-l40-request.json.gz': 'level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144 (seam 5271 capture)'}
rows = [json.loads(l) for l in open(sys.argv[1])]
order = ['off', 'all4', 'noPKRB', 'noLHM', 'noDSS']
def lab(d):
    s = d['src']
    if '#' in s:
        f, ij = s.split('#'); run = f.split('.')[0]
        return f"{ {'r8-A1': 'A1', 'r8-P1': 'P1', 'r9-F1': 'F1(rm9)'}[run]} {ij} seam={d['seam']:+d}"
    return f"{s.replace('-request.json.gz','').replace('-request.jsonl.gz','')} | {d['key'] or KEYS.get(s, '?')}"
groups = {}
for d in rows: groups.setdefault(lab(d), {})[d['variant']] = d
for g, vs in groups.items():
    for v in order + sorted(set(vs) - set(order)):
        d = vs.get(v)
        if not d: continue
        r = d['reach']; reach = f"pksw {r['pksw']} pkrb {r['pkrb']['asked']}/{r['pkrb']['refused']} dss {r['dss']['asks']} lhm {r['lhm']['asked']}/{r['lhm']['moves']}m"
        verdict = f"SOLVED {d['ticks']} t" if d['ok'] else 'REFUSED ' + (d['msg'] or '')[len('solverBot(wasm-location-40) '):][:70]
        print(f"{g} | {v:7} | {verdict} | work {d['work']} | ans {d['answer']} | hits: {'; '.join(d['hits']) if d['hits'] else ('none' if d['ok'] else '-')} | deaths {d['deaths']} | {reach}")
    print()
