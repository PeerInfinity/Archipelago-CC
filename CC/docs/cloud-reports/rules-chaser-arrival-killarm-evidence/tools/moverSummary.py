"""One line per (target level, arrival, goal) mover of a routeWalk --diff file, with the base and tip DNFs, grouped by level."""
import re, sys, collections
lines = open(sys.argv[1]).read().split('\n')
by = collections.defaultdict(list)
for i, l in enumerate(lines):
    if l and not l.startswith(' ') and '=>' in l:
        tgt = re.search(r'-> (level_\d+)', l.split('=>')[0]).group(1)
        by[tgt].append((l, lines[i + 1].strip()[5:], lines[i + 2].strip()[5:]))
for t in sorted(by, key=lambda s: int(s[6:])):
    print(f"{t}: {len(by[t])} route(s)")
    for l, a, b in by[t][: int(sys.argv[2]) if len(sys.argv) > 2 else 99]:
        print(f"  {l}\n     base {a}\n     tip  {b}")
