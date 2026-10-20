#!/usr/bin/env node
/**
 * rules-r4b-followup — WHICH PIT LANDINGS THE CENTRE FIX MOVES, over every room of the vanilla map AND the delivered
 * set: `pitOf`'s arrival from the pit tile's CORNER (before) vs its CENTRE (after, `Tile.as:103`), per pit tile.
 * The rows printed are every pit group whose arrival differs. Measure only.
 *
 * Run: node CC/docs/cloud-reports/rules-r4b-followup-evidence/census-pit-centre.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SEM = await import(join(REPO, 'frontend/modules/flashPanel/seedlingSemantics.js'));
const { PIT_TILE_TYPE } = await import(join(REPO, 'frontend/modules/seedlingDemo/seedlingAtlasDerivation.js'));
const { patchedMapDocument } = await import(join(REPO, 'frontend/modules/seedlingDemo/seedlingSetPatches.js'));
const T = 16;

function arrivals(rooms, centre) {
    const byId = new Map(rooms.map((r) => [r.level, r]));
    const out = new Map();
    for (const room of rooms) {
        const control = room.entities.find((e) => e.type === 'control');
        const to = Number(control?.attrs?.fallthrough);
        if (!Number.isInteger(to) || !byId.has(to)) continue;
        const dest = byId.get(to);
        const offX = Number(control.x) + Number(control.attrs.xOff);
        const offY = Number(control.y) + Number(control.attrs.yOff);
        for (const layer of room.layers ?? []) {
            if (layer.name === 'cliffsides') continue;
            for (const p of layer.tiles ?? []) {
                if (SEM.tileTypeForPlacement(p) !== PIT_TILE_TYPE) continue;
                const c = centre ? T / 2 : 0;
                const ax = Math.min(dest.width - 1, Math.floor(Math.max(p[0] * T + c - offX, 0) / T));
                const ay = Math.min(dest.height - 1, Math.floor(Math.max(p[1] * T + c - offY, 0) / T));
                out.set(`L${room.level} pit (${p[0]},${p[1]}) -> L${to}`, `(${ax},${ay})`);
            }
        }
    }
    return out;
}
const map = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const vanilla = map.levels;
const delivered = patchedMapDocument(map).levels;
for (const [name, rooms] of [['vanilla map', vanilla], ['delivered set', delivered]]) {
    const a = arrivals(rooms, false);
    const b = arrivals(rooms, true);
    const moved = [...a.keys()].filter((k) => a.get(k) !== b.get(k));
    console.log(`${name}: ${a.size} pit tiles over ${new Set([...a.keys()].map((k) => k.split(' ')[0])).size} rooms; `
        + `${moved.length} landing(s) move`);
    for (const k of moved) console.log(`  ${k}: ${a.get(k)} -> ${b.get(k)}`);
}
