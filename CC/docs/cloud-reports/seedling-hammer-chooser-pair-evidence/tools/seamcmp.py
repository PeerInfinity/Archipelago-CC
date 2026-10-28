import json,sys,re,collections
def load(f):
    d={}
    for l in open(f):
        r=json.loads(l); d[r['seamTime']]=r
    return d
def blocker(r):
    m=r.get('message') or ''
    if r.get('ok'): return 'SOLVED'
    x=re.search(r'died at t(\d+) \(chaser ([\w@,]+)',m)
    if x: return 'DEATH:'+x.group(2)
    x=re.search(r'passes through danger at \([\d.,]+\) — (\w+):([\w@,]*)',m)
    stage=re.findall(r'-> ([a-z]+ (?:stance|\()[^>]*?)(?= ->|:)',m)
    if x: return 'EXH:'+x.group(2)
    return 'OTHER:'+m[-60:]
A=load(sys.argv[1]); B=load(sys.argv[2]) if len(sys.argv)>2 else {}
ca=collections.Counter(); cb=collections.Counter(); moved=0
for t in sorted(A):
    a=A[t]; b=B.get(t)
    ba=blocker(a); bb=blocker(b) if b else '-'
    ca[ba]+=1
    if b: cb[bb]+=1
    same = b and b['answer']==a['answer']
    if b and not same: moved+=1
    print(t, ba, '|', bb, '' if same else 'MOVED')
print('A', dict(ca)); print('B', dict(cb)); print('moved', moved, 'of', len(A))
