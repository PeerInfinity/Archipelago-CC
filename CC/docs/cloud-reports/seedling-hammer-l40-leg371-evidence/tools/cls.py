#!/usr/bin/env python3
"""Measure-only (slice L371): census rows (l371-solve.mjs RESULT jsonl) -> one class per pass, read off the answer's
own words. Usage: cls.py <rows.jsonl>... [--md] [--label=<name>]"""
import json, re, sys
from collections import Counter

def cls(p):
    if p['ok']:
        return f"SOLVE {p['ticks']} t"
    m = p['message'] or ''
    rung = ''
    k = re.search(r'-> (kill \(spinner@192,160\) by press|break stance \([^)]*\)|hold stance \([^)]*\))(?::| ->)', m)
    head = m.split(':', 1)[0]
    where = 'kill' if 'kill (spinner@192,160) by press' in head else ('break' if 'break stance' in head else ('hold' if 'hold stance' in head else '?'))
    if 'PRESS_KILL_REBOOT_GUARD' in m:
        src = re.search(r'died at t(\d+) \(([^)]*)\)', m)
        return f"reboot@kill t{src.group(1)} ({src.group(2).split('@')[0]} {src.group(2).split('#')[-1] if '#' in src.group(2) else ''})".strip()
    if 'shouldStop' in m and 'deadline' in m:
        s = re.search(r'at the `([^`]*)` site', m)
        return f"deadline@{where} ({s.group(1) if s else '?'})"
    if m.startswith('chaserForecast') and 'Game.shake' in m:
        return 'shake-throw(forecast)'
    if 'levelRun: whether' in m:
        return 'shake-throw(live run)'
    if 'the hold stands still' in m and 'no pacing is clean' in m:
        b = re.search(r'(bomb:\S+?) at paced tick', m)
        return f"paced-hold refused (MOVING_WAIT, {b.group(1) if b else '?'})"
    if 'There is no step out' in m:
        t = re.search(r'first saw this corner at t(\d+)', m)
        return f"HAMMER_SAFETY@{where}" + (f" t{t.group(1)}" if t else '')
    if 'nowhere to be' in m:
        return f"HAMMER_SAFETY(refuge)@{where}"
    if 'combat ladder is EXHAUSTED' in m:
        d = re.search(r'danger at \([^)]*\) — (\S+?)(?: \(|$)', m)
        return f"EXHAUSTED@{where} ({d.group(1) if d else '?'})"
    if 'whole' in m and 'bound' in m and 'still in the world' in m:
        return f"STRIKE_BOUND@{where}"
    return f"other@{where}: {m[:80]}"

def main():
    files = [a for a in sys.argv[1:] if not a.startswith('--')]
    md = '--md' in sys.argv
    rows = [json.loads(l) for f in files for l in open(f) if l.strip()]
    rows.sort(key=lambda r: r['seam'])
    tally = Counter()
    if md:
        print('| seam | answer | units | dashless | full | guards (shake/reboot) | wall s |')
        print('|---|---|---|---|---|---|---|')
    for r in rows:
        ps = {p['pass']: p for p in r['passes']}
        units = {x['pass']: x.get('work') for x in r['rows']}
        d, f = cls(ps['dashless']), cls(ps['full'])
        ans = 'SOLVE' if r['ok'] else 'refusal'
        tally[(d, f) if not r['ok'] else ('SOLVE',)] += 1
        g = r['guards']
        if md:
            print(f"| {r['seam']} | {ans} `{r['answer'][:8]}` | {r['work']} | {d} ({units.get('dashless')}) | {f} ({units.get('full')}) | {g['shakeRefused']}/{g['rebootRefused']} | {r['ms']/1000:.0f} |")
        else:
            print(r['seam'], ans, r['answer'][:8], r['work'], '|', d, units.get('dashless'), '|', f, units.get('full'), '|', g, f"{r['ms']/1000:.0f}s")
    print()
    print(f"{len(rows)} rows; solves {sum(1 for r in rows if r['ok'])}")
    for k, v in tally.most_common():
        print(f"- {v}× {' / '.join(k)}")

main()
