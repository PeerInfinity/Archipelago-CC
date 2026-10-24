import json,sys
d=json.load(open(sys.argv[1]))
P=d['players']; worst=0; bad=[]
for p in P:
    g,m=p['game'],p['model']
    if m is None: bad.append((p['t'],'no model')); continue
    dx=abs(g['x']-m['x']); dy=abs(g['y']-m['y'])
    if g['level']!=m['level'] or dx>1e-9 or dy>1e-9: bad.append((p['t'],g['level'],m['level'],round(g['x']-m['x'],3),round(g['y']-m['y'],3)))
gh=[(p['t'],p['game']['hits']) for i,p in enumerate(P) if i==0 or p['game']['hits']!=P[i-1]['game']['hits']]
mh=[(p['t'],p['model']['hits']) for i,p in enumerate(P) if p['model'] and (i==0 or not P[i-1]['model'] or p['model']['hits']!=P[i-1]['model']['hits'])]
print('player samples',len(P),'mismatched ticks',len(bad),'first',bad[:6],'last',bad[-3:])
print('game hits changes',gh); print('model hits changes',mh)
print('final game',P[-1]['game'],'model',P[-1]['model'])
