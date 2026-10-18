#!/usr/bin/env node
/**
 * ROCKMOVE D1/D2-model: the trigger-sealed blockers of the DELIVERED set, measured on the model's tile geometry.
 * Scratch (evidence dir), not a tracked tool. Pure node.
 *
 * For each dynamic blocker (fallrock, fallrocklarge; the moonrock pair is reported from the patch table):
 *   - writers: same-room activators with t == tset (button, buttonroom room -1, rope), the L43 Wand (tset 0),
 *     cross-level buttonrooms writing its tag, the bossrock self-trigger;
 *   - per landing into the level: the doors a tile flood reaches with the rock PARKED (absent = REMOVE),
 *     FALLEN (a 16x16 / 32x32 `rock` stand-in at its tile), and MOVED-and-FALLEN for each candidate move;
 *   - gap check (the user, 2026-10-18): a move that lets the flood reach MORE than the original fallen state
 *     opens a bypass the original sealed.
 * USAGE: node census.mjs [--json]
 */
import { loadAtlas } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging, gameLandings } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { plannerObstacleAt } from '../../../../frontend/modules/seedlingDemo/botDriverV2.js';
import { patchedMapDocument } from '../../../../frontend/modules/seedlingDemo/seedlingSetPatches.js';

const TILE = 16;
const ATLAS = patchedMapDocument(loadAtlas()); // the DELIVERED rooms (moonrock + L37 rock removed)
const rec = (doc, n) => doc.levels.find((r) => r.level === n);

function floodDoors(run) {
    const w = run.world; const opts = run.liveGeometryOpts();
    const start = [Math.floor(run.state.x / TILE), Math.floor(run.state.y / TILE)];
    const seen = new Set([start.join(',')]); const doors = new Set(); const q = [start];
    while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx; const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w.width || ny >= w.height || seen.has(`${nx},${ny}`)) continue;
            const hit = plannerObstacleAt(w, nx * TILE + 8, ny * TILE + 8, null, opts);
            if (hit?.kind === 'teleporter') {
                const t = w.teleporters.find((tp) => tp.rect.x <= nx * TILE + 8 && nx * TILE + 8 < tp.rect.right
                    && tp.rect.y <= ny * TILE + 8 && ny * TILE + 8 < tp.rect.bottom);
                doors.add(t ? `${t.isStairs ? 'stairs' : 'tp'}@${t.x},${t.y}->L${t.to}` : `door@${nx * TILE},${ny * TILE}`);
                seen.add(`${nx},${ny}`); continue;
            }
            if (hit && hit.kind !== 'proximity-hazard') continue;
            seen.add(`${nx},${ny}`); q.push([nx, ny]);
        }
    }
    return { tiles: seen.size, doors: [...doors].sort(), seen };
}

/** A doc with level n's entity `ent` replaced by `withEnts(ent)` (array). */
const docWith = (doc, n, ent, withEnts) => ({ ...doc, levels: doc.levels.map((r) => (r.level !== n ? r
    : { ...r, entities: r.entities.flatMap((e) => (e === ent ? withEnts(e) : [e])) })) });
const asRock = (x, y, large) => (large
    ? [[0, 0], [16, 0], [0, 16], [16, 16]].map(([dx, dy]) => ({ type: 'rock', x: x + dx, y: y + dy, attrs: {} }))
    : [{ type: 'rock', x, y, attrs: {} }]);

import { readFileSync } from 'node:fs';
const LEGS = JSON.parse(readFileSync(new URL('./sweep-legs-rock-levels.json', import.meta.url), 'utf8'));
/** The level's arrivals: the door landings plus every sweep-leg arrival not already one (pit landings). */
function arrivalsOf(doc, level) {
    const out = gameLandings(doc).filter((l) => l.level === level);
    for (const g of LEGS.filter((q) => q.level === level)) {
        if (!out.some((l) => l.x === g.arrive.x && l.y === g.arrive.y)) out.push({ from: g.arrive.via, door: 'sweep-arrival', level, x: g.arrive.x, y: g.arrive.y });
    }
    return out;
}
function floodAll(doc, level) {
    const src = levelSourceFromAtlas(doc);
    return arrivalsOf(doc, level).map((l) => {
        try {
            const f = floodDoors(createRunForStaging(arrivalStaging(l), src));
            return { landing: `L${l.from} ${l.door} -> (${l.x},${l.y})`, tiles: f.tiles, doors: f.doors, seen: f.seen };
        } catch (e) { return { landing: `L${l.from} ${l.door} -> (${l.x},${l.y})`, error: String(e.message).split('\n')[0].slice(0, 160) }; }
    });
}

/** The tile class at (tx,ty) on the parked map: open / wall / door / solid:<tag>. */
function cellAt(doc, level, x, y) {
    const src = levelSourceFromAtlas(doc);
    const l = gameLandings(doc).find((q) => q.level === level);
    const run = createRunForStaging(arrivalStaging(l), src);
    const hit = plannerObstacleAt(run.world, x + 8, y + 8, null, run.liveGeometryOpts());
    return hit ? `${hit.kind}${hit.blocker?.tag ? `:${hit.blocker.tag}` : ''}` : 'open';
}

