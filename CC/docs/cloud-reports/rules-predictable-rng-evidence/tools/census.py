#!/usr/bin/env python3
"""rules-predictable-rng: the census of entropy in the Seedling AS3 (vendor/seedling, read-only).

1. SITES: every live (uncommented) `Math.random()`, `Rng.cos()`, `FP.random`/`FP.rand`/`FP.choose` and `getTimer()`
   call in src/, with the curated classification below keyed by (file, a snippet of the line). A live site the table
   does not classify is printed as UNCLASSIFIED and fails the run, so the table cannot silently fall behind the source.
2. REACH: per level (the `/*N*/` index of `Game.as`'s embed table), what the level's .oel builds that DRAWS on the
   gameplay stream: grass tiles (24 draws each, `Tile.addGrass`), Enemy-class objects (1 draw each, `Enemy.coins`;
   +1 for Spinner/WallFlyer), chests (a seal rejection loop on open), FinalBoss, TentacleBeast.

    python3 census.py [--src vendor/seedling] [--out census.json]
"""
import argparse, json, re, sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--src', default='vendor/seedling')
ap.add_argument('--out', default='CC/docs/cloud-reports/rules-predictable-rng-evidence/census.json')
a = ap.parse_args()
ROOT = Path(a.src)
SRC = ROOT / 'src'

# (file, snippet) -> classification. kind: GAMEPLAY (the value can change a hit, a kill, a reachable cell, a drop or a
# route), ADVANCER (a gameplay-stream draw whose VALUE nothing gameplay-visible reads, but whose COUNT moves every later
# gameplay draw), SAVE-ONLY (value reaches save data / a medal only), COSMETIC (render / audio / nothing), ENGINE
# (frame pacing; no game logic reads it).
C = [
    ('Enemies/FinalBoss.as', 'Math.random() * rockFrequency', 'gameplay', 'GAMEPLAY',
     'barrage roll: 1 in 6 per barrage tick spawns a RockFall (the Owl, L112)'),
    ('Enemies/FinalBoss.as', 'new RockFall(p.x + p.v.x * stepsAhead', 'gameplay', 'GAMEPLAY',
     'rock aim x and y: +/-20 px around the player\'s position 15 velocity-steps BEHIND (L112); decides a hit'),
    ('Enemies/FinalBoss.as', 'Math.random() * grenadeFrequency', 'gameplay', 'GAMEPLAY',
     'grenade roll: 1 in 40 per walk tick drops a Grenade at the Owl (L112); a Grenade is an Enemy (+1 coins draw)'),
    ('Enemies/FinalBoss.as', 'new RockFall(120 + Math.random() * 8 - 4', 'gameplay', 'GAMEPLAY',
     'death rocks: 5 x (x jitter) on the "dead" anim end (L112), after both flags are cleared; can still land on the player'),
    ('Scenery/RockFall.as', 'sprRockFall.scale = Math.random()', 'gameplay', 'GAMEPLAY',
     'rock scale 0.25..0.75 -> setHitbox(32*scale, 16*scale): the rock\'s HITBOX size (L112)'),
    ('Enemies/TentacleBeast.as', 'xpos = Math.random() * (spawnRect.width - whirlpoolMargin', 'gameplay', 'GAMEPLAY',
     'whirlpool spawn x (rejection-sampled, up to 101 tries) — TentacleBeast, L57 (Dungeon5 Boss)'),
    ('Enemies/TentacleBeast.as', 'ypos = Math.random() * (spawnRect.height - whirlpoolMargin', 'gameplay', 'GAMEPLAY',
     'whirlpool spawn y (L57)'),
    ('Enemies/TentacleBeast.as', 'xpos = Math.random() * (spawnRect.width - tentacleMargin', 'gameplay', 'GAMEPLAY',
     'tentacle spawn x (L57); a Tentacle is an Enemy (+1 coins draw)'),
    ('Enemies/TentacleBeast.as', 'ypos = Math.random() * (spawnRect.height - tentacleMargin', 'gameplay', 'GAMEPLAY',
     'tentacle spawn y (L57)'),
    ('Chest.as', 'index = Math.floor(Math.random() * SealController.SEALS)', 'gameplay', 'ADVANCER',
     'seal identity on a chest open: a REJECTION loop (variable draw count) over SealController.getSealPart, which '
     'writes Main.hasSealPartSet(slot, index). Logic reads only the COUNT (hasAllSealParts = last slot != -1); the '
     'identity is drawn by SealController and read back in save.seal_parts. Variable count => moves later draws'),
    ('Enemies/Enemy.as', 'private const coins:int = 4 + Math.random() * 4', 'gameplay', 'ADVANCER',
     'Enemy.coins field initialiser: 1 draw per Enemy constructed (level build AND runtime spawns: Grenade, Tentacle). '
     'dropCoins() is never called (every call site is commented out), so the value is dead'),
    ('Enemies/Enemy.as', 'var astart:Number = Math.random() * Math.PI * 2', 'gameplay', 'ADVANCER',
     'dropCoins() angle — DEAD CODE (no live caller); listed so the census is complete'),
    ('Enemies/Spinner.as', 'private var coins:int = 4 + Math.random() * 4', 'gameplay', 'ADVANCER',
     'Spinner shadows Enemy.coins: a SECOND dead draw per Spinner'),
    ('Enemies/WallFlyer.as', 'private var coins:int = 4 + Math.random() * 4', 'gameplay', 'ADVANCER',
     'WallFlyer shadows Enemy.coins: a SECOND dead draw per WallFlyer'),
    ('Scenery/Tile.as', 'new Grass(x + Tile.w * (Math.random() - 0.5)', 'gameplay', 'SAVE-ONLY',
     'grass blade x,y: 12 blades x 2 draws = 24 per grass tile at the build. A blade has a hitbox and cut() bumps '
     'Main.grassCut (a medal counter at 10,000; no lock or check reads it). Fixed count per build'),
    ('net/flashpunk/FP.as', 'randomSeed = 2147483647 * Math.random()', 'gameplay', 'ADVANCER',
     'FP\'s own generator is seeded ONCE from one gameplay draw in Engine\'s ctor (FP.randomSeed == 0); a boot-time '
     'draw, before any tape'),
]
FP_SITES = [
    ('Scenery/RockFall.as', 'angleRate *= FP.choose(1, -1)', 'fp', 'COSMETIC', 'rock spin direction'),
    ('Scenery/RockFall.as', 'sprRockFall.scaleX = FP.choose(1, -1)', 'fp', 'COSMETIC', 'mirror; setHitbox reads scale, not scaleX'),
    ('Pickups/HealthPickup.as', 'scaleX = FP.choose(1, -1)', 'fp', 'COSMETIC', 'mirror'),
    ('Pickups/HealthPickup.as', 'scaleY = FP.choose(1, -1)', 'fp', 'COSMETIC', 'mirror'),
    ('Player.as', 'fallSpinSpeed:int = 8 * FP.choose(-1, 1)', 'fp', 'COSMETIC', 'pit-fall spin'),
    ('Enemies/Enemy.as', 'fallSpinSpeed:int = 8 * FP.choose(-1, 1)', 'fp', 'COSMETIC', 'pit-fall spin (FP stream, not Math.random)'),
    ('net/flashpunk/graphics/Spritemap.as', 'frame = FP.rand(_frameCount)', 'fp', 'COSMETIC', 'randFrame(): a sprite frame'),
    ('net/flashpunk/graphics/Emitter.as', 'type._duration + type._durationRange * FP.random', 'fp', 'COSMETIC', 'particles'),
    ('net/flashpunk/graphics/Emitter.as', 'type._angle + type._angleRange * FP.random', 'fp', 'COSMETIC', 'particles'),
    ('net/flashpunk/graphics/Emitter.as', 'type._distance + type._distanceRange * FP.random', 'fp', 'COSMETIC', 'particles'),
    ('net/flashpunk/FP.as', 'a[i] = a[j = FP.rand(i + 1)]', 'fp', 'COSMETIC', 'FP.shuffle: no caller in src/'),
]
C += FP_SITES

