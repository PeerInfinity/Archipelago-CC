import json,sys
base=json.load(open('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/fixtures/igneous-witness/igneous-l76-fresh-stand.tape.json'))
def I(spec):
    out=[]
    for s in spec.split(','):
        s=s.strip()
        if not s: continue
        k,r=s.split(); a,b=r.split('-'); out.append({"key":k,"from":int(a),"to":int(b)})
    out.sort(key=lambda d:(d['from'],d['key'])); return out
name, bx, by, spec, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5])
t=json.loads(json.dumps(base)); t['boot']={'level':74,'x':bx,'y':by}; t['inputs']=I(spec); t['tick_count']=n; t['name']=name
t['seam']['items']['hasDarkShield']=False
if len(sys.argv)>6: t['noDamage']=sys.argv[6]=='1'
t['description']='fidelity IGFADE D2 — staged: a broken tile turns during the dark shield pickup phase A'
json.dump(t,open(f'tapes/{name}.json','w'),indent=1)
