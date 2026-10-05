#!/usr/bin/env node
/**
 * probe-persistence — MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05).
 * Re-runs the fidelity I1 report's three persistence measurements on the CURRENT tree:
 *   M1  persistenceClearsFor over every atlas room (offered / refused, refused grouped by reason)
 *   M2  every committed tape's persistence slot, rebuilt one clear at a time via buildLevelWorld
 *   M3  the chain-end persistence (r9-solve-32) booted in EVERY room (build + an idle run at each arrival)
 *
 *   node scripts/procgen/model-coverage/probe-persistence.mjs --out=<file>
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const MOD = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const { buildLevelWorld, ROLES, persistenceClearsFor } = await import(join(MOD, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MOD, 'levelSource.js'));
const { createLevelRun } = await import(join(MOD, 'levelRun.js'));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=');
const OUT = arg('out');
const CHAIN_END = arg('chain-end', 'r9-solve-32');
const atlas = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const byLevel = new Map(atlas.levels.map((l) => [l.level, l]));
const source = atlasLevelSource();
const first = (m) => String(m).split('\n')[0].slice(0, 400);
const build = (lv, cleared) => buildLevelWorld(source(lv), { roles: ROLES, cleared, nextLevelRecord: byLevel.get(lv + 1) ?? null });

// M1
const m1 = { offered: 0, refused: [] };
for (const L of atlas.levels) {
    const { offered, refused } = persistenceClearsFor(source(L.level));
    m1.offered += offered.length;
    for (const r of refused) {
        const types = [...new Set((L.entities ?? []).filter((e) => Number(e.attrs?.tag) === r.tag).map((e) => e.type))];
        m1.refused.push({ level: r.level, tag: r.tag, types, why: first(r.why) });
    }
}
// M2
const TAPES = join(MOD, 'fixtures', 'tapes');
const slots = new Map();
for (const f of readdirSync(TAPES).filter((f) => f.endsWith('.json'))) {
    const t = JSON.parse(readFileSync(join(TAPES, f), 'utf8'));
    for (const p of t.persistence ?? []) {
        const k = `${p.level},${p.tag}`;
        if (!slots.has(k)) slots.set(k, { level: p.level, tag: p.tag, tapes: [] });
        slots.get(k).tapes.push(f.replace(/\.json$/, ''));
    }
}
const m2 = [];
for (const s of [...slots.values()].sort((a, b) => a.level - b.level || a.tag - b.tag)) {
    let msg = null;
    try { build(s.level, [s.tag]); } catch (e) { msg = first(e.message); }
    m2.push({ level: s.level, tag: s.tag, tapes: s.tapes.length, ok: msg === null, msg });
}
// M3
const end = JSON.parse(readFileSync(join(TAPES, `${CHAIN_END}.json`), 'utf8'));
const DOOR = new Set(['teleporter', 'stairsup', 'stairsdown']);
const arrivals = new Map();
for (const L of atlas.levels) for (const e of L.entities) {
    if (!DOOR.has(e.type)) continue;
    const to = Number(e.attrs.to);
    if (!arrivals.has(to)) arrivals.set(to, []);
    arrivals.get(to).push({ x: Number(e.attrs.playerx), y: Number(e.attrs.playery), from: L.level });
}
const m3 = [];
for (const L of atlas.levels) {
    const lv = L.level;
    const cleared = (end.persistence ?? []).filter((p) => p.level === lv).map((p) => p.tag);
    const row = { level: lv, cleared, build: null, run: null };
    try { build(lv, cleared.length ? cleared : null); row.build = 'ok'; } catch (e) { row.build = first(e.message); }
    const a = arrivals.get(lv)?.[0];
    if (a) {
        try {
            const run = createLevelRun({ levelSource: source, boot: { level: lv, x: a.x, y: a.y }, persistence: end.persistence, grants: end.grants ?? [], save: end.save ?? null, pins: ['sound', 'dead_frames'] });
            for (let t = 0; t < 60; t++) run.advance(new Set());
            row.run = 'ok';
        } catch (e) { row.run = first(e.message); }
    }
    m3.push(row);
}
const out = { chainEnd: CHAIN_END, m1: { offered: m1.offered, refusedCount: m1.refused.length, refused: m1.refused }, m2: { slots: m2.length, boot: m2.filter((s) => s.ok).length, refused: m2.filter((s) => !s.ok), all: m2 }, m3 };
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`M1 offered ${m1.offered} refused ${m1.refused.length}; M2 ${out.m2.boot}/${out.m2.slots} boot; M3 build-refused ${m3.filter((r) => r.build !== 'ok').map((r) => r.level)} run-refused ${m3.filter((r) => r.run && r.run !== 'ok').map((r) => r.level)}`);
