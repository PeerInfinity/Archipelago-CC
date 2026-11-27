# entrymarks.py <capture.jsonl> <entry...>: per entry, each request's outcome; R = refusal, then +retry
import json,sys
rows={json.loads(l)['id']:json.loads(l) for l in open(sys.argv[1])}
for e in map(int,sys.argv[2:]):
    r=rows.get(e)
    if not r: print(f"entry {e}: not captured"); continue
    refs=[f"{q['i']}{'(retry)' if q['retry'] else ''}:{q['goal']}" for q in r['requests'] if not (q.get('result') or {}).get('ok')]
    last=r['requests'][-1]; ok=(last.get('result') or {}).get('ok')
    print(f"entry {e} {r['key']!r}: {len(r['requests'])} req, last {last['i']} {last['goal']} -> {'SOLVED' if ok else 'REFUSED'} {last['result'].get('answer')}; refusals: {', '.join(refs) or 'none'}")
