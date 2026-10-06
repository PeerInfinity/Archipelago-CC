/**
 * ⛓ RULES game-truth-gaps (R2) — a landing on LETHAL TERRAIN costs the item that survives it. The fresh
 * derivation (`playthroughLandingGates`) gates every landing edge the physics model kills an item-less arrival
 * on, and the committed rules carry exactly those gates; the model's two exemptions hold by name (a landing
 * the body walks off, a departure that already asks for the item); and the oracle's own verdicts on the two
 * shapes: the L49/L50 water doors (back out through the door is no survival) and L54's shore (left onto land).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
    buildPlaythroughAtlas, setPlaythroughLandingAtlas, playthroughLandingGates, lethalLandings, PLAYTHROUGH_MAP,
} from './make-seedling-playthrough-rules.mjs';
import { arrivalIsLethal, lethalTerrainUnder } from '../../frontend/modules/seedlingDemo/seedlingLethalArrivals.js';
import { levelSourceFromAtlas } from '../../frontend/modules/seedlingDemo/atlasSource.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const levelOf = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const levelSource = levelSourceFromAtlas(PLAYTHROUGH_MAP);
const SWIM = { rule: 'Has', args: { item_name: 'Progressive Swim' } };

/** The AP exit a departure endpoint wires, by the atlas door's level numbers. */
const apExitsInto = (fromLevel, toLevel) => Object.entries(RULES.regions['1']).flatMap(([from, r]) => r.exits
    .filter((e) => from.startsWith(`level_${fromLevel}`) && e.connected_region.startsWith(`level_${toLevel}`))
    .map((e) => ({ from, ...e })));
const requires = (rule, gate) => JSON.stringify(rule) === JSON.stringify(gate)
    || (rule?.rule === 'And' && rule.children.some((c) => requires(c, gate)));

let gates;
let atlas;
beforeAll(() => {
    atlas = buildPlaythroughAtlas();
    setPlaythroughLandingAtlas(atlas);
    gates = playthroughLandingGates(atlas);
}, 300_000);

describe('landings on lethal terrain', () => {
    it('every gate is a departure the committed rules charge its terrain\'s item', () => {
        expect(gates.length).toBeGreaterThan(0);
        for (const g of gates) {
            const toLevel = Number(/-> L(\d+)/.exec(lethalLandings.find((l) => l.where.startsWith(`${g.region_id}/${g.exit_id} `)).where)[1]);
            const exits = apExitsInto(Number(/^level_(\d+)/.exec(g.region_id)[1]), toLevel);
            expect(exits.length, `${g.region_id}/${g.exit_id}`).toBeGreaterThan(0);
            for (const e of exits.filter((x) => x.from.startsWith(g.region_id))) {
                expect(requires(e.access_rule, g.rule), `${e.from} -> ${e.connected_region}`).toBe(true);
            }
        }
    });

    it('the R2 water doors are gated on Swim, both ways where both land in water', () => {
        const gated = new Set(gates.filter((g) => JSON.stringify(g.rule) === JSON.stringify(SWIM)).map((g) => `${g.region_id}/${g.exit_id}`));
        for (const door of ['level_49/out_teleporter_32_128', 'level_50/out_teleporter_32_0', 'level_50/out_teleporter_48_304',
            'level_51/out_teleporter_144_0', 'level_53/out_teleporter_208_64', 'level_0/out_teleporter_240_0',
            'level_89/out_teleporter_160_304', 'level_111/out_teleporter_304_176', 'level_113/out_teleporter_112_0',
            'level_113/out_teleporter_128_0']) {
            expect(gated.has(door), door).toBe(true);
        }
    });

    it('the exemptions hold by name: a shore the body walks off, a departure that already asks for the item', () => {
        const row = (prefix) => lethalLandings.find((l) => l.where.startsWith(prefix));
        expect(row('level_53/out_teleporter_144_240 ')).toMatchObject({ gated: false });
        expect(row('level_53/out_teleporter_144_240 ').why).toMatch(/walks off/);
        expect(row('level_96/out_teleporter_32_64 ')).toMatchObject({ gated: false });
        expect(row('level_96/out_teleporter_32_64 ').why).toMatch(/already requires/);
        // ⛓ the L57 lift: the mouth's landing in L58 is a shore too (the body walks west onto land).
        expect(row('level_57/out_tentaclebeast_80_48 ')).toMatchObject({ gated: false });
        expect(row('level_57/out_tentaclebeast_80_48 ').why).toMatch(/walks off/);
        expect(lethalLandings.filter((l) => !l.gated).map((l) => l.where.split(' ')[0]).sort()).toEqual([
            'level_53/out_teleporter_144_240', 'level_57/out_tentaclebeast_80_48', 'level_96/out_teleporter_32_64']);
    });
});

