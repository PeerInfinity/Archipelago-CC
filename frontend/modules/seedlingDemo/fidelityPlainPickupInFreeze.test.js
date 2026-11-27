/**
 * ⛓⛓ SEEDLING FIDELITY PLAINSPAN (wave 59) — a PLAIN pickup (`Pickups/APItem`) taken on a freeze's frame
 * (`CONTACT_FIDELITY.plainPickupInFreeze`, OFF byte-identical).
 *
 *     Pickups/Pickup.as:63-84,120-123   the collide (no freeze gate); a non-special `pick_up()` is `removeSelf()`
 *     Pickups/APItem.as:114-133         the 8×8 box at the cell's centre; `removed()` → `Game.setPersistence(tag,false)`
 *     Game.as:1902-1910                 `setPersistence` writes the check report (`pendingCheck`) on that frame
 *     Game.as:2250,2330                 the player is added first, the apitems later; `addUpdate` prepends, so every
 *                                       apitem tests the post-(F−1) box on frame F
 *     Scenery/FallRock.as:54-109        the landing snap, the span, R
 *
 * The solver's call (`solverBot.apItemTakenOnTick`: the pre-tick box, one apitem a tick, none on a tick that began in
 * a ceremony) already takes a SINGLE apitem on a freeze's first frame on the game's tick (the box does not move from
 * F−1 through a span or phase A) — measured, the first row of each source. What it misses, and what ON takes on the
 * game's tick: a second apitem under the same box (button frame A, a rope's pull, a ceremony's T, the union), the
 * wand's landing snap and a deferred release step's box.
 *
 * Every row is STAGED (`.oel` rows appended to a cloned level): the delivered set ships no apitem in reach of a freeze.
 * ⚠ Not game-witnessed. Report: `CC/docs/cloud-reports/seedling-fidelity-plainspan.md`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { ROCKBUTTON_WITNESS_DIR } from './fidelityRockButton.js';
import { apItemTakenOnTick } from './solverBot.js';
import { loadTape } from './fixtures/index.js';

const KEY = 'plainPickupInFreeze';
/** The neighbouring keys of waves 50 to 57, for the composition rows. */
const ALL = { nestedRockCeremony: true, freezeSpanUpdates: true, freezeReleaseTick: true, freezeEdgeFrames: true,
    frozenTickUngated: true, pickupTickFreeze: true, dialogueFrameFreeze: true };
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const AP = (x, y, tag) => ({ type: 'apitem', x, y, attrs: { tag: String(tag), look: 'ap' } });
/** On L29's frame-A box (post-t23), and a second one beside it under the same box. */
const AP_A = AP(112, 127, 7);
const AP_A2 = AP(110, 127, 9);
const FEATHER = { type: 'feather', x: 112, y: 127, attrs: { tag: '5' } };

function staged(level, inject, remove = []) {
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.filter((e) => !remove.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}

/**
 * Drive `run` one tick at a time with `keysAt(k)`, asking the solver's own contact call after each tick (its view's
 * pre/post shape) and reporting each take through `takeApItem`, as `solverBot`'s segment view does.
 */
function drive(run, ticks, keysAt) {
    const solver = [];
    const taken = new Set();
    const stream = [];
    for (let k = 0; k < ticks; k += 1) {
        const items = run.world?.apItems ?? [];
        const pre = { level: run.level, x: run.state.x, y: run.state.y, inCeremony: Boolean(run.progress('inCeremony')),
            deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length };
        run.advance(keysAt(k));
        const a = apItemTakenOnTick(items.filter((x) => !taken.has(x.id)), pre,
            { level: run.level, deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length });
        if (a) {
            taken.add(a.id);
            solver.push([k, a.id, run.takeApItem({ level: pre.level, id: a.id, tag: a.tag }).t]);
        }
        stream.push([run.state.x, run.state.y, run.gameTime]);
    }
    const bank = run.earnedClears.filter((e) => String(e.by).startsWith('apitem@')).map((e) => [e.t, e.by]);
    return { solver, bank, runTakes: run.plainFreezeTakes.map((r) => [r.t, r.id, r.why]), stream,
        falls: run.rockFalls.map((f) => [f.t, f.id, f.deadFrames]), starts: run.ceremonyStarts.map((c) => [c.t, c.tag]) };
}

/** L29 from (112,160) walking up onto `button@112,128` (frame A is the advance at tick 24); talk from `talkFrom`. */
function l29({ inject = [], remove = [], ticks = 40, talkFrom = 1000 }, over = {}) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({ levelSource: staged(29, inject, remove), boot: { level: 29, x: 112, y: 160 },
            seam: { time: 900 }, roles: ROLES, pins: ['sound', 'dead_frames'] });
        return drive(run, ticks, (k) => new Set(k >= talkFrom ? (k % 2 ? ['primary'] : []) : ['up']));
    });
}

