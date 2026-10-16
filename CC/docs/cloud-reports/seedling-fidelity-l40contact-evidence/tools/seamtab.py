import json,sys,re,collections
def load(p):
  out={}
  for l in open(p):
    r=json.loads(l); m=(r.get('message') or '')
    cls='shake-throw' if 'Game.shake' in m else 'deadline' if 'anytime deadline' in m else 'swing-throw' if 'the swing at' in m else ('refused: '+re.sub(r'\(.*','',m)[:60]) if r['kind']=='refusal' else r['kind']
    out[r['seamTime']]=(r['answer'][:8],cls,r['work'])
  return out
leg=sys.argv[1]; a=load(f'{sys.argv[2]}/seam-{leg}-w0.jsonl'); b=load(f'{sys.argv[2]}/seam-{leg}-w1.jsonl')
print('| seam | OFF answer (class, work) | ON answer (class, work) | same |\n|---|---|---|---|')
same=0
for t in sorted(set(a)|set(b)):
  x=a.get(t); y=b.get(t); s=x and y and x[0]==y[0]; same+=bool(s)
  print(f'| {t} | `{x[0]}` {x[1]}, {x[2]} | ' + (f'`{y[0]}` {y[1]}, {y[2]}' if y else '—') + f' | {"=" if s else "≠"} |')
ca=collections.Counter(v[1] for v in a.values()); cb=collections.Counter(v[1] for v in b.values())
print(f'\nOFF {len(set(v[0] for v in a.values()))} distinct over {len(a)}: {dict(ca)}; ON {len(set(v[0] for v in b.values()))} distinct over {len(b)}: {dict(cb)}; equal at {same} of {len(a)}')
