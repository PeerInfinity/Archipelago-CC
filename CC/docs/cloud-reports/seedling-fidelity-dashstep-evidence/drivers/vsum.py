import json,sys,hashlib
d=json.load(open(sys.argv[1]))
rows=[(a['status'],a['fullName'],f['name']) for f in d['testResults'] for a in f['assertionResults']]
tr=sorted(f"{s}\t{n}" for s,n,fn in rows if fn.endswith('tapeRunner.test.js'))
print('tests', len(rows), {s:sum(1 for r in rows if r[0]==s) for s in set(r[0] for r in rows)})
print('tapeRunner pairs', len(tr), hashlib.md5('\n'.join(tr).encode()).hexdigest())
allm=hashlib.md5('\n'.join(sorted(f"{s}\t{n}" for s,n,fn in rows)).encode()).hexdigest(); print('all md5', allm)
for f in d['testResults']:
    if f['status']!='passed' and not f['assertionResults']: print('FILE FAIL', f['name'].split('Archipelago-CC/')[-1], (f.get('message') or '')[:200].replace('\n',' '))
for s,n,fn in rows:
    if s=='failed': print('RED', fn.split('Archipelago-CC/')[-1].split('basewt/')[-1], '::', n[:150])
