import json,sys,hashlib
d=json.load(open(sys.argv[1]))
print('files', len(d['testResults']), 'tests', d['numTotalTests'], 'pass', d['numPassedTests'], 'fail', d['numFailedTests'], 'skip', d['numPendingTests']+d.get('numTodoTests',0))
pairs=[]
for f in d['testResults']:
    for a in f['assertionResults']:
        if a['status']!='passed' and a['status']!='skipped': print('  NONPASS', f['name'].split('/')[-1], '|', a['fullName'][:160])
        if f['name'].endswith('/tapeRunner.test.js'): pairs.append((a['fullName'],a['status']))
pairs.sort(); s=''.join(f'{n}\t{st}\n' for n,st in pairs)
print('tapeRunner rows', len(pairs), 'md5', hashlib.md5(s.encode()).hexdigest(), 'nonpass', sum(1 for _,st in pairs if st!='passed'))
