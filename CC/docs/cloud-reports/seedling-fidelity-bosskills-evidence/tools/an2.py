import json,sys
d=json.load(open(sys.argv[1]))
prev=None
for s in d['samples']:
    b=[x for x in s['rows'] if x['c']=='LavaBoss']
    balls=[x for x in s['rows'] if x['c']=='LavaBall']
    nr=sum(1 for x in s['rows'] if x['c']=='LavaRunner')
    bb=b[0] if b else None
    key=(bb and bb['a'], bb and bb['e']['h'], len(balls), nr, s['hits'])
    if key!=prev or (bb and bb['e']['ht'] in (120,119,1)):
        print(s['t'], key, (round(s['x'],1),round(s['y'],1)), bb and (bb['e'], bb['al']), [(round(x['x'],1),round(x['y'],1),x['vx'],x['vy']) for x in balls if abs(x['x']-160)<20])
        prev=key
