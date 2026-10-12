# SCRATCH (g1): a d1-run.sh jsonl → one markdown row per leg: sword verdict | ghost verdict | keys/err md5 | s.
# The runner's `sh` echo expands `\n` inside rows, so records are re-joined on their `{"id":` starts.
import json, re, sys
txt = open(sys.argv[1]).read().strip()
recs = re.split(r'\n(?=\{"id":)', txt)
rows = {}
for l in recs:
    d = json.loads(l.replace('\n', '\\n').replace('"wall":.', '"wall":0.'), strict=False)
    r = d.get('row') or {}
    o = r.get('outcome', 'TIMEOUT' if d['rc'] == 124 else f"rc{d['rc']}")
    if o == 'solved':
        v = f"SOLVED {r['ticks']}" + (f" ({r['hits']} hit)" if r.get('hits') else '')
    elif o == 'refused':
        ob = r.get('obstacle') or {}
        v = f"REFUSED ({ob.get('kind')}: {ob.get('id')})"
        if 'derives is a SWORD press' in (r.get('err') or ''):
            v += ' [rung gate]'
    else:
        v = o.upper() + (' ' + (r.get('err') or '')[:60] if o == 'threw' else '')
    rows.setdefault(d['id'], {})[d['ghost']] = (v, r.get('keysMd5') or r.get('errMd5') or '', d['wall'])
for i in sorted(rows):
    s, g = rows[i].get(0, ('-', '', 0)), rows[i].get(1, ('-', '', 0))
    print(f"| {i} | {s[0]} | {g[0]} | {s[1][:8]} / {g[1][:8]} | {s[2]:.1f} / {g[2]:.1f} |")
