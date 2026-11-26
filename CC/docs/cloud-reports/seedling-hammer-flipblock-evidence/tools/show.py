import json,sys
for f in sys.argv[1:]:
  try: o=json.load(open(f))
  except Exception as e: print(f, 'ERR', e); continue
  print(f.split('/')[-1], 'ok',o['ok'],'work',o['work'],'ticks',o['ticks'],'wall',o['wall'],'asks',o['asks'],o['bySite'],'pm',o['pm'])
  for p in o['passRows']: print('   ',p['pass'],p['ok'],'asks',p['asks'],'ms',p['ms'],'pm',p['pm'],p['msg'][:160])
  for g in o['gsw']: print('    gsw',g['wait'],g['ok'],g['asks'],g['ms'],(g.get('why') or '')[:120])
  for r in o['pkh']: print('    pkh',json.dumps(r)[:600])
