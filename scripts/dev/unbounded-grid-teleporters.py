#!/usr/bin/env python3
"""unbounded-grid-teleporters — READ-ONLY census of the teleporters in every
committed generated preset, split by WHY each one exists.

Survey `unbounded-grid-survey` (2026-11-15). Report:
`CC/docs/region-map/unbounded-grid-survey.md`. Touches nothing; prints a table
(and `--json` writes the rows).

The roster is DERIVED: every `frontend/presets/*/AP_*/*_rules.json` whose
`procgen_metadata` is a non-empty dict with a `driver`, per player slot.

Classification (exact, from the recorded data, no regeneration):

* Sphere drivers (`sphere-growth`, `top-down-sphere`) record the placement
  tree in `procgen_metadata[p].sphere_tree.nodes`, in placement order, with
  `parent`, `side`, `cell`, `isTeleporter`. A teleporter NODE is a child the
  placer could not put next to its parent. At that moment the occupied cells
  are exactly the cells of the nodes before it.
  - sphere-growth (`placeSphereTreeCells`): the candidate sides are the
    host's sides minus its entrance side (toward its own parent) minus the
    sides earlier siblings took. The node teleported because every
    candidate neighbour was occupied OR out of the box.
  - top-down-sphere (`layoutTopDown` → `findAdjacentEmptyCell`): the
    candidates are all four neighbours of the parent's cell.
  A teleporter node is **BOX-FORCED** when at least one candidate neighbour
  was OUT OF THE BOX (with no box, that neighbour was free, so the child
  would have been adjacent). It is **OCCUPIED** when every candidate was an
  in-box occupied cell (no box would have saved it).
  Teleporter EXITS that are not a tree edge (top-down: an exit to a region
  another branch already placed, not adjacent; any driver: the bidirectional
  pass) are **OTHER** — the box had no part in them.
* grid-growth (`growMazeGen`, no tree): a forward teleporter exit's
  geographic neighbour on its own side was either out of the box (BOX-FORCED)
  or built (OCCUPIED); the sidecar holds both facts.
* shuffled-spiral and anything else: the forward exits are classified the
  grid-growth way (spiral cells are consecutive, so they should be zero).

Run:  python3 scripts/dev/unbounded-grid-teleporters.py [--json out.json] [rules.json ...]
      (no files = every committed preset)
"""
import glob
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DELTA = {'N': (0, -1), 'S': (0, 1), 'E': (1, 0), 'W': (-1, 0)}
OPP = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}


def in_box(c, dims):
    return 0 <= c[0] < dims['width'] and 0 <= c[1] < dims['height']


def classify_tree(nodes, dims, driver):
    occupied = set()
    taken = {}  # parent index -> sides earlier children took
    out = {'box': 0, 'occupied': 0, 'nodes': len(nodes), 'edges': set()}
    for n in nodes:
        c = (n['cell']['gx'], n['cell']['gy']) if n.get('cell') else None
        p = n.get('parent')
        if p is not None:
            out['edges'].add((p, n['index']))
            if n.get('isTeleporter'):
                par = nodes[p]
                pc = (par['cell']['gx'], par['cell']['gy'])
                if driver == 'sphere-growth':
                    ent = OPP[par['side']] if par.get('side') else None
                    cands = [s for s in DELTA if s != ent and s not in taken.get(p, set())]
                else:
                    cands = list(DELTA)
                nbrs = [(pc[0] + DELTA[s][0], pc[1] + DELTA[s][1]) for s in cands]
                oob = [q for q in nbrs if not in_box(q, dims)]
                free_in_box = [q for q in nbrs if in_box(q, dims) and q not in occupied]
                if free_in_box and driver == 'sphere-growth':
                    raise AssertionError(f'node {n["index"]}: a free in-box candidate yet teleported')
                out['box' if oob else 'occupied'] += 1
            if n.get('side'):
                taken.setdefault(p, set()).add(n['side'])
        if c is not None:
            occupied.add(c)
    return out


