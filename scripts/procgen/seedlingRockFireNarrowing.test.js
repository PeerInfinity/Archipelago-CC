/**
 * ⛓⛓ tile-fire-breaks-rocks — THE FIRE ARM DOES NOT COUNT WHERE A PARKED HOLDER NEEDS A KILL. ⚖ Robert 2026-11-12, to
 * rules-6: "Narrow it generally (Recommended)". The flame does no damage (`Player.as:178` `fireDamage = 0`), so where the
 * block-stopper census's own holder verdict says a settling body parked on a holder block's route needs a kill, the rocks
 * whose Fire that lock entry's price came from lose their flame stances (`make-seedling-playthrough-rules.rockFireSides`),
 * in the rules AND in the maze (one map: `playthroughRockFireSides`).
 *
 * MUTATIONS (each reds the named row):
 *   m1 `narrowRockFireByHolders` returns `raw` unchanged     -> "no holder entry a parked kill-needing body holds carries
 *                                                               Fire" and "L16's lock crossing is the swing's"
 *   m2 the culprit re-price dropped (narrow every room rock) -> "only the rocks the entry's Fire came from"
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    PLAYTHROUGH_MAP, playthroughGridFor, playthroughEntitySemantics, playthroughRockFireSides, rockFireNarrowings,
} from './make-seedling-playthrough-rules.mjs';
import * as HP from './seedlingHolderParking.js';
import { buildBlockHolders } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const SIDES = playthroughRockFireSides();
const HOLDERS = buildBlockHolders(PLAYTHROUGH_MAP);
const hasFire = (dnf) => Array.isArray(dnf) && dnf.some((t) => t.split(' & ').includes('flag:hasFire'));

/** The census's holder verdict rows at this tip, for every decided holder room with a killable body on a block's route. */
const verdicts = () => PLAYTHROUGH_MAP.levels.filter((l) => HOLDERS.has(l.level)).flatMap((level) => {
    const grid = playthroughGridFor(level);
    const tileTypes = HP.tileTypesOf(level, grid.width);
    const bodies = HP.holderRoomBodies(level, grid, tileTypes);
    return (HP.holderParkVerdicts(level, { grid, tileTypes, heldBy: HOLDERS.get(level.level), bodies, entitySemantics: playthroughEntitySemantics }) ?? [])
        .map((r) => ({ level: level.level, ...r }));
});

describe('the narrowing reads the census\'s own holder verdict', () => {
    it('no holder entry a parked kill-needing body holds carries Fire, and the census reads no TIGHTER row', () => {
        const rows = verdicts();
        expect(rows.length > 0).toBe(true);
        expect(rows.filter((r) => r.holderVerdict === 'TIGHTER').map((r) => `L${r.level} ${r.body}`)).toEqual([]);
        for (const r of rows.filter((x) => x.settles)) {
            for (const [entry, price] of Object.entries(r.prices)) expect(hasFire(price), `L${r.level} ${r.body} ${entry}`).toBe(false);
        }
    });

    it('only the rocks the entry\'s Fire came from lose their flame stances; every other rock keeps them', () => {
        expect(rockFireNarrowings.length > 0).toBe(true);
        const narrowed = new Set(rockFireNarrowings.map((n) => n.rock));
        for (const key of narrowed) {
            expect(SIDES.get(key).stances, key).toEqual([]);
            expect(SIDES.get(key).narrowed?.entry, key).toBeTruthy();
        }
        // a narrowing names a rock in a decided holder room, never a level by literal
        for (const n of rockFireNarrowings) expect(HOLDERS.has(n.level), n.rock).toBe(true);
        // the room's other rocks keep their flame (the narrowing is per crossing, not per room)
        const sameRoom = [...SIDES].filter(([k, r]) => !narrowed.has(k) && rockFireNarrowings.some((n) => n.level === r.level));
        expect(sameRoom.some(([, r]) => r.stances.length > 0)).toBe(true);
    });
});

describe('the rules and the maze read one map', () => {
    const ruleOf = (rules, from, to) => rules.regions['1'][from].exits.find((e) => e.connected_region === to)?.access_rule;
    it("L16's lock crossing is the swing's in AP_1, seedling_er and the maze preset (no Fire anywhere in it)", () => {
        for (const preset of ['seedling_playthrough', 'seedling_er', 'seedling_playthrough_maze']) {
            const rules = read(`frontend/presets/${preset}/AP_1/AP_1_rules.json`);
            expect(JSON.stringify(ruleOf(rules, 'level_16__r1c9', 'level_16__r4c21')), preset).not.toContain('"Fire"');
        }
    });

    it('the maze world has no Fire stance on a narrowed rock, and keeps it on the others', () => {
        const maze = read('frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json').preset_sidecars['1'];
        for (const n of rockFireNarrowings) {
            const [x, y] = SIDES.get(n.rock).tiles[0];
            const payload = Object.values(maze).find((sc) => sc.playable_payload?.atlas_region === `level_${n.level}`)?.playable_payload;
            const id = payload.obstacles.find((o) => o.x === x && o.y === y)?.id;
            expect(payload.obstacleLib[id]?.kind, n.rock).toBe('rock');
            expect(payload.obstacleLib[id].struck_by, n.rock).not.toContain('fire');
            expect(payload.obstacleLib[id].struck_from, n.rock).toBeUndefined();
        }
        const stanced = Object.values(maze).flatMap((sc) => Object.values(sc.playable_payload?.obstacleLib ?? {}))
            .filter((e) => e.kind === 'rock' && e.struck_from?.fire);
        expect(stanced.length > 0).toBe(true);
    });
});
