#!/usr/bin/env python3
"""SCRATCH (seedling-fidelity-digest D1): the census table — every createLevelRun binding the escape's reach reads,
with its readers inside the reach and EVERY writer (closure function, run member, or <construction>), and the digest
component that carries it. Also the persistence channel's own readers (the crux).  usage: d1-table.py <census.json>"""
import json, sys
d = json.load(open(sys.argv[1]))
COMP = {}
for c, names in {
    'staging': 'boot noclip noHazards noDamage grants equips roles pins save seam',
    'place': 'level ticksCompleted firstTickInWorld world worlds',
    'clock': 'clock clockRefusal',
    'player': 'state damage frozenTimer swordWindow slashState slashEndsAt spearEndsAt ceremony bobArena bobNoInput primary slotOrder inventory grantsByLevel equipsByTick',
    'persist': 'clearedByLevel pendingEarnedClears despawnedByLevel staticRemovedTags unreadRoomWrites totemParts keys collectedPickups lockSnap moonrockSet chestOpens rockFalls',
    'visit': 'activatorStates bridgeStates pushableStates rockStates burnStates ropeStates fallRockStates moonrockStates crusherStates bossStates shieldBossStates finalDoorStates turretStates beamTowerStates magicalLockStates chestStates pulserStates spinnerStates pullsByLevel wandWindows fireWindows',
}.items():
    for n in names.split(): COMP[n] = c
EXCL = {'levelSource': 'EXCLUDED: a function; the caller keys on the staging it came from',
        'crossRoomWriterIndex': 'EXCLUDED: a memo of levelSource', 'PROGRESS_FIELDS': 'EXCLUDED: frozen constant',
        'seamBoot': 'EXCLUDED: f(seam)', 'clockDeclared': 'EXCLUDED: f(seam)', 'bootCutscene': 'EXCLUDED: f(seam)',
        'bootSave': 'EXCLUDED: f(save)', 'cutscene': 'EXCLUDED: f(seam)', 'spawn': 'EXCLUDED: f(boot)'}
rows = [r for r in d['rows'] if r['reachedRead'] and r['kind'] not in ('fn', 'const-fn')]
rows.sort(key=lambda r: r['line'])
print('| binding | kind | decl | read in the reach by | written by (every writer; `<construction>` = at build) | digest |')
print('|---|---|---|---|---|---|')
short = lambda xs, k=6: ', '.join(f'`{x}`' for x in xs[:k]) + (f' +{len(xs) - k}' if len(xs) > k else '')
for r in rows:
    w = [u for u in r['writers'] if not u.startswith('=')]
    print(f"| `{r['name']}` | {r['kind']} | :{r['line']} | {short(sorted(r['reachedRead']), 4)} | {short(sorted(w), 8) or '—'} | "
          f"{COMP.get(r['name'], EXCL.get(r['name'], '??'))} |")
print(f"\n{len(rows)} bindings; digested {sum(r['name'] in COMP for r in rows)}, excluded by name {sum(r['name'] in EXCL for r in rows)}, "
      f"unaccounted {[r['name'] for r in rows if r['name'] not in COMP and r['name'] not in EXCL]}")
print('\n## the persistence channel (the crux): every reader and writer, and whether the escape reach reads it')
for n in ('persistence', 'timedClears', 'declaredClears', 'despawn', 'scratchPersistence'):
    r = next(x for x in d['rows'] if x['name'] == n)
    print(f"- `{n}` ({r['kind']}, :{r['line']}): read by {sorted(r['readers'])}; written by {sorted(r['writers'])}; "
          f"read in the escape reach: {r['reachedRead'] or 'NO'}")
