# scratch census (decides nothing): the divergence legs whose level holds a kill-lock (lock/rocklock, tset -1) —
# the only rooms KILLLOCK_STANDOUT_GUARD's call sites (the kill-lock chaser arm's rewound turns) can run in.
import json, sys, collections
m = json.load(open('frontend/modules/flashPanel/atlases/seedling-map.json'))
legs = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
kl = {}
for L in m['levels']:
    locks = [f"{e['type']}@{e['x']},{e['y']}" for e in L['entities']
             if e['type'] in ('lock', 'rocklock') and str((e.get('attrs') or {}).get('tset')) == '-1']
    if locks:
        bodies = collections.Counter(e['type'] for e in L['entities'] if e['type'] in (
            'jellyfish', 'puncher', 'lavarunner', 'bob', 'bobsoldier', 'iceturret', 'spinner', 'wallflyer', 'drill',
            'ghost', 'flyer', 'skeleton', 'bat', 'spider', 'slime', 'yeti', 'icespinner', 'firespinner'))
        kl[L['level']] = (locks, dict(bodies))
hits = [l for l in legs if l['level'] in kl]
print(f'{len(kl)} kill-lock level(s), {len(hits)} of {len(legs)} legs in them')
for lv in sorted(kl):
    ks = [l['key'] for l in hits if l['level'] == lv]
    print(f'L{lv} {kl[lv][0]} bodies={kl[lv][1]} legs={len(ks)}')
    for k in ks: print('   ', k)
