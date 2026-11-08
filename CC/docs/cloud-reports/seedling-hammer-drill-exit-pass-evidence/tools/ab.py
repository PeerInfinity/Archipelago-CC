# scratch: replay.mjs rows → one line per request × arm (digest, ok, ticks, work, fresh-run check, head)
import json, sys
for l in open(sys.argv[1]):
    r = json.loads(l)
    print('\t'.join(str(x) for x in [r['id'], r['i'], r['arm'], r['digest'], r['ok'], r['ticks'], r['work'],
        json.dumps(r['fresh']), (r['head'] or '').replace('\n', ' ')[:260]]))
