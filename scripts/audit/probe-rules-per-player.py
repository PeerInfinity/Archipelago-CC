#!/usr/bin/env python3
"""probe-rules-per-player.py — the measure-only census behind
NewDocs/plans/rules-per-player-audit.md (slice rules-per-player-audit, 2026-10-03).

Over every TRACKED frontend/presets/*/*/*_rules.json it prints:
  1. each top-level key: how many documents carry it, and its SHAPE
     (player-map = every key is a slot id; empty{}; dict; scalar);
  2. the flat (non-slot-keyed) candidates' values, per document;
  3. assume_bidirectional_exits top-level vs exporter[p];
  4. the multiworld conflation measurements (is_canonical / game_name vs world[p]);
  5. the schema's second-shape rows that still have live data.
Read-only; run from the repo root:  python3 scripts/audit/probe-rules-per-player.py
"""
import collections
import json
import subprocess

FILES = subprocess.run(['git', 'ls-files', 'frontend/presets/*/*/*_rules.json'],
                       capture_output=True, text=True, check=True).stdout.split()
DOCS = [(f, json.load(open(f))) for f in FILES]


def shape(v):
    if isinstance(v, dict):
        if not v:
            return 'empty{}'
        if all(k.isdigit() for k in v):
            return 'player-map'
        return 'dict'
    return type(v).__name__


print(f'== 1. top-level keys over {len(DOCS)} documents '
      f'(player counts: {dict(collections.Counter(len(d["player_names"]) for _, d in DOCS))})')
count, shapes = collections.Counter(), collections.defaultdict(collections.Counter)
for _, d in DOCS:
    for k, v in d.items():
        count[k] += 1
        shapes[k][shape(v)] += 1
for k, n in sorted(count.items(), key=lambda x: (-x[1], x[0])):
    print(f'  {n:4d} {k:28s} {dict(shapes[k])}')

FLAT = ['assume_bidirectional_exits', 'region_atlas', 'flash_panel', 'provenance',
        'is_vanilla', 'is_canonical', 'preset_label', 'playerId', 'sphere_log']
print('\n== 2. flat candidates, per preset group')
for k in FLAT:
    groups = collections.Counter(f.split('/')[2] for f, d in DOCS if k in d)
    print(f'  {k} ({sum(groups.values())} docs): {dict(sorted(groups.items()))}')

print('\n== 3. assume_bidirectional_exits')
top = sum(1 for _, d in DOCS if 'assume_bidirectional_exits' in d)
per = sum(1 for _, d in DOCS for e in (d.get('exporter') or {}).values()
          if 'assume_bidirectional_exits' in e)
print(f'  top-level: {top} docs; exporter[p]: {per} slot entries')

print('\n== 4. multiworld conflation')
for f, d in DOCS:
    if '/multiworld/' not in f:
        continue
    print(f'  {f.split("/")[-1]:42s} game_name={d["game_name"]!r:24s} '
          f'world games={ {p: w.get("game") for p, w in d["world"].items()} } '
          f'is_canonical={d.get("is_canonical")} exporter={list(d.get("exporter", {}))}')

print('\n== 5. schema second shapes with live data')
c, where = collections.Counter(), collections.defaultdict(set)
for f, d in DOCS:
    g = f.split('/')[2]
    for items in (d.get('items') or {}).values():
        for it in items.values():
            for k in ('advancement', 'useful', 'trap'):
                if k in it:
                    c['item.' + k + ' (legacy flag)'] += 1
                    where['item.' + k + ' (legacy flag)'].add(g)
    for w in d['world'].values():
        if 'use_auto_indirect_conditions' in w:
            c['world[p].use_auto_indirect_conditions (legacy)'] += 1
    if 'world_attributes' in d:
        c['top-level world_attributes (legacy)'] += 1
    s = json.dumps(d.get('regions'))
    n = s.count('"setting_value"')
    if n:
        c['rule type setting_value (legacy)'] += n
        where['rule type setting_value (legacy)'].add(g)
    if d.get('game_info') == {}:
        c['game_info {} (required key, no slot row)'] += 1
        where['game_info {} (required key, no slot row)'].add(g)
for k in ['item.advancement (legacy flag)', 'item.useful (legacy flag)', 'item.trap (legacy flag)',
          'rule type setting_value (legacy)', 'world[p].use_auto_indirect_conditions (legacy)',
          'top-level world_attributes (legacy)', 'game_info {} (required key, no slot row)']:
    print(f'  {c[k]:5d} {k} {sorted(where[k])}')