PAT = re.compile(r'Math\.random\(\)|Rng\.cos\(\)|FP\.random\b|FP\.rand\(|FP\.choose\(|getTimer\(\)')
sites, unclassified = [], []
for f in sorted(SRC.rglob('*.as')):
    rel = f.relative_to(SRC).as_posix()
    if rel in ('Rng.as', 'Bot.as'):  # Rng: the hook class itself; Bot: instrument (botRngProbe) and reseeds, below
        continue
    lines = f.read_text(encoding='utf-8', errors='replace').split('\n')
    in_block = False
    for i, line in enumerate(lines, 1):
        code = line
        # strip block comments that span lines, and line comments
        if in_block:
            if '*/' in code: code = code.split('*/', 1)[1]; in_block = False
            else: continue
        while '/*' in code:
            pre, rest = code.split('/*', 1)
            if '*/' in rest: code = pre + rest.split('*/', 1)[1]
            else: code = pre; in_block = True; break
        code = code.split('//', 1)[0]
        if not PAT.search(code):
            continue
        if rel.startswith('net/flashpunk/') and 'getTimer' in code:
            sites.append({'file': rel, 'line': i, 'stream': 'clock', 'kind': 'ENGINE',
                          'decides': 'frame pacing only (Engine is constructed fixed=false; FP.elapsed is read by no game class)',
                          'code': code.strip()})
            continue
        if 'Rng.cos()' in code and 'Math.random' not in code:
            sites.append({'file': rel, 'line': i, 'stream': 'cosmetic', 'kind': 'COSMETIC',
                          'decides': 'routed to the cosmetic stream by the AS3 (Rng.cos); the Rng.as rule: only render/Draw/audio/nothing reads it',
                          'code': code.strip()})
            continue
        hit = [c for c in C if c[0] == rel and c[1] in code]
        if not hit:
            unclassified.append(f'{rel}:{i}: {code.strip()}')
            continue
        _, _, stream, kind, why = hit[0]
        sites.append({'file': rel, 'line': i, 'stream': stream, 'kind': kind, 'decides': why, 'code': code.strip()})

