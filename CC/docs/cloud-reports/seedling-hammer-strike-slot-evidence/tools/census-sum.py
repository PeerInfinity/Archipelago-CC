# MEASUREMENT ONLY: summarise slot-register jsonl files. A press is DRIVEN when no frame of its stack is a preview's
# (`previewWalk` / `combatBefore`); each non-blade press is listed with its walker (the first non-policy frames).
import json, sys, collections
for path in sys.argv[1:]:
    tot = collections.Counter(); rows = []
    for line in open(path):
        if not line.strip(): continue
        d = json.loads(line)
        tot['policies'] += d['policies']; tot['presses'] += d['presses']
        for r in d['rows']:
            r['_tag'] = d.get('tag'); rows.append(r)
    drv = [r for r in rows if not any(f.startswith(('previewWalk@', 'combatBefore@')) for f in r['stack'])]
    print(f"== {path}: policies {tot['policies']}, presses {tot['presses']}, non-blade {len(rows)} "
          f"(driven {len(drv)}, preview {len(rows) - len(drv)})")
    by = collections.Counter((r['weapon'], 'planned' if r['planned'] else ('dash' if r['dash'] else 'strike'),
                              'driven' if r in drv else 'preview') for r in rows)
    for k, v in sorted(by.items()): print('   ', k, v)
    seen = set()
    for r in drv:
        sig = (r['_tag'], r['level'], r['tick'])
        if sig in seen: continue
        seen.add(sig)
        game = [(g['fired'], g['hits']) for g in (r.get('game') or [])]
        print(f"    DRIVEN {r['_tag']} L{r['level']} t{r['tick']} {r['weapon']} slot {r['primary']} of {r['slots']} "
              f"at ({r['x']:.2f},{r['y']:.2f}) held {r['held']} target {r['target']} planned {r['planned']} "
              f"dash {r['dash']} game {game} via {' <- '.join(r['stack'][:6])}")
