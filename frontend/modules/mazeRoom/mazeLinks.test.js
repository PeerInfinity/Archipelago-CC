/**
 * MAZE LINK WIRES (maze lab step 3): `mazeLinks.linkGroups` reads a room's token wires (presser → responder) from the
 * token fields only, and `linkShapes` turns them into `editorView` shapes (E2's bipartite star + a dangling mark).
 *
 * Driven over the committed `seedling_playthrough_maze` preset as the lab loads it (`loadPayload`, the route the
 * overlay draws on), plus synthetic rooms for the rules the preset does not exercise. The census numbers (33 groups,
 * 76 members, 13 dangling) are the maze link census's, re-measured by step 1's test-local reader.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateStep, loadPayload } from './mazeLab.js';
import { posKey } from './mazeRoomEngine.js';
import { assertShape } from '../procgenCore/editorView.js';
import { describeLinkGroups, linkGroups, linkShapes } from './mazeLinks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const RULES = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const ROOMS = Object.entries(RULES.preset_sidecars['1']).filter(([, s]) => s.playable_payload !== undefined);
const world = (key) => loadPayload(ROOMS.find(([k]) => k === key)[1]).record;
const ALL = ROOMS.map(([k, s]) => [k, linkGroups(loadPayload(s).record)]);

const tally = (groups) => {
    const out = { groups: 0, members: 0, noResponder: 0, noPresser: 0 };
    for (const g of groups) {
        out.groups += 1;
        out.members += g.pressers.length + g.responders.length;
        if (g.missing === 'responder') out.noResponder += 1;
        if (g.missing === 'presser') out.noPresser += 1;
    }
    return out;
};

/** A tiny synthetic room in the engine's own shapes (Maps of `"x,y"` → id). */
const synth = ({ buttons = {}, obstacles = {}, buttonLib = {}, obstacleLib = {}, traps, trapLib, pulsers } = {}) => ({
    width: 6, height: 6,
    buttons: new Map(Object.entries(buttons)),
    obstacles: new Map(Object.entries(obstacles)),
    buttonLib, obstacleLib, traps, trapLib, pulsers,
});

describe('maze link wires: the preset census', () => {
    it('over every room of the converted preset, as the lab loads it, the census groups / members / dangling hold', () => {
        const sum = tally(ALL.flatMap(([, g]) => g));
        expect(sum).toEqual({ groups: 33, members: 76, noResponder: 13, noPresser: 0 });
    });
    it('the member kinds are the census table\'s: buttons, latching buttons, ropes, poles press; doors, traps, rope/pole self-gates respond', () => {
        const kinds = {};
        for (const [, gs] of ALL) for (const g of gs) {
            for (const p of g.pressers) kinds[`P:${p.kind}`] = (kinds[`P:${p.kind}`] ?? 0) + 1;
            for (const r of g.responders) kinds[`R:${r.kind}`] = (kinds[`R:${r.kind}`] ?? 0) + 1;
        }
        expect(kinds).toEqual({
            'P:button': 24, 'P:latch': 4, 'P:rope': 6, 'P:pole': 7, 'R:door': 11, 'R:trap': 11, 'R:rope': 6, 'R:pole': 7,
        });
    });
    it('the dangling tokens are named per room (L28, L38, L39 ×6, L40 ×3, L41 ×2)', () => {
        const dangling = ALL.map(([k, gs]) => [k, gs.filter((g) => g.dangling).map((g) => g.token)]).filter(([, t]) => t.length);
        expect(dangling).toEqual([
            ['level_28__r0c6', ['sw_0']], ['level_38__r0c9', ['sw_0']], // ⛓ rules-ap-chest-solid: L38 split, its upper half carries the world
            ['level_39__r0c9', ['sw_0', 'sw_1', 'sw_2', 'sw_3', 'sw_4', 'sw_5']],
            ['level_40__r0c53', ['sw_2', 'sw_4', 'sw_5']], ['level_41__r4c3', ['sw_0', 'sw_1']],
        ]);
    });
    it('every shape over the preset is one editorView accepts, and their total is measured', () => {
        const shapes = ALL.flatMap(([, g]) => linkShapes(g));
        for (const s of shapes) assertShape(s, 'a maze link shape');
        expect(shapes.length).toBe(74);
    });
});

describe('maze link wires: one room at a time', () => {
    it('the 4-trap room: one button wired to four traps = four arrowed polylines from the button', () => {
        const groups = linkGroups(world('level_5__r1c1'));
        expect(groups.map((g) => [g.token, g.pressers.length, g.responders.map((r) => r.kind)])).toEqual([
            ['sw_0', 1, ['trap', 'trap', 'trap', 'trap']],
        ]);
        const shapes = linkShapes(groups);
        const b = groups[0].pressers[0];
        expect(shapes).toHaveLength(4);
        expect(shapes.every((s) => s.kind === 'polyline' && s.arrow === true && !s.highlight
            && s.points[0].x === b.x + 0.5 && s.points[0].y === b.y + 0.5)).toBe(true);
    });
    it('a door room: the button\'s arrow ends on the door cell', () => {
        const groups = linkGroups(world('level_15__r1c5'));
        expect(groups).toHaveLength(1);
        const [g] = groups;
        expect(g.responders.map((r) => r.kind)).toEqual(['door']);
        expect(linkShapes(groups)).toEqual([{
            kind: 'polyline', arrow: true,
            points: [{ x: g.pressers[0].x + 0.5, y: g.pressers[0].y + 0.5 }, { x: g.responders[0].x + 0.5, y: g.responders[0].y + 0.5 }],
        }]);
    });
    it('a dangling room: each dangling button gets a highlighted X labelled with its token; the sentence names what is missing', () => {
        const groups = linkGroups(world('level_39__r0c9'));
        const shapes = linkShapes(groups);
        expect(shapes).toHaveLength(12);
        expect(shapes.every((s) => s.highlight === true && !s.arrow)).toBe(true);
        expect(shapes.filter((s) => s.label).map((s) => s.label)).toEqual(['sw_0', 'sw_1', 'sw_2', 'sw_3', 'sw_4', 'sw_5']);
        expect(describeLinkGroups(groups)).toMatch(/^6 wire group\(s\), 6 member\(s\) — dangling: sw_0: drives nothing/);
    });
    it('a pole that gates itself draws no self-edge (L62: one group, presser = responder, no shape)', () => {
        const groups = linkGroups(world('level_62'));
        expect(groups.map((g) => [g.pressers.length, g.responders.length, g.dangling])).toEqual([[1, 1, false]]);
        expect(linkShapes(groups)).toEqual([]);
    });
    it('a generated maze has no wires and says so', () => {
        for (const seed of [1, 7]) {
            const { record } = generateStep({ seed, step: 3 });
            expect(linkGroups(record)).toEqual([]);
            expect(linkShapes(linkGroups(record))).toEqual([]);
        }
        expect(describeLinkGroups([])).toMatch(/^no wired buttons in this room/);
    });
});

