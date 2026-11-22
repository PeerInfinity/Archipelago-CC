#!/usr/bin/env python3
# rules-l77-suit-alone-witness: summarise every w77.mjs game run under runs/game/** into
#   runs/summary.txt  (one line per attempt: hits, deaths, door reached, reels, contacts)
#   l78-pulls.json    (every L78 lava-trap reel seen, with the attempt it came from)
#   all-pulls.json    (every reel, any level)
# Run from the evidence directory:  python3 tools/summarise.py
import glob, json, os

T = 16
rows, pulls = [], []
for f in sorted(glob.glob('runs/game/**/*.game.json', recursive=True)):
    d = json.load(open(f))
    r = d['row']
    att = os.path.relpath(f, 'runs/game').replace('.game.json', '')
    for p in r.get('pulls', []):
        pulls.append({'attempt': att, 'level': p['level'], 'trap': p['trap'], 'trapTile': p['trapTile'],
                      'frame_attached': p['t'], 'frame_released': p['lastT'],
                      'before': p['start'], 'attachedAt': p.get('attachedAt'), 'releasedAt': p['end'],
                      'tongue_lengths': p['tongues'], 'measured_distances': p.get('ds')})
    deaths = r.get('deaths', [])
    left = r.get('leftLevelAt')
    contacts = r.get('contacts', [])
    kills = [dd.get('killingContact') for dd in deaths if dd.get('killingContact')]
    rows.append('%-44s hits(final)=%s total=%s deaths=%d door=%s reels=%s contacts=%s killing=%s' % (
        att, r.get('hits'), r.get('totalHits'), len(deaths),
        ('L%d@t%d' % (left['level'], left['t'])) if left else '-',
        ['%s t%d %s->%s' % (p['trap'], p['t'], p['start']['tile'], p['end']['tile']) for p in r.get('pulls', [])],
        ['t%d %s %s(%.1f,%.1f) d%.1f' % (c['t'], c['player']['tile'], c['nearestBodies'][0]['cls'], c['nearestBodies'][0]['x'],
                                         c['nearestBodies'][0]['y'], c['nearestBodies'][0]['d']) for c in contacts if c.get('nearestBodies')],
        ['t%s %s %s(%.1f,%.1f) d%.1f' % (k['t'], k['player']['tile'], k['nearestBodies'][0]['cls'], k['nearestBodies'][0]['x'],
                                         k['nearestBodies'][0]['y'], k['nearestBodies'][0]['d']) for k in kills if k.get('nearestBodies')]))
open('runs/summary.txt', 'w').write('\n'.join(rows) + '\n')
l78att = sorted({os.path.relpath(f, 'runs/game').replace('.game.json', '') for f in glob.glob('runs/game/**/*.game.json', recursive=True)
                 if any(o['level'] == 78 for o in json.load(open(f))['ticks'])})
json.dump({'note': 'every L78 lava-trap reel seen in this slice (w77.mjs sequence detector: >= 4 ticks on the tongue table [32,29,22,15,10,7] within 1.6 px). attemptsInL78 lists every attempt that spent ticks in L78.',
           'pulls': [p for p in pulls if p['level'] == 78], 'attemptsInL78': l78att}, open('l78-pulls.json', 'w'), indent=1)
json.dump(pulls, open('all-pulls.json', 'w'), indent=1)
print('\n'.join(rows))
print('pulls: %d (L78: %d)' % (len(pulls), sum(p['level'] == 78 for p in pulls)))
