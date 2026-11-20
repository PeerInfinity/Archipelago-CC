"""Per sidecar with `pulls`: the trap, its `from` cells removed/added, its `yields` before/after; and every other path that differs."""
import json, subprocess, sys
a = json.loads(subprocess.check_output(['git', 'show', sys.argv[1]])) if ':' in sys.argv[1] else json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2]))
other = 0
for name in sorted(set(a['preset_sidecars']['1']) | set(b['preset_sidecars']['1'])):
    pa = (a['preset_sidecars']['1'].get(name) or {}).get('playable_payload') or {}
    pb = (b['preset_sidecars']['1'].get(name) or {}).get('playable_payload') or {}
    xa, xb = dict(pa), dict(pb)
    la, lb = xa.pop('pulls', None), xb.pop('pulls', None)
    if xa != xb: other += 1; print(f'{name}: OTHER payload fields differ')
    if la is None and lb is None: continue
    for i, (p, q) in enumerate(zip(la or [], lb or [])):
        fa = {(c['x'], c['y']) for c in p['from']}; fb = {(c['x'], c['y']) for c in q['from']}
        ka = {k: v for k, v in p.items() if k != 'from'}; kb = {k: v for k, v in q.items() if k != 'from'}
        print(f"{name} pull {i} trap ({p['x']},{p['y']}): from {len(fa)} -> {len(fb)}; DEL {sorted(fa - fb)} ADD {sorted(fb - fa)}; "
              f"yields {p.get('yields')} -> {q.get('yields')}; other keys {'same' if ka == kb else f'{ka} -> {kb}'}")
ra = {k: v for k, v in a.items() if k != 'preset_sidecars'}; rb = {k: v for k, v in b.items() if k != 'preset_sidecars'}
print('top-level (non-sidecar) keys:', 'same' if ra == rb else 'DIFFER: ' + str([k for k in set(ra) | set(rb) if ra.get(k) != rb.get(k)]))
print('sidecars with other differences:', other)