describe('maze link wires: what is NOT a wire, and the rules the preset does not exercise', () => {
    const button = { buttons: { [posKey(1, 1)]: 'b0' }, buttonLib: { b0: { kind: 'button', holds: 'sw_0' } } };
    it('a KEY door (a one-item set naming a key nobody presses) is a colour-class rule, never a group', () => {
        const w = synth({ obstacles: { [posKey(3, 3)]: 'door_red' }, obstacleLib: { door_red: { clear_set: [['key_red']] } } });
        expect(linkGroups(w)).toEqual([]);
    });
    it('rock entries are ignored whatever their shape (design-5 reshapes rock ids and `struck_from`)', () => {
        const base = synth({ ...button, obstacles: { [posKey(3, 3)]: 'lock' }, obstacleLib: { lock: { clear_set: [['sw_0']] } } });
        const withRocks = synth({
            ...button,
            obstacles: { [posKey(3, 3)]: 'lock', [posKey(4, 4)]: 'rock_4_4', [posKey(2, 4)]: 'rock_sword_spear' },
            obstacleLib: {
                lock: { clear_set: [['sw_0']] },
                rock_4_4: { kind: 'rock', at: [4, 4], struck_by: ['sword'], struck_from: { sword: ['n', 's'], fire: ['any'] }, clear_set: [['Sword'], ['Fire']] },
                rock_sword_spear: { kind: 'rock', struck_from: 'adjacent', unknown_key: 1, clear_set: [['Sword', 'Spear']] },
            },
        });
        expect(linkGroups(withRocks)).toEqual(linkGroups(base));
        expect(linkGroups(base).map((g) => g.responders.length)).toEqual([1]);
    });
    it('a door whose `clear_rule` is exactly Has(token) responds; Has(another item), a compound rule or a Count does not', () => {
        const w = synth({
            ...button,
            obstacles: { [posKey(3, 3)]: 'd1', [posKey(4, 3)]: 'd2', [posKey(5, 3)]: 'd3', [posKey(5, 4)]: 'd4' },
            obstacleLib: {
                d1: { clear_set_type: 'rule', clear_rule: { rule: 'Has', args: { item_name: 'sw_0' } } },
                d2: { clear_set_type: 'rule', clear_rule: { rule: 'Has', args: { item_name: 'Sword' } } },
                d3: { clear_set_type: 'rule', clear_rule: { rule: 'And', children: [{ rule: 'Has', args: { item_name: 'sw_0' } }] } },
                d4: { clear_set_type: 'rule', clear_rule: { rule: 'Count', args: { item_name: 'sw_0', count: 2 } } },
            },
        });
        expect(linkGroups(w).map((g) => g.responders.map((r) => [r.x, r.y, r.kind]))).toEqual([[[3, 3, 'door']]]);
    });
    it('a trap or pulser nothing presses is dangling the other way, and the sentence says so', () => {
        const w = synth({
            traps: [{ x: 2, y: 2, id: 't', lane: [] }], trapLib: { t: { active: 'sw_9' } },
            pulsers: [{ x: 4, y: 4, token: 'sw_8', reach: [] }],
        });
        const groups = linkGroups(w);
        expect(groups.map((g) => [g.token, g.missing])).toEqual([['sw_8', 'presser'], ['sw_9', 'presser']]);
        expect(linkShapes(groups).filter((s) => s.label).map((s) => s.label)).toEqual(['sw_8', 'sw_9']);
        expect(describeLinkGroups(groups)).toMatch(/sw_8: nothing in this room presses it; sw_9: nothing in this room presses it$/);
    });
    it('a latching button is kind `latch`; the order is row-major and the groups sort by token', () => {
        const w = synth({
            buttons: { [posKey(4, 1)]: 'b1', [posKey(1, 2)]: 'b0', [posKey(0, 1)]: 'b2' },
            buttonLib: { b0: { holds: 'sw_1' }, b1: { holds: 'sw_0', latch: { event: 'E' } }, b2: { holds: 'sw_1' } },
        });
        expect(linkGroups(w).map((g) => [g.token, g.pressers.map((p) => [p.x, p.y, p.kind])])).toEqual([
            ['sw_0', [[4, 1, 'latch']]], ['sw_1', [[0, 1, 'button'], [1, 2, 'button']]],
        ]);
    });
});
