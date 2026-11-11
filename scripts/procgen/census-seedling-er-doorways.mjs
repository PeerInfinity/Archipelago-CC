#!/usr/bin/env node
/**
 * census-seedling-er-doorways — **THE ER DOOR CENSUS** (ENTRANCE RANDOMIZATION E1, a design check, no
 * shuffle): every doorway of the Seedling playthrough atlas classified by a STATED rule, each doorway's
 * reverse derived from GAME DATA (`seedlingReturnSpawns.returnSpawnTable`, a landing-distance heuristic only
 * as a cross-check), the proof that every STAIRS doorway has exactly one reverse of the opposite direction,
 * and the census of everything a stairs shuffle would have to recompute: (A) the producer's readers of the
 * map's game links, (B) the gated AP exits on a stairs doorway by owner, (C) the stairs a pit chain fires,
 * (D) the permissive bindings in a stairs level, (E) the start's stairs, (F) stairs into an entry-gate floor.
 *
 * ⚖ user 2026-11-01: Q1 stairs only · Q2 coupled only · Q5 ZERO unclassified (a doorway no rule classifies,
 * or a stair with no unique opposite reverse, prints `Q5 STOP`).
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house census law) ──────────
 *
 * Report-only; exit 0 whatever it finds. The pure half is `seedlingErDoorCensus.js`;
 * `seedlingErDoorCensus.test.js` pins the committed atlas's counts. It builds the playthrough atlas in
 * memory (`buildPlaythroughAtlas`, ~6 s) for the producer-side facts and WRITES NOTHING but `--json`.
 *
 * ⛓ WHAT IT BOUNDS (named in the printed header):
 *   · the doorways are the COMMITTED atlas's (`seedling-playthrough.json`) over the DELIVERED map
 *     (`patchedMapDocument(seedling-map.json)`, what the producer derives from);
 *   · (A) is a SOURCE SCAN of the producer and its direct imports (`scanLinkReaders`), and each reader's
 *     domain (the landings it consumes) is measured here per reader; a reader with no measured domain is
 *     printed UNMEASURED rather than guessed;
 *   · (B) reads the committed AP_1 rules; a conjunct's owner is the stated rule in `stairsGates`.
 *
 * Run:
 *   node scripts/procgen/census-seedling-er-doorways.mjs
 *   node scripts/procgen/census-seedling-er-doorways.mjs --json=/tmp/er-doorways.json
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { censusErDoorways, IN_SCOPE_CLASSES } from './seedlingErDoorCensus.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const imp = (p) => import(pathToFileURL(join(REPO, p)));

/**
 * Every input the pure census takes, loaded from the committed tree (the vitest pin calls this too).
 * @param {{producer?: boolean}} o `producer: false` skips the in-memory atlas build ((A)'s domains, (B)'s
 *   lethal-landing owners, (C), (D), (F) are then absent)
 */
