#!/usr/bin/env node
// SCRATCH (seedling-hammer-d D2): a leg's staged room as ASCII (# solid by a 1-px line probe at each 8-px cell centre),
// the spinner bodies and the arrival. node room-map.mjs --legs=… --dump=… --id=374
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const leg = readFileSync(arg('legs'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.id === Number(arg('id')));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const RECS = mountedRecordsOf(dump.deliveredSet);
const SRC = levelSourceFromAtlas(RECS);
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([...['hasSword', 'hasGhostSword'].map((property) => ({ class: 'Main', property, value: true })),
    { invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick(); rt.tick();
const run = createRunForStaging(rt.session.staging, SRC);
const W = run.world.width * 16, H = run.world.height * 16;
console.log('level', run.level, 'size', W, H, 'player', run.state.x, run.state.y);
const bodies = run.entities('spinnerBodies') ?? [];
for (const b of bodies) console.log('spinner', b.id, 'at', b.x.toFixed(1), b.y.toFixed(1), 'rect', JSON.stringify(b.rect));
const x0 = Number(arg('x0', 0)), x1 = Number(arg('x1', W)), y0 = Number(arg('y0', 0)), y1 = Number(arg('y1', H));
for (let y = y0; y < y1; y += 8) {
    let s = `${String(y).padStart(4)} `;
    for (let x = x0; x < x1; x += 8) {
        const cx = x + 4, cy = y + 4;
        const sp = bodies.find((b) => Math.abs(b.x - cx) < 4 && Math.abs(b.y - cy) < 4);
        s += sp ? 'S' : (run.collideLineSolid(cx, cy, cx + 0.5, cy) ? '#' : '.');
    }
    console.log(s);
}
