# inclusive seconds of TARGET functions, split by the nearest ancestor among ANCHORS
import json,sys,collections
p=json.load(open(sys.argv[1])); targets=sys.argv[2].split(','); anchors=sys.argv[3].split(',')
nodes={n['id']:n for n in p['nodes']}; parent={}
for n in p['nodes']:
    for c in n.get('children',[]): parent[c]=n['id']
fn=lambda i: nodes[i]['callFrame']['functionName']
out=collections.Counter(); total=0
for s,d in zip(p['samples'],p['timeDeltas']):
    total+=d; chain=[]; cur=s
    while cur is not None: chain.append(fn(cur)); cur=parent.get(cur)
    for t in targets:
        if t in chain:
            k=chain.index(t); anc=next((a for a in chain[k+1:] if a in anchors),'(other)')
            out[(t,anc)]+=d
for (t,a),v in sorted(out.items(), key=lambda x:-x[1]): print('%7.1f s %5.1f%%  %-22s under %s'%(v/1e6,100*v/total,t,a))
