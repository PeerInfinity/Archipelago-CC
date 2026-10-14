import json,sys
def load(p):
    d=json.load(open(p)); rows=d['rows'] if 'rows' in d else d['steps']
    out={}
    for r in rows:
        key=(r['level'], json.dumps([ (g.get('kind'), g.get('placement') or g.get('exit')) for g in r['goals']]), json.dumps(r['boot'].get('block') if isinstance(r['boot'],dict) else r['boot']))
        out.setdefault(key,[]).append(r)
    return out
a,b=load(sys.argv[1]),load(sys.argv[2])
moved=[]
for k in a:
    for ra,rb in zip(a[k],b.get(k,[])):
        va=(ra['verdict'],ra.get('ticks')); vb=(rb['verdict'],rb.get('ticks'))
        if va!=vb or (ra.get('refusal') or '')[:200]!=(rb.get('refusal') or '')[:200]:
            moved.append((ra['step'],ra['level'],vb,va,(rb.get('refusal') or '')[:90],(ra.get('refusal') or '')[:90]))
cnt=lambda d:{v:sum(1 for rs in d.values() for r in rs if r['verdict']==v) for v in ('SOLVED','REFUSED','NO-EDGE','NO-ARRIVAL','TIMEOUT')}
print(sys.argv[2].split('/')[-1],cnt(b)); print(sys.argv[1].split('/')[-1],cnt(a))
for m in sorted(moved): print('step %s L%s: %s -> %s | %s || %s'%m)
