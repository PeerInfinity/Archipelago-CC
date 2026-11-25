/**
 * fidelityApChestCover — **THE SAME-FRAME ORDER OF A `Cover` AND THE p4h `APChest` UNDER IT** (slice
 * seedling-fidelity-apchestcover, planning-24 wave 60; wave 58's named STOP).
 *
 * `World.addUpdate` PREPENDS, so a frame updates entities in reverse `Game.loadlevel` add order. p4h (`p4h-as3`
 * @169247c4c4) adds the `APChest` at `Game.as:2335`, the `Button` at `:2348`, the `Cover` at `:2367` and the vanilla
 * `Chest` at `:2384`: a frame runs Chest → Cover → Button → APChest → … → Player (`:2250`). The vanilla chest reads the
 * cover as the PREVIOUS frame left it (it opens the tick after the cover does, `levelRun`'s fencepost note); the
 * APChest reads it as THIS frame's `Cover.update` left it (`Puzzlements/Cover.as:41-48`, `Pickups/APChest.as:75`).
 * `CONTACT_FIDELITY.apChestCoverOrder` (OFF by default) models that for an AP chest only.
 *
 * ⛔⛔ THE GAME REFUTES ON (wave 60). The p4h page played the staged room (`coverButtonRecord`, with `button@80,192`
 * moved out of group 0: two `Button`s of one group recurse in `Button.as:42-60`), loaded as level data through
 * `botLoadLevels`: the APChest opens on 12 (OFF's tick; ON says 11) and a vanilla `Chest` opens on 13 (the model says
 * 12). The rows below pin what the model does in each arm, and the last block reads the committed game results.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { createActivatorState, openActivatorIds, previewOpenActivatorIds, stepActivators } from './activators.js';
import { buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { l25Sets } from './fidelityL25ApItem.js';
import { AP_CHEST_PLANS, apChestPlanTape, apChestReplay, coverButtonRecord } from './fidelityApChest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const KEY = 'apChestCoverOrder';
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
const P4H_CAPS = MANIFEST.builds.find((b) => b.name === 'seedling_bot_ap_p4h').capabilities;
const DELIVERED = l25Sets(ROOT).deliveredSource;
const VANILLA = atlasLevelSource();
const COVER_BUTTON = (src) => (n) => coverButtonRecord(src(n));
/** L38 with its `buttonroom@144,128` swapped for a `button tset 0` one tile WEST (a walk can leave it in the band). */
const SHIFTED_BUTTON = (src) => (n) => {
    const rec = src(n);
    if (rec?.level !== 38) return rec;
    return { ...rec, entities: rec.entities.map((e) => (e.type === 'buttonroom' && e.x === 144 && e.y === 128
        ? { type: 'button', x: 136, y: 128, attrs: { tset: '0' } } : e)) };
};
const plan = (name) => AP_CHEST_PLANS.find((p) => p.name === name);
const tapeOf = (name, over = {}) => {
    const t = apChestPlanTape(ROOT, plan(name));
    return Object.keys(over).length === 0 ? t : parseTape({ ...t, ...over });
};
const on = (fn, extra = {}) => withContactFidelity({ [KEY]: true, ...extra }, fn);
const off = (fn, extra = {}) => withContactFidelity({ [KEY]: false, ...extra }, fn);
/** The whole observable result of a replay: rows, opens, takes and every chest ledger. */
const whole = (r) => JSON.stringify({
    rows: r.rows, openTick: r.openTick, takes: r.takes, chestOpens: r.run.chestOpens,
    sealCollections: r.run.sealCollections, earned: r.run.earnedClears, banked: r.run.bankedClears,
});
const replay = (tape, src, capabilities) => apChestReplay(tape, src, { capabilities });
/** The cover's open tick (the tick count after which `cover@144,112` is open), stepping the tape by hand. */
const coverOpenTick = (tape, src, capabilities) => {
    const r = replay({ ...tape, tick_count: 0 }, src, capabilities);
    for (let t = 0; t < tape.tick_count; t++) {
        r.run.advance(new Set(tape.inputs.filter((sp) => sp.from <= t && t < sp.to).map((sp) => sp.key)));
        if (r.run.activatorsNow.responders.find((a) => a.id === 'cover@144,112')?.open) return t + 1;
    }
    return null;
};
/** Arrival AFTER the cover: on the button below the band (no key), then walking north once the cover is open. */
const LATE = { inputs: [{ key: 'up', from: 15, to: 30 }], tick_count: 30 };
/** The STOP case: the shifted button, the stand pressed into the face, then a walk east off the button. */
const LEAVE = { boot: { level: 38, x: 138, y: 128 }, inputs: [{ key: 'up', from: 0, to: 7 }, { key: 'right', from: 7, to: 20 }], tick_count: 20 };

