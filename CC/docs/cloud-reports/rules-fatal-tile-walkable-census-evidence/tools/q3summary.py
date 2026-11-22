# Q3 table from the full witness census (q3-witness-paths-all.json.gz): every witness cell whose RAW tile is player-fatal
# for the row's inventory (witness-cells.mjs `fatal`), with its disposition, plus the suit-less igneous rows.
#   python3 q3summary.py q3-witness-paths-all.json.gz q3-pit-arrivals.jsonl > q3-census.json
import gzip, json, sys, collections
d = json.load(gzip.open(sys.argv[1]))
pit_arrivals = {json.loads(l)['region'] for l in open(sys.argv[2])}
fatal = []
for r in d['rows']:
    cs = r.get('cells', [])
    for i, c in enumerate(cs):
        if not c.get('fatal'): continue
        if c['maze'] == 'exit' and i == len(cs) - 1: disp = 'CROSSING: the exit cell itself, last cell of the path (a pit drop / water edge IS the AP exit)'
        elif r['level'] in (50, 52) and c['fatal'].startswith('water'): disp = 'ENTRY GATE: water lifted to open by entryGateOf (make-seedling-playthrough-rules.mjs:491-517); every entrance into the level names Progressive Swim in all three presets'
        elif i == 0 and r['from'] in pit_arrivals: disp = 'ARRIVAL ON A PIT EXIT TILE: the sub-region entrance is its pit exit; reach equals the floor neighbour\'s (q3-pit-arrivals.jsonl) or the row is the drop itself'
        else: disp = 'UNEXPLAINED'
        fatal.append({'level': r['level'], 'kind': r['kind'], 'from': r['from'], 'to': r['to'], 'set': r['set'], 'cell': [c['x'], c['y']], 'pathIndex': i, 'pathCells': len(cs),
                      't': c['t'], 'tName': c['tName'], 'fatal': c['fatal'], 'maze': c['maze'], 'grid': c['grid'], 'disposition': disp})
ign = []
for r in d['rows']:
    cs = r.get('cells', [])
    cells = [(c['x'], c['y']) for c in cs if c.get('converts')]
    if not cells: continue
    cnt = collections.Counter(cells)
    idle = sum(1 for i, c in enumerate(cs) if c.get('converts') and ((cs[i + 1]['step'] if i + 1 < len(cs) else r['planLength'] + 1) - c['step'] - 1) > 0)
    ign.append({'level': r['level'], 'kind': r['kind'], 'from': r['from'], 'to': r['to'], 'set': r['set'], 'igneousCells': sorted(set(cells)),
                'revisits': [list(k) for k, v in cnt.items() if v > 1], 'idleOnIgneous': idle, 'endsOnIgneous': bool(cs[-1].get('converts'))})
out = {
    'base': d.get('base'), 'preset': 'seedling_playthrough_maze/AP_1 (witness paths); the classifier census covers the producer grid all three presets compile from',
    'witnessRows': len(d['rows']), 'inWorld': sum(1 for r in d['rows'] if r.get('kind') == 'in-world'), 'entry': sum(1 for r in d['rows'] if r.get('kind') == 'entry'),
    'fatalCellsOnWitnessPaths': len(fatal), 'byDisposition': dict(collections.Counter(f['disposition'].split(':')[0] for f in fatal)),
    'unexplained': [f for f in fatal if f['disposition'] == 'UNEXPLAINED'],
    'fatal': fatal,
    'suitlessIgneousRows': len(ign), 'igneousRevisits': sum(1 for x in ign if x['revisits']), 'igneousIdle': sum(1 for x in ign if x['idleOnIgneous']),
    'igneousEndsOn': sum(1 for x in ign if x['endsOnIgneous']), 'igneous': ign,
}
print(json.dumps(out, indent=1))
