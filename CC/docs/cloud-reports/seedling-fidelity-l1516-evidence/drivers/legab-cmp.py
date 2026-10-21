import json,sys,collections
S=sys.argv[1]
def load(p):
    d={}
    for l in open(p):
        try: r=json.loads(l)
        except Exception: continue
        d[r['id']]=r
    return d
A=load(S+'/legab/0.jsonl'); B=load(S+'/legab/1.jsonl')
both=[k for k in A if k in B]
def v(r):
    if r.get('timeout'): return 'TIMEOUT'
    if r.get('outcome'): return r['outcome']
    return 'SOLVED' if r.get('ok') else 'REFUSED'
print('legs', len(both), 'OFF', collections.Counter(v(A[k]) for k in both), 'ON', collections.Counter(v(B[k]) for k in both))
mv=0
for k in sorted(both):
    a,b=A[k],B[k]
    sa=(v(a),a.get('ticks'),json.dumps(a.get('end')),(a.get('message') or '')[:300])
    sb=(v(b),b.get('ticks'),json.dumps(b.get('end')),(b.get('message') or '')[:300])
    if sa!=sb: mv+=1; print('MOVED',k,a.get('key'),'|',sa[:3],sa[3][:120],'->',sb[:3],sb[3][:120])
print('movers',mv)
