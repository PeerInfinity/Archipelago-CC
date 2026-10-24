#!/usr/bin/env node
// SCRATCH (seedling-hammer-d D2): why does a preview walk from a leg's staged arrival truncate? node walk-probe.mjs … --to=x,y
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
const { previewWalk } = await M('seedlingDemo/solverBot.js');
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const RECS = mountedRecordsOf(dump.deliveredSet);
const SRC = levelSourceFromAtlas(RECS);
const rt = createJsRuntime(); rt.setVanilla(RECS);
rt.queueItems([...['hasTorch', 'hasFire', 'hasShield', 'hasSword', 'hasGhostSword'].map((property) => ({ class: 'Main', property, value: true })),
    { invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick(); rt.tick();
const st = rt.session.staging;
const extra = (leg.stagedEvents ?? []).filter((f) => !f.otherLevel).map((f) => ({ level: leg.level, tag: f.tag, note: '' }));
const run = createRunForStaging({ ...st, persistence: [...st.persistence, ...extra] }, SRC);
console.log('persistence L', leg.level, JSON.stringify([...st.persistence, ...extra].filter((p) => p.level === leg.level)), 'player', run.state.x, run.state.y);
for (const to of arg('to').split(';')) {
    const [x, y] = to.split(',').map(Number);
    const w = previewWalk(run, [{ x, y }], 1);
    console.log(to, 'samples', w.samples.length, 'truncated', JSON.stringify(w.truncated)?.slice(0, 400), 'last', JSON.stringify(w.samples.at(-1) ? { x: w.samples.at(-1).x, y: w.samples.at(-1).y } : null));
}
