#!/usr/bin/env python3
"""census.py — slice `rules-spinner-tag-alias`: every map entity whose persistence tag resolves NEGATIVE (or >= 30),
the slot `Main.levelPersistenceSet(level, tag)` (`Main.as:222`, index level*30+tag, unchecked) would land on, whether
its class can reach `Game.setPersistence` with that tag (WRITER table below, read from vendor/seedling source), whether
any map entity of the TARGET level owns that slot, and whether a rules event names it.

Usage: python3 CC/docs/cloud-reports/rules-spinner-tag-alias-evidence/tools/census.py   (prints Markdown)
"""
import json, re, pathlib
R = pathlib.Path(__file__).resolve().parents[5]
atlas = json.loads((R / 'frontend/modules/flashPanel/atlases/seedling-map.json').read_text())
rules = (R / 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json').read_text()
TPL = 30  # Game.as:525 tagsPerLevel

# How the Game.as loader turns an ABSENT @tag into an int (Game.as:2281-2387): `o.@tag` coerces "" -> 0;
# `optionalTag` (bosskey, totempart, seed) and the teleporter's `String(o.@tag)=="" ? -1` give -1.
ABSENT_IS_MINUS_ONE = {'bosskey', 'totempart', 'seed', 'teleporter'}
# Can a -1 of this type reach setPersistence? (source citation, verdict)
WRITER = {
    'spinner': ('Enemies/Spinner.as:47-64: check() guards tag>=0, removed() writes setPersistence(tag) under doActions', True),
    'breakablerock': ('Puzzlements/BreakableRock.as:68-72: endAnim() writes setPersistence(tag) with no guard', True),
    'karlore': ('NPCs/Karlore.as:17 -> NPC.as:122 reads checkPersistence only under tag>=0; NPC/Karlore never write', False),
    'teleporter': ('Teleporter.as:79-82 removeSelf() writes, but nothing calls Teleporter.removeSelf; :86 read guarded tag>=0', False),
    'bosskey': ('Pickups/BossKey.as:68 `if (tag >= 0) setPersistence`', False),
    'totempart': ('Pickups/BossTotemPart.as:51 `if (tag >= 0) setPersistence`', False),
    'seed': ('Pickups/Seed.as:109 `if (tag >= 0) setPersistence`', False),
}
events = {}
for m in re.finditer(r'"(L(\d+) flag (\d+): [^"]*)"', rules):
    events[(int(m.group(2)), int(m.group(3)))] = m.group(1)
owned = {}
for l in atlas['levels']:
    for e in l['entities']:
        t = e.get('attrs', {}).get('tag')
        if t not in (None, '') and int(t) >= 0:
            owned.setdefault((l['level'], int(t)), []).append(f"{e['type']}@{e['x']},{e['y']}")
maxtag = max(t for (_, t) in owned)
rows, unknown = [], set()
for l in atlas['levels']:
    for e in l['entities']:
        raw = e.get('attrs', {}).get('tag')
        if raw in (None, ''):
            if e['type'] not in ABSENT_IS_MINUS_ONE: continue
            tag = -1; how = 'absent -> -1'
        else:
            tag = int(raw); how = f'tag="{raw}"'
        if 0 <= tag < TPL: continue
        idx = l['level'] * TPL + tag
        tgt = (idx // TPL, idx % TPL) if idx >= 0 else None
        if e['type'] not in WRITER: unknown.add(e['type'])
        cite, writes = WRITER.get(e['type'], ('UNCLASSIFIED', None))
        rows.append((l['level'], f"{e['type']}@{e['x']},{e['y']}", how, tgt, writes, cite,
                     owned.get(tgt, []) if tgt else [], events.get(tgt) if tgt else None))
print(f'max non-negative tag on any map entity: {maxtag}; rules events: {len(events)}; '
      f'max event tag: {max(t for (_, t) in events)}; unclassified types: {sorted(unknown) or "none"}\n')
print('| level | entity | tag | alias slot | writes? | slot owned in target level | rules event on slot |')
print('|---|---|---|---|---|---|---|')
agg = {}
for lv, ent, how, tgt, w, cite, own, ev in rows:
    if ent.startswith('teleporter@') or ent.split('@')[0] in ('bosskey', 'totempart', 'seed'):
        agg.setdefault(ent.split('@')[0], []).append((lv, tgt, own, ev)); continue
    print(f"| L{lv} | `{ent}` | {how} | {{{tgt[0]},{tgt[1]}}} | {'YES' if w else 'no'} | {', '.join(own) or 'none'} | {ev or 'none'} |")
for typ, xs in agg.items():
    print(f"| {len({x[0] for x in xs})} levels | `{typ}` x{len(xs)} | -1 | {{N-1,29}} | no | "
          f"{sum(1 for x in xs if x[2])} owned | {sum(1 for x in xs if x[3])} events |")
print('\nWRITER classification (source):')
for k, (c, w) in WRITER.items(): print(f'- `{k}`: {"WRITES" if w else "no write"} — {c}')
