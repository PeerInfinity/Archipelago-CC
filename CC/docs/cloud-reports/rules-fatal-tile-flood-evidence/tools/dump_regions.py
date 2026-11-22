# Dump every region whose name contains one of argv[2:] from a rules.json (argv[1]): exits, locations, rules (compact).
import json, sys
d = json.load(open(sys.argv[1]))
regs = d['regions']['1'] if '1' in d['regions'] else d['regions']
def r(x):
    if x is None: return 'TRUE'
    t = x.get('type')
    if t == 'constant': return str(x.get('value'))
    if t == 'item_check': return 'has(' + (x['item'].get('value') if isinstance(x.get('item'), dict) else str(x.get('item'))) + ')'
    if t == 'and': return '(' + ' & '.join(r(c) for c in x['conditions']) + ')'
    if t == 'or': return '(' + ' | '.join(r(c) for c in x['conditions']) + ')'
    return json.dumps(x, separators=(',', ':'))
pats = sys.argv[2:]
for name, reg in regs.items():
    if not any(p in name for p in pats): continue
    print(f'== {name}')
    for e in reg.get('exits', []): print(f'  exit -> {e.get("connected_region")} : {r(e.get("access_rule"))}')
    for l in reg.get('locations', []): print(f'  loc {l.get("name")} : {r(l.get("access_rule"))}')
