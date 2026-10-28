# rows-<a>.json vs rows-<b>.json (vitest json): status changes by fullName, rows only in one
import json,sys
def load(p):
    d=json.load(open(p)); out={}
    for t in d['testResults']:
        f=t['name'].split('/')[-1]
        for a in t['assertionResults']: out[f+' :: '+a['fullName']]=a['status']
    return out,d
a,da=load(sys.argv[1]); b,db=load(sys.argv[2])
print(f"{sys.argv[1]}: {da['numPassedTests']}/{da['numTotalTests']} failed {da['numFailedTests']}; {sys.argv[2]}: {db['numPassedTests']}/{db['numTotalTests']} failed {db['numFailedTests']}")
for k in sorted(set(a)|set(b)):
    if a.get(k)!=b.get(k): print(f"{a.get(k,'-'):8} -> {b.get(k,'-'):8} {k[:220]}")
