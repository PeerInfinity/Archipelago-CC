import json,sys
for f in sys.argv[1:]:
    d=json.load(open(f)); seen={}; beast=[]
    for s in d['samples']:
        for r in s['rows']:
            if r['c']=='Tentacle':
                k=(r['x'],r['y'])
                if k not in seen: seen[k]=s['t']
            if r['c']=='TentacleBeast' and (not beast or beast[-1][1]!=r['a']): beast.append((s['t'],r['a']))
    print(f.split('/')[-1], 'beast', beast[:4], 'first player', d['samples'][0]['x'], d['samples'][0]['y'])
    print('   tentacles (spawn t, x, y):', sorted((t,k[0],k[1]) for k,t in seen.items())[:10])
    print('   rng at t=0/1:', d['samples'][0]['rng'], d['samples'][1]['rng'] if len(d['samples'])>1 else None)
