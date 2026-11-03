#!/usr/bin/env node
/**
 * ⛓ RULES rules-l63-darktrap-census — **WHAT IF A LIVE DARKTRAP BODY WERE AN ANALYZER GATE ON ITS POLE'S FLAG?**
 * (option (b) for the L63 r6c9 → r0c1 framing row, ⚖ user 2026-11-02; the designer set the census FIRST.) REPORT ONLY:
 * it edits nothing and exits 0. The producer and the analyzer are IMPORTED, never patched: the patch is an in-memory
 * grid handed to the analyzer's pure `analyzeRegion` (`seedlingDarkTrapGateCensus.js` holds the pure half and the AS3).
 *
 * Today a DarkTrap's cell is `open` in the playthrough grid; the trap is priced by the rules layer instead — the pocket
 * doors of `barrierCut` (`Or(<event>, <arm>)` on the landings it seals) and the struck-block stopper
 * (`playthroughBlockCrossings`). Under (b) the trap's body tiles are crossing MATERIAL: the analyzer splits sub-regions
 * at them and prices the new crossings itself.
 *
 * PER DARKTRAP of the delivered set (`combatCensusOf` rows with `as3` DarkTrap): its level, body tiles (`contactRect`),
 * the poles whose light kills it (`poleKillsOf`) and their AP events (minted by the event layer, cross-room press or
 * in-room pole), the poles' thrust / swing stances, the sub-region its cell sits in today, and — with THAT trap alone
 * gated — the partition: pieces, new crossings and their rules, bindings that move. Classified (i) no change, (ii) a
 * sub-region splits, (iii) an exit's / location's sub-region moves, (iv) can't be decided (why).
 *
 * THEN, every trap gated at once, three variants, each compiled onto the committed AP_1 graph (`AP_1_rules.json`:
 * the affected levels' regions replaced by the gated pieces, boundary edges re-targeted by binding, the struck-block
 * crossings re-priced on the new partition with the producer's own `blockCrossingCost`) and swept for spheres with
 * the seed-1 placement (`AP_<seed>_rules.json`). The baseline sweep is first checked against the committed seed-1
 * sphere log, sphere by sphere:
 *   V1 additive   the cell gated on `Or(<events>)`; today's pocket-door gates kept (the minimal implementation);
 *   V2 as-spec    the cell gated on `Or(<events>)`; the pocket-door gates (`cross-room-press`, `in-room-pole`) dropped —
 *                 (b) REPLACING the barrier analysis (which, as written, refuses a gated trap: its flood no longer
 *                 reaches past the trap with or without the light, so it "cuts off no landing");
 *   V3 side-arms  as V2, but the cell is gated on ENTRY per side: `Or(<events>, <arm>)` where a stance of the killing
 *                 pole stands in the piece entered from (thrust = the Spear arm, else swing = the Ghost Sword arm).
 * An in-room pole's event is placed in every piece holding one of its stances (the producer would have to pick ONE:
 * named when they span pieces); a press's in the presser's piece.
 *
 * Run:
 *   node scripts/procgen/census-seedling-darktrap-gates.mjs           # the report
 *   node scripts/procgen/census-seedling-darktrap-gates.mjs --json    # everything, as JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    trapGatedGrid, trapGateOptions, keptComponents, comparePartitions, classifyTrapGate, sphereSweep, sphereMoves,
    withoutConjunct,
} from './seedlingDarkTrapGateCensus.js';

argvHelp(import.meta.url);

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRESET_DIR = path.join(REPO, 'frontend/presets/seedling_playthrough');
const POCKET_GATE_KINDS = new Set(['cross-room-press', 'in-room-pole']);

/** The seed-1 output directory: the one `AP_<digits>` beside `AP_1` that carries a sphere log. */
function seedDir() {
    const dirs = fs.readdirSync(PRESET_DIR).filter((d) => /^AP_\d+$/.test(d) && d !== 'AP_1'
        && fs.existsSync(path.join(PRESET_DIR, d, `${d}_sphere_log.jsonl`)));
    if (dirs.length !== 1) throw new Error(`darktrap census: expected one seed directory with a sphere log, found [${dirs.join(', ')}]`);
    return dirs[0];
}

