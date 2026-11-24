#!/usr/bin/env node
/**
 * rules-ap-chest-solid evidence (designer term 1): every LavaTrap pull disc of the playthrough map, as the producer cuts it
 * (`playthroughLavaTrapPulls`: the raw grid's `wall` cells stand for "Solid"), and AGAIN with every chest cell added to the
 * line test's solids (an AP chest is `type = "Solid"`, APChest.as:57, so a SHUT chest also blocks `collideLine("Solid")`,
 * LavaTrap.as:86-88). Prints, per trap: the disc size, the yields, and every tile the chest cut removes.
 * Usage: node pull-discs.mjs [--repo=<tree root>]   (default: this tree)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const arg = process.argv.find((a) => a.startsWith('--repo='))?.slice(7);
const REPO = path.resolve(arg ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../..'));
const P = await import(path.join(REPO, 'scripts/procgen/make-seedling-playthrough-rules.mjs'));
const OV = await import(path.join(REPO, 'frontend/modules/flashPanel/seedlingPlaythroughOverlay.js'));
const TILE = P.PLAYTHROUGH_MAP.tile_size;
const out = [];
for (const level of P.PLAYTHROUGH_MAP.levels) {
    if (!(level.entities ?? []).some((e) => e.type === OV.LAVATRAP_PULL.tag)) continue;
    const pulls = P.playthroughLavaTrapPulls(level);
    const g = P.playthroughGridFor(level);
    const ox = g.origin?.x ?? 0; const oy = g.origin?.y ?? 0;
    const chests = new Set();
    for (const e of level.entities.filter((x) => x.type === 'chest')) {
        for (let ty = Math.floor(e.y / TILE); ty * TILE < e.y + 16; ty += 1) for (let tx = Math.floor(e.x / TILE); tx * TILE < e.x + 16; tx += 1) chests.add(`${tx},${ty}`);
    }
    const wallOf = (x, y) => g.cells[(y - oy) * g.width + (x - ox)]?.kind === 'wall';
    const withChests = OV.lavaTrapPulls(level, TILE, { solid: (x, y) => wallOf(x, y) || chests.has(`${x},${y}`) });
    for (const p of pulls) {
        const q = withChests.find((r) => r.tile[0] === p.tile[0] && r.tile[1] === p.tile[1]);
        const k = (t) => `${t[0]},${t[1]}`;
        const cut = p.from.filter((t) => !q.from.some((u) => k(u) === k(t)));
        const chestCell = (t) => g.cells[(t[1] - oy) * g.width + (t[0] - ox)];
        out.push(`L${level.level} trap (${k(p.tile)}): disc ${p.from.length} tile(s), yields ${p.yields.length}`
            + ` · chests in the level: ${[...chests].join(' ') || 'none'}`
            + ` · chest cells' kind: ${[...chests].map((c) => chestCell(c.split(',').map(Number))?.kind).join(' ') || '-'}`
            + ` · with every chest cell Solid: disc ${q.from.length}, yields ${q.yields.length}, cut [${cut.map(k).join(' ')}]`
            + ` · disc tiles [${p.from.map(k).join(' ')}]`);
    }
}
console.log(out.join('\n'));