/** `rockbutton-l28-livefall` on L28 with staged apitems (the pull is tape tick 155). */
function rope(inject, over = {}) {
    const fixture = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, 'rockbutton-l28-livefall.json'), 'utf8'));
    const tape = parseTape(JSON.stringify(fixture.tape));
    return withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: staged(28, inject), onTick: (t, s, h, r) => { run = r; } });
        st.next();
        // ⛓ the stepper drives the tape; the rows ask the solver's call on its run, tick by tick, the same way.
        const solver = [];
        const taken = new Set();
        let pre = null;
        let k = 0;
        const ask = () => {
            if (pre && run.world?.apItems) {
                const a = apItemTakenOnTick(run.world.apItems.filter((x) => !taken.has(x.id)), pre,
                    { level: run.level, deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length });
                if (a) {
                    taken.add(a.id);
                    solver.push([k, a.id, run.takeApItem({ level: pre.level, id: a.id, tag: a.tag }).t]);
                }
            }
            pre = { level: run.level, x: run.state.x, y: run.state.y, inCeremony: Boolean(run.progress('inCeremony')),
                deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length };
        };
        ask();
        for (let r = st.next(); !r.done; r = st.next()) { k += 1; ask(); }
        const bank = run.earnedClears.filter((e) => String(e.by).startsWith('apitem@')).map((e) => [e.t, e.by]);
        return { solver, bank, runTakes: run.plainFreezeTakes.map((x) => [x.t, x.id, x.why]),
            falls: run.rockFalls.map((f) => [f.t, f.id, f.deadFrames]) };
    });
}

/** `r5-l43-wand` on L43 with staged rows (the wand's ceremony ends, and its rocks drop, on tick 108). */
function wand(inject, over = {}) {
    const t = loadTape('r5-l43-wand');
    return withContactFidelity(over, () => {
        const run = createLevelRun({ levelSource: staged(43, inject), boot: t.boot, noclip: t.noclip,
            noHazards: t.noHazards, noDamage: t.noDamage, grants: t.grants, persistence: t.persistence,
            equips: t.equips, pins: t.pins, save: t.save });
        return drive(run, t.tick_count, (k) => heldKeysAt(t, k));
    });
}