export async function darkTrapGateCensus() {
    const PT = await import('./make-seedling-playthrough-rules.mjs');
    const { analyzeRegion } = await import('../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');
    const { apRegionName } = await import('../../frontend/modules/procgenPipeline/regionAtlasValidator.js');
    const { buildLevelWorld, combatCensusOf, rectsOverlap } = await import('../../frontend/modules/seedlingDemo/levelWorld.js');
    const { contactRect } = await import('../../frontend/modules/seedlingDemo/combat.js');
    const { DARKTRAP_LIGHT_DEATH } = await import('../../frontend/modules/seedlingDemo/enemyDamage.js');
    const { spearHitRect, pressRectTouches } = await import('../../frontend/modules/seedlingDemo/presses.js');
    const { swingHits } = await import('../../frontend/modules/seedlingDemo/combatVerbs.js');
    const OE = await import('../../frontend/modules/flashPanel/seedlingObstacleEvents.js');
    const SEM = await import('../../frontend/modules/flashPanel/seedlingSemantics.js');
    const { PUSHABLE_KINDS, blockCrossingCost } = await import('../../frontend/modules/flashPanel/seedlingBlockPaths.js');
    const { deriveWeaponFootprint } = await import('../../frontend/modules/flashPanel/seedlingWeaponFootprints.js');

    const MAP = PT.PLAYTHROUGH_MAP;
    const TILE = MAP.tile_size;
    const committed = JSON.parse(fs.readFileSync(PT.PLAYTHROUGH_ATLAS_PATH, 'utf8'));
    const doc = PT.buildPlaythroughAtlas();
    if (JSON.stringify(doc.regions) !== JSON.stringify(committed.regions)) {
        throw new Error('darktrap census: the in-memory atlas build differs from the committed atlas — regenerate first');
    }
    PT.setPlaythroughLandingAtlas(doc);
    const layer = PT.playthroughEventLayer(doc);
    const minted = new Set(layer.events.map((e) => e.name));
    const eventOf = new Map(layer.events.map((e) => [e.name, e]));
    const resolve = PT.playthroughAnalyzerOptions.resolveCondition;
    const ARM = { thrust: resolve(SEM.flag(OE.POLE_LIGHT_ARM.item)), swing: resolve(SEM.flag(OE.POLE_GHOST_ARM.item)) };
    const model = { buildLevelWorld, combatCensusOf, contactRect, DARKTRAP_LIGHT_DEATH };
    const presses = OE.crossRoomButtonsOf(MAP);
    const inRoom = new Set(OE.inRoomPolesOf(MAP).map((p) => `${p.level}|${p.x},${p.y}`));
    const tileOf = ({ x, y }) => [Math.floor(x / TILE), Math.floor(y / TILE)];
    const key = ([x, y]) => `${x},${y}`;

    // ── the traps ─────────────────────────────────────────────────────────
    const levels = [];
    for (const level of [...MAP.levels].sort((a, b) => a.level - b.level)) {
        const bodies = combatCensusOf(level).enemies.filter((e) => e.as3 === 'DarkTrap');
        if (bodies.length === 0) continue;
        const grid = PT.playthroughGridFor(level);
        const ox = grid.origin?.x ?? 0;
        const oy = grid.origin?.y ?? 0;
        const kindAt = ([x, y]) => grid.cells[(y - oy) * grid.width + (x - ox)]?.kind ?? null;
        const walkable = (x, y) => ['open', 'manual'].includes(kindAt([x, y]));
        const rects = bodies.map((b) => contactRect(b));
        const poles = (level.entities ?? []).filter((e) => e.type === 'lightpole').map((p) => {
            const kills = (OE.poleKillsOf(level, p, model) ?? []).map((b) => b.id);
            const responder = buildLevelWorld(level).pressResponders.find((r) => r.as3 === 'LightPole' && r.x === p.x && r.y === p.y);
            const name = OE.obstacleEventName({ level: level.level, tag: Number(p.attrs?.tag), cls: p.type, x: p.x, y: p.y });
            const g = { width: grid.width, height: grid.height, origin: grid.origin, tile: TILE, walkable, avoid: rects, rectsOverlap };
            const thrust = responder ? OE.poleThrustStances(responder.rect, { ...g, spearHitRect, pressRectTouches }).map((s) => s.tile) : [];
            const swing = responder ? OE.poleSwingStances(responder.rect, { ...g, swingHits }).map((s) => s.tile) : [];
            const press = presses.find((b) => b.write.level === level.level && b.targets.some((t) => t.type === p.type && t.x === p.x && t.y === p.y));
            return {
                at: `lightpole@${p.x},${p.y}`, tag: Number(p.attrs?.tag), invert: Number(p.attrs?.invert ?? 0) !== 0, kills, name,
                minted: minted.has(name), how: press ? 'cross-room press' : inRoom.has(`${level.level}|${p.x},${p.y}`) ? 'in-room pole' : 'none',
                presser: press ? press.presser : null, thrust, swing,
            };
        });
        const traps = bodies.map((b, i) => {
            const r = rects[i];
            const tiles = [];
            for (let ty = Math.floor(r.y / TILE); ty < Math.ceil(r.bottom / TILE); ty += 1) {
                for (let tx = Math.floor(r.x / TILE); tx < Math.ceil(r.right / TILE); tx += 1) tiles.push([tx, ty]);
            }
            const id = `${b.tag}@${b.x},${b.y}`;
            const killers = poles.filter((p) => p.kills.includes(id));
            return {
                id, tag: Number(b.attrs?.tag), tiles, kinds: tiles.map(kindAt), rect: { x: r.x, y: r.y, w: r.w, h: r.h },
                killers: killers.map((p) => p.at), events: killers.filter((p) => p.minted).map((p) => p.name),
            };
        });
        levels.push({ level, grid, poles, traps, regions: doc.regions.filter((r) => Number(r.map_ref) === level.level) });
    }

    // ── the analyses: today, each trap alone, all at once (V2 spec; V3 side arms) ──
    const start = doc.vanilla_layout?.start_region;
    const startSub = doc.vanilla_layout?.start_sub_region ?? null;
    const regionRuns = new Map();
    for (const L of levels) {
        const opts = trapGateOptions(PT.playthroughAnalyzerOptionsFor(L.level));
        for (const region of L.regions) {
            const s = region.region_id === start ? startSub : null;
            const base = analyzeRegion(region, L.grid, opts);
            const baseSubs = keptComponents(base, { start: s });
            const atlasSubs = region.subgraph?.sub_regions ?? null;
            if (atlasSubs ? JSON.stringify(atlasSubs) !== JSON.stringify(baseSubs) : baseSubs.length > 1) {
                throw new Error(`darktrap census: ${region.region_id}'s kept components [${baseSubs}] are not the atlas's [${atlasSubs}]`);
            }
            const run = (traps) => {
                const a = analyzeRegion(region, trapGatedGrid(L.grid, traps), opts);
                return { analysis: a, subs: keptComponents(a, { start: s }) };
            };
            const spec = (ts) => ts.map((t) => ({ tiles: t.tiles, events: t.events }));
            const alone = new Map(L.traps.map((t) => [t.id, run(spec([t]))]));
            const all = run(spec(L.traps));
            // V3: the arm of the piece entered from, read off the all-gated partition.
            const pieceAt = (a, subs) => ([x, y]) => {
                const gx = x - (L.grid.origin?.x ?? 0);
                const gy = y - (L.grid.origin?.y ?? 0);
                if (gx < 0 || gy < 0 || gx >= L.grid.width || gy >= L.grid.height) return null;
                const c = a.componentsResult.indexOf[gy * L.grid.width + gx];
                const id = c >= 0 ? a.componentsResult.components[c].id : null;
                return subs.includes(id) ? id : null;
            };
            const at = pieceAt(all.analysis, all.subs);
            const armOf = (t) => (from) => {
                const piece = at(from);
                if (!piece) return null;
                const ps = L.poles.filter((p) => t.killers.includes(p.at));
                if (ps.some((p) => p.thrust.some((st) => at(st) === piece))) return ARM.thrust;
                if (ps.some((p) => p.swing.some((st) => at(st) === piece))) return ARM.swing;
                return null;
            };
            const arms = run(L.traps.map((t) => ({ tiles: t.tiles, events: t.events, armFrom: armOf(t) })));
            regionRuns.set(region.region_id, { L, region, base, baseSubs, alone, all, arms, at });
        }
    }

    // ── per trap ──────────────────────────────────────────────────────────
    const rows = [];
    for (const L of levels) {
        for (const t of L.traps) {
            const R = L.regions.map((r) => regionRuns.get(r.region_id)).find((x) => {
                const i = (t.tiles[0][1] - (L.grid.origin?.y ?? 0)) * L.grid.width + (t.tiles[0][0] - (L.grid.origin?.x ?? 0));
                const c = x.base.componentsResult.indexOf[i];
                return c >= 0 && x.baseSubs.includes(x.base.componentsResult.components[c].id);
            }) ?? null;
            const undecided = [];
            if (t.events.length === 0) undecided.push('no minted event clears it (no pole lights it in the rules): a permanent barrier');
            if (t.kinds.some((k) => k !== 'open')) undecided.push(`its cells are [${t.kinds}] today, not open`);
            if (!R) undecided.push('its cell is in no kept sub-region today');
            const today = R ? (() => {
                const i = (t.tiles[0][1] - (L.grid.origin?.y ?? 0)) * L.grid.width + (t.tiles[0][0] - (L.grid.origin?.x ?? 0));
                return R.base.componentsResult.components[R.base.componentsResult.indexOf[i]].id;
            })() : null;
            const alone = R?.alone.get(t.id);
            const cmp = R ? comparePartitions(R.base, alone.analysis, { baseSubs: R.baseSubs, gatedSubs: alone.subs }) : null;
            const killers = L.poles.filter((p) => t.killers.includes(p.at));
            for (const p of killers) {
                const sides = new Set([...p.thrust, ...p.swing].map((st) => R?.at(st)).filter(Boolean));
                if (p.how === 'in-room pole' && sides.size > 1) {
                    // Not undecided for the partition: named, the producer must pick one place (or mint per side).
                }
            }
            rows.push({
                level: L.level.level, region: R?.region.region_id ?? null, trap: t.id, tag: t.tag, tiles: t.tiles, rect: t.rect,
                killers: killers.map((p) => ({
                    pole: p.at, tag: p.tag, event: p.name, minted: p.minted, how: p.how,
                    presser: p.presser && `L${p.presser.level} buttonroom@${p.presser.x},${p.presser.y}`,
                    thrust: p.thrust.map((st) => ({ tile: st, piece: R?.at(st) ?? null })),
                    swing: p.swing.map((st) => ({ tile: st, piece: R?.at(st) ?? null })),
                })),
                today, cmp, cls: cmp ? classifyTrapGate(cmp, undecided) : 'iv', undecided,
            });
        }
    }

    // ── the whole game, compiled onto AP_1 and swept ─────────────────────
    const AP1 = JSON.parse(fs.readFileSync(PT.PLAYTHROUGH_PRESET_PATH, 'utf8'));
    const seed = seedDir();
    const SEED = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, seed, `${seed}_rules.json`), 'utf8'));
    const regions1 = AP1.regions['1'];
    const placed = new Map();
    for (const r of Object.values(SEED.regions['1'])) for (const l of r.locations ?? []) placed.set(l.name, l.item?.name ?? null);
    const levelOfName = (n) => n.split('__')[0];
    const affected = new Set([...regionRuns.keys()]);
    const regionById = new Map(doc.regions.map((r) => [r.region_id, r]));
    const baseName = (regionId, exitId) => {
        const r = regionById.get(regionId);
        const e = r.exits.find((x) => x.exit_id === exitId);
        return r.subgraph ? apRegionName(regionId, e.sub_region) : regionId;
    };
    // Each AP region's boundary exits are the LAST ones, in connection order (`compileRegionAtlas`).
    const conns = doc.vanilla_layout.connections;
    const boundaryOf = new Map();
    for (const c of conns) {
        const a = baseName(c.from[0], c.from[1]);
        if (!boundaryOf.has(a)) boundaryOf.set(a, []);
        boundaryOf.get(a).push(c);
        if (c.one_way !== true) {
            const b = baseName(c.to[0], c.to[1]);
            if (!boundaryOf.has(b)) boundaryOf.set(b, []);
            boundaryOf.get(b).push({ from: c.to, to: c.from, reversed: true });
        }
    }
    const edgeOfConn = new Map();
    for (const [name, list] of boundaryOf) {
        const exits = regions1[name]?.exits ?? [];
        const tail = exits.slice(exits.length - list.length);
        list.forEach((c, i) => {
            const want = baseName(c.to[0], c.to[1]);
            if (tail[i]?.connected_region !== want) throw new Error(`darktrap census: ${name}'s boundary exit ${i} is ${tail[i]?.connected_region}, not ${want}`);
            edgeOfConn.set(`${c.from.join('/')}>${c.to.join('/')}`, tail[i]);
        });
    }
    const internalOf = (name) => {
        const exits = regions1[name]?.exits ?? [];
        return exits.slice(0, exits.length - (boundaryOf.get(name)?.length ?? 0));
    };

    // The pocket-door gates (b) would replace: a press's or an in-room pole's, naming a trap-clearing event.
    const trapEvents = new Set(rows.flatMap((r) => r.killers.map((k) => k.event)));
    const trapGates = layer.exitGates.filter((g) => POCKET_GATE_KINDS.has(g.kind)
        && [...trapEvents].some((n) => JSON.stringify(g.rule).includes(JSON.stringify(n))));
    const compile = (variant) => {
        const graph = new Map();
        const locations = [];
        const add = (name) => { if (!graph.has(name)) graph.set(name, { exits: [] }); return graph.get(name); };
        const pieceName = (regionId, sub) => {
            const R = regionRuns.get(regionId);
            const v = R[variant.startsWith('V3') ? 'arms' : 'all'];
            return v.subs.length > 1 ? apRegionName(regionId, sub) : regionId;
        };
        const nameOf = (regionId, exitId) => {
            if (!affected.has(regionId)) return baseName(regionId, exitId);
            const R = regionRuns.get(regionId);
            const v = R[variant.startsWith('V3') ? 'arms' : 'all'];
            const b = v.analysis.bindings.find((x) => x.kind === 'exit' && x.id === exitId);
            if (!b?.component || !v.subs.includes(b.component.id)) throw new Error(`darktrap census: ${regionId}/${exitId} binds no kept piece under ${variant}`);
            return pieceName(regionId, b.component.id);
        };
        // Unaffected regions: their internal exits as compiled; their locations as compiled.
        for (const [name, r] of Object.entries(regions1)) {
            if (name !== 'Menu' && affected.has(levelOfName(name))) continue;
            const g = add(name);
            for (const e of internalOf(name)) g.exits.push({ to: e.connected_region, rule: e.access_rule });
            for (const l of r.locations ?? []) locations.push({ name: l.name, item: placed.get(l.name) ?? (l.event ? l.name : null), sources: [{ region: name, rule: l.access_rule }] });
        }
        // Boundary edges, every connection, re-targeted by binding.
        for (const [, list] of boundaryOf) {
            for (const c of list) {
                const e = edgeOfConn.get(`${c.from.join('/')}>${c.to.join('/')}`);
                let rule = e.access_rule;
                if (variant !== 'V1') {
                    for (const gte of trapGates) {
                        if (gte.region_id === c.from[0] && gte.exit_id === c.from[1]) rule = withoutConjunct(rule, gte.rule);
                    }
                }
                add(nameOf(c.from[0], c.from[1])).exits.push({ to: nameOf(c.to[0], c.to[1]), rule });
            }
        }
        // Affected regions: the gated pieces, their rows, the struck-block crossings re-priced, their locations.
        const notes = [];
        for (const [regionId, R] of regionRuns) {
            const v = R[variant.startsWith('V3') ? 'arms' : 'all'];
            for (const s of v.subs) add(pieceName(regionId, s));
            const blockGates = blockGatesOn(R, v);
            for (const r of v.analysis.internal_exits) {
                if (!v.subs.includes(r.from) || !v.subs.includes(r.to)) continue;
                const dirs = [[r.from, r.to], ...(r.bidirectional ? [[r.to, r.from]] : [])];
                for (const [f, t] of dirs) {
                    const gate = blockGates.find((g) => g.from === f && g.to === t);
                    const rule = gate ? { rule: 'And', children: [r.access_rule, gate.rule] } : r.access_rule;
                    add(pieceName(regionId, f)).exits.push({ to: pieceName(regionId, t), rule });
                }
            }
            for (const g of blockGates) notes.push(`${variant} ${g.why}`);
            for (const name of Object.keys(regions1).filter((n) => levelOfName(n) === regionId)) {
                for (const l of regions1[name].locations ?? []) {
                    const item = placed.get(l.name) ?? (l.event ? l.name : null);
                    if (!l.event) {
                        const b = v.analysis.bindings.find((x) => x.kind === 'location' && x.id === l.name);
                        locations.push({ name: l.name, item, sources: [{ region: pieceName(regionId, b.component.id), rule: l.access_rule }] });
                        continue;
                    }
                    locations.push({ name: l.name, item, sources: eventSources(R, v, l, eventOf.get(l.name), pieceName, regionId, notes, variant) });
                }
            }
        }
        add('Menu');
        return { graph, locations, notes };
    };

    // The producer's struck-block crossings (`playthroughBlockCrossingCases` + `playthroughBlockCrossings`), on the
    // gated partition: the push physics is the baseline grid's (the trap is already a stopper there).
    function blockGatesOn(R, v) {
        const { level, grid } = R.L;
        const out = [];
        const pushables = (level.entities ?? []).filter((e) => PUSHABLE_KINDS[e.type]?.push);
        if (pushables.length === 0) return out;
        const stoppers = PT.playthroughBlockStoppers(level, minted);
        if (stoppers.length === 0) return out;
        const { indexOf, components } = v.analysis.componentsResult;
        const subOf = (i) => (indexOf[i] >= 0 && v.subs.includes(components[indexOf[i]].id) ? components[indexOf[i]].id : null);
        const tileTypes = new Map();
        for (const layerRow of level.layers ?? []) {
            if (layerRow.name === 'cliffsides') continue;
            for (const placement of layerRow.tiles ?? []) {
                const t = SEM.tileTypeForPlacement(placement);
                if (t !== null) tileTypes.set(placement[1] * grid.width + placement[0], t);
            }
        }
        for (const b of pushables) {
            const [bx, by] = tileOf(b);
            const pushFlag = PUSHABLE_KINDS[b.type].push;
            const stances = deriveWeaponFootprint(pushFlag.replace(/^has/, '').toLowerCase(), 'block');
            const sides = new Map();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const [nx, ny] = [bx + dx, by + dy];
                if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
                const sub = subOf(ny * grid.width + nx);
                if (sub && !sides.has(sub)) sides.set(sub, ny * grid.width + nx);
            }
            for (const [from, startCell] of sides) {
                for (const to of sides.keys()) {
                    if (to === from) continue;
                    const goal = new Set();
                    for (let i = 0; i < indexOf.length; i += 1) if (subOf(i) === to) goal.add(i);
                    const cost = blockCrossingCost(grid, {
                        block: { tx: bx, ty: by, condition: SEM.flag(pushFlag) }, stances, stoppers, tileTypes, keyOf: SEM.conditionKey,
                        held: [SEM.conditionKey(SEM.flag(pushFlag))],
                    }, startCell, goal);
                    if (cost.refused || cost.sets.length === 0 || cost.sets.some((s) => s.length === 0)) continue;
                    const ways = cost.sets.map((set) => (set.length === 1 ? { rule: 'Has', args: { item_name: set[0] } }
                        : { rule: 'And', children: set.map((n) => ({ rule: 'Has', args: { item_name: n } })) }));
                    out.push({ from, to, rule: ways.length === 1 ? ways[0] : { rule: 'Or', children: ways },
                        why: `${R.region.region_id} ${b.type}@${b.x},${b.y}: ${from} -> ${to} needs ${cost.sets.map((s) => s.join(' + ')).join(' OR ')}` });
                }
            }
        }
        return out;
    }

    // Where an event of an affected region is collected under the gated partition.
    function eventSources(R, v, loc, ev, pieceName, regionId, notes, variant) {
        const at = (tile) => {
            const gx = tile[0] - (R.L.grid.origin?.x ?? 0);
            const gy = tile[1] - (R.L.grid.origin?.y ?? 0);
            const c = v.analysis.componentsResult.indexOf[gy * R.L.grid.width + gx];
            const id = c >= 0 ? v.analysis.componentsResult.components[c].id : null;
            return v.subs.includes(id) ? id : null;
        };
        const ob = ev?.fields?.obstacle;
        const press = ob && presses.find((b) => b.presser.level === R.L.level.level && b.write.level === ob.level && b.write.tag === ob.tag);
        if (press) {
            const p = at(tileOf(press.presser));
            if (!p) throw new Error(`darktrap census: ${loc.name}'s presser stands in no kept piece`);
            return [{ region: pieceName(regionId, p), rule: loc.access_rule }];
        }
        const pole = ob?.class === 'lightpole' && ob.level === R.L.level.level ? R.L.poles.find((p) => p.at === `lightpole@${ob.x},${ob.y}`) : null;
        if (pole) {
            const thrust = [...new Set(pole.thrust.map(at).filter(Boolean))];
            const swing = [...new Set(pole.swing.map(at).filter(Boolean))].filter((p) => !thrust.includes(p));
            // V3s: ONE place — today's sub-region, when it survives as a piece holding a stance (the producer's choice kept).
            const today = ev?.sub_region;
            if (variant === 'V3s' && today && [...thrust, ...swing].includes(today)) {
                return [{ region: pieceName(regionId, today), rule: thrust.includes(today) ? loc.access_rule : ARM.swing }];
            }
            if (thrust.length + swing.length > 1) notes.push(`${variant} ${loc.name}: its stances span pieces [${[...thrust, ...swing.map((s) => `${s} (swing)`)].join(', ')}] — the producer must pick one place or mint per side`);
            return [...thrust.map((p) => ({ region: pieceName(regionId, p), rule: loc.access_rule })),
                ...swing.map((p) => ({ region: pieceName(regionId, p), rule: ARM.swing }))];
        }
        // Any other event: keep it where the atlas put it, if that piece survives (named).
        const sub = ev?.sub_region;
        const b = sub && v.subs.includes(sub) ? sub : null;
        notes.push(`${variant} ${loc.name}: not a pole or press event — kept at ${b ?? '(its sub-region is gone)'}`);
        return b ? [{ region: pieceName(regionId, b), rule: loc.access_rule }] : [];
    }

    // The baseline: AP_1 as compiled (checked against the seed-1 sphere log).
    const baseGraph = new Map();
    const baseLocations = [];
    for (const [name, r] of Object.entries(regions1)) {
        baseGraph.set(name, { exits: (r.exits ?? []).map((e) => ({ to: e.connected_region, rule: e.access_rule })) });
        for (const l of r.locations ?? []) baseLocations.push({ name: l.name, item: placed.get(l.name) ?? (l.event ? l.name : null), sources: [{ region: name, rule: l.access_rule }] });
    }
    const baseline = sphereSweep({ regions: baseGraph, start: 'Menu', locations: baseLocations });
    const log = fs.readFileSync(path.join(PRESET_DIR, seed, `${seed}_sphere_log.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const logSphere = new Map();
    for (const row of log) {
        if (row.type !== 'state_update') continue;
        for (const n of row.player_data['1'].sphere_locations) logSphere.set(n, Number(String(row.sphere_index).split('.')[0]));
    }
    const logMismatch = [...new Set([...logSphere.keys(), ...baseline.sphereOf.keys()])]
        .filter((n) => logSphere.get(n) !== baseline.sphereOf.get(n))
        .map((n) => ({ location: n, log: logSphere.get(n) ?? null, sweep: baseline.sphereOf.get(n) ?? null }));

    const variants = {};
    for (const variant of ['V1', 'V2', 'V3', 'V3s']) {
        const { graph, locations, notes } = compile(variant);
        const sweep = sphereSweep({ regions: graph, start: 'Menu', locations });
        const names = [...new Set([...baseline.regionSphere.keys(), ...sweep.regionSphere.keys()])].sort();
        variants[variant] = {
            moves: sphereMoves(baseline, sweep),
            regionMoves: names.filter((n) => baseline.regionSphere.get(n) !== sweep.regionSphere.get(n))
                .map((n) => ({ region: n, before: baseline.regionSphere.get(n) ?? null, after: sweep.regionSphere.get(n) ?? null })),
            unreachable: locations.filter((l) => !sweep.sphereOf.has(l.name)).map((l) => l.name),
            notes: [...new Set(notes)],
        };
    }

    const regionsOut = [...regionRuns].map(([regionId, R]) => {
        const out = { region: regionId, today: R.baseSubs };
        for (const [k, v] of [['all', R.all], ['arms', R.arms]]) {
            const cmp = comparePartitions(R.base, v.analysis, { baseSubs: R.baseSubs, gatedSubs: v.subs });
            const bound = new Set(v.analysis.bindings.filter((b) => b.component).map((b) => b.component.id));
            out[k] = { subs: v.subs, empty: v.subs.filter((s) => !bound.has(s)), ...cmp,
                pieceTiles: Object.fromEntries(v.subs.map((s) => [s, v.analysis.components.find((c) => c.id === s).tiles.map(key)])) };
        }
        return out;
    });

    return {
        atlasId: committed.atlas_id, seed, traps: rows, regions: regionsOut, baselineVsLog: logMismatch,
        baselineSpheres: Math.max(...baseline.sphereOf.values()), variants,
        pocketGates: { all: layer.exitGates.filter((g) => POCKET_GATE_KINDS.has(g.kind)).length, trap: trapGates.map((g) => `${g.region_id}/${g.exit_id} [${g.kind}]`) },
    };
}

const ruleText = (r) => {
    if (!r) return 'True_';
    switch (r.rule) {
        case 'Has': return r.args.item_name;
        case 'True_': return 'True_';
        case 'And': return `(${r.children.map(ruleText).join(' AND ')})`;
        case 'Or': return `(${r.children.map(ruleText).join(' OR ')})`;
        default: return JSON.stringify(r);
    }
};

export function formatDarkTrapGateCensus(c) {
    const out = [];
    out.push(`DarkTrap gate census — atlas ${c.atlasId}, seed ${c.seed}`);
    out.push(`${c.traps.length} DarkTrap(s); classes: ${JSON.stringify(Object.fromEntries(['i', 'ii', 'iii', 'iv'].map((k) => [k, c.traps.filter((t) => t.cls === k).length])))}`);
    out.push('');
    for (const t of c.traps) {
        out.push(`L${t.level} darktrap@${t.trap.split('@')[1]} (tag ${t.tag}) — tiles [${t.tiles.map((x) => x.join(',')).join('; ')}], today in ${t.region}/${t.today} — class (${t.cls})`);
        for (const k of t.killers) {
            out.push(`  cleared by ${k.pole} (tag ${k.tag}): "${k.event}"${k.minted ? '' : ' (NOT minted)'} — ${k.how}${k.presser ? ` (${k.presser})` : ''}`);
            out.push(`    thrust stances: ${k.thrust.map((s) => `[${s.tile}]→${s.piece ?? '.'}`).join(' ') || 'none'}; swing: ${k.swing.map((s) => `[${s.tile}]→${s.piece ?? '.'}`).join(' ') || 'none'}`);
        }
        for (const u of t.undecided) out.push(`  undecided: ${u}`);
        if (t.cmp) {
            for (const p of t.cmp.pieces.filter((x) => x.pieces.length > 1 || x.pieces[0]?.id !== x.sub)) out.push(`  ${t.region}/${p.sub} → ${p.pieces.map((x) => `${x.id}(${x.size})`).join(' + ')}`);
            for (const r of t.cmp.newRows) out.push(`  new crossing ${r.from} ${r.bidirectional ? '<->' : '->'} ${r.to}: ${ruleText(r.access_rule)}`);
            for (const r of t.cmp.goneRows) out.push(`  gone crossing ${r.from} ${r.bidirectional ? '<->' : '->'} ${r.to}: ${ruleText(r.access_rule)}`);
            for (const m of t.cmp.moved) out.push(`  moves: ${m.kind} ${m.id} [${m.tile}] ${m.from} → ${m.to}`);
        }
    }
    out.push('');
    out.push('Every trap gated at once (V2 as-spec / V3 side-arms):');
    for (const r of c.regions) {
        for (const k of ['all', 'arms']) {
            const v = r[k];
            out.push(`  ${r.region} [${k === 'all' ? 'V2' : 'V3'}]: [${r.today.join(', ') || '(one)'}] → [${v.subs.join(', ')}]${v.empty.length ? `; empty (no exit, no location): [${v.empty.join(', ')}]` : ''}`);
            for (const row of v.newRows) out.push(`      new ${row.from} ${row.bidirectional ? '<->' : '->'} ${row.to}: ${ruleText(row.access_rule)}`);
            for (const row of v.goneRows) out.push(`      gone ${row.from} ${row.bidirectional ? '<->' : '->'} ${row.to}: ${ruleText(row.access_rule)}`);
            for (const m of v.moved) out.push(`      moves ${m.kind} ${m.id} ${m.from} → ${m.to}`);
            for (const e of v.empty) out.push(`      empty ${e}: tiles [${v.pieceTiles[e].join('; ')}]`);
        }
    }
    out.push('');
    out.push(`Baseline sweep vs the committed seed-1 sphere log: ${c.baselineVsLog.length === 0 ? `IDENTICAL (${c.baselineSpheres + 1} spheres)` : `${c.baselineVsLog.length} MISMATCH(ES)`}`);
    for (const m of c.baselineVsLog.slice(0, 20)) out.push(`  ${m.location}: log ${m.log}, sweep ${m.sweep}`);
    for (const [k, v] of Object.entries(c.variants)) {
        out.push(`${k}: ${v.moves.length} location(s) change sphere; ${v.unreachable.length} unreachable`);
        for (const m of v.moves) out.push(`  ${m.location}: sphere ${m.before} → ${m.after ?? 'UNREACHABLE'}`);
        for (const m of v.regionMoves) out.push(`  region ${m.region}: first reached in sphere ${m.before ?? '(new / gone)'} → ${m.after ?? '(gone / unreachable)'}`);
        for (const n of v.notes) out.push(`  note: ${n}`);
    }
    return out.join('\n');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) {
    const census = await darkTrapGateCensus();
    process.stdout.write(`${process.argv.includes('--json') ? JSON.stringify(census, null, 1) : formatDarkTrapGateCensus(census)}\n`);
    process.exit(0);
}