def rows(files=None):
    # `path@WxH` overrides the box: `grid_dims` records the cells' extent (max+1, the engine's
    # buildRulesJson), which equals the growth box only when the cells reach its far edges. With a
    # smaller-than-real box the BOX-FORCED count is an UPPER bound (more cells look out of the box).
    boxes = {}
    if files:
        fs = []
        for a in files:
            if '@' in a:
                a, wh = a.rsplit('@', 1)
                w, h = wh.split('x')
                boxes[os.path.abspath(a)] = {'width': int(w), 'height': int(h)}
            fs.append(a)
        files = fs
    files = files or sorted(glob.glob(os.path.join(REPO, 'frontend/presets/*/AP_*/*_rules.json')))
    for f in files:
        try:
            d = json.load(open(f))
        except Exception:
            continue
        pm = d.get('procgen_metadata')
        if not isinstance(pm, dict):
            continue
        for slot, m in pm.items():
            if not isinstance(m, dict) or 'driver' not in m:
                continue
            dims = boxes.get(os.path.abspath(f)) or m.get('grid_dims')
            sc = (d.get('preset_sidecars') or {}).get(slot) or {}
            cells = {}
            for name, r in sc.items():
                gc = r.get('grid_cell') if isinstance(r, dict) else None
                if gc:
                    cells[name] = (gc['gx'], gc['gy'])
            by_cell = {v: k for k, v in cells.items()}
            fwd = back = 0
            fwd_exits = []
            for name, r in sc.items():
                for e in ((r.get('playable_payload') or {}).get('exits') or []) if isinstance(r, dict) else []:
                    if not e.get('isTeleporter'):
                        continue
                    if e.get('isBackExit'):
                        back += 1
                    else:
                        fwd += 1
                        fwd_exits.append((name, e))
            row = {
                'preset': (os.path.relpath(f, os.path.join(REPO, 'frontend/presets'))
                           if os.path.abspath(f).startswith(os.path.join(REPO, 'frontend/presets'))
                           else os.path.basename(f)),
                'slot': slot, 'driver': m['driver'], 'dims': dims, 'grid_dims': m.get('grid_dims'), 'regions': len(cells),
                'stop_reason': m.get('stop_reason'),
                'tele_exits_fwd': fwd, 'tele_exits_back': back,
            }
            if cells:
                xs = [c[0] for c in cells.values()]
                ys = [c[1] for c in cells.values()]
                row['bbox'] = [min(xs), min(ys), max(xs), max(ys)]
            tree = m.get('sphere_tree')
            if tree and tree.get('nodes') and dims:
                t = classify_tree(tree['nodes'], dims, m['driver'])
                row['tree_box_forced'] = t['box']
                row['tree_occupied'] = t['occupied']
                # forward teleporter exits that are not a tree teleporter edge
                row['other_exits'] = max(0, fwd - t['box'] - t['occupied'])
            elif dims:
                box = occ = 0
                for name, e in fwd_exits:
                    c = cells.get(name)
                    s = e.get('side')
                    if c is None or s not in DELTA:
                        continue
                    q = (c[0] + DELTA[s][0], c[1] + DELTA[s][1])
                    if not in_box(q, dims):
                        box += 1
                    elif q in by_cell:
                        occ += 1
                row['exit_box_forced'] = box
                row['exit_occupied'] = occ
                row['other_exits'] = fwd - box - occ
            yield row


def main():
    args = sys.argv[1:]
    jpath = None
    if '--json' in args:
        jpath = args[args.index('--json') + 1]
        del args[args.index('--json'):args.index('--json') + 2]
    out = list(rows(args or None))
    hdr = ('preset', 'slot', 'driver', 'dims', 'regions', 'bbox', 'fwd', 'back', 'BOX', 'OCC', 'OTHER', 'stop')
    print(' | '.join(hdr))
    tot = {'BOX': 0, 'OCC': 0, 'OTHER': 0, 'fwd': 0}
    for r in out:
        box = r.get('tree_box_forced', r.get('exit_box_forced', 0))
        occ = r.get('tree_occupied', r.get('exit_occupied', 0))
        oth = r.get('other_exits', 0)
        tot['BOX'] += box; tot['OCC'] += occ; tot['OTHER'] += oth; tot['fwd'] += r['tele_exits_fwd']
        dims = f"{r['dims']['width']}x{r['dims']['height']}" if r.get('dims') else '-'
        print(' | '.join(str(x) for x in (r['preset'], r['slot'], r['driver'], dims, r['regions'],
                                          r.get('bbox'), r['tele_exits_fwd'], r['tele_exits_back'],
                                          box, occ, oth, r['stop_reason'])))
    print(f"TOTAL rows={len(out)} fwd_teleporter_exits={tot['fwd']} BOX-FORCED={tot['BOX']} "
          f"OCCUPIED={tot['OCC']} OTHER={tot['OTHER']}")
    if jpath:
        json.dump(out, open(jpath, 'w'), indent=1)


if __name__ == '__main__':
    main()