describe('the key', () => {
    it('is OFF by default and is the LAST key; its env name is in the solver channel', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).at(-1)).toBe(KEY);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_AP_CHEST_COVER_ORDER');
    });
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_AP_CHEST_COVER_ORDER)(
        'this process runs it at the default', () => {
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
        });
});

describe('previewOpenActivatorIds: the step on a copy', () => {
    it('answers what the real step leaves, and leaves the state as it found it', () => {
        const w = buildLevelWorld(COVER_BUTTON(VANILLA)(38));
        const st = createActivatorState(w);
        const box = { x: 150, y: 128.5, right: 154, bottom: 133.5 };   // the stand: in the band, on the button
        for (let k = 0; k < 10; k++) stepActivators(st, w, box, { inventory: {}, keys: new Set() });
        const before = JSON.stringify([...st.byId], null, 0);
        const preview = previewOpenActivatorIds(st, w, box, { inventory: {}, keys: new Set() });
        expect(JSON.stringify([...st.byId], null, 0)).toBe(before);
        expect(openActivatorIds(st).has('cover@144,112')).toBe(false);
        expect(preview.has('cover@144,112')).toBe(true);
        stepActivators(st, w, box, { inventory: {}, keys: new Set() });
        expect(openActivatorIds(st)).toEqual(preview);
    });
});

describe('p4h, L38 (model-only button): the AP chest under the cover', () => {
    const tape = tapeOf('l38-cover-button');
    const src = COVER_BUTTON(DELIVERED);
    it('OFF keeps wave 58\'s order: the cover opens, then the chest on the next tick', () => {
        off(() => {
            expect(coverOpenTick(tape, src, P4H_CAPS)).toBe(plan('l38-cover-button').predicted.coverOpenTick);
            const r = replay(tape, src, P4H_CAPS);
            expect([r.openTick, r.takes.map((t) => t.t)]).toEqual([12, [12]]);
        });
    });
    it('ON: the chest opens on the cover\'s own tick, and the AP take is banked on that tick', () => {
        on(() => {
            const cover = coverOpenTick(tape, src, P4H_CAPS);
            const r = replay(tape, src, P4H_CAPS);
            expect([cover, r.openTick]).toEqual([11, 11]);
            expect(r.takes).toEqual([expect.objectContaining({ by: 'apitem@144,112', t: 11 })]);
            expect(r.run.bankedClears).toContainEqual({ level: 38, tag: 1 });
            expect([r.run.chestOpens, r.run.sealCollections]).toEqual([[], []]);
        });
    });
    it('ON: the take lands on the cover\'s tick and not the tick before (`apItemFlags`, `pendingEarnedClears`)', () => {
        on(() => {
            const at = (n) => {
                const r = replay({ ...tape, tick_count: n }, src, P4H_CAPS);
                return [r.takes.map((t) => t.t), r.run.bankedClears.some((c) => c.level === 38 && c.tag === 1)];
            };
            expect(at(10)).toEqual([[], false]);
            expect(at(11)).toEqual([[11], true]);
        });
    });
    it('the player arriving AFTER the cover completes: ON is OFF, the whole result', () => {
        const late = tapeOf('l38-cover-button', LATE);
        const a = off(() => replay(late, src, P4H_CAPS));
        const b = on(() => replay(late, src, P4H_CAPS));
        expect(a.openTick).toBeGreaterThan(plan('l38-cover-button').predicted.coverOpenTick);
        expect(whole(b)).toBe(whole(a));
    });
    it('⛔ the named STOP: a walk that leaves the presser in the tick the cover turns is REFUSED ON, by name', () => {
        const leave = tapeOf('l38-cover-button', LEAVE);
        const srcShift = SHIFTED_BUTTON(DELIVERED);
        const a = off(() => replay(leave, srcShift, P4H_CAPS));
        expect(a.takes).toEqual([]);
        expect(() => on(() => replay(leave, srcShift, P4H_CAPS))).toThrow(/apChestCoverOrder: .*not final/);
        try { on(() => replay(leave, srcShift, P4H_CAPS)); } catch (e) { expect(e.code).toBe('AP_CHEST_COVER_NOT_FINAL'); }
    });
});