export async function loadCensusInputs({ producer = true } = {}) {
    const atlas = readJson('frontend/modules/flashPanel/atlases/seedling-playthrough.json');
    const rules = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
    const { patchedMapDocument } = await imp('frontend/modules/seedlingDemo/seedlingSetPatches.js');
    const mapDoc = patchedMapDocument(readJson('frontend/modules/flashPanel/atlases/seedling-map.json'));
    const { returnSpawnTable, returnKey } = await imp('frontend/modules/flashPanel/seedlingReturnSpawns.js');
    const { TRIGGER_FOR_NAMED_ROOM } = await imp('frontend/modules/seedlingDemo/seedlingAtlasDerivation.js');
    const { apRegionName } = await imp('frontend/modules/procgenPipeline/regionAtlasValidator.js');
    const { obstacleEventName } = await imp('frontend/modules/flashPanel/seedlingObstacleEvents.js');
    // The inverse of `obstacleEventName`, built FROM it (sentinels in, a pattern out), so the format is not respelled.
    const SENT = { level: '\u0001', tag: '\u0002', cls: '\u0003', x: '\u0004', y: '\u0005' };
    const eventRe = new RegExp(`^${obstacleEventName(SENT).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(SENT.level, '(\\d+)').replace(SENT.tag, '-?\\d+').replace(SENT.cls, '[a-z0-9_]+')
        .replace(SENT.x, '-?\\d+').replace(SENT.y, '-?\\d+')}$`, 'i');
    const flagLevelOf = (name) => {
        const m = eventRe.exec(name);
        return m ? Number(m[1]) : null;
    };
    const triggerKeys = Object.fromEntries(Object.entries(TRIGGER_FOR_NAMED_ROOM).map(([key, t]) => [t, key]));

    const PRODUCER = 'scripts/procgen/make-seedling-playthrough-rules.mjs';
    const producerSource = readFileSync(join(REPO, PRODUCER), 'utf8');
    const moduleSources = {};
    for (const m of producerSource.matchAll(/await imp\('([^']+)'\)/g)) moduleSources[m[1]] = readFileSync(join(REPO, m[1]), 'utf8');
    for (const m of producerSource.matchAll(/await import\('(\.\/[^']+)'\)/g)) moduleSources[m[1]] = readFileSync(join(HERE, m[1]), 'utf8');

    const inputs = {
        atlas, rules, mapDoc, returnTable: returnSpawnTable(mapDoc), returnKey, triggerKeys, apRegionName, flagLevelOf,
        producerSource, moduleSources,
    };
    if (!producer) return inputs;

    const P = await import(pathToFileURL(join(REPO, PRODUCER)));
    const doc = P.buildPlaythroughAtlas();
    P.setPlaythroughLandingAtlas(doc);
    P.playthroughLandingGates(doc);
    const lethalGated = new Set(P.lethalLandings.filter((l) => l.gated).map((l) => l.where.split(' -> ')[0]));

    const { gameLandings, arrivalSolidCensus } = await imp('frontend/modules/seedlingDemo/fidelityArrival.js');
    const { levelSourceFromAtlas } = await imp('frontend/modules/seedlingDemo/atlasSource.js');
    const O = await imp('frontend/modules/flashPanel/seedlingObstacleEvents.js');
    const MAP = P.PLAYTHROUGH_MAP;
    const all = gameLandings(MAP);
    const into = (levels) => all.filter((g) => levels.has(g.level));
    const ownLinks = (levels) => MAP.levels.filter((L) => levels.has(L.level)).flatMap((L) => (L.entities ?? [])
        .filter((e) => e.attrs?.to !== undefined && e.attrs?.playerx !== undefined)
        .map((e) => ({ from: L.level, door: `${e.type}@${e.x},${e.y}`, level: Number(e.attrs.to) })));
    const ropeLevels = new Set(O.ropesOf(MAP).map((r) => r.level));
    const barrierLevels = new Set([
        ...O.crossRoomButtonsOf(MAP).flatMap((b) => b.targets.map((t) => t.level)),
        ...O.inRoomPolesOf(MAP).map((p) => p.level),
    ]);
    const solidRows = arrivalSolidCensus(MAP, levelSourceFromAtlas(MAP));
    const chainLevels = new Set(P.pitChains.map((c) => c.landing.level));
    const everyLevel = new Set(MAP.levels.map((L) => L.level));
    const noHitGateLevels = new Set(P.playthroughNoHitGates().map((g) => g.gate.level));
    /** ⛓ Each scanned reader's DOMAIN: the landings (or departures) it consumes, measured on the delivered map. */
    const readerDomains = {
        doorTilesOf: { what: 'landings INTO a rope level (the doors a rope lane leaves open)', landings: into(ropeLevels) },
        playthroughRopeEvents: { what: 'landings INTO a minted rope\'s level inside its lane (exitGates)', landings: into(ropeLevels) },
        barrierAnalysis: { what: 'landings INTO a button-target / in-room-pole level (the "cut" pass: needs the vanilla departure -> region connection)', landings: into(barrierLevels) },
        playthroughObstacleEvents: { what: 'every game landing the arrival-solid census finds inside a persistence solid', landings: solidRows.map((r) => r.landing) },
        RETURN_SPAWNS: { what: 'every door\'s return spawn (the reverse link\'s playerx/y)', landings: all },
        arrivalSpawnFor: { what: 'every arrival exit\'s return spawn', landings: all },
        playthroughLandingGates: { what: 'every arrival exit\'s return spawn, priced for lethal terrain', landings: all },
        pitChainsFor: { what: 'the links a fall lands on (descent census, the room\'s own links\' @to)', landings: ownLinks(chainLevels) },
        // ⛓ rules-no-hit-directional: a gated room's flyer bands (its solids) and its witnesses' doors: the room's own links
        // and the landings their links back give (`doorOf`). A stairs shuffle keeps every room's door and landing tiles.
        playthroughNoHitGatesFor: { what: 'the links of a room that holds a directional no-hit gate, and the landings into it (its witnesses\' door and landing tiles)',
            landings: [...into(noHitGateLevels), ...ownLinks(noHitGateLevels)] },
        derivePlaythroughLayer: { what: 'every link (the atlas derivation itself: E4 rewrites its output)', landings: ownLinks(everyLevel) },
        // A buildLevelWorld call (wherever it sits) models the room's OWN links (their @to/@playerx).
        'reads:buildLevelWorld': { what: 'the room\'s own links (departure-side model)', landings: ownLinks(everyLevel) },
        'reads:poleKillsOf': { what: 'the room\'s combat model, built by buildLevelWorld (its own links, departure side)', landings: ownLinks(barrierLevels) },
    };
    const entryGateLevels = MAP.levels.filter((L) => P.playthroughEntryGate(L) !== null).map((L) => L.level);
    return {
        ...inputs, lethalGated, readerDomains,
        pitChains: P.pitChains, permissiveBindings: [...P.permissiveBindings], entryGateLevels,
    };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const c = censusErDoorways(await loadCensusInputs());
    const out = [];
    const say = (s = '') => out.push(s);
    const j = (o) => JSON.stringify(o);
    say('# census-seedling-er-doorways (ER E1 — a design check, no shuffle)');
    say(`atlas ${c.atlasId} · ${c.connections} connections (${c.oneWayConnections} one_way) · ${c.doorways} doorways`);
    say('bounds: committed atlas over the DELIVERED map; (A) is a source scan of make-seedling-playthrough-rules.mjs + its direct imports; (B) reads the committed AP_1 rules');
    say();
    say('## doorways by class (the class rules: R-LINK / R-PIT / R-WARP, seedlingErDoorCensus.js header)');
    for (const [k, n] of Object.entries(c.byClass)) say(`  ${String(n).padStart(4)}  ${k}`);
    say(`  by kind: ${j(c.byKind)}`);
    say(`  by rule: ${j(c.byRule)}`);
    say(`UNCLASSIFIED: ${c.unclassified.length}${c.unclassified.length ? ' ⛔ Q5 STOP' : ''}`);
    for (const u of c.unclassified) say(`  ${u.from.join('/')} -> ${u.to.join('/')}: ${u.why}`);
    say();
    say('## reverses');
    say(`game data (returnSpawnTable) pairs ${c.gamePaired} of ${c.doorways}; the ${'3'}-tile landing heuristic finds a candidate for ${c.heuristicPaired}`);
    for (const [k, n] of Object.entries(c.pairingCounts)) say(`  ${String(n).padStart(4)}  ${k}`);
    say(`one-way doorways (${c.oneWay.length}):`);
    for (const o of c.oneWay) say(`  ${o.id.padEnd(36)} ${o.cls.padEnd(16)} -> L${String(o.to).padEnd(4)} ${o.pairing}`);
    say(`game vs heuristic disagreements (${c.disagreements.length}):`);
    for (const d of c.disagreements) say(`  ${d.id.padEnd(36)} ${d.cls.padEnd(16)} game=[${d.game.join(', ')}] heuristic=[${d.heuristic.join(', ')}]`);
    say();
    say(`## the in-scope set (${IN_SCOPE_CLASSES.join(' ↔ ')}): ${c.proof.stairs} doorways, ${c.proof.down} down / ${c.proof.up} up, ${c.proof.pairs.length} coupled pairs`);
    say(`proof failures: ${c.proof.failures.length}${c.proof.failures.length ? ' ⛔ Q5 STOP' : ' — every stair has exactly one game-data reverse, mutual, of the opposite direction'}`);
    for (const f of c.proof.failures) say(`  ${f.id}: ${f.why.join('; ')}`);
    for (const [a, b] of c.proof.pairs) say(`  ${a.padEnd(36)} ↔ ${b}`);
    say();
    say(`## (A) the producer's readers of the map's game links (scan: ${c.scan.readers.join(', ')})`);
    for (const r of c.exposure.rows) {
        say(`  :${String(r.line).padEnd(5)} ${r.fn.padEnd(28)} ${r.reads}${r.via ? ` (via ${r.via})` : ''} — ${r.domain}; `
            + `${r.landings} rows, ${r.stairsLandings.length} STAIRS${r.stairsLandings.length && r.stairsLandings.length <= 8 ? `: ${r.stairsLandings.join('; ')}` : ''}`);
    }
    say(`  UNMEASURED readers: ${c.exposure.unmeasured.length ? c.exposure.unmeasured.join(', ') : 'none'}`);
    say();
    say(`## (B) gated cross-level AP exits: ${c.gates.gated} of ${c.gates.crossLevel} (LANDING-owned: ${c.gates.gatedLandingEvent} by a landing-room event, ${c.gates.gatedLandingTerrain} more by landing terrain only; cross-level = both ends' AP regions name different levels, Menu excluded); on a STAIRS doorway: ${c.gates.stairsRows.length}`);
    for (const r of c.gates.stairsRows) {
        say(`  ${r.apExit}  [${r.doorways.join(', ')}]${r.sharedWith.length ? ` shared with [${r.sharedWith.join(', ')}]` : ''}`);
        for (const o of r.owners) say(`      ${o.owner.padEnd(16)} ${j(o.rule)}`);
    }
    if (c.gates.apExitsWithNoConnection.length) say(`  cross-level AP exits no atlas connection names: ${c.gates.apExitsWithNoConnection.join(', ')}`);
    say();
    say(`## (C) pit chains through a stairs doorway: ${c.chains.length}`);
    for (const ch of c.chains) say(`  ${ch.pit} lands in L${ch.landsIn}, fires ${ch.fires} = ${ch.stairsDoorway} (reverse ${ch.stairsReverse}), ends L${ch.ends.level} [${ch.ends.tile}]`);
    say();
    say(`## (D) permissiveBindings (${c.permissive.length}) and the stairs that touch their level`);
    say('  rule: a binding is AT RISK iff a stairs doorway LANDS in its own sub-region (a swap changes only that edge set; the room\'s landing tiles are kept)');
    for (const p of c.permissive) {
        say(`  ${p.binding.padEnd(36)} [${p.subRegion ?? '—'}] ${p.atRisk ? 'AT RISK' : 'safe   '}  stairs landing in the level: [${p.stairsArriveInLevel.join(', ')}]`
            + `${p.stairsArriveInSubRegion.length ? `; in its sub-region: [${p.stairsArriveInSubRegion.join(', ')}]` : ''}`);
    }
    say();
    say(`## (E) start ${c.start.level}/${c.start.subRegion}: stairs in the start sub-region [${c.start.stairsInStartSubRegion.join(', ')}]; stairs landing in it [${c.start.stairsIntoStartSubRegion.join(', ')}]`);
    say(`## (F) entry-gate floors [${c.floors.levels.map((l) => `L${l}`).join(', ')}]: stairs doorways into/out of them [${c.floors.stairsDoorways.join(', ')}]`);
    say();
    say(`## PINS (stated-rule design outputs): ${c.pins.length}`);
    for (const p of c.pins) say(`  ${p.doorway.padEnd(36)} ${p.rule}: ${p.why}`);
    say();
    const stop = c.unclassified.length + c.proof.failures.length;
    say(stop ? `⛔ Q5 STOP: ${c.unclassified.length} unclassified, ${c.proof.failures.length} stairs without a unique opposite reverse`
        : 'Q5: ZERO unclassified; every in-scope stair has exactly one game-data reverse of the opposite direction.');
    console.log(out.join('\n'));

    const jsonArg = process.argv.find((a) => a.startsWith('--json='));
    if (jsonArg) {
        const p = resolve(jsonArg.slice('--json='.length));
        mkdirSync(dirname(p), { recursive: true });
        const { byId, doorwayList, ...rest } = c;
        writeFileSync(p, `${JSON.stringify({ ...rest, doorways: doorwayList }, null, 2)}\n`);
        console.log(`wrote ${p}`);
    }
}