function writersOf(doc, level, e) {
    const a = e.attrs ?? {}; const tset = Number(a.tset); const tag = Number(a.tag);
    const out = [];
    for (const q of rec(doc, level).entities) {
        const qa = q.attrs ?? {};
        if (q === e) continue;
        if (['button', 'rope'].includes(q.type) && Number(qa.tset) === tset) out.push(`${q.type}@${q.x},${q.y} t${tset} (same room)`);
        if (q.type === 'buttonroom' && qa.room === '-1' && Number(qa.tset) === tset) out.push(`buttonroom@${q.x},${q.y} t${tset} (same room)`);
        if (q.type === 'wand' && tset === 0) out.push(`wand@${q.x},${q.y} pickup (Wand.as:58-68, tset 0)`);
        if (q.type === 'finalboss' && tset === 0) out.push(`finalboss@${q.x},${q.y} (activateAll t0)`);
    }
    for (const r of doc.levels) for (const q of r.entities) {
        if (q.type === 'buttonroom' && Number(q.attrs?.room) === level && Number(q.attrs?.tset) === tag) {
            out.push(`L${r.level} buttonroom@${q.x},${q.y} writes {${level},${tag}} (cross-level)`);
        }
    }
    if (e.type === 'fallrocklarge' && Number(a.bossrock)) out.push('self: bossrock, player above it (FallRockLarge.as:70-79)');
    return out;
}

const diffDoors = (a, b) => a.filter((d) => !b.includes(d));

export function census(moves = {}) {
    const rows = [];
    for (const r of ATLAS.levels) {
        for (const e of r.entities) {
            if (!['fallrock', 'fallrocklarge'].includes(e.type)) continue;
            const large = e.type === 'fallrocklarge';
            const size = large ? 32 : 16;
            const parked = floodAll(ATLAS, r.level);
            const fallenDoc = docWith(ATLAS, r.level, e, (q) => asRock(q.x, q.y, large));
            const fallen = floodAll(fallenDoc, r.level);
            const doorsHere = parked[0]?.error ? [] : null;
            const tps = rec(ATLAS, r.level).entities.filter((q) => q.attrs?.to !== undefined);
            const under = tps.filter((t) => t.x < e.x + size && e.x < t.x + 16 && t.y < e.y + size && e.y < t.y + 16)
                .map((t) => `${t.type}@${t.x},${t.y}->L${t.attrs.to}`);
            const nearest = tps.map((t) => ({ d: Math.abs(t.x - e.x) / 16 + Math.abs(t.y - e.y) / 16, t }))
                .sort((a, b) => a.d - b.d)[0];
            const W = r.width * 16; const H = r.height * 16;
            const edge = [['left', e.x], ['right', W - (e.x + size)], ['top', e.y], ['bottom', H - (e.y + size)]]
                .sort((a, b) => a[1] - b[1])[0];
            const perLanding = parked.map((p, i) => {
                const f = fallen[i];
                if (p.error || f.error) return { landing: p.landing, error: p.error ?? f.error };
                return { landing: p.landing, parked: { tiles: p.tiles, doors: p.doors },
                    fallen: { tiles: f.tiles, doors: f.doors }, lostWhenFallen: diffDoors(p.doors, f.doors) };
            });
            const key = `${e.type}@${e.x},${e.y}`;
            const cand = (moves[`${r.level}:${key}`] ?? []).map((m) => {
                const mdoc = docWith(ATLAS, r.level, e, (q) => asRock(m.x, m.y, large));
                const mf = floodAll(mdoc, r.level);
                const into = [];
                for (let y = m.y; y < m.y + size; y += 16) for (let x = m.x; x < m.x + size; x += 16) into.push(`${x},${y}:${cellAt(ATLAS, r.level, x, y)}`);
                return { to: m, why: m.why, into, perLanding: mf.map((q, i) => {
                    const f = fallen[i];
                    if (q.error || f.error) return { landing: q.landing, error: q.error ?? f.error };
                    const gap = [...q.seen].filter((t) => !f.seen.has(t));
                    return { landing: q.landing, tiles: q.tiles, doors: q.doors,
                        lostVsParked: diffDoors(parked[i].doors, q.doors), gainedVsFallen: diffDoors(q.doors, f.doors),
                        gapTilesVsFallen: gap.length };
                }) };
            });
            rows.push({ level: r.level, path: r.path, size: `${r.width}x${r.height}`, entity: key, attrs: e.attrs,
                writers: writersOf(ATLAS, r.level, e), onDoor: under, nearestDoor: nearest ? `${nearest.t.type}@${nearest.t.x},${nearest.t.y}->L${nearest.t.attrs.to} (${nearest.d} tiles)` : null,
                nearestEdge: `${edge[0]} (${edge[1] / 16} tiles)`, perLanding, moves: cand, doorsHere });
        }
    }
    return rows;
}

const MOVES = JSON.parse(process.env.ROCKMOVE_MOVES ?? '{}');
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
    const rows = census(MOVES);
    if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify({ source: 'rockmove-evidence/census.mjs', rows }, null, 1)}\n`);
    else for (const r of rows) {
        console.log(`L${r.level} ${r.entity} ${JSON.stringify(r.attrs)} [${r.path} ${r.size}] onDoor=${JSON.stringify(r.onDoor)} nearest=${r.nearestDoor} edge=${r.nearestEdge}`);
        console.log(`  writers: ${r.writers.join(' | ') || 'NONE'}`);
        for (const p of r.perLanding) console.log(`  ${p.landing}: ${p.error ? `ERR ${p.error}` : `parked ${p.parked.tiles}t [${p.parked.doors.join(' ')}] | fallen ${p.fallen.tiles}t lost [${p.lostWhenFallen.join(' ')}]`}`);
        for (const m of r.moves) {
            console.log(`  MOVE -> (${m.to.x},${m.to.y}) ${m.why ?? ''} into [${m.into.join(' ')}]`);
            for (const p of m.perLanding) console.log(`     ${p.landing}: ${p.error ? `ERR ${p.error}` : `${p.tiles}t lostVsParked [${p.lostVsParked.join(' ')}] gainedVsFallen [${p.gainedVsFallen.join(' ')}] gap ${p.gapTilesVsFallen}`}`);
        }
    }
}
