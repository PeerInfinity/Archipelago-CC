# cmp-arms.py <armA dir> <armB dir> — per axe-room leg (by key): node verdict + ticks per arm; prints the movers
import json,glob,sys
rows={json.loads(l)['id']:json.loads(l) for l in open('/tmp/claude-0/ax/sweep/merged/rows.jsonl')}
def load(d): 
    out={}
    for f in glob.glob(d+'/*.json'):
        r=json.load(open(f)); out[r['id']]=r
    return out
A=load(sys.argv[1]); B=load(sys.argv[2])
v=lambda r: ('SOLVED %s' % r.get('ticks')) if r.get('ok') else ('REFUSED' if 'ok' in r else r.get('outcome','?'))
moved=0
for i in sorted(A):
    a,b=v(A[i]),v(B.get(i,{}))
    if a!=b:
        moved+=1; print(f"{i} {rows[i]['key']} | baseline {rows[i]['end']} seam {rows[i].get('seamTime')} | {a} -> {b}")
print('movers', moved, 'of', len(A))
