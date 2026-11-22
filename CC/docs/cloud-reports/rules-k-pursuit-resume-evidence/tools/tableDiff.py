import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
ka={r['key']:r for r in a['rows']}; kb={r['key']:r for r in b['rows']}
print('rows',len(ka),'->',len(kb))
for k in sorted(set(ka)-set(kb)): print('DEL',k)
for k in sorted(set(kb)-set(ka)): print('ADD',k)
for k in sorted(set(ka)&set(kb)):
  if json.dumps(ka[k],sort_keys=True)!=json.dumps(kb[k],sort_keys=True): print('CHG',k)
print('excluded equal', a['excluded']==b['excluded'])
print('inputs', a.get('inputs'), '->', b.get('inputs'))
print('topkeys', sorted(a), sorted(b))
