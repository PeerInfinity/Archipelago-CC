import json,sys
def load(path, seq):
    for l in open(path):
        o=json.loads(l)
        if o.get('probe')=='svc' and o['seq']==seq: return o['requests'][0]['request']
A=load(sys.argv[1],int(sys.argv[2])); B=load(sys.argv[3],int(sys.argv[4]))
def show(k,a,b):
    same = json.dumps(a,sort_keys=True)==json.dumps(b,sort_keys=True)
    print(('  same ' if same else '**DIFF ')+k, '' if same else ('\n     A: '+json.dumps(a,sort_keys=True)[:400]+'\n     B: '+json.dumps(b,sort_keys=True)[:400]))
print('top keys A', sorted(A)); print('top keys B', sorted(B))
for k in sorted(set(A)|set(B)):
    if k in ('staging','source','perTick'): continue
    show(k,A.get(k),B.get(k))
sa,sb=A['staging'],B['staging']
print('staging keys A',sorted(sa)); print('staging keys B',sorted(sb))
for k in sorted(set(sa)|set(sb)):
    a,b=sa.get(k),sb.get(k)
    if k=='persistence':
        pa=sorted(json.dumps(x,sort_keys=True) for x in a); pb=sorted(json.dumps(x,sort_keys=True) for x in b)
        print('  persistence: A',len(pa),'B',len(pb),'only-A',sorted(set(pa)-set(pb)),'only-B',sorted(set(pb)-set(pa)))
    elif k=='seam':
        for kk in sorted(set(a)|set(b)): show('staging.seam.'+kk,a.get(kk),b.get(kk))
    else: show('staging.'+k,a,b)
print('perTick len A',len(A['perTick']),'B',len(B['perTick']))
print('source.records same:', json.dumps(A['source'],sort_keys=True)==json.dumps(B['source'],sort_keys=True))