describe('fidelity PLAINSPAN — a plain pickup (APItem) taken on a freeze\'s frame', () => {
    it('the key ships ON (flipped 2026-11-27); its env name is in `SOLVER_ENV_NAMES`', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(true);
        // ⛓ wave 61 (CHESTCOVER) appended `chestCoverFencepost` after it.
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf(KEY) + 1)).toEqual(['chestCoverFencepost']);
        if (process.env.SEEDLING_PLAIN_PICKUP_IN_FREEZE === undefined) expect(CONTACT_FIDELITY[KEY]).toBe(true);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PLAIN_PICKUP_IN_FREEZE');
    });

    it('button frame A, one apitem: the solver\'s call already takes it on A; ON banks the same take, no double take', () => {
        const off = l29({ inject: [AP_A] }, { [KEY]: false });
        expect(off.solver).toEqual([[24, 'apitem@112,127', 25]]);
        expect(off.falls).toEqual([[25, 'fallrock@112,112', 172]]);
        const on = l29({ inject: [AP_A] }, { [KEY]: true });
        expect(on.runTakes).toEqual([[25, 'apitem@112,127', 'frame A']]);
        // the solver's later report is `takeApItem`'s no-op: the run's record, its tick
        expect(on.solver).toEqual(off.solver);
        expect(on.bank).toEqual(off.bank);
        expect(on.stream).toEqual(off.stream);
    });

    it('button frame A, a second apitem under the same box: OFF after the span (late); ON on A', () => {
        const s = { inject: [AP_A, AP_A2] };
        const off = l29(s, { [KEY]: false });
        expect(off.bank).toEqual([[25, 'apitem@112,127'], [26, 'apitem@110,127']]);
        const on = l29(s, { [KEY]: true });
        expect(on.bank).toEqual([[25, 'apitem@112,127'], [25, 'apitem@110,127']]);
        expect(on.runTakes.map((r) => r[2])).toEqual(['frame A', 'frame A']);
        expect(on.stream).toEqual(off.stream);
        expect(on.falls).toEqual(off.falls);
    });

    it('a ceremony\'s T (a feather, no button), a second apitem: OFF after the ceremony; ON on T', () => {
        const s = { inject: [AP_A, AP_A2, FEATHER], remove: ['button'], ticks: 80, talkFrom: 30 };
        const off = l29(s, { [KEY]: false });
        expect(off.starts).toEqual([[24, 'feather']]);
        expect(off.bank).toEqual([[25, 'apitem@112,127'], [48, 'apitem@110,127']]);
        const on = l29(s, { [KEY]: true });
        expect(on.bank).toEqual([[25, 'apitem@112,127'], [25, 'apitem@110,127']]);
        expect(on.runTakes.map((r) => r[2])).toEqual(['a ceremony\'s T', 'a ceremony\'s T']);
        expect(on.stream).toEqual(off.stream);
        expect(on.starts).toEqual(off.starts);
    });

    it('the union (`nestedRockCeremony` ON, the feather on the button): ON takes both on T = A', () => {
        const s = { inject: [AP_A, AP_A2, FEATHER], ticks: 80, talkFrom: 30 };
        const off = l29(s, { nestedRockCeremony: true, [KEY]: false });
        expect(off.falls).toEqual([[24, 'fallrock@112,112', 0]]);
        expect(off.bank).toEqual([[25, 'apitem@112,127'], [48, 'apitem@110,127']]);
        const on = l29(s, { nestedRockCeremony: true, [KEY]: true });
        expect(on.bank).toEqual([[25, 'apitem@112,127'], [25, 'apitem@110,127']]);
        expect(on.stream).toEqual(off.stream);
    });

    it('the rope\'s pull (`rockbutton-l28-livefall`): the first on P either way; a second OFF after the span, ON on P', () => {
        const one = [AP(137, 48, 3)];
        expect(rope(one, { [KEY]: false }).bank).toEqual([[156, 'apitem@137,48']]);
        expect(rope(one, { [KEY]: true }).bank).toEqual([[156, 'apitem@137,48']]);
        const two = [AP(137, 48, 3), AP(138, 48, 4)];
        const off = rope(two, { [KEY]: false });
        expect(off.falls).toEqual([[155, 'fallrock@112,240', 181]]);
        expect(off.bank).toEqual([[156, 'apitem@137,48'], [157, 'apitem@138,48']]);
        const on = rope(two, { [KEY]: true });
        expect(on.bank).toEqual([[156, 'apitem@137,48'], [156, 'apitem@138,48']]);
        expect(on.runTakes.map((r) => r[2])).toEqual(['the pull', 'the pull']);
    });

    it('the wand\'s drop, a deferred release step: OFF a tick late; ON on the tick whose R+1 tests the post-R box', () => {
        const s = [AP(144, 226, 6)];
        const off = wand(s, { [KEY]: false });
        expect(off.bank).toEqual([[110, 'apitem@144,226']]);
        const on = wand(s, { [KEY]: true });
        expect(on.bank).toEqual([[109, 'apitem@144,226']]);
        expect(on.runTakes).toEqual([[109, 'apitem@144,226', 'the deferred step']]);
        expect(on.stream).toEqual(off.stream);
    });

    it('the wand\'s drop, a landing snap: OFF a tick late; ON on the drop tick, under the snapped box', () => {
        const s = [{ type: 'fallrock', x: 144, y: 210, attrs: { tset: '0', tag: '9' } }, AP(144, 200, 6)];
        const off = wand(s, { [KEY]: false });
        expect(off.bank).toEqual([[110, 'apitem@144,200']]);
        const on = wand(s, { [KEY]: true });
        expect(on.bank).toEqual([[109, 'apitem@144,200']]);
        expect(on.runTakes).toEqual([[109, 'apitem@144,200', 'the wand\'s snap']]);
        expect(on.stream).toEqual(off.stream);
    });

    it('composition (the seven neighbours ON): the same ON takes at frame A, T and the pull', () => {
        const a = { inject: [AP_A, AP_A2] };
        expect(l29(a, { ...ALL, [KEY]: true }).bank).toEqual([[25, 'apitem@112,127'], [25, 'apitem@110,127']]);
        const t = { inject: [AP_A, AP_A2, FEATHER], ticks: 80, talkFrom: 30 };
        expect(l29(t, { ...ALL, [KEY]: true }).bank).toEqual([[25, 'apitem@112,127'], [25, 'apitem@110,127']]);
        expect(l29(t, { ...ALL, [KEY]: false }).bank).toEqual([[25, 'apitem@112,127'], [48, 'apitem@110,127']]);
        const p = [AP(137, 48, 3), AP(138, 48, 4)];
        expect(rope(p, { ...ALL, [KEY]: true }).bank).toEqual([[156, 'apitem@137,48'], [156, 'apitem@138,48']]);
    });

    it('no freeze: an apitem taken on a live tick, and the button with no apitem — ON = OFF, the whole result', () => {
        for (const s of [{ inject: [AP(112, 120, 7)] }, {}]) {
            expect(l29(s, { [KEY]: true })).toEqual(l29(s, { [KEY]: false }));
            expect(l29(s, { ...ALL, [KEY]: true })).toEqual(l29(s, { ...ALL, [KEY]: false }));
        }
        expect(l29({ inject: [AP(112, 120, 7)] }, { [KEY]: true }).bank).toEqual([[31, 'apitem@112,120']]);
        expect(wand([], { [KEY]: true })).toEqual(wand([], { [KEY]: false }));
    });
});
