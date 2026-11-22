// Prints a K level's grid: terrain, the runners' spawns, K's zone and cut (+ the full grid with K stamped).
// usage: node levelDump.mjs <level> [<level>...]
const R = new URL('../../../../../', import.meta.url).pathname;
const M = await import(R + 'scripts/procgen/make-seedling-playthrough-rules.mjs');
const KG = await import(R + 'scripts/procgen/seedlingChaserPursuitGuard.js');
const HP = await import(R + 'scripts/procgen/seedlingHolderParking.js');
const { ENEMY_CLASSES } = await import(R + 'frontend/modules/seedlingDemo/combat.js');
const { combatCensusOf } = await import(R + 'frontend/modules/seedlingDemo/levelWorld.js');
for (const n of process.argv.slice(2).map(Number)) {
    const level = M.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
    const pre = M.playthroughGridFor(level, { guards: false });
    const full = M.playthroughGridFor(level);
    const g = M.playthroughChaserGuards.get(n) ?? { guards: [] };
    const { width, height, cells } = pre;
    const tt = HP.tileTypesOf(level, width);
    const zones = new Map(), cuts = new Set(), spawn = new Map();
    for (const gd of g.guards) {
        const body = combatCensusOf(level).enemies.find((b) => HP.label(b) === gd.body); const { tag, x, y } = body;
        const ctor = ENEMY_CLASSES[tag].ctor; const centre = [x + ctor.dx, y + ctor.dy];
        const v = KG.chaserGuardCells(body, { grid: pre, tileTypes: tt, centre });
        for (const i of v.zone) zones.set(i, (zones.get(i) ?? 0) + 1);
        for (const [cx, cy] of gd.cut) cuts.add(cy * width + cx);
        spawn.set(Math.floor(centre[1] / 16) * width + Math.floor(centre[0] / 16), gd.body);
    }
    console.log(`L${n} ${width}x${height} guards: ${g.guards.map((x) => x.body + ' cut=' + x.cut.length).join(' | ')}`);
    console.log('legend: # wall  ~ lava  w water  . floor  z zone  K cut  R runner spawn  g gated(pre-K)  (lower case on lava: k cut-in-lava, l zone-lava)');
    console.log('    ' + [...Array(width).keys()].map((x) => String(x % 10)).join(''));
    for (let y = 0; y < height; y += 1) {
        let s = '';
        for (let x = 0; x < width; x += 1) {
            const i = y * width + x; const c = cells[i]; const t = tt.get(i);
            const lava = t === 17, water = t === 1;
            let ch = HP.BLOCKING.has(c.kind) ? '#' : lava ? '~' : water ? 'w' : c.kind === 'gated' ? 'g' : '.';
            if (zones.has(i) && ch !== '#') ch = lava ? 'l' : 'z';
            if (cuts.has(i)) ch = lava ? 'k' : 'K';
            if (spawn.has(i)) ch = 'R';
            s += ch;
        }
        console.log(String(y).padStart(3) + ' ' + s);
    }
    console.log('full-grid gated cells with K:', full.cells.filter((c) => c.kind === 'gated').length);
}
