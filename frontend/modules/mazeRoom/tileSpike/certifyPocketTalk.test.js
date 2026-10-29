/**
 * SPHERE-ORDER-8 (session tile-primitives-sphere-order-8): the two features L58 and L65 brought, on the smallest compiles that
 * have them.
 *   - A TALK is a location (⚖ 2026-10-29 "Talk location + portal door"): the L58 Yeti opens its portal to L46 when its dialogue
 *     ends (`NPCs/Yeti.as:41-49`), started from inside its talk circle (`NPC.as:47,190`, radius 24). The event stands on a tile of
 *     that circle in L58's world, and the portal's cell carries the producer's gate on it.
 *   - The L63/L65 POCKETS (⚖ 2026-10-29 "World doors + framing"): L65 lands in the dead ends below L63's DarkTraps (2,17)/(8,17).
 *     The producer gates those crossings on the poles' light; the world lays the same gates on the exit cells. The certifier prices
 *     excuses a stricter in-world pair at a point no crossing into its member from outside admits (named in `accepted`), and
 *     does not ask an event location at a landing holding its own event (named in `skipped`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze, eventLayerFor } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { talkStances } from '../../flashPanel/seedlingObstacleEvents.js';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const ATLAS = readJson('../../flashPanel/atlases/seedling-playthrough.json');
const YETI = 'L58 flag 1: yeti@56,56 cleared';
const F6 = 'L63 flag 6: lightpole@48,272 cleared';
const F7 = 'L63 flag 7: lightpole@112,272 cleared';
const L65F0 = 'L65 flag 0: lightpole@128,168 cleared';
const F1 = 'L63 flag 1: lightpole@64,88 cleared';
const has = (item_name) => ({ rule: 'Has', args: { item_name } });
// ⛓ RULES l63-pole-crossings: the L65 side of each pocket door has only Ghost Sword swing stances, so its gate is Or(event, the fusion).
const GHOST = { rule: 'And', children: [has('Ghost Sword Fusion'), has('Ghost Spear'), has('Progressive Sword')] };
const payloadOf = (rules, level) => Object.values(rules.preset_sidecars['1'])
    .find((s) => s.playable_payload?.atlas_region === level).playable_payload;
const cellRule = (pp, x, y) => pp.obstacleLib[pp.obstacles.find((o) => o.x === x && o.y === y)?.id]?.clear_rule;

describe('talkStances: the tiles inside an NPC\'s talk circle', () => {
    it('the L58 Yeti (56,56), radius 24: its own 2x2 of tiles, nearest first then row-major', () => {
        // centred on (64,64): the four tile centres around it lie 11.3 px away; the next ring 25.3 px (out)
        expect(talkStances({ x: 56, y: 56 }, { range: 24, tile: 16 })).toEqual([[3, 3], [4, 3], [3, 4], [4, 4]]);
    });
    it('a Statue\'s radius 32 reaches the next ring, and none past it', () => {
        const s = talkStances({ x: 56, y: 56 }, { range: 32, tile: 16 });
        expect(s.slice(0, 4)).toEqual([[3, 3], [4, 3], [3, 4], [4, 4]]);
        expect(s).toHaveLength(12);
        expect(s).not.toContainEqual([1, 1]);
    });
});

describe('the L58 Yeti talk in the maze (L57 + L58)', () => {
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_57', 'level_58'] }).text);

    it('its event is a location on its talk circle\'s first tile in its side (r3c3), granting the event', () => {
        expect(payloadOf(RULES, 'level_58').items).toEqual([{ x: 3, y: 3, id: YETI, locationName: YETI }]);
        expect(RULES.preset_sidecars['1'].level_58__r3c3.shared_world).toBe('level_58');
    });

    it('the producer\'s talk gate on the portal is laid only when its exit is wired (L46 listed) — a door named for the event', () => {
        expect(eventLayerFor(ATLAS, ['level_57', 'level_58']).world.filter((w) => w.mode === 'door')).toEqual([]);
        const doors = eventLayerFor(ATLAS, ['level_46', 'level_57', 'level_58']).world.filter((w) => w.mode === 'door');
        expect(doors).toEqual([{ name: YETI, side: null, mode: 'door', door: { level: 58, exit_id: 'out_teleporter_80_16' }, rule: null, gate: has(YETI) }]);
    });

    it('certifies clean: the talk location is priced (main: "not priced — the maze world cannot produce it (a talk)")', () => {
        const regions = Object.keys(RULES.preset_sidecars['1']).filter((n) => n.startsWith('level_58'));
        const out = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, regions });
        expect(out.problems).toEqual([]);
        // r3c3 is entered only by walking in (internal-only), so it is priced from the rooted member r4c1
        expect(out.lines).toContain(`level_58__r3c3@${YETI}<level_58__r4c1=[["Progressive Swim"]]`);
    }, 120_000);
});

// ⛓ RULES l63-pole-crossings: r6c9 -> r0c1 also costs L63 flag 1 (the spear block parks on darktrap@64,96 unlit), whose pole L61's
// press lights — so the smallest compile with the pockets lists L61 (L63 + L65 alone is refused by name, `certifyEventLocations`).
describe('the L63/L65 pocket landings (L61 + L63 + L65)', () => {
    const RULES = JSON.parse(buildPlaythroughMaze({ levels: ['level_61', 'level_63', 'level_65'] }).text);
    const run = (rules) => certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS });

    it('the world lays the producer\'s in-room-pole gates on both pockets\' exit cells, the rule as it stands', () => {
        const l65 = payloadOf(RULES, 'level_65');
        expect(cellRule(l65, 2, 0)).toEqual({ rule: 'Or', children: [has(F6), GHOST] });
        expect(cellRule(l65, 8, 0)).toEqual({ rule: 'And', children: [
            { rule: 'Or', children: [has(F7), GHOST] }, { rule: 'Or', children: [has(L65F0), has('Ghost Spear')] }] });
        const l63 = payloadOf(RULES, 'level_63');
        expect(cellRule(l63, 2, 19)).toEqual({ rule: 'Or', children: [has(F6), has('Ghost Spear')] });
        expect(cellRule(l63, 8, 19)).toEqual({ rule: 'And', children: [
            { rule: 'Or', children: [has(F7), has('Ghost Spear')] }, { rule: 'Or', children: [has(L65F0), has('Ghost Spear')] }] });
    });

    // ⛓ RULES l63-pole-crossings: main's one problem here (r6c9 → r10c2 [Ghost Spear, f7] derived false) now AGREES — both sides
    // cost f1 — and the named problem is its mirror, the ACCEPTED framing row (design-2): r6c9's world entrance is the L65 pocket cell (8,19), so
    // the maze charges f7 (or the swing) to leave it; its witness pushes the block from (7,6) to (5,6), where it stops at the dark
    // trap (4,6), and stands on (6,6) — a cell of the 3-cell dead end the partition gives r0c1. The game agrees (the probe's
    // east-no-f1 tape: the block halts on [5,6]); the AP crossing into r0c1 proper still needs f1.
    it('one named problem (r0c1 is entered on its dead end, east of the parked block); the pocket rows are excused or skipped by name', () => {
        const out = run(RULES);
        expect(out.problems).toEqual([
            `level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,${F7}]: derived true, atlas false`,
        ]);
        const fresh = 'no AP crossing into level_63__r6c9 from outside its world admits this arrival';
        const excused = out.accepted.filter((a) => a.by === fresh).map((a) => a.label).sort();
        expect(excused).toEqual([
            'level_63__r5c14 @ Level 063 - Chest (from level_63__r6c9)', 'level_63__r6c9 → level_63__r10c2',
            'level_63__r6c9 → level_63__r5c14', 'level_63__r6c9 → level_63__r6c15',
        ]);
        const named = (label, why) => out.skipped.some((k) => k.label === label && (k.why ?? null) === why);
        expect(named(`level_63__r6c9 @ ${F7} (landing 8,18)`, 'own event')).toBe(true);
        expect(named(`level_63__r10c2 @ ${F6} (landing 2,18)`, 'own event')).toBe(true);
    }, 180_000);

    it('mutant: admit the pocket crossing free and the pocket arrival\'s pairs are problems again (the excuse is the admission)', () => {
        const copy = structuredClone(RULES);
        copy.regions['1'].level_65__r0c8.exits.find((e) => e.connected_region === 'level_63__r6c9').access_rule = { rule: 'True_' };
        const { problems } = run(copy);
        expect(problems).toContain(`level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,${F1}]: derived false, atlas true`);
    }, 180_000);
});
