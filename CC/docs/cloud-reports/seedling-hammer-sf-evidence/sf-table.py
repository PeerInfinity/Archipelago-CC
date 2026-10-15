#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sf D2): the report's census table from sf-census.py's JSON lines (stdin)."""
import json, sys
rows = [json.loads(l) for l in sys.stdin if l.strip().startswith('{')]
def cats(c):
    c = c or {}
    return f"{c.get('earlier', 0)} · {c.get('lost', 0)} · {c.get('found', 0)} · {c.get('later', 0) + c.get('other', 0)}"
print('| workload | derivations (OFF refuses) | floor only: earlier · lost · found · other | a: earlier · lost · found · other | b: earlier · lost · found · other '
      "| floor-only's lost, under a / b | arrived previews · beat OFF floor (worst) · beat SF floor | previews OFF / floor / a / b | scan s OFF / floor / a / b |")
print('|---|---|---|---|---|---|---|---|---|')
for s in rows:
    if not s.get('derivations'):
        print(f"| {s['wl']} | 0 | | | | | | | |"); continue
    fl = lambda v: ', '.join(f'{k} {n}' for k, n in sorted(s[f'floorLost_{v}'].items())) or '—'
    print(f"| {s['wl']} | {s['derivations']:,} ({s['refused_off']:,}) | {cats(s['cat_floor'])} | {cats(s['cat_a'])} | {cats(s['cat_b'])} "
          f"| {sum(s['floorLost_a'].values())}: a {fl('a')} / b {fl('b')} "
          f"| {s['arrived']:,} · {s['underOff']:,} ({s['maxOffMinusEta']}) · **{s['underOn']}** (least ETA − floor {s['minEtaMinusOn']}) "
          f"| {s['previews_off']:,} / {s['previews_floor']:,} / {s['previews_a']:,} / {s['previews_b']:,} "
          f"| {s['ms_off']} / {s['ms_floor']} / {s['ms_a']} / {s['ms_b']} |")