describe('what the key does not touch', () => {
    it('a vanilla `Chest` under the same cover: ON is OFF, the whole result (p4g and p4h)', () => {
        const tape = tapeOf('l38-cover-button');
        for (const caps of [null, P4H_CAPS]) {
            const a = off(() => replay(tape, COVER_BUTTON(VANILLA), caps));
            const b = on(() => replay(tape, COVER_BUTTON(VANILLA), caps));
            expect(a.run.chestOpens.map((c) => c.t)).toEqual([12]);
            expect(whole(b)).toBe(whole(a));
        }
    });
    for (const name of ['l11-below', 'l25-below', 'l38-covered', 'l38-cover-button']) {
        it(`p4g, ${name}: ON is OFF, the whole result`, () => {
            const p = plan(name);
            const src = p.modelOnly ? COVER_BUTTON(DELIVERED) : DELIVERED;
            const a = off(() => replay(tapeOf(name), src, null));
            const b = on(() => replay(tapeOf(name), src, null));
            expect(whole(b)).toBe(whole(a));
        });
    }
    for (const name of ['l25-side', 'l25-above', 'l25-below', 'l11-below', 'l38-covered']) {
        it(`p4h, ${name} (no cover turns): ON is OFF, the whole result`, () => {
            const a = off(() => replay(tapeOf(name), DELIVERED, P4H_CAPS));
            const b = on(() => replay(tapeOf(name), DELIVERED, P4H_CAPS));
            expect(whole(b)).toBe(whole(a));
        });
    }
});

describe('composition: with the base\'s last four OFF keys ON', () => {
    const LAST4 = { pickupTickFreeze: true, dialogueFrameFreeze: true, frozenTickUngated: true, freezeEdgeFrames: true };
    it('the four are OFF by default, and are the keys just before this one', () => {
        const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
        expect(keys.slice(-5, -1)).toEqual(Object.keys(LAST4));
        expect(Object.keys(LAST4).map((k) => CONTACT_FIDELITY_DEFAULTS[k])).toEqual([false, false, false, false]);
    });
    it('L38 opens on the cover\'s tick with them ON, and on the next without this key; L25 is unmoved', () => {
        const tape = tapeOf('l38-cover-button');
        const src = COVER_BUTTON(DELIVERED);
        expect(on(() => replay(tape, src, P4H_CAPS).openTick, LAST4)).toBe(11);
        expect(off(() => replay(tape, src, P4H_CAPS).openTick, LAST4)).toBe(12);
        const a = off(() => replay(tapeOf('l25-below'), DELIVERED, P4H_CAPS), LAST4);
        const b = on(() => replay(tapeOf('l25-below'), DELIVERED, P4H_CAPS), LAST4);
        expect(whole(b)).toBe(whole(a));
    });
});

describe('the game witness (committed: `CC/docs/cloud-reports/seedling-fidelity-apchestcover-evidence/d3/`)', () => {
    const W = (f) => JSON.parse(readFileSync(join(ROOT, 'CC/docs/cloud-reports/seedling-fidelity-apchestcover-evidence/d3', f), 'utf8')).rows[0];
    /** The staged room the page played: `coverButtonRecord`, and `button@80,192` out of group 0. */
    const PAGE_ROOM = (src) => (n) => {
        const r = coverButtonRecord(src(n));
        if (r?.level !== 38) return r;
        return { ...r, entities: r.entities.map((e) => (e.type === 'button' && e.x === 80 && e.y === 192
            ? { ...e, attrs: { ...e.attrs, tset: '5' } } : e)) };
    };
    it('APChest: the game opens on OFF\'s tick, not ON\'s; both replays are its stream at 0 px', () => {
        const g = W('witness.json');
        const tape = tapeOf('l38-cover-button');
        const offTick = off(() => replay(tape, PAGE_ROOM(DELIVERED), P4H_CAPS).openTick);
        const onTick = on(() => replay(tape, PAGE_ROOM(DELIVERED), P4H_CAPS).openTick);
        expect([g.gameOpenTick, g.model.off, g.model.on]).toEqual([offTick, offTick, onTick]);
        expect(g.gameOpenTick).not.toBe(onTick);
        expect([g.positions.off.worst, g.positions.on.worst]).toEqual([0, 0]);
    });
    it('⛔ residue: a vanilla Chest in the same room opens one tick AFTER the model (the vanilla fencepost, handed over)', () => {
        const g = W('witness-vanilla.json');
        const tape = tapeOf('l38-cover-button');
        const model = off(() => replay(tape, PAGE_ROOM(VANILLA), P4H_CAPS).openTick);
        expect(g.model.off).toBe(model);
        expect(g.gameOpenTick).toBe(model + 1);
    });
});
