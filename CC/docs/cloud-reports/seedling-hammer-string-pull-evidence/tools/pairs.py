# SCRATCH (g1): B3c's recipe — vitest --reporter=json over tapeRunner.test.js → `status\tfullName`, sorted, newline-terminated.
import json, sys, hashlib
d = json.load(open(sys.argv[1]))
rows = sorted(f"{a['status']}\t{a['fullName']}" for r in d['testResults'] for a in r['assertionResults'])
s = '\n'.join(rows)
print(len(rows), hashlib.md5(s.encode()).hexdigest(), sum(1 for x in rows if not x.startswith('passed')), 'non-pass')
