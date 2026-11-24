#!/usr/bin/env python3
"""Print every exit/location rule of the regions of the named levels in an AP rules JSON (a file, or rev:path).
Usage: levelRules.py <file | rev:path> <level> [<level> ...]"""
import json, subprocess, sys

def load(spec):
    if ':' in spec and not spec.startswith('/'):
        rev, p = spec.split(':', 1)
        return json.loads(subprocess.run(['git', 'show', f'{rev}:{p}'], capture_output=True, check=True).stdout)
    return json.load(open(spec))

def fmt(r):
    if r is None: return 'FREE'
    k = r.get('rule')
    if k == 'True_': return 'FREE'
    if k == 'Has':
        c = r['args'].get('count', 1)
        return r['args']['item_name'] + (f' x{c}' if c != 1 else '')
    if k in ('And', 'Or'):
        return k + '(' + ', '.join(fmt(c) for c in r['children']) + ')'
    return json.dumps(r)

doc = load(sys.argv[1])
regions = doc['regions']['1'] if '1' in doc['regions'] else doc['regions']
levels = sys.argv[2:]
for name in sorted(regions):
    lv = name.split('__')[0].replace('level_', '')
    targets = [e for e in regions[name].get('exits', []) if any(e['connected_region'].split('__')[0] == f'level_{l}' for l in levels)]
    if lv not in levels and not targets: continue
    for e in regions[name].get('exits', []):
        if lv in levels or e in targets:
            print(f'{name} -> {e["connected_region"]}  [{e["name"]}]: {fmt(e.get("access_rule"))}')
    if lv in levels:
        for l in regions[name].get('locations', []):
            print(f'{name} @ {l["name"]}: {fmt(l.get("access_rule"))}')
