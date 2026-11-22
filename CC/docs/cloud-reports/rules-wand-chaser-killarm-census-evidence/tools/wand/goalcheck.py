#!/usr/bin/env python3
"""rules-wand-chaser-killarm-census: per game run, did the player reach the row's GOAL (an exit's level, or a tile of the
goal sub-region) with 0 hits and 0 restarts before it? Reads tools/wand/rows.json and runs/game/<dir>/*.game.json.gz.
  python3 goalcheck.py <dir> [<dir> ...]   -> one line per run: row col tape VERDICT tick first-hit nearest"""
import gzip, json, math, os, re, sys
ROWS = json.load(open(os.path.join(os.path.dirname(__file__), 'rows.json')))
for d in sys.argv[1:]:
    for f in sorted(os.listdir(d)):
        if not f.endswith('.game.json.gz'): continue
        m = re.match(r'(.*)-(wand|firewand)-(k\d+(?:-\d)?)\.game', f)
        if not m or m.group(1) not in ROWS: continue
        row, col, tag = m.groups(); spec = ROWS[row]
        g = json.load(gzip.open(os.path.join(d, f))); reads = g['reads']; boot = int(spec['boot'].split(':')[0])
        goal = spec['goal']
        tiles = [tuple(map(int, t.split(','))) for t in goal[6:].split(';')] if goal.startswith('tiles:') else None
        glevel = None if tiles else int(goal.split(':')[2])
        hit = None; reached = None; died = None; prev_df = 0
        for r in reads:
            if r['level'] == boot and r['hits'] > 0 and hit is None: hit = r['tick']
            if reached is None and hit is None:
                if tiles and r['level'] == boot and (int(r['x'] // 16), int(r['y'] // 16)) in tiles: reached = r['tick']
                if glevel is not None and r['level'] == glevel: reached = r['tick']
            if hit is not None or reached is not None: break
        # a restart (death) before the goal: the boot level's player jumps back to the boot point with dead_frames rising
        v = 'YES' if reached is not None else ('NO-line(hit@%d)' % hit if hit is not None else 'not-reached')
        if reached is not None:
            # a death before the goal: the player jumps > 40 px in one read inside the boot level (the restart's respawn);
            # `dead_frames` is not used (it also rises by 20 at every level change)
            b = [r for r in reads if r['tick'] <= reached and r['level'] == boot]
            if any(math.hypot(b[i]['x'] - b[i - 1]['x'], b[i]['y'] - b[i - 1]['y']) > 40 for i in range(1, len(b))): v = 'DIED-before'
        if v == 'YES' and tiles:
            # a sub-region goal must HOLD: no hit and no death anywhere in the run (the tape idles 30 ticks at the end)
            bb = [r for r in reads if r['level'] == boot]
            later_hit = next((r['tick'] for r in bb if r['hits'] > 0), None)
            jump = any(math.hypot(bb[i]['x'] - bb[i - 1]['x'], bb[i]['y'] - bb[i - 1]['y']) > 40 for i in range(1, len(bb)))
            if later_hit is not None: v = 'NO-hold(hit@%d)' % later_hit; hit = later_hit
            elif jump or any(r['level'] != boot for r in reads): v = 'NO-hold(died/left)'
        near = ''
        if hit is not None:
            p = next(r for r in reads if r['tick'] == hit)
            en = [(math.hypot(e['x'] - p['x'], e['y'] - p['y']), e['c']) for e in (p.get('en') or [])]
            if en: dd, c = min(en); near = f'{c} {dd:.1f}px'
        print(f'{row:18s} {col:8s} {tag:6s} {v:18s} t{reached} {near}  [{d}/{f}]')
