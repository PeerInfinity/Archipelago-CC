import json,sys
R=json.load(open('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'))
regs=R['regions']['1'] if '1' in R['regions'] else R['regions']
AB={'Progressive Sword':'Sword','Ghost Spear':'Spear','Dark Suit':'Suit','Progressive Shield':'Shield','Wand':'Wand'}
def p(r):
  t=r['rule']
  if t=='Has':
    a=r['args']; n=AB.get(a['item_name'],a['item_name']); return n+('×%d'%a['count'] if a.get('count',1)>1 else '')
  if t in('And','Or'):
    return '('+(' & ' if t=='And' else ' | ').join(p(c) for c in r['children'])+')'
  return t+json.dumps(r.get('args',''))
for lv in sys.argv[1:]:
  for name,r in regs.items():
    if name==lv or name.startswith(lv+'__'):
      for e in r.get('exits',[]): print(name,'->',e.get('connected_region'),' ',p(e['access_rule']))
