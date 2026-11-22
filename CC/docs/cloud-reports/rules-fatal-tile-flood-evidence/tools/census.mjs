// ⛓ rules-fatal-tile-flood — the kill-lock census over a tree. `ROOT=<tree> node census.mjs > out.json`
// Every kill-lock room (`buildKillLockRulings`) over the VANILLA map and over the DELIVERED (patched) map the producer
// reads, as the tree's OWN producer computes it (`playthroughKillLocks` = what the rules use). Per room: verdict,
// condition, every `why`, every body's `env`, plus the flood (`flood.mjs`) of each non-free body over the producer's
// analyzer-grid walls, and the walls audit (designer term 1: is every grid wall something every class collides with?).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fatalReach } from './flood.mjs';

const ROOT = process.env.ROOT ?? process.cwd();
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const P = await imp('scripts/procgen/make-seedling-playthrough-rules.mjs');
const OV = await imp('frontend/modules/flashPanel/seedlingPlaythroughOverlay.js');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');

// Tile.as:24-27 — the "Solid" tile types.
const TILE_TYPES = ['Tile', 'Tile', 'Solid', 'Tile', 'Tile', 'Tile', 'Tile', 'Tile', 'Tile', 'Solid', 'Tile', 'Solid', 'Tile', 'Tile', 'Solid',
    'Solid', 'Tile', 'Tile', 'Tile', 'Solid', 'Solid', 'Tile', 'Tile', 'Solid', 'Solid', 'Tile', 'Tile', 'Solid', 'Tile', 'Unused', 'Tile', 'Tile',
    'Tile', 'Tile', 'Solid', 'Solid', 'Solid', 'Tile'];
// The AS3 `type` of each entity class that is a grid wall in a kill-lock room (read from vendor/seedling/src; see flood.mjs).
const ENTITY_AS3_TYPE = { dungeonspire: 'Solid', pole: 'Solid', rock: 'Solid', rock2: 'Solid', rock3: 'Solid', rock4: 'Solid',
    ruinedpillar: 'Solid', pulser: 'Solid', tree: 'Tree', treebare: 'Tree', rope: 'Rope', iceturret: 'Solid' };
const MOBILE_SOLIDS = ['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss']; // Mobile.as:17

const tileTypesOf = (level) => {
    const at = new Map();
    for (const layer of level.layers ?? []) {
        if (layer.name === 'cliffsides') continue;
        for (const p of layer.tiles ?? []) {
            const t = SEM.tileTypeForPlacement(p);
            if (t === null) continue;
            const k = `${p[0]},${p[1]}`;
            if (!at.has(k)) at.set(k, new Set());
            at.get(k).add(t);
        }
    }
    return at;
};
const ck = (c) => (c ? SEM.conditionKey(c) : null);
const row = (r) => r && ({
    verdict: r.verdict, condition: ck(r.condition), locks: r.locks, hazards: r.hazards,
    bodies: r.bodies.map((b) => ({ at: b.at, class: b.class, env: b.env, free: b.free, items: b.items, ...(b.reach ? { reach: b.reach } : {}) })),
    why: r.why,
});

const out = { root: ROOT, rooms: {}, vanillaEqualsDelivered: {}, wallsAudit: {}, flood: {} };
const vanilla = OV.buildKillLockRulings(P.VANILLA_MAP);
for (const [id, r] of P.playthroughKillLocks) {
    const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === id);
    const vlevel = P.VANILLA_MAP.levels.find((l) => l.level === id);
    out.rooms[id] = row(r);
    out.vanillaEqualsDelivered[id] = JSON.stringify(row(vanilla.get(id))) === JSON.stringify(row(r))
        && JSON.stringify(vlevel) === JSON.stringify(level);
    const g = P.playthroughGridFor(level);
    const wall = (x, y) => g.cells[y * g.width + x]?.kind === 'wall';
    const types = tileTypesOf(level);
    // walls audit: every wall cell → what makes it a wall, and is that in Mobile.solids?
    const byEntity = new Map();
    for (const e of level.entities ?? []) {
        const sem = P.playthroughEntitySemantics(e, level) ?? SEM.entitySemantics(e);
        if (!sem) continue;
        for (const c of SEM.entityClaims(e, sem, { pixelMaskFootprints: true })) {
            const k = `${c.tile[0]},${c.tile[1]}`;
            if (!byEntity.has(k)) byEntity.set(k, []);
            byEntity.get(k).push(e.type);
        }
    }
    const audit = { walls: 0, solidTile: 0, entity: {}, unexplained: [] };
    for (let y = 0; y < g.height; y += 1) {
        for (let x = 0; x < g.width; x += 1) {
            if (!wall(x, y)) continue;
            audit.walls += 1;
            const k = `${x},${y}`;
            if ([...(types.get(k) ?? [])].some((t) => TILE_TYPES[t] === 'Solid')) { audit.solidTile += 1; continue; }
            const ents = (byEntity.get(k) ?? []).filter((t) => ENTITY_AS3_TYPE[t]);
            if (ents.length && ents.every((t) => MOBILE_SOLIDS.includes(ENTITY_AS3_TYPE[t]))) {
                for (const t of ents) audit.entity[t] = (audit.entity[t] ?? 0) + 1;
                continue;
            }
            audit.unexplained.push(`${k} tiles[${[...(types.get(k) ?? [])]}] ents[${byEntity.get(k) ?? []}] labels${JSON.stringify(g.cells[y * g.width + x].labels ?? [])}`);
        }
    }
    out.wallsAudit[id] = audit;
    out.flood[id] = r.bodies.filter((b) => !b.free).map((b) => {
        const [tag, xy] = b.at.split('@');
        const [x, y] = xy.split(',').map(Number);
        const cls = OV.KILL_LOCK_BODY_CLASSES[tag];
        const f = fatalReach(level, { x, y }, cls, wall, types, 16);
        const present = [...new Set([...types.values()].flatMap((s) => [...s]))].filter((t) => cls.dies.includes(t)).sort((a, b) => a - b);
        return { at: b.at, dies: cls.dies, presentFatal: present, reachedFatal: f.fatal, deathCells: f.deathCells,
            cells: f.cells.size, untiled: f.untiled };
    });
}
console.log(JSON.stringify(out, null, 1));