/**
 * ⛓ RULES game-truth-gaps — the L57 lift (⚖ the user, 2026-10-06: "lift L57 like L82"), on the FRESH derivation:
 * the death-spawned mouth is wired from the manifest at the AS3's own door, and every connection into or out of
 * the arena carries the kill.
 */
describe('the L57 arena (a fresh derivation)', () => {
    const KILL = { rule: 'Or', children: ['Progressive Sword', 'Ghost Spear', 'Wand'].map((item_name) => ({ rule: 'Has', args: { item_name } })) };
    it('wires L56\'s pit, L58\'s two doors and the mouth, each charged the kill', () => {
        const conns = atlas.vanilla_layout.connections.filter((c) => c.from[0] === 'level_57' || c.to[0] === 'level_57');
        expect(conns.map((c) => `${c.from.join('/')} -> ${c.to[0]}`).sort()).toEqual([
            'level_56/out_pit_6_10 -> level_57', 'level_57/out_tentaclebeast_80_48 -> level_58',
            'level_58/out_teleporter_48_112 -> level_57', 'level_58/out_teleporter_64_112 -> level_57']);
        for (const c of conns) {
            const exit = atlas.regions.find((r) => r.region_id === c.from[0]).exits.find((e) => e.exit_id === c.from[1]);
            expect(requires(exit.access_rule, KILL), c.from.join('/')).toBe(true);
        }
    });

    it('the mouth stands where the AS3 puts it: the beast\'s (80,48) + (16,16) = tile (6,4)', () => {
        const mouth = atlas.regions.find((r) => r.region_id === 'level_57').exits.find((e) => e.exit_id === 'out_tentaclebeast_80_48');
        expect(mouth.entrance_tile).toEqual([6, 4]);
    });
});

describe('the oracle', () => {
    it('L50 (32,16): water, and every input dies or goes back up to L49 — lethal', () => {
        expect(lethalTerrainUnder(levelOf(50), 32, 16)).toMatchObject({ tile: [2, 1] });
        const v = arrivalIsLethal(levelOf(50), 32, 16, { levelSource, cameFrom: 49 });
        expect(v.lethal).toBe(true);
        expect(v.tries).toContain('up:left->L49@7');
    });

    it('the same landing reached from ANOTHER level is not lethal: leaving to L49 is then an escape', () => {
        expect(arrivalIsLethal(levelOf(50), 32, 16, { levelSource, cameFrom: 51 }).lethal).toBe(false);
    });

    it('L54 (144,16): water, but holding left walks onto land — not lethal', () => {
        expect(lethalTerrainUnder(levelOf(54), 144, 16)).not.toBeNull();
        const v = arrivalIsLethal(levelOf(54), 144, 16, { levelSource, cameFrom: 53 });
        expect(v.lethal).toBe(false);
        expect(v.tries).toContain('left:alive');
    });

    it('a dry landing is no lethal terrain at all (L0\'s start (80,128))', () => {
        expect(lethalTerrainUnder(levelOf(0), 80, 128)).toBeNull();
    });
});
