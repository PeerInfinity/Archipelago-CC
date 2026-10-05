#!/usr/bin/env node
/**
 * footprint-census — MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05).
 * For every placed entity whose rules row (`seedlingSemantics.ENTITY_SEMANTICS`) is a `wall` or `gated` blocker,
 * compare the tiles the RULES seal (`entitySealedTiles`, full cover only) with the tiles the MODEL's rect
 * (`levelWorld.ENTITY_CLASSES`, collider 'rect') fully covers. A model tile the rules leave open = UNDER-claim
 * (a permissive wall); a rules tile the model does not fully cover = OVER-claim (a strict wall).
 * The overlay's rulings are applied first (`overlayEntitySemantics`), as the generator does.
 *
 *   node scripts/procgen/model-coverage/footprint-census.mjs --out=<file>
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const FP = join(REPO, 'frontend', 'modules', 'flashPanel');
const { ENTITY_CLASSES } = await import(join(REPO, 'frontend/modules/seedlingDemo/levelWorld.js'));
const { entitySemantics, entitySealedTiles } = await import(join(FP, 'seedlingSemantics.js'));
const OV = await import(join(FP, 'seedlingPlaythroughOverlay.js'));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=');
const atlas = JSON.parse(readFileSync(join(FP, 'atlases', 'seedling-map.json'), 'utf8'));
const T = 16;
const full = (r) => {
    const out = [];
    for (let ty = Math.floor(r.y / T); ty * T < r.y + r.h; ty++) for (let tx = Math.floor(r.x / T); tx * T < r.x + r.w; tx++) {
        if (tx * T >= r.x && ty * T >= r.y && (tx + 1) * T <= r.x + r.w && (ty + 1) * T <= r.y + r.h) out.push(`${tx},${ty}`);
    }
    return out;
};
const byTag = {};
for (const L of atlas.levels) for (const e of L.entities ?? []) {
    let sem = entitySemantics(e);
    if (!sem) continue;
    const ov = OV.overlayEntitySemantics?.(e, sem, null);
    if (ov) sem = ov;
    if (!['wall', 'gated'].includes(sem.kind)) continue;
    const ec = ENTITY_CLASSES[e.type];
    if (!ec || ec.collider !== 'rect' || !(ec.w > 0)) continue;
    const mr = { x: e.x + (ec.dx ?? 0) - (ec.originX ?? 0), y: e.y + (ec.dy ?? 0) - (ec.originY ?? 0), w: ec.w, h: ec.h };
    const model = new Set(full(mr));
    const rules = new Set(entitySealedTiles(e, sem).map(([x, y]) => `${x},${y}`));
    const under = [...model].filter((t) => !rules.has(t));
    const over = [...rules].filter((t) => !model.has(t));
    const b = (byTag[e.type] ||= { tag: e.type, kind: sem.kind, placements: 0, under: 0, over: 0, underRooms: new Set(), overRooms: new Set(), example: null });
    b.placements++;
    if (under.length) { b.under++; b.underRooms.add(L.level); }
    if (over.length) { b.over++; b.overRooms.add(L.level); }
    if ((under.length || over.length) && !b.example) b.example = { level: L.level, at: `${e.x},${e.y}`, modelRect: mr, modelTiles: [...model], rulesTiles: [...rules] };
}
const rows = Object.values(byTag).map((b) => ({ ...b, underRooms: [...b.underRooms].sort((x, y) => x - y), overRooms: [...b.overRooms].sort((x, y) => x - y) }))
    .sort((a, b) => (b.under + b.over) - (a.under + a.over));
writeFileSync(arg('out'), JSON.stringify(rows, null, 1));
for (const r of rows.filter((r) => r.under || r.over)) console.log(`${r.tag} [${r.kind}] ${r.placements} placed: under ${r.under} (L${r.underRooms.join(',L')}) over ${r.over} (L${r.overRooms.join(',L')})`);
console.log(`tags compared ${rows.length}; mismatched ${rows.filter((r) => r.under || r.over).length}`);
