import json,sys
f=lambda x: '-' if not x else ('OK %dt h%d d%d w%s'%(x['ticks'],x['hits'],x['deaths'],x['work']) if x['ok'] else 'NO w%s cut=%s'%(x['work'],x['cut']))
rows=[json.loads(l) for l in open(sys.argv[1])]
rows.sort(key=lambda r:(r['step'],r.get('seamOffset',0),r.get('goal',0)))
for r in rows:
    if r.get('verdict')=='CRASHED': print(r); continue
    a=r['at640']; print(r['step'],'@%+d'%r.get('seamOffset',0),'g%d'%r['goal'],r['verdict'],'|640',f(a),'|retry',f(r['retry']),'|2560',f(r['straight']),'|',(a.get('refusal') or '')[:110])
