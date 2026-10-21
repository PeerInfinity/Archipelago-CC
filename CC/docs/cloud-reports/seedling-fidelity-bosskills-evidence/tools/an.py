import json,sys
d=json.load(open(sys.argv[1]))
prev=None
for s in d['samples']:
    b=[x for x in s['bodies'] if x['cls']=='LavaBoss']
    nb=sum(1 for x in s['bodies'] if x['cls']=='LavaBall'); nr=sum(1 for x in s['bodies'] if x['cls']=='LavaRunner')
    key=(b[0]['anim'] if b else None, nb, nr, s['hits'], s['freeze'], tuple(s['cleared'] or []) if isinstance(s['cleared'],list) else str(s['cleared'])[:40])
    if key!=prev:
        print(s['t'], key, s['player'] and (s['player']['x'],s['player']['y']), b and (b[0]['x'],b[0]['y'],b[0]['enemy']))
        prev=key
