import json, re, sys
rows = {}
for line in open(sys.argv[1]):
    m = re.match(r'PGF(\d) (\S\S) (\S+) (.*)', line.strip())
    if not m: continue
    arm, f, req, rest = m.groups()
    a = re.search(r'ANSWER (\{.*?\}) (?:PGF|REPLAY|$)', rest)
    ans = json.loads(a.group(1)) if a else None
    r = re.search(r'REPLAY (\{.*?\}) (?:PGF|$)', rest + ' ')
    rep = json.loads(r.group(1)) if r else None
    p = re.search(r'PGF (\{.*\}) enabled', rest)
    pgf = json.loads(p.group(1)) if p else None
    rows.setdefault((f, req), {})[arm] = (ans, rep, pgf)
def k(x):
    f, req = x; a, b = req.split(':'); return (f, int(a), int(b))
moved = 0; asked = 0; leaned = 0
for key in sorted(rows, key=k):
    d = rows[key]
    def s(arm):
        ans, rep, pgf = d.get(arm, (None, None, None))
        if ans is None: return 'MISSING'
        hits = [f"{h['source']}:{h['id']}@{h['t']}" for h in (rep or {}).get('hits', [])]
        return f"{'SOLVED' if ans['ok'] else 'refused'} {ans['answer']} work={ans['work']} ticks={ans['ticks']} hits={len(hits)}{(' ' + ','.join(hits)) if hits else ''}"
    p = d.get('1', (None, None, None))[2] or {}
    if p.get('asked'): asked += 1
    if p.get('followed'): leaned += 1
    tag = 'SAME ' if s('0') == s('1') else 'MOVED'
    if tag == 'MOVED': moved += 1
    extra = f" | PGF asked={p.get('asked')} eligible={p.get('eligible')} leaned={[ (x['step'], x['leaned']) for x in p.get('followed', [])]} declined={[ (x['step'], x['why'][:60]) for x in p.get('declined', [])]}" if p.get('asked') else ''
    print(f"{tag} {key[0]} {key[1]}\n   OFF {s('0')}\n   ON  {s('1')}{extra}")
print(f"TOTAL {len(rows)} requests; moved {moved}; hook asked in {asked} ON solves; leaned in {leaned}")
