/**
 * The divergence sweep's CI shape (⚖ user, 2026-10-05, via planner-3: the live sweep runs in CI, SHARDED, off the
 * box): the partition covers every leg exactly once and deterministically, a location page takes one arrival per
 * location, and `.github/workflows/seedling-divergence-sweep.yml` is `workflow_dispatch` ONLY (a `push:` would spend
 * ten browser shards on every commit).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { heldFlags, legPrice, orderLegs, partitionLegs } from './probe-seedling-divergence-sweep.mjs';
import { withStagedFlags } from './seedling-divergence-bare.mjs';
import { triggersOf } from './seedlingFullTierWorkflow.test.js';
import { slotBlockOf, withSlotBlock } from './seedlingRoomPlay.js';
import { refuseRetiredTopLevelKeys } from '../../frontend/modules/stateManager/core/initialization.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const exit = (id, level, sphere = 0) => ({ id, level, goal: { kind: 'exit', name: `x${id}` }, sphere: { index: sphere } });
const loc = (id, level, name, sphere = 0) => ({ id, level, goal: { kind: 'location', name }, sphere: { index: sphere } });

describe('partitionLegs', () => {
    const area = (level) => (level === 9 ? 3000 : 200);
    const legs = [
        ...Array.from({ length: 40 }, (_, i) => exit(i, i % 5)),
        exit(40, 9), exit(41, 9), exit(42, 9),
        loc(43, 1, 'A'), loc(44, 1, 'A'), loc(45, 2, 'B'),
    ];

    it('covers every leg exactly once, into exactly n shards', () => {
        const shards = partitionLegs(legs, 4, area);
        expect(shards.map((s) => s.shard)).toEqual([1, 2, 3, 4]);
        const ids = shards.flatMap((s) => s.ids);
        expect(ids.length).toBe(legs.length);
        expect(new Set(ids).size).toBe(legs.length);
    });

    it('is deterministic (the plan job and every shard derive the same split)', () => {
        expect(partitionLegs(legs, 4, area)).toEqual(partitionLegs([...legs].reverse(), 4, area));
    });

    it('spreads the priciest legs: the three big-room legs land in three different shards', () => {
        const shards = partitionLegs(legs, 4, area);
        const holding = [40, 41, 42].map((id) => shards.findIndex((s) => s.ids.includes(id)));
        expect(new Set(holding).size).toBe(3);
        expect(legPrice(legs[40], area)).toBeGreaterThan(legPrice(legs[0], area));
    });

    it('n larger than the legs leaves empty shards, never a lost leg', () => {
        const shards = partitionLegs(legs.slice(0, 2), 4, area);
        expect(shards.flatMap((s) => s.ids).sort()).toEqual([0, 1]);
        expect(shards.filter((s) => s.ids.length === 0).length).toBe(2);
    });
});

describe('orderLegs', () => {
    it('a location page takes ONE arrival per location (an opened check stays open for the session)', () => {
        const pages = orderLegs([exit(0, 1), loc(1, 1, 'A'), loc(2, 1, 'A'), loc(3, 2, 'B')], 'inv', 60);
        expect(pages.map((p) => p.map((l) => l.id))).toEqual([[0], [1, 3], [2]]);
    });

    it('--page-legs=1 puts EVERY leg on its own page, location rounds included (one clean game per leg)', () => {
        const pages = orderLegs([exit(0, 1), loc(1, 1, 'A'), loc(2, 2, 'B'), loc(3, 1, 'A')], 'inv', 1);
        expect(pages.map((p) => p.map((l) => l.id))).toEqual([[0], [1], [2], [3]]);
    });

    it('inv mode orders the exits by sphere (the grants only ever grow)', () => {
        const pages = orderLegs([exit(0, 1, 5), exit(1, 1, 0), exit(2, 1, 2)], 'inv', 60);
        expect(pages[0].map((l) => l.id)).toEqual([1, 2, 0]);
    });
});

describe('event STAGING — a staged flag outlives its leg in the game', () => {
    const staged = (l) => ({ ...l, stagedEvents: [{ eventId: 'flag:L0:1', level: 0, tag: 1, otherLevel: false }] });
    it('a leg that stages flags is a page of its OWN, whatever --page-legs (no later leg inherits its flags)', () => {
        const legs = [exit(0, 1), staged(exit(1, 0, 3)), exit(2, 1), staged(loc(3, 0, 'A', 1)), loc(4, 2, 'B')];
        const pages = orderLegs(legs, 'inv', 60);
        expect(pages.map((p) => p.map((l) => l.id))).toEqual([[0, 2], [4], [3], [1]]);
        expect(orderLegs(legs.filter((l) => !l.stagedEvents), 'inv', 60).map((p) => p.map((l) => l.id))).toEqual([[0, 2], [4]]);
    });
    it('heldFlags reads the game\'s persistence_cleared (string or number fields) — a flag not there is MISSING', () => {
        const flags = [{ eventId: 'flag:L12:7', level: 12, tag: 7 }, { eventId: 'flag:L12:12', level: 12, tag: 12 }];
        expect(heldFlags(flags, [{ level: '12', tag: '7' }, { level: 12, tag: 12 }])).toEqual({ held: ['flag:L12:7', 'flag:L12:12'], missing: [] });
        expect(heldFlags(flags, [{ level: 12, tag: 7 }, { level: 3, tag: 12 }])).toEqual({ held: ['flag:L12:7'], missing: ['flag:L12:12'] });
        expect(heldFlags(flags, undefined).missing).toHaveLength(2);
    });
    it('the bare pass adds the flags to the staging\'s persistence (sorted, deduplicated) and changes nothing else', () => {
        const s0 = { boot: { level: 0, x: 1, y: 2 }, persistence: [{ level: 3, tag: 0 }, { level: 0, tag: 1 }], save: { keys: [] } };
        const s1 = withStagedFlags(s0, [{ eventId: 'flag:L0:1', level: 0, tag: 1 }, { eventId: 'flag:L12:7', level: 12, tag: 7 }]);
        expect(s1.persistence).toEqual([{ level: 0, tag: 1 }, { level: 3, tag: 0 }, { level: 12, tag: 7 }]);
        expect({ ...s1, persistence: s0.persistence }).toEqual(s0);
        expect(s0.persistence).toHaveLength(2);
    });
});

describe('seedling-divergence-sweep.yml', () => {
    const text = readFileSync(join(REPO, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');

    it('its only trigger is workflow_dispatch', () => {
        expect(triggersOf(text)).toEqual(['workflow_dispatch']);
    });

    it('the shard timeout and the leg count are DERIVED by the plan job, never typed', () => {
        expect(text).toMatch(/timeout-minutes: \$\{\{ fromJSON\(needs\.plan\.outputs\.timeout\) \}\}/);
        expect(text).toMatch(/LEGS: \$\{\{ needs\.plan\.outputs\.legs \}\}/);
    });
});

/**
 * ⛓ F2 (the rules arc's per-player blocks): `--page=<build>` re-points the preset's `flash_panel.wasm` in the
 * rules the page fetches. It must write INTO the one slot — a document-level `flash_panel` beside the slot map is
 * the retired shape the loader refuses by name, so a non-preset `--page` run would fail to boot (found at the
 * wave-6 harvest; both probes that route a build share `withSlotBlock`).
 */
