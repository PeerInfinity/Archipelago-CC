#!/usr/bin/env python3
"""Every maze world's pulls / blocks / entry gates and its T-gated cells (cells whose gate names hasDarkSuit|hasSpear),
per level, from a maze preset (a file, or rev:path). Usage: mazePulls.py <maze rules.json | rev:path> <level> [...]"""
import json, subprocess, sys
def load(spec):
    if ':' in spec and not spec.startswith('/'):
        rev, p = spec.split(':', 1)
        return json.loads(subprocess.run(['git', 'show', f'{rev}:{p}'], capture_output=True, check=True).stdout)
    return json.load(open(spec))
doc = load(sys.argv[1])
sc = doc['preset_sidecars']['1']
for name in sorted(sc):
    lv = name.split('__')[0].replace('level_', '')
    if lv not in sys.argv[2:]: continue
    p = sc[name].get('playable_payload', {})
    w = p.get('world', p)
    keys = sorted(k for k in w if isinstance(w, dict))
    print(f'== {name}: payload keys {keys[:30]}')
    for k in ('pulls', 'blocks', 'entry_gates'):
        if k in w: print(f'  {k}: {json.dumps(w[k], sort_keys=True)}')
