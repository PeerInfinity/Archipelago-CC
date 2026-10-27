import json,sys,collections
rows=[json.loads(l) for f in sys.argv[1:] for l in open(f)]
emp=[r for r in rows if r['empty']]
print('climbs', len(rows), 'empty', len(emp))
c=collections.Counter()
for r in emp:
    hc=len(r.get('hitChasers',[]))
    key=(r['tag'], r.get('argv',''), r['level'], r['t'], ','.join(r['sources'])[:60], 'hitCh=%d'%hc,
         'pairs=%s'%(r.get('pairsAdmit')), 'allCh=%s'%r.get('allChasersAdmit'), 'b+1=%s'%r.get('basePlusOne'))
    print(*key)
