#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-re D1): the census of what the refuge's best-ETA cut (and the two pre-filters) would hide.

Reads the lab's per-derivation records (one JSON line per `deriveRefuge` call, RE_LAB=census) and prints one summary
row per file. Every derivation ran the FULL (base) preview of each candidate; the cut / pre-filter outcomes are
derived from each candidate's full length, so the run itself is the base run.

  hidden_cut   previews whose full run raised a throw (death / forecast refusal) or ended on a lethal pit / drowning
               PAST the cut (sample >= best.eta + 1)
  hidden_lb    the same for the ETA lower-bound pre-filter (a candidate whose `minTicksBetween` exceeds best.eta is
               never previewed, so anything anywhere in its preview is hidden)
  cell_cut     derivations whose chosen cell differs under the cut (simulated beside the base, in the lab)
  cell_wall    derivations whose chosen cell differs under the wall pre-filter (candidates whose straight line from
               the player is blocked by a solid are dropped), recomputed here from the rows
  samples      preview states: full, under the cut, under cut + lb, under cut + wall
  usage: census.py <file.jsonl>...
"""
import json
import sys


def best_of(rows, keep):
    best = None
    for r in rows:
        if not keep(r):
            continue
        if r.get('threw') or r.get('kind') is not None or r.get('bl') == 1:
            continue
        eta = r['len']
        if best is None or eta < best[2] or (eta == best[2] and r['cl'] > best[3]):
            best = (r['x'], r['y'], eta, r['cl'])
    return None if best is None else [best[0], best[1], best[2]]


def sim_choice(rows, skip):
    """The choice a filtered + cut pass makes, sequentially: `skip(row, best)` drops a candidate before its preview."""
    best = None
    for r in rows:
        if skip(r, best):
            continue
        if r.get('threw') or r.get('kind') is not None or r.get('bl') == 1:
            continue
        eta = r['len']
        if best is None or eta < best[2] or (eta == best[2] and r['cl'] > best[3]):
            best = (r['x'], r['y'], eta, r['cl'])
    return None if best is None else [best[0], best[1], best[2]]


def summarize(path):
    der = 0
    prev = 0
    s_full = s_cut = s_lb = s_wall = 0
    hid_cut = hid_lb = hid_wall = 0
    hid_rows = []
    threw = 0
    cell_cut = cell_wall = cell_lb = 0
    lb_viol = 0
    lbt_viol = 0
    wall_n = wall_arrived = wall_stalled = wall_chosen = 0
    kinds = {}
    sim_threw_diff = 0
    for line in open(path):
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        der += 1
        rows = d['c']
        prev += len(rows)
        best_cut_so_far = None
        best_wall_so_far = None
        for r in rows:
            k = r.get('kind') or ('threw' if r.get('threw') else 'arrived')
            kinds[k] = kinds.get(k, 0) + 1
            s_full += r['len']
            cut = r['cut']
            cutlen = r['len'] if cut < 0 else min(r['len'], cut + 1)
            s_cut += cutlen
            lbskip = cut >= 0 and r.get('lbT', r['lb']) > cut
            s_lb += 0 if lbskip else cutlen
            s_wall += 0 if r['wall'] else cutlen
            if r.get('threw'):
                threw += 1
            if r.get('hidCut'):
                hid_cut += 1
                hid_rows.append(('cut', d['t'], r))
            if (r.get('threw') or r.get('kind') in ('lethal-pit', 'drowned')) and lbskip:
                hid_lb += 1
                hid_rows.append(('lb', d['t'], r))
            if (r.get('threw') or r.get('kind') in ('lethal-pit', 'drowned')) and r['wall']:
                hid_wall += 1
                hid_rows.append(('wall', d['t'], r))
            if r.get('lbViolated'):
                lb_viol += 1
            if r['wall']:
                wall_n += 1
                if k == 'arrived':
                    wall_arrived += 1
                elif k == 'stalled':
                    wall_stalled += 1
        if d.get('best') != d.get('sim') or d.get('simThrew'):
            cell_cut += 1
        if d.get('best') is not None and any(r['wall'] and [r['x'], r['y']] == d['best'][:2] for r in rows):
            wall_chosen += 1
        if sim_choice(rows, lambda r, b: r['wall']) != d.get('best'):
            cell_wall += 1
        if sim_choice(rows, lambda r, b: b is not None and r.get('lbT', 0) > b[2]) != d.get('best'):
            cell_lb += 1
        for r in rows:
            if r.get('lbTViolated'):
                lbt_viol += 1
    return dict(file=path.split('/')[-1], derivations=der, previews=prev, kinds=kinds, threw=threw,
                hidden_cut=hid_cut, hidden_lb=hid_lb, hidden_wall=hid_wall,
                cell_cut=cell_cut, cell_wall=cell_wall, cell_lb=cell_lb, lb_violations=lb_viol, lbT_violations=lbt_viol,
                wall_blocked=wall_n, wall_blocked_arrived=wall_arrived, wall_blocked_stalled=wall_stalled,
                wall_blocked_chosen=wall_chosen,
                samples_full=s_full, samples_cut=s_cut, samples_cut_lb=s_lb, samples_cut_wall=s_wall,
                hid=[(w, t, {k: v for k, v in r.items() if k in ('x', 'y', 'cut', 'len', 'kind', 'threw', 'lb')})
                     for (w, t, r) in hid_rows[:6]])


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(json.dumps(summarize(p)))
