/**
 * ⛓ RULES game-truth-gaps (R2) — a landing on LETHAL TERRAIN costs the item that survives it. The fresh
 * derivation (`playthroughLandingGates`) gates every landing edge the physics model kills an item-less IDLE
 * arrival on, and the committed rules carry exactly those gates; the one exemption holds by name (a departure
 * that already asks for the item); and the oracle's own verdicts. ⚖ Game truth first (2026-10-06): the
 * walk-off exemption is gone — the wasm game drowns L54 (144,16) and the mouth's L58 landing under the input
 * the model said walks off (`probe-seedling-lethal-landings.mjs`).
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

    it('the one exemption holds by name: a departure that already asks for the item (L96 into the lava)', () => {
        const row = (prefix) => lethalLandings.find((l) => l.where.startsWith(prefix));
        expect(row('level_96/out_teleporter_32_64 ')).toMatchObject({ gated: false });
        expect(row('level_96/out_teleporter_32_64 ').why).toMatch(/already requires/);
        expect(lethalLandings.filter((l) => !l.gated).map((l) => l.where.split(' ')[0])).toEqual(['level_96/out_teleporter_32_64']);
    });

    it('⚖ game truth first: the shores the model walked off are gated (L53 -> L54 (144,16), the mouth -> L58)', () => {
        const gated = new Set(gates.map((g) => `${g.region_id}/${g.exit_id}`));
        expect(gated.has('level_53/out_teleporter_144_240')).toBe(true);
        expect(gated.has('level_57/out_tentaclebeast_80_48')).toBe(true);
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
    it('L50 (32,16): water, and an idle item-less arrival drowns (the model\'s die@31 = the game\'s ~31-tick restarts)', () => {
        expect(lethalTerrainUnder(levelOf(50), 32, 16)).toMatchObject({ tile: [2, 1] });
        expect(arrivalIsLethal(levelOf(50), 32, 16, { levelSource })).toEqual({ lethal: true, outcome: 'die@31:drown' });
    });

    it('L54 (144,16): idle, it drowns too — the shore beside it is no exemption any more', () => {
        expect(lethalTerrainUnder(levelOf(54), 144, 16)).not.toBeNull();
        expect(arrivalIsLethal(levelOf(54), 144, 16, { levelSource }).lethal).toBe(true);
    });

    it('a dry landing is no lethal terrain at all (L0\'s start (80,128))', () => {
        expect(lethalTerrainUnder(levelOf(0), 80, 128)).toBeNull();
    });
});
