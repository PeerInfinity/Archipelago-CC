import json, sys
for f in sys.argv[1:]:
    for l in open(f):
        d = json.loads(l)
        h = d.get('history') or [{}]
        pl = d.get('plans') or [{}]
        print(f.split('/')[-1], d['id'], 'end=' + str(d['end']), 'seam=' + str(d.get('seamTime')), f"ms={d.get('ms')}",
              'plan=' + ('ok %st' % pl[-1].get('ticks') if pl[-1].get('ok') else 'refused' if pl[-1] else '-'),
              'passes=' + ','.join(f"{p['pass']}:{'ok' if p['ok'] else p.get('kind')}" for p in pl[-1].get('passes', [])),
              f"drained={h[-1].get('drained')}/{h[-1].get('ticks')} solvedMs={h[-1].get('solvedMs')}",
              'msg=' + str(d.get('failed') or '')[:260].replace('\n', ' '))
