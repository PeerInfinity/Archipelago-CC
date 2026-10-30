#!/usr/bin/env python3
# scratch (L40C): the arm x request table from req-<arm>.jsonl (arms.mjs). Usage: table.py <dir> <arm>...
# Prints, per request, the verdict per arm (S<ticks>[!] = SOLVED, ! = not game-modelled or a hit in the plan;
# R = REFUSED; B = budget/anytime deadline; T = threw) and the named wall of the first refusal; then the movers vs A0.
import json, re, sys

GOALS = '--goals' in sys.argv
d, arms = sys.argv[1], [a for a in sys.argv[2:] if a != '--goals']
data = {}
for a in arms:
    try:
        data[a] = {(r['id'], r['i']): r for r in map(json.loads, open(f'{d}/req-{a}.jsonl'))}
    except FileNotFoundError:
        pass
arms = [a for a in arms if a in data]


def goal(key):
    return key.split(' -> ')[-1].replace('location:', '').replace('exit:', '')


def wall(r):
    if r['ok']:
        return ''
    h = r['head'] or ''
    seg = h.split(' -> ')[-1]
    seg = re.sub(r'\s+', ' ', seg)
    return seg[:230]


def cell(r):
    if r is None:
        return '-'
    if r['ok']:
        gm = r.get('gm') or {}
        bad = gm.get('gm') is False or (gm.get('hits') or [])
        return f"S{r['ticks']}{'!' if bad else ''}"
    k = r.get('kind') or ''
    if k == 'THREW':
        return 'T'
    if 'deadline' in (r['head'] or '') or k in ('budget', 'deadline'):
        return f'B:{k}'
    return f'R:{k}' if k else 'R'


if __name__ == '__main__' and not GOALS:
    keys = sorted(set().union(*[set(v) for v in data.values()]))
    print('id/i\t' + '\t'.join(arms) + '\tgoal')
    for k in keys:
        rr = [data[a].get(k) for a in arms]
        key = next(r['key'] for r in rr if r)
        print(f'{k[0]}/{k[1]}\t' + '\t'.join(cell(r) for r in rr) + f'\t{goal(key)}')
    print()
    base = data.get('A0', {})
    for a in arms[1:] if arms and arms[0] == 'A0' else arms:
        movers = [k for k in keys if k in base and k in data[a] and data[a][k]['digest'] != base[k]['digest']]
        print(f'== {a}: {len(movers)} mover(s) vs A0; solved {sum(r["ok"] for r in data[a].values())}/{len(data[a])}')
        for k in movers:
            b, r = base[k], data[a][k]
            print(f'  {k[0]}/{k[1]} {goal(r["key"])}: {cell(b)} -> {cell(r)}')
            print(f'     A0: {wall(b)[:200]}')
            print(f'     {a}: {wall(r)[:200]}')


def goal_summary(arms_order):
    """Per L40 goal: legs solved per arm (a leg = its LAST captured request; a solve with a hit is marked h)."""
    legs = {}
    for a in arms_order:
        for (i, q), r in data[a].items():
            legs.setdefault(i, {}).setdefault(a, {})[q] = r
    goals = {}
    for i, per in legs.items():
        key = next(iter(next(iter(per.values())).values()))['key']
        goals.setdefault(goal(key), []).append(i)
    print('goal\tlegs\t' + '\t'.join(arms_order))
    for g in sorted(goals):
        cells = []
        for a in arms_order:
            s = h = 0
            for i in goals[g]:
                rr = legs[i].get(a)
                if not rr:
                    continue
                r = rr[max(rr)]
                if r['ok']:
                    s += 1
                    h += bool((r.get('gm') or {}).get('hits'))
            cells.append(f'{s}{"h" * min(h, 1)}')
        print(f'{g}\t{len(goals[g])}\t' + '\t'.join(cells))


if __name__ == '__main__' and GOALS:
    goal_summary(arms)
