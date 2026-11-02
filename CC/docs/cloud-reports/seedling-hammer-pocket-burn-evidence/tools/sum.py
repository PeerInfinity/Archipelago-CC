#!/usr/bin/env python3
"""scratch (SOUTHDOOR): one line per request of arms.mjs jsonl files: id/i verdict work ticks gm, the refusal head, the
approach and door instruments. Usage: sum.py <jsonl>..."""
import json, sys
for p in sys.argv[1:]:
    print('==', p.split('/')[-1])
    for l in open(p):
        r = json.loads(l)
        v = f"SOLVED {r['ticks']} gm={r['gm'] and r['gm'].get('gm')} hits={r['gm'] and r['gm'].get('hits')}" if r['ok'] else f"REFUSED {r['kind']}"
        print(f"  {r['id']}/{r['i']} {v} work={r['work']} {r['ms']}ms {r['digest']}")
        if r['head']:
            h = r['head']
            print('    head:', h[:420].replace('\n', ' '))
        if r.get('door'): print('    door:', json.dumps(r['door'])[:400])
        if r.get('ta'): print('    ta:', json.dumps(r['ta'])[:400])
