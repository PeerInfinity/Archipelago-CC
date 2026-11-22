"""rules-k-exempt-fix: compare two sphere logs. Per sphere: everything but new_accessible_regions must be identical (a
sphere move); new_accessible_regions is diffed per level (sub-region NAMES: level_NN__rYcX folded to level_NN)."""
import json, sys, re
def load(p): return [json.loads(l) for l in open(p) if l.strip()]
a, b = load(sys.argv[1]), load(sys.argv[2])
fold = lambda r: re.sub(r'__r\d+c\d+$', '', r)
moves = 0
if len(a) != len(b): print(f'LENGTH {len(a)} -> {len(b)}'); moves += 1
for x, y in zip(a, b):
    if x == y: continue
    sx, sy = x.get('sphere_index'), y.get('sphere_index')
    px, py = x.get('player_data', {}).get('1', {}), y.get('player_data', {}).get('1', {})
    rx, ry = set(px.pop('new_accessible_regions', [])), set(py.pop('new_accessible_regions', []))
    if sx != sy or {k: v for k, v in x.items() if k != 'player_data'} != {k: v for k, v in y.items() if k != 'player_data'} or px != py:
        moves += 1; print(f'SPHERE MOVE at {sx}/{sy}'); continue
    print(f'sphere {sx}: regions -{sorted(rx - ry)} +{sorted(ry - rx)}; folded to levels -{sorted({fold(r) for r in rx} - {fold(r) for r in ry})} +{sorted({fold(r) for r in ry} - {fold(r) for r in rx})}')
print('SPHERE MOVES (beyond region names):', moves)
