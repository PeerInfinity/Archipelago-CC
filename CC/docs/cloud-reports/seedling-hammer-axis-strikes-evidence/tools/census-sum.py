# Summarise a census jsonl (axis-register.mjs's exit rows) and an answers jsonl (axis-batch.mjs) into one table.
import json, sys, collections
cen = [json.loads(l) for l in open(sys.argv[1])]
print(f"# processes {len(cen)} | driven ticks {sum(r.get('driveTicks', 0) for r in cen)} | axis-aligned ticks "
      f"{sum(r['axisTicks'] for r in cen)} | axis ticks armed {sum(r['axisArmed'] for r in cen)} | "
      f"axis ticks with a body in reach {sum(len(r['rows']) for r in cen)} | of those, reachable ALONG the axis "
      f"{sum(1 for r in cen for x in r['rows'] if x['along'])}")
g = collections.OrderedDict()
for r in cen:
    for x in r['rows']:
        k = (r.get('tag'), x['level'], x['axis'], ','.join(f"{b['id']}(dir {b['dir']})" for b in x['inReach']), ','.join(x['along']) or '-')
        g.setdefault(k, []).append(x['t'])
for (tag, lvl, axis, bodies, along), ts in g.items():
    print(f"{tag} | L{lvl} | axis {axis} | in reach: {bodies} | along: {along} | {len(ts)} tick(s) t{min(ts)}..t{max(ts)}")
if len(sys.argv) > 2:
    ans = collections.OrderedDict()
    for l in open(sys.argv[2]):
        a = json.loads(l); ans[(a['id'], a['i'])] = a
    c = collections.Counter('SOLVE' if a['ok'] else ('deadline' if 'deadline' in (a['message'] or '') else 'refusal') for a in ans.values())
    print(f"# requests {len(ans)}: {dict(c)}")
