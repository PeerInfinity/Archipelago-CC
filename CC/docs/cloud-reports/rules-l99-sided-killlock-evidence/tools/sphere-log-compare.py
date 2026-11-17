import json,sys
def rows(p):
    out=[]
    for line in open(p):
        r=json.loads(line)
        if r.get('type')!='state_update': continue
        for loc in r['player_data']['1'].get('sphere_locations',[]): out.append((loc,r['sphere_index']))
    return out
a=rows(sys.argv[1]); b=rows(sys.argv[2])
isev=lambda n:' flag ' in n or n.startswith('L') and ':' in n
ra=[(n,s.split('.')[0]) for n,s in a if not isev(n)]; rb=[(n,s.split('.')[0]) for n,s in b if not isev(n)]
print('item rows',len(ra),len(rb),'same order+integer sphere:',ra==rb)
ea=[n for n,s in a if isev(n)]; eb=[n for n,s in b if isev(n)]
print('event rows',len(ea),len(eb),'added',sorted(set(eb)-set(ea)),'removed',sorted(set(ea)-set(eb)))
fa=dict(a); fb=dict(b)
print('item rows whose fractional index moved:',sum(1 for n,_ in ra if fa[n]!=fb[n]), [ (n,fa[n],fb[n]) for n,_ in ra if fa[n]!=fb[n]])
print('event rows (other than the new one) whose index moved:',[(n,fa[n],fb[n]) for n in ea if fa[n]!=fb.get(n)])
