# MEASUREMENT ONLY: arm-register's rows, compacted: per candidate its verdict, why, arrival tick, and the target's
# hits/hitsTimer/punch transitions in the dwell (the samples where any of them changes, or a punch is reported).
import json, sys
for l in open(sys.argv[1]):
    r = json.loads(l); s = r['samples']; prev = None; marks = []
    for x in s:
        b = x[4]
        if x[1] != 'dwell': continue
        key = 'gone' if b == 'gone' else (b[2], b[3] > 0, b[4])
        if key != prev or (b != 'gone' and b[4]): marks.append(x)
        prev = key
    print(json.dumps({'ask': r['ask'], 't': r['t'], 'from': r['from'], 'stance': r['stance'], 'verdict': r['verdict'], 'why': r['why'],
        'arrive': sum(1 for x in s if x[1] != 'dwell'), 'dwellMarks': marks}))
