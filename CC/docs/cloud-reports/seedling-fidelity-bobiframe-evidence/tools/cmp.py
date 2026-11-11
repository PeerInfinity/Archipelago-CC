import json,sys
def load(p):
    X={}
    for l in open(p):
        r=json.loads(l); X[r['t']]=r   # last poll per tick
    return X
G=load(sys.argv[1]); arms=[(a.split('=')[0],load(a.split('=')[1])) for a in sys.argv[2:4]]
lo,hi=int(sys.argv[4]),int(sys.argv[5])
last=max(G)
for name,M in arms:
    fp=fb=fs=None; worst=0; n=0
    for t in range(1,min(last,max(M))):   # final tick excluded (first-poll rule)
        g=G.get(t)
        if not g: continue
        P=[m for m in g['m'] if m['cls']=='Player']
        if not P: continue
        P=P[0]; m=M[t]
        if (abs(P['x']-m['p']['x'])>1e-9 or abs(P['y']-m['p']['y'])>1e-9) and fp is None: fp=t
        gb=[b for b in g['m'] if b['cls']=='Enemies::Bob']
        mb=[c for c in m['chasers'] if c['id'].startswith('bob@') and not c.get('removed')]
        for c in mb:
            if not gb: 
                if fb is None: fb=(t,c['id'],'missing in game')
                continue
            b=min(gb,key=lambda b: abs(b['x']-c['x'])+abs(b['y']-c['y']))
            d=max(abs(b['x']-c['x']),abs(b['y']-c['y'])); n+=1
            bad = d>1e-9 or b['enemy']['hits']!=c['hits'] or b['enemy']['hits_timer']!=c['hitsTimer']
            if bad and fb is None: fb=(t,c['id'],d,(b['enemy']['hits'],b['enemy']['hits_timer']),(c['hits'],c['hitsTimer']))
            if fp is None or t<fp: worst=max(worst,d)
        if len(gb)!=len(mb) and fb is None: fb=(t,'count',len(gb),len(mb))
        gs=[b for b in g['m'] if b['cls']=='Enemies::Spinner']
        for s in m['spinnerBodies']:
            if s.get('removed') or s.get('destroy'): continue
            b=min(gs,key=lambda b: abs(b['x']-s['x'])+abs(b['y']-s['y']))
            if max(abs(b['x']-s['x']),abs(b['y']-s['y']))>1e-9 and fs is None: fs=(t,s['id'])
    print(f"{name}: first player diff {fp}; first bob diff {fb}; first spinner diff {fs}; bob comparisons {n}; game hits at end {G[last]['st']['hits']}; model hits {M[max(M)]['hits']}")
name,M=arms[-1]
for t in range(lo,hi+1):
    g=G[t]; P=[m for m in g['m'] if m['cls']=='Player'][0]; m=M[t]
    c=next((c for c in m['chasers'] if c['id']=='bob@736,752'),None)
    gb=[b for b in g['m'] if b['cls']=='Enemies::Bob']
    b=min(gb,key=lambda b: abs(b['x']-c['x'])+abs(b['y']-c['y'])) if c and gb else None
    print(f"t{t} G p({P['x']:.3f},{P['y']:.3f}) h{g['st']['hits']}/{g['st']['hits_timer']} sl{g['st']['slash']['tests']}/{g['st']['slash']['hits']} bob({b['x']:.3f},{b['y']:.3f}) {b['enemy']['hits']}/{b['enemy']['hits_timer']} {b['anim'] or '-':4s} | {name} p({m['p']['x']:.3f},{m['p']['y']:.3f}) bob({c['x']:.3f},{c['y']:.3f}) {c['hits']}/{c['hitsTimer']} dying{int(bool(c.get('dying')))}" if b else f"t{t} -")
