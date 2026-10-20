#!/usr/bin/env node
// APFLIP D1 — the MODEL alone on each arm's delivered set (no browser): OFF (the constant rock) vs ON (the entity's).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { parseTape } = await M('tapeFormat.js');
const { vanillaRecordSet } = await M('levelSetExporter.js');
const { mountedRecordsOf } = await M('wasmWalkTape.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { runTape } = await M('tapeRunner.js');
const { withContactFidelity } = await M('contactFidelity.js');
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
const raw = readJson(spec.tapeFile); const tp = spec.tapePatch;
raw.inputs = raw.inputs.filter((i) => i.from < tp.inputsUntil).map((i) => ({ ...i, to: Math.min(i.to, tp.inputsUntil) })).concat(tp.append ?? []);
raw.tick_count = tp.tick_count; raw.equips = tp.equips ?? raw.equips;
const tape = parseTape(raw);
for (const arm of spec.arms) {
    const map = { ...MAP, levels: MAP.levels.map((r) => {
        const ops = (arm.ops ?? []).filter((o) => o.level === r.level); if (!ops.length) return r;
        return { ...r, entities: r.entities.map((e) => { const o = ops.find((q) => q.type === e.type && q.x === e.x && q.y === e.y);
            return o ? { ...e, x: o.to.x, y: o.to.y } : e; }) }; }) };
    const set = vanillaRecordSet(EMBED, map).set;
    for (const on of [false, true]) {
        const out = withContactFidelity({ apReportBosses: on }, () => runTape(tape, { levelSource: levelSourceFromAtlas(mountedRecordsOf(set)) }));
        const last = out.ticks.at(-1);
        console.log(JSON.stringify({ arm: arm.name, apReportBosses: on, final: { t: last.t, level: last.level, x: last.x, y: last.y } }));
    }
}
