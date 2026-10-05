#!/usr/bin/env node
/**
 * probe-rooms — MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05).
 *
 * For every atlas room: build it through the committed `buildLevelWorld` at
 * the full role set (peeling roles on a refusal, so every refusal is named),
 * then boot a `createLevelRun` at each arrival the atlas declares into the
 * room and advance it IDLE for N ticks, twice: with no items and with every
 * item. Every throw is recorded verbatim. Nothing is written but --out.
 *
 *   node scripts/procgen/model-coverage/probe-rooms.mjs --out=<file> [--ticks=180] [--only=5,40]
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const MOD = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const { buildLevelWorld, ROLES } = await import(join(MOD, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MOD, 'levelSource.js'));
const { createLevelRun } = await import(join(MOD, 'levelRun.js'));
const { ITEM_NAMES, BUILD_SPAWN } = await import(join(MOD, 'tapeFormat.js'));

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=');
const OUT = arg('out');
const TICKS = Number(arg('ticks', '180'));
const ONLY = new Set(arg('only', '').split(',').filter(Boolean).map(Number));
const atlas = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const source = atlasLevelSource();

// Arrivals: every door entity elsewhere whose `to` is this room.
const DOOR = new Set(['teleporter', 'stairsup', 'stairsdown']);
const arrivals = new Map();
for (const L of atlas.levels) for (const e of L.entities) {
    if (!DOOR.has(e.type)) continue;
    const to = Number(e.attrs.to);
    const k = `${e.attrs.playerx},${e.attrs.playery}`;
    if (!arrivals.has(to)) arrivals.set(to, new Map());
    if (!arrivals.get(to).has(k)) arrivals.get(to).set(k, { x: Number(e.attrs.playerx), y: Number(e.attrs.playery), from: L.level });
}
const first = (m) => String(m).split('\n')[0].slice(0, 600);

const rows = [];
for (const L of atlas.levels) {
    const lv = L.level;
    if (ONLY.size && !ONLY.has(lv)) continue;
    const row = { level: lv, cls: L.class, build: null, buildRefusals: [], runs: [] };
    for (const roles of [ROLES, ROLES.filter((r) => r !== 'proximity-hazard'), ['blocking', 'trigger', 'pickup'], ['blocking']]) {
        try { buildLevelWorld(source(lv), { roles }); row.build = roles.join('+'); break; } catch (e) { row.buildRefusals.push({ roles: roles.join('+'), msg: first(e.message) }); }
    }
    const arr = [...(arrivals.get(lv)?.values() ?? [])];
    if (lv === BUILD_SPAWN.level) arr.unshift({ ...BUILD_SPAWN, from: 'start' });
    for (const a of arr) {
        for (const items of [[], ITEM_NAMES.filter((n) => n !== 'health')]) {
            const r = { from: a.from, x: a.x, y: a.y, items: items.length ? 'all' : 'none', ok: false, ticks: 0, msg: null, endLevel: lv };
            try {
                const run = createLevelRun({ levelSource: source, boot: { level: lv, x: a.x, y: a.y }, grants: items.length ? [{ level: lv, items }] : [], pins: ['sound', 'dead_frames'] });
                for (let t = 0; t < TICKS; t++) { run.advance(new Set()); r.ticks = t + 1; }
                r.ok = true; r.endLevel = run.level ?? lv;
                const deaths = run.playerDeaths ?? [];
                r.deaths = deaths.length;
                if (deaths.length) r.firstDeath = JSON.stringify(deaths[0]).slice(0, 300);
            } catch (e) { r.msg = first(e.message); }
            row.runs.push(r);
        }
    }
    rows.push(row);
    process.stderr.write(`L${lv} build=${row.build} runs=${row.runs.length} fail=${row.runs.filter((r) => !r.ok).length}\n`);
}
const out = { ticks: TICKS, rooms: rows };
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1)); else console.log(JSON.stringify(out, null, 1));
