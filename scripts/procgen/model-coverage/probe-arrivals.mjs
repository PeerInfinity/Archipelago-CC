#!/usr/bin/env node
/**
 * probe-arrivals — MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05).
 * Every arrival the RULES put a player on: for each sub-region payload in the
 * seedling_playthrough AP_1 preset and each of its exits, the spawn the runtime
 * binding resolves (`seedlingRegionBinding.resolveArrivalSpawn` with the game's
 * return-spawn table). Deduped by (level, x, y), each is booted in the model and
 * advanced IDLE for --ticks; a death (`run.playerDeaths`) or a throw is recorded.
 *
 *   node scripts/procgen/model-coverage/probe-arrivals.mjs --out=<file> [--ticks=180]
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const MOD = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const FP = join(REPO, 'frontend', 'modules', 'flashPanel');
const { atlasLevelSource } = await import(join(MOD, 'levelSource.js'));
const { createLevelRun } = await import(join(MOD, 'levelRun.js'));
const { resolveArrivalSpawn } = await import(join(FP, 'seedlingRegionBinding.js'));
const { returnSpawnTable } = await import(join(FP, 'seedlingReturnSpawns.js'));
const { ITEM_NAMES } = await import(join(MOD, 'tapeFormat.js'));
const ALL = ITEM_NAMES.filter((n) => n !== 'health');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=');
const TICKS = Number(arg('ticks', '180'));
const mapDoc = JSON.parse(readFileSync(join(FP, 'atlases', 'seedling-map.json'), 'utf8'));
const rules = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const returns = returnSpawnTable(mapDoc);
const source = atlasLevelSource();
const spawns = new Map();
for (const [region, side] of Object.entries(rules.preset_sidecars['1'])) {
    const w = side.playable_payload;
    if (!w || !Number.isFinite(w.level)) continue;
    for (const e of w.exits ?? []) {
        const s = resolveArrivalSpawn(w, { exit_id: e.exit_id }, returns);
        if (!s) continue;
        const k = `${s.level},${s.x},${s.y}`;
        if (!spawns.has(k)) spawns.set(k, { level: s.level, x: s.x, y: s.y, landing: s.landing, regions: [] });
        spawns.get(k).regions.push(`${region}/${e.exit_id}`);
    }
}
const rows = [];
for (const s of spawns.values()) {
    const r = { ...s };
    for (const [name, items] of [['none', []], ['all', ALL]]) {
        const o = { deaths: 0, firstDeath: null, refusal: null };
        try {
            const run = createLevelRun({ levelSource: source, boot: { level: s.level, x: s.x, y: s.y }, pins: ['sound', 'dead_frames'],
                grants: items.length ? [{ level: s.level, items }] : [] });
            for (let t = 0; t < TICKS; t++) run.advance(new Set());
            const d = run.playerDeaths ?? [];
            o.deaths = d.length; o.firstDeath = d.length ? JSON.stringify(d[0]).slice(0, 300) : null;
        } catch (e) { o.refusal = String(e.message).split('\n')[0].slice(0, 400); }
        r[name] = o;
    }
    r.deaths = r.none.deaths; r.refusal = r.none.refusal;
    rows.push(r);
}
const n = (k, f) => rows.filter((r) => r[k][f]).length;
writeFileSync(arg('out'), JSON.stringify({ ticks: TICKS, arrivals: rows.length, dyingNoItems: n('none', 'deaths'), dyingAllItems: n('all', 'deaths'), refusedNoItems: n('none', 'refusal'), refusedAllItems: n('all', 'refusal'), rows }, null, 1));
console.log(`arrivals ${rows.length}; dying none/all ${n('none', 'deaths')}/${n('all', 'deaths')}; refused none/all ${n('none', 'refusal')}/${n('all', 'refusal')}`);
