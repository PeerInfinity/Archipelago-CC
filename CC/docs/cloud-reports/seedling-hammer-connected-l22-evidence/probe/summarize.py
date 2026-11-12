import json,sys,re
r=json.load(open(sys.argv[1]))
g=r.get('step_g_full',{})
print(json.dumps({k:g.get(k) for k in ('pid','total','checkedBefore','checked','ms','statusAtEnd','halted','awaitedLines','confirmedLines','didNotLand','unchecked','inaccessible','error')}))
print('statusTrace tail', g.get('statusTrace',[])[-6:])
f=r['frames']
lc=[x for x in f if x['cmd']=='LocationChecks' and x['dir']=='>']
ids=[i for x in lc for i in x['locations']]
print('LocationChecks frames sent', len(lc), 'ids', len(ids), 'distinct', len(set(ids)))
print('StatusUpdate', [x for x in f if x['cmd']=='StatusUpdate'])
print('goal lines', [x['text'] for x in f if x['cmd']=='PrintJSON' and re.search('goal|complet',x.get('text',''),re.I)])
print('errors', r.get('errors'))
print('inaccessible end', sum(1 for m in r.get('consoleLinesEnd',[]) if 'INACCESSIBLE' in m))
