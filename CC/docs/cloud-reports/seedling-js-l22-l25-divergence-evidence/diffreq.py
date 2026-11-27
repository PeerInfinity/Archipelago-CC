import json,sys
def load(path, pred):
    for l in open(path):
        o=json.loads(l)
        if o.get('probe')=='svc' and pred(o): return o
def walk(a,b,p,out):
    if type(a)!=type(b): out.append((p,'type',str(a)[:120],str(b)[:120])); return
    if isinstance(a,dict):
        for k in sorted(set(a)|set(b)):
            if k not in a: out.append((p+'.'+k,'only-B','',str(b[k])[:120]))
            elif k not in b: out.append((p+'.'+k,'only-A',str(a[k])[:120],''))
            else: walk(a[k],b[k],p+'.'+k,out)
    elif isinstance(a,list):
        if len(a)!=len(b): out.append((p,'len',len(a),len(b)))
        for i,(x,y) in enumerate(zip(a,b)):
            walk(x,y,f'{p}[{i}]',out)
            if len(out)>200: return
    elif a!=b: out.append((p,'value',str(a)[:120],str(b)[:120]))
A=load(sys.argv[1], lambda o:o['seq']==int(sys.argv[2]))
B=load(sys.argv[3], lambda o:o['seq']==int(sys.argv[4]))
ra=A['requests'][0]['request']; rb=B['requests'][0]['request']
out=[]; walk(ra,rb,'',out)
print('A',A['name'],'B',B['name'], 'diffs',len(out))
for d in out[:60]: print(' ',d)
