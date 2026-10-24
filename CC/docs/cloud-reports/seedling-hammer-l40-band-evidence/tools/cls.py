# LB: the census rows -> one class per seam time (the census tool's rows; the class from the answer's own words).
import json, sys, re
def cls(r):
    m = (r.get('message') or r.get('error') or '')
    if r.get('ok'): return 'SOLVED'
    if 'anytime deadline' in m: return 'deadline'
    if m.startswith('chaserForecast: whether'): return 'shake-throw(forecast)'
    if m.startswith('levelRun: whether'): return 'shake-throw(live run)'
    if m.startswith('levelRun: the swing at'): return 'swing-throw'
    if 'the player died at t' in m: return 'refused: death (REBOOT guard)'
    if 'every key set' in m: return 'refused: HAMMER_SAFETY'
    if 'ran the strike schedule' in m: return 'strike bound'
    if 'EXHAUSTED' in m: return 'refused: exhausted'
    return 'other: ' + m[:60]
if __name__ == '__main__':
    rows = {}
    for f in sys.argv[1:]:
        for l in open(f):
            r = json.loads(l); rows.setdefault(f, {})[r['seamTime']] = (cls(r), r.get('work'), r.get('answer'))
    fs = sys.argv[1:]
    times = sorted(set(t for f in fs for t in rows.get(f, {})))
    print('| seam | ' + ' | '.join(f.split('/')[-1].replace('.jsonl', '') for f in fs) + ' |')
    print('|---|' + '---|' * len(fs))
    for t in times:
        print(f'| {t} | ' + ' | '.join((lambda x: f'{x[0]}, {x[1]}' if x else '—')(rows.get(f, {}).get(t)) for f in fs) + ' |')
    from collections import Counter
    for f in fs:
        print(f, dict(Counter(v[0] for v in rows.get(f, {}).values())), 'n', len(rows.get(f, {})))
