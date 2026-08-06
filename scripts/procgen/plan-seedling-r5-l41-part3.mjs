#!/usr/bin/env node
/**
 * plan-seedling-r5-l41-part3 — THE CRUSHER'S FIRST LIVE DRIVE, AND THE
 * FOURTH COLLECT CEREMONY.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 15 step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §25.5 / §28.8, and
 * `r5Totem.L41_PART3` for the room.
 *
 * ── ⛓⛓⛓ WHY THIS ROOM RETIRES `hazardVolume`'s HARD-AVOID ────────────
 *
 * §24.6 measured that `totempart 3` "crosses on the crusher alone" and read
 * that as an obstacle. It is an obstacle AND it is the room's only usable
 * machine. L41 has TWO gates that each need a SOLID standing on a button —
 * `wandlock@240,96` (whose `returnToNormal` fires the tick nothing is in its
 * cell) and `cover@112,128` (same shape) — ONE pushable block, and the
 * block's only push stance is the cover's own cell. A player alone cannot
 * open either.
 *
 * `Button.update` collides `["Player","Enemy","Solid"]` and excludes only a
 * `Cover`; a `Crusher` is `type = "Solid"`. Three baits walk it from
 * (256,80) to (256,240) — which is ON `button@248,232` — where it holds the
 * cover open permanently, and the FIRST of those baits is also what clears
 * the doorway to the part. The obstacle is the key.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l41-part3.mjs [--write] [--search]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { synthesizeLegs, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { rockBreaksUnder } = await import(join(MODULE, 'breakableRocks.js'));
const { L41_PART3 } = await import(join(MODULE, 'r5Totem.js'));
const { CRUSHER_PLAN } = await import(join(MODULE, 'crusher.js'));

const WRITE = process.argv.includes('--write');
const SEARCH = process.argv.includes('--search');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

const world = buildLevelWorld(levelSource(41), { roles: ROLES, inventory: held });
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

console.log('## the room');
for (const r of L41_PART3.rocks) {
    const solid = world.solids.find((s) => s.rockId === r.id);
    if (!solid) throw new Error(`L41 has no ${r.id}`);
    if (!rockBreaksUnder(solid.rockType, held)) {
        throw new Error(`${r.id} is rockType ${solid.rockType}, unbreakable by this walk`);
    }
    if (solid.persistTag !== r.tag) {
        throw new Error(`${r.id} carries tag ${solid.persistTag}, not ${r.tag}`);
    }
    console.log(`   ${r.id} tag ${solid.persistTag}`);
}
console.log(`   crusher ${L41_PART3.crusher}, block ${L41_PART3.block}`);
console.log(`   ⛓ the doctrine: ${CRUSHER_PLAN.phases.map((p) => p.verb).join(' -> ')}`);
console.log(`   ⛔ ${L41_PART3.flood.crusherHome.nodes} nodes with it home, `
    + `${L41_PART3.flood.crusherParkedWest.nodes} parked — part reachable `
    + `${L41_PART3.flood.crusherHome.partReachable} / `
    + `${L41_PART3.flood.crusherParkedWest.partReachable}`);

/**
 * ⚠ THE BAIT SPANS ARE SEARCHED, NOT GUESSED — and the search is here
 * rather than in the leg because a choreography is a phase-1 artifact
 * (`CRUSHER_PLAN`): it is verified against `stepCrusher` tick by tick, and
 * the winner is banked in `L41_PART3`. `--search` re-runs it.
 */
const centre = (t) => ({ x: t[0] * TILE_SIZE + TILE_SIZE / 2, y: t[1] * TILE_SIZE + TILE_SIZE / 2 });

const legsFor = (baits) => [{
    level: 41,
    targets: [
        { ...centre([12, 5]), equip: { slot: 0 } },
        // ⛔ THE ORDER IS THE ROOM. The rocks SHIELD the crusher, so this
        // swing is what unleashes it — and it is a pair, vertically
        // adjacent, so one slash takes both (§28.6's collateral, named).
        {
            ...centre([12, 5]),
            spear: { rock: { x: 224, y: 80 }, facing: 'E' },
        },
        // ⛓⛓⛓ PHASE 1, THREE TIMES. Each bait is a short choreography
        // whose every tick is simulated by the same `stepCrusher` the run
        // steps, and each asserts a PARK POSITION because phase 2's flood
        // is taken against it.
        { ...centre([12, 5]), bait: baits[0] },
    ],
}];

if (SEARCH) {
    console.log('\n## searching bait 1 — the WEST charge that clears the doorway');
    // The prefix is deterministic, so the search re-drives it each time.
    const prefix = () => {
        const run = createLevelRun({
            levelSource,
            boot: { level: 41, x: 208, y: 80 },
            persistence: [{ level: 41, tag: 1 }, { level: 41, tag: 2 }],
            noDamage: true,
        });
        return run;
    };
    const drive = (run, spans) => {
        for (const s of spans) {
            const k = s.key ? new Set([s.key]) : new Set();
            for (let i = 0; i < s.ticks; i += 1) run.advance(k);
        }
        return run;
    };
    for (let L = 16; L <= 26; L += 1) {
        const run = drive(prefix(), [
            { key: 'left', ticks: L }, { key: 'down', ticks: 40 }, { key: null, ticks: 160 },
        ]);
        const c = [...run.crushers.values()][0];
        if (run.crusherContacts.length === 0 && c.x === 64 && c.y === 80) {
            console.log(`   left ${L} / down 40 -> park (64,80), 0 contacts`);
        }
    }
}

console.log('\n(this script is STEP 2 IN PROGRESS — see §29 for what is driven)');
void legsFor; void synthesizeLegs; void plannerObstacleAt; void runTape; void parseTape;
void serializeTape; void writeFileSync; void WRITE; void checks; void check; void MODULE;
