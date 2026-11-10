import json,sys,collections
for fn in sys.argv[1:]:
    rows=[json.loads(l) for l in open(fn)]
    print('==',fn,len(rows))
    grp=collections.OrderedDict()
    for i,r in enumerate(rows):
        v=r['via']; key=(r['t0'] if r['k']!='WIN' else 'win', r['side'], f"{v['x']},{v['y']}" if v else 'corr')
        key=(r['side'], f"{v['x']},{v['y']}" if v else 'corr')
        grp.setdefault(key,[]).append((i,r))
    for key,lst in grp.items():
        s=' '.join(f"{r['w']}:{r['k'][:9]}" + (f"@{r['hit']['t']}" if r.get('hit') and r['k']!='WIN' else '') for i,r in lst)
        print(key, 'first idx',lst[0][0], 'n',len(lst)); print('   ',s[:1500])
    w=[r for r in rows if r['k']=='WIN']
    print('WIN',w)
