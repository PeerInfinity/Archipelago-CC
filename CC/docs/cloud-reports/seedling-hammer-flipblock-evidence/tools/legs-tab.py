import json,glob,os,collections
S=os.path.dirname(os.path.abspath(__file__))
t=collections.defaultdict(list)
for f in sorted(glob.glob(S+'/rows-*.jsonl')):
  arm,rep=os.path.basename(f)[5:-6].split('-')
  for l in open(f):
    r=json.loads(l); k=r['key'].split(' -> ')[1][:44]
    plans=[(p.get('ok'),p.get('ticks'),[(x.get('pass'),x.get('ok')) for x in p.get('passes',[])]) for p in r.get('plans',[])]
    t[(k,arm)].append(f"{r['end']}/{r.get('ms')}ms/seam{r.get('seamTime')}/hits{(r.get('roomHits') or {}).get('max')}/t{[p[1] for p in plans]}")
for (k,arm),v in sorted(t.items()): print(k.ljust(45), arm.ljust(4), ' | '.join(v))
