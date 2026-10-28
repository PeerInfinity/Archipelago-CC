# per-run counts of `end`, and per-key ends across runs (A1 A2 B1 B2 when present); failed text head for movers
import json,sys,os,collections
W='/tmp/claude-0/w'
runs=[r for r in ('A1','A2','B1','B2') if os.path.exists(f'{W}/sweep-{r}.jsonl')]
data={}
for r in runs:
    data[r]={json.loads(l)['key']:json.loads(l) for l in open(f'{W}/sweep-{r}.jsonl')}
    print(r, len(data[r]), dict(collections.Counter(x['end'] for x in data[r].values())))
keys=sorted(set().union(*[set(d) for d in data.values()]))
for k in keys:
    ends=[data[r].get(k,{}).get('end','-') for r in runs]
    if len(set(ends))>1: print('MOVES', data[runs[0]][k]['id'], ends, k[:110])
