#!/usr/bin/env node
// rules-fire-arm-chaser-guard: L100 `r4c10 -> r2c3` with Fire only (and the Sword control), HAND-AUTHORED on the JS model
// of the DELIVERED set (`--spot=delivered`: the census slice's `author.mjs`, imported, the same ops), from the game's own
// teleporter landing in r4c10 (288,80) — r4c10 has no arrival edge in AP_1, so this is the room's own landing.
// The rock `@128,144` (c8 r9) breaks to Fire from its east stances (152,136)/(152,152) (`rockFireSides`, fireDirs W);
// west of it is r2c3 (the directional block c5-7) and the L99 stairs at (48,96).
//   node l100.mjs --spot=delivered [--case=a,b] [--trace] [--build=<dir>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { author, tapeOf } = await import('../../rules-landing-contact-census-evidence/tools/author.mjs');
const BOOT = { level: 100, x: 288, y: 80 };
const n = (k, d) => Number(arg(k, d));
// the walk west: r6 corridor to c9, down the c9-12 block to the stance east of the rock, face west, press, wait, through
const LEAD = [['go', 168, 104], ['go', 152, 136], ['to', 152, 144]];
const OUT = [['to', 136, 150], ['to', 124, 150], ['to', 124, 40], ['wait', n('end', '120')]];
export const CASES = {
    'l100-fire': { boot: BOOT, items: ['hasFire'], script: [...LEAD, ['keys', 'left', 1], ['fire'], ['wait', n('w', '24')], ...OUT] },
    'l100-fire-run': { boot: BOOT, items: ['hasFire'], script: [...LEAD, ['keys', 'left', 1], ['fire'], ['wait', n('w', '12')], ['keys', 'left', 4], ...OUT] },
    'l100-sword': { boot: BOOT, items: ['hasSword'], script: [...LEAD, ['to', 140, 144], ['keys', 'left', 1], ['fire'], ['wait', n('w', '24')], ...OUT] },
    // on through r2c3 to its own exit, the L99 stairs (c3 r6): west along r2 over the waterfall's top, then down c3
    'l100-fire-out': { boot: BOOT, items: ['hasFire'], script: [...LEAD, ['keys', 'left', 1], ['fire'], ['wait', n('w', '24')],
        ['to', 136, 150], ['to', 124, 150], ['to', 124, 40], ['to', 72, 40], ['to', 56, 40], ['to', 56, 72], ['to', 48, 88], ['keys', 'down', 40], ['wait', 30]] },
    'l100-sword-out': { boot: BOOT, items: ['hasSword'], script: [...LEAD, ['to', 140, 144], ['keys', 'left', 1], ['fire'], ['wait', n('w', '24')],
        ['to', 136, 150], ['to', 124, 150], ['to', 124, 40], ['to', 72, 40], ['to', 56, 40], ['to', 56, 72], ['to', 48, 88], ['keys', 'down', 40], ['wait', 30]] },
    'l100-idle': { boot: BOOT, items: ['hasFire'], script: [['wait', 200]] },
};
const names = arg('case') ? arg('case').split(',') : Object.keys(CASES);
const dir = arg('build');
if (dir) mkdirSync(dir, { recursive: true });
for (const name of names) {
    const a = author(CASES[name], { trace: process.argv.includes('--trace') });
    console.log('MODEL', name, JSON.stringify(a.model));
    if (process.argv.includes('--trace')) for (const s of a.log) if (s.t % Number(arg('every', '10')) === 0) console.error(JSON.stringify(s));
    if (dir) writeFileSync(join(dir, `${name}.tape.json`), JSON.stringify({ ...tapeOf(a, name), description: `rules-fire-arm-chaser-guard: ${name} (hand script on the delivered set, from L100's teleporter landing (288,80))` }));
}