# The decorated cosmetic sites that still call Math.random (none expected) or Rng.cos mixed lines were handled above.
# Bot.as: the reseeds (instrument), recorded as one row each for the runtime section.
bot = (SRC / 'Bot.as').read_text(encoding='utf-8', errors='replace').split('\n')
reseeds = [{'file': 'Bot.as', 'line': i, 'code': l.strip()} for i, l in enumerate(bot, 1)
           if re.search(r'Rng\.(setState|setCosmeticState)\(|FP\.randomSeed = |Rng\.split = ', l) and not l.strip().startswith('//')]

# REACH per level.
game = (SRC / 'Game.as').read_text(encoding='utf-8', errors='replace')
levels = {int(m.group(1)): m.group(2) for m in re.finditer(r"/\*\s*(\d+)\s*\*/\s*\[Embed\(source = '\.\./assets/levels/([^']+)'", game)}
tag2cls = dict(re.findall(r'for each \(o in xml\.objects\[0\]\.([A-Za-z0-9]+)\) \{\s*(?:\w+ = )?add\(new ([A-Za-z0-9]+)\(', game))
ext = dict(re.findall(r'class ([A-Za-z0-9]+) extends ([A-Za-z0-9]+)', '\n'.join(p.read_text(encoding='utf-8', errors='replace') for p in SRC.rglob('*.as'))))
def is_enemy(c):
    seen = set()
    while c and c not in seen:
        if c == 'Enemy': return True
        seen.add(c); c = ext.get(c)
    return False
reach = []
for n, path in sorted(levels.items()):
    xml = (ROOT / 'assets/levels' / path).read_text(encoding='utf-8', errors='replace')
    # `Game.loadlevel` reads only `xml.tiles[0]` and drops a tile outside the level's own width/height (`Game.as:2065`,
    # `:2116`). Checked against R4's measured build costs: L0 1296, L12 3145 (this census: the same).
    blk = re.search(r'<tiles\b[^>]*>(.*?)</tiles>', xml, re.S)
    W = int(re.search(r'<width>(\d+)', xml).group(1)) // 16; H = int(re.search(r'<height>(\d+)', xml).group(1)) // 16
    grass = sum(1 for t, x, y in re.findall(r'<tile tx="(\d+)" ty="\d+" x="(\d+)" y="(\d+)"', blk.group(1) if blk else '')
                if int(t) // 16 in (1, 10) and int(x) // 16 < W and int(y) // 16 < H)
    enemies, extra, objs = 0, 0, {}
    for tag, cls in tag2cls.items():
        k = len(re.findall(rf'<{tag}\b', xml))
        if not k: continue
        objs[tag] = k
        if is_enemy(cls):
            enemies += k
            if cls in ('Spinner', 'WallFlyer'): extra += k
    row = {'level': n, 'oel': path, 'grassTiles': grass, 'grassDraws': grass * 24, 'enemies': enemies,
           'enemyDraws': enemies + extra, 'chests': objs.get('chest', 0),
           'finalboss': objs.get('finalboss', 0), 'tentaclebeast': objs.get('tentaclebeast', 0)}
    row['buildDraws'] = row['grassDraws'] + row['enemyDraws']
    reach.append(row)

out = {
    'source': {'repo': 'PeerInfinity/Seedling', 'commit': __import__('subprocess').run(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()},
    'kinds': {'GAMEPLAY': 'the value can change a hit, a kill, a reachable cell, a drop or a route',
              'ADVANCER': 'on the gameplay stream; the value is dead or render-only, the draw COUNT moves every later gameplay draw',
              'SAVE-ONLY': 'on the gameplay stream; the value reaches save data or a medal counter only',
              'COSMETIC': 'render, audio or nothing (the cosmetic stream under the split, or FP\'s own generator)',
              'ENGINE': 'frame pacing'},
    'sites': sites, 'unclassified': unclassified, 'botReseeds': reseeds,
    'summary': {k: sum(1 for s in sites if s['kind'] == k) for k in ('GAMEPLAY', 'ADVANCER', 'SAVE-ONLY', 'COSMETIC', 'ENGINE')},
    'reach': reach,
    'reachSummary': {
        'levels': len(reach),
        'withGameplayDecider': [r['level'] for r in reach if r['finalboss'] or r['tentaclebeast']],
        'withBuildDraws': sum(1 for r in reach if r['buildDraws']),
        'withChests': [r['level'] for r in reach if r['chests']],
        'zeroBuildDraws': [r['level'] for r in reach if not r['buildDraws']],
    },
}
Path(a.out).write_text(json.dumps(out, indent=1) + '\n')
print(json.dumps(out['summary']), 'unclassified', len(unclassified))
print('gameplay deciders in levels', out['reachSummary']['withGameplayDecider'], '; levels with build draws',
      out['reachSummary']['withBuildDraws'], 'of', len(reach))
for u in unclassified: print('UNCLASSIFIED', u)
sys.exit(1 if unclassified else 0)
