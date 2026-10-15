#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sf2 D1): the census tables from sf2-census.py's JSON lines (stdin).
--long: one row per (workload, variant); default: the totals per variant."""
import json, sys
rows = [json.loads(l) for l in sys.stdin if l.strip().startswith('{')]
def c4(c):
    c = c or {}
    return (c.get('earlier', 0), c.get('lost', 0), c.get('found', 0), c.get('later', 0) + c.get('other', 0))
V = rows[0]['variants']
if '--long' in sys.argv:
    print('| workload | variant | earlier · **lost** · found · other | a-found it loses | previews | scan s (× OFF) |')
    print('|---|---|---|---|---|---|')
    for s in rows:
        for v in V:
            if f'ms_{v}' not in s: continue
            e, l, f, o = c4(s.get(f'cat_{v}')) if v != 'off' else ('', '', '', '')
            cats = '—' if v == 'off' else f'{e} · **{l}** · {f} · {o}'
            print(f"| {s['wl']} ({s['derivations']:,}; OFF refuses {s['refused_off']:,}) | {v} | {cats} | {s.get(f'aLost_{v}', '—')} "
                  f"| {s[f'previews_{v}']:,} | {s[f'ms_{v}']:.1f} ({s[f'ms_{v}'] / s['ms_off']:.2f}×) |")
else:
    print('| variant | earlier · **lost** · found · other | a-found it loses | previews | scan s, all 12 | L18 scan s (× OFF) | staging A sword (× OFF) | ghost staging (× OFF) |')
    print('|---|---|---|---|---|---|---|---|')
    by = {s['wl']: s for s in rows}
    for v in V:
        tot = [0, 0, 0, 0]; al = 0; pv = 0; ms = 0
        for s in rows:
            if v != 'off':
                for k, x in enumerate(c4(s.get(f'cat_{v}'))): tot[k] += x
                al += s.get(f'aLost_{v}', 0)
            pv += s[f'previews_{v}']; ms += s[f'ms_{v}']
        r = lambda w: f"{by[w][f'ms_{v}']:.1f} ({by[w][f'ms_{v}'] / by[w]['ms_off']:.2f}×)"
        cats = '—' if v == 'off' else f'{tot[0]:,} · **{tot[1]:,}** · {tot[2]:,} · {tot[3]:,}'
        print(f"| {v} | {cats} | {'—' if v == 'off' else f'{al:,}'} | {pv:,} | {ms:.0f} | {r('l18')} | {r('A-sword')} | {r('ghost-sweep')} |")
