import json,glob,os,sys,re,collections
out=sys.argv[1]
cells=[l.strip() for l in open(os.path.join(out,'cells.txt')) if l.strip()]
def ld(a,c):
    f=os.path.join(out,f"{a}-{c.replace(':','-')}.json")
    return json.load(open(f)) if os.path.exists(f) and os.path.getsize(f) else None
n=collections.Counter(); movers=[]
for c in cells:
    d,f=ld('dflt',c),ld('ff',c)
    if d is None or f is None: n['missing']+=1; continue
    n['cells']+=1; n['dflt_ok']+=d['ok']; n['ff_ok']+=f['ok']
    div=f.get('kind')=='divergence'; n['ff_div']+=div; n['dflt_div']+=d.get('kind')=='divergence'
    rw=[r for r in f['ff'] if r['how']=='rewind']; n['ff_any_row']+=bool(f['ff']); n['ff_rewind_solved']+=any(r['verdict']=='solved' for r in rw)
    same=d['answer']==f['answer'] and d['work']==f['work']
    n['identical']+=same
    if not same:
        m=''
        if div:
            mm=[p['message'] for p in f['passes'] if 'shadow advanced' in (p['message'] or '')][0]
            m=re.search(r'returned (\d+) key set\(s\) but the shadow advanced (\d+)',mm).group(0)
        movers.append(f"{c} seam {f['seam']}: dflt {'OK '+str(d['ticks'])+'t' if d['ok'] else 'NO'} ({d['work']}) -> ff {'OK '+str(f['ticks'])+'t' if f['ok'] else ('DIVERGE' if div else 'NO')} ({f['work']}) {m} rows={[(r['how'],r['verdict'],r['t'],r.get('refusedAt')) for r in f['ff']]}")
print(dict(n)); print('\n'.join(movers))
