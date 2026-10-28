import json,sys
a={ (r['id'],r['i']):r for r in map(json.loads,open(sys.argv[1])) }
b={ (r['id'],r['i']):r for r in map(json.loads,open(sys.argv[2])) }
same=0; mv=[]
for k in sorted(a):
    if k in b and a[k]['answer']==b[k]['answer'] and a[k].get('work')==b[k].get('work'): same+=1
    else: mv.append((k, a[k].get('kind'), a[k]['answer'], (b.get(k) or {}).get('kind'), (b.get(k) or {}).get('answer'), (a[k].get('message') or '')[:160], ((b.get(k) or {}).get('message') or '')[:160]))
print(f'{same} identical of {len(a)}; {len(mv)} mover(s)')
for m in mv: print('MOVER', m)
