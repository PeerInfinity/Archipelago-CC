import gzip,json,sys,hashlib
for f in sys.argv[1:]:
  for l in gzip.open(f,'rt'):
    if not l.strip(): continue
    r=json.loads(l)
    if str(r.get('id'))!='19': continue
    for i,q in enumerate(r['requests']):
      res=q.get('result') or {}
      rq=q['request']
      h=hashlib.sha1(json.dumps(rq,sort_keys=True).encode()).hexdigest()[:10]
      print(f.split('/')[-2], f.split('/')[-1][:2], f"19:{i}", 'reqhash',h, 'budget',rq.get('budgetWork'), 'kind',res.get('kind'), 'ok',res.get('ok'),'work',res.get('work'),'ans',res.get('answer'), 'env', res.get('solverEnv'), 'keys', list(rq.keys())[:12])
