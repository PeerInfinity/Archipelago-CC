import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
gone=[k for k in a if k not in b]; new=[k for k in b if k not in a]
ch=[k for k in a if k in b and a[k]!=b[k]]
print('elements',len(a),'->',len(b),'| gone',len(gone),'new',len(new),'changed',len(ch))
for k in gone: print('-',k, json.dumps(a[k])[:160])
for k in new: print('+',k, json.dumps(b[k])[:300])
for k in ch: print('~',k,'\n    was',json.dumps(a[k])[:240],'\n    now',json.dumps(b[k])[:400])
