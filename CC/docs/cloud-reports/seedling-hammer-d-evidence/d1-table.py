#!/usr/bin/env python3
# SCRATCH (seedling-hammer-d D1): the sword / ghost table from d1-run.sh's jsonl (bc writes ".62": patched on read)
import json, re, sys
# ⚠ the runner's `sh` echo expands the JSON's `\n` escapes, so one row can span physical lines: re-join until it parses
rows = {}
buf = ''
for l in open(sys.argv[1]):
    buf += l
    try: d = json.loads(re.sub(r'"wall":\.', '"wall":0.', buf), strict=False)
    except json.JSONDecodeError: continue
    buf = ''
    rows.setdefault(d['id'], {})[d['ghost']] = d
def cell(d):
    if d is None: return 'pending'
    r = d['row']
    if r is None: return f"TIMEOUT/rc{d['rc']} ({d['wall']:.0f} s)"
    if r['outcome'] == 'solved':
        land = r.get('spinnerLandings') or []
        return f"SOLVED {r['ticks']} t {'+'.join(r['verbs'])}, hits {r['hits']}, landings {len(land)}, {r['ms']/1000:.1f} s"
    return f"{r['outcome'].upper()} ({(r.get('err') or '')[:90]}) {r['ms']/1000:.1f} s"
for i in sorted(rows):
    s, g = rows[i].get(0), rows[i].get(1)
    same = s and g and s['row'] and g['row'] and s['row'].get('outcome') == g['row'].get('outcome') and s['row'].get('ticks') == g['row'].get('ticks')
    key = ((s or g)['row'] or {}).get('key', '')
    print(f"| {i} | `{key}` | {cell(s)} | {cell(g)} | {'=' if same else '**≠**'} |")
