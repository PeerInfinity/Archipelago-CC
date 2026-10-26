import json,os,sys,collections
out=sys.argv[1]
cells=[l.strip() for l in open(os.path.join(out,'cells.txt')) if l.strip()]
def ld(a,c):
    f=os.path.join(out,f"{a}-{c.replace(':','-')}.json")
    return json.load(open(f)) if os.path.exists(f) and os.path.getsize(f) else None
def strip(x):
    if isinstance(x,dict): return {k:strip(v) for k,v in x.items() if k not in ('ms','ffOn','replayMs','solveMs')}
    if isinstance(x,list): return [strip(v) for v in x]
    return x
n=collections.Counter(); lines=[]
for c in cells:
    a={k:ld(k,c) for k in ('baseoff','baseon','fixoff','fixon')}
    if any(v is None for v in a.values()): n['missing']+=1; continue
    n['cells']+=1
    for k,v in a.items(): n[k+'_ok']+=v['ok']; n[k+'_div']+=(v.get('kind')=='divergence'); n[k+'_ffrows']+=len(v['ff'])
    off_same=strip(a['baseoff'])==strip(a['fixoff']); on_same=strip(a['baseon'])==strip(a['fixon'])
    n['off_identical']+=off_same; n['on_identical']+=on_same
    if not (off_same and on_same):
        lines.append(f"{c} seam {a['fixon']['seam']}: OFF {'=' if off_same else 'MOVED'}; ON base {a['baseon']['ok']}/{a['baseon']['kind']} w{a['baseon']['work']} -> fix {a['fixon']['ok']}/{a['fixon']['kind']} w{a['fixon']['work']} t{a['fixon']['ticks']} ff={[(r['how'],r['verdict'],r['t']) for r in a['fixon']['ff']]}")
print(dict(n)); print('\n'.join(lines))
