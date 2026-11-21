"""Per-level ROUTE requirements of a rules doc: for every arrival into a level (an exit from outside it) and every goal
inside it (a location, or an exit leaving the level), the minimal item sets that open the route, as a DNF. Region names
inside a level are folded away (sub-region splits do not count as moves); exit names to another level are folded to that
level. Usage: routeWalk.py <rules.json> [<rules.json> ...] -> one JSON per doc on stdout lines, or diff mode:
routeWalk.py --diff <base.json> <tip.json>."""
import json, sys, re, itertools

def lvl(name):
    m = re.match(r'(level_\d+)', name or '')
    return m.group(1) if m else name

def norm_exit(name):
    return re.sub(r'(level_\d+)__r\d+c\d+', r'\1', name)

def items_of(rule, out):
    if not rule: return
    if rule.get('rule') == 'Has': out.add((rule['args']['item_name'], rule['args'].get('count', 1)))
    for c in rule.get('children', []) or []: items_of(c, out)

def ev(rule, held):
    if rule is None: return True
    k = rule.get('rule')
    if k == 'True_': return True
    if k == 'Has': return held.get(rule['args']['item_name'], 0) >= rule['args'].get('count', 1)
    if k == 'And': return all(ev(c, held) for c in rule['children'])
    if k == 'Or': return any(ev(c, held) for c in rule['children'])
    raise ValueError(k)

def walk(doc):
    regs = doc['regions']['1']
    bylvl = {}
    for n in regs: bylvl.setdefault(lvl(n), []).append(n)
    out = {}
    for L, names in bylvl.items():
        inside = set(names)
        arrivals = []
        for n, g in regs.items():
            if n in inside: continue
            for e in g.get('exits', []):
                if e['connected_region'] in inside: arrivals.append((f"{lvl(n)}:{norm_exit(e['name'])}", e['connected_region']))
        internal = []
        goals = []
        its = set()
        for n in names:
            g = regs[n]
            for e in g.get('exits', []):
                if e['connected_region'] in inside: internal.append((n, e['connected_region'], e.get('access_rule')))
                else: goals.append((n, f"exit:{norm_exit(e['name'])}", e.get('access_rule')))
                items_of(e.get('access_rule'), its)
            for l in g.get('locations', []):
                goals.append((n, f"loc:{l['name']}", l.get('access_rule')))
                items_of(l.get('access_rule'), its)
        # one atom per item name at its highest count asked
        atoms = {}
        for name, cnt in its: atoms[name] = max(atoms.get(name, 0), cnt)
        atoms = sorted(atoms.items())
        if len(atoms) > 14: atoms_used = atoms  # still enumerate; levels are small
        res = {}
        seen_arr = {}
        for akey, start in arrivals:
            if akey in seen_arr and seen_arr[akey] == start: continue
            seen_arr[akey] = start
            minimal = {}
            for r in range(len(atoms) + 1):
                for combo in itertools.combinations(atoms, r):
                    held = dict(combo)
                    reach = {start}; stack = [start]
                    while stack:
                        u = stack.pop()
                        for (a, b, rule) in internal:
                            if a == u and b not in reach and ev(rule, held): reach.add(b); stack.append(b)
                    names_c = frozenset(f"{k}x{v}" if v > 1 else k for k, v in combo)
                    for (gr, gk, rule) in goals:
                        if gr in reach and ev(rule, held):
                            sets = minimal.setdefault(gk, [])
                            if not any(s <= names_c for s in sets): sets.append(names_c)
            for gk, sets in minimal.items():
                res[f"{akey} => {gk}"] = sorted(' & '.join(sorted(s)) or 'FREE' for s in sets)
        out[L] = res
    return out

if __name__ == '__main__':
    if sys.argv[1] == '--diff':
        a = walk(json.load(open(sys.argv[2]))); b = walk(json.load(open(sys.argv[3])))
        moved = 0
        for L in sorted(set(a) | set(b), key=lambda s: (len(s), s)):
            ra, rb = a.get(L, {}), b.get(L, {})
            for k in sorted(set(ra) | set(rb)):
                if ra.get(k) != rb.get(k):
                    moved += 1
                    print(f"{k}\n    base {ra.get(k)}\n    tip  {rb.get(k)}")
        print(f"MOVED ROUTES: {moved}")
    else:
        print(json.dumps(walk(json.load(open(sys.argv[1])))))
