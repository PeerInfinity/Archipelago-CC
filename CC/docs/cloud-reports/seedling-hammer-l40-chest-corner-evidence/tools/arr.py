import gzip,json,sys
def load(f,i):
    for l in gzip.open(f,'rt'):
        if not l.strip(): continue
        r=json.loads(l)
        if str(r['id'])=='19': return r['requests'][i]
for tag,f in [('rm9F1','ev9/F1.stop-requests.jsonl.gz'),('rm9P1','ev9/P1.stop-requests.jsonl.gz'),('rm10P1','ev10/P1.stop-requests-19-32.jsonl.gz'),('rm10S1','ev10/S1.stop-requests-19-26-29.jsonl.gz')]:
    q=load(sys.argv[1]+'/'+f,2); rq=q['request']; st=rq['staging']
    pt=rq.get('perTick'); n=len(pt) if isinstance(pt,list) else pt
    print(tag, 'seam', st['seam']['time'], 'perTick', (len(pt) if isinstance(pt,(list,str)) else type(pt)), 'stagingkeys', sorted(st.keys())[:20], 'res', q['result'].get('answer'), q['result'].get('kind'))
