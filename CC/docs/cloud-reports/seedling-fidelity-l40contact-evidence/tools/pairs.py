import json,sys,hashlib
d=json.load(open(sys.argv[1]))
rows=[]
for f in d['testResults']:
    if not f['name'].endswith('/tapeRunner.test.js'): continue
    for a in f['assertionResults']: rows.append(f"{a['status']}\t{a['fullName']}")
rows.sort(); s='\n'.join(rows)
print(len(rows), hashlib.md5(s.encode()).hexdigest())