describe('--page=<build> against an F2 document', () => {
    const doc = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
    const BUILD_PAGE = 'seedling_bot_ap_p4d/game.html';

    it('the committed preset IS per player, and names another build than the routed one', () => {
        expect(Object.keys(doc.player_names)).toHaveLength(1);
        expect(slotBlockOf(doc, 'flash_panel').wasm).toBeTruthy();
        expect(slotBlockOf(doc, 'flash_panel').wasm).not.toBe(BUILD_PAGE);
    });

    it('the routed document re-points the SLOT, keeps its other fields, adds no document-level block, and still loads', () => {
        const routed = withSlotBlock(doc, 'flash_panel', { wasm: BUILD_PAGE });
        expect(slotBlockOf(routed, 'flash_panel')).toEqual({ ...slotBlockOf(doc, 'flash_panel'), wasm: BUILD_PAGE });
        expect(Object.keys(routed.flash_panel)).toEqual(Object.keys(doc.flash_panel));
        expect(() => refuseRetiredTopLevelKeys(routed)).not.toThrow();
        expect(slotBlockOf(doc, 'flash_panel').wasm).not.toBe(BUILD_PAGE); // the input is untouched
    });

    it('⛔ the CONTROL: the pre-F2 flat write is the shape the loader refuses by name', () => {
        const flat = { ...doc, flash_panel: { ...doc.flash_panel, wasm: BUILD_PAGE } };
        expect(() => refuseRetiredTopLevelKeys(flat)).toThrow(/document-level `flash_panel` block/);
    });

    it.each(['probe-seedling-divergence-sweep.mjs', 'probe-seedling-contact-divergence.mjs'])(
        '%s routes its build through withSlotBlock, never a flat write', (file) => {
            const src = readFileSync(join(REPO, 'scripts/procgen', file), 'utf8');
            expect(src).toMatch(/withSlotBlock\(doc, 'flash_panel', \{ wasm: WASM_PAGE \}\)/);
            expect(src).not.toMatch(/doc\.flash_panel\s*=/);
        });
});
