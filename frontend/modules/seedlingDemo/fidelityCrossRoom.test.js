/**
 * Seedling fidelity CROSSROOM: the rules arc's cross-room `ButtonRoom` writes, both directions.
 *
 * `ButtonRoom.as:93` writes `setPersistence(t, persist, room)` — its TSET, in level `room`, FALSE with
 * `flip`. Measured on the game (p4f, headless, `probe-seedling-cross-room-button.mjs --only=38`): L38's
 * `buttonroom@144,288` writes `{37,4}` (and its own `{38,5}`), `buttonroom@32,48` writes `{39,8}` (and
 * `{38,4}`), both into `persistence_cleared` on the press.
 *
 *   · D2 (the ledger): on the DELIVERED set (`seedlingSetPatches`, `l37-fallrock-removed`) no entity of L37
 *     carries tag 4, so the first write is the game's unread save slot. It is REPORTED
 *     (`run.ledger('unreadRoomWrites')`, the `roomWrites` row marked `unread`) and NEVER banked — the
 *     banked clear made L37's build refuse "a clear which no entity in this level reads" (survey step 59,
 *     sweep-4 leg 366). A STAGED `{37,4}` (the live table a later solve declares) is left out of the build
 *     the same way, by the writer's provenance. On the vanilla map L37's fallrock reads it: unchanged.
 *   · D3 (the cross-room presser): a `clear-tag` goal whose flag is in another level names its presser
 *     (`presser: {level, class, x, y}`, the event's `action.presser`); standing in that level, the executor
 *     walks to the presser through the room and presses it, and the flag lands on the run's ledger (survey
 *     step 76, sweep-4 leg 368's goal).
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 `unreadWrite` always false (the press banks as before)
 *        -> D2's "walks into L37" row reds with the build's orphan text; the ledger rows red.
 *   m2 `clearedForBuild`'s unread filter removed
 *        -> the STAGED row reds with the same orphan text; the press rows stay green.
 *   m3 the writer provenance dropped (`crossRoomWritersOnto` answers every slot)
 *        -> the "no writer stays a derivation error" row reds (L37's `{37,5}` builds).
 *   m4 the cross-room branch removed from `execClearTag`
 *        -> D3's SOLVES row reds with `wrong-level`.
 *   m5 the presser walk keeps a `contactsOverride` snapshot (the first cut)
 *        -> D3's SOLVES row reds: the frontier re-meets `buttonroom@144,128` after its press and `hold`
 *           refuses "ALREADY OPEN".
 */
import { describe, expect, it } from 'vitest';

import { loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { createLevelRun } from './levelRun.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { assertGoal, solveSegment, SolverRefusal } from './solverBot.js';

const VANILLA = levelSourceFromAtlas(loadAtlas());
const DELIVERED = levelSourceFromAtlas(patchedMapDocument(loadAtlas()));
const L38_BUTTON = Object.freeze({ level: 38, x: 144, y: 288 });
const L39_PLUG = Object.freeze({
    kind: 'clear-tag', tag: { level: 39, tag: 8 }, at: { x: 144, y: 592 }, obstacle: 'wandlock@144,592',
    presser: { level: 38, class: 'buttonroom', x: 32, y: 48 },
});
const ITEMS = ['hasSword', 'hasShield', 'hasFire', 'hasTorch', 'canSwim'];

/** Boot on L38's arrival button and walk south into `teleporter@144,304` (→ L37). */
const walkIntoL37 = (levelSource, extra = {}) => {
    const run = createLevelRun({ levelSource, boot: { ...L38_BUTTON }, noDamage: true, ...extra });
    for (let t = 0; t < 60 && run.level === 38; t += 1) run.advance(new Set(['down']));
    return run;
};
const refusalOf = (fn) => {
    try { fn(); } catch (e) { if (e instanceof SolverRefusal) return e; throw e; }
    return null;
};

describe('fidelity CROSSROOM — D2: a cross-room write into a level nothing reads is a ledger entry', () => {
    it('the delivered set: L37 carries no tag 4, the vanilla map\'s fallrock does', () => {
        const carriers = (src) => src(37).entities.filter((e) => Number(e.attrs?.tag) === 4)
            .map((e) => `${e.type}@${e.x},${e.y}`);
        expect(carriers(VANILLA)).toEqual(['fallrock@288,32']);
        expect(carriers(DELIVERED)).toEqual([]);
    });

    it('delivered: the press is REPORTED (unread), never banked, and the walk crosses into L37', () => {
        const run = walkIntoL37(DELIVERED);
        expect(run.level).toBe(37);
        const write = run.ledger('roomWrites').find((r) => r.level === 37 && r.tag === 4);
        expect(write).toMatchObject({ id: 'buttonroom@144,288', from: 38, value: false, which: 'room', unread: true });
        expect(run.ledger('unreadRoomWrites')).toEqual([
            { level: 37, tag: 4, by: 'buttonroom@144,288', from: 38, t: write.t, staged: false },
        ]);
        expect(run.ledger('bankedClears')).not.toContainEqual({ level: 37, tag: 4 });
        // the game's own readout holds it (`persistence_cleared`, the probe): the earned ledger keeps the row
        expect(run.ledger('earnedClears')).toContainEqual(expect.objectContaining({ level: 37, tag: 4 }));
        // the button's OWN tag is read in L38 and banks as before
        expect(run.ledger('roomWrites').find((r) => r.level === 38 && r.tag === 5)).not.toHaveProperty('unread');
    });

    it('vanilla: the same press banks as before — L37\'s fallrock reads it, and the build meets its arm', () => {
        // ⛔ UNCHANGED, and not this slice's: the banked clear reaches L37's build, whose fallrock is an `arm`
        // (built FALLEN), which the clear list refuses — the text CI's survey step 59 showed before the rules
        // arc's delivered-set patch removed the fallrock.
        let run = null;
        expect(() => { run = walkIntoL37(VANILLA); })
            .toThrow(/level 37: the tape clears tag 4, which is a "fallrock" at \(288,32\) — response "arm"/);
        expect(run).toBe(null);
        const probe = createLevelRun({ levelSource: VANILLA, boot: { ...L38_BUTTON }, noDamage: true });
        for (let t = 0; t < 3; t += 1) probe.advance(new Set());
        expect(probe.ledger('roomWrites').find((r) => r.level === 37 && r.tag === 4)).not.toHaveProperty('unread');
        expect(probe.ledger('unreadRoomWrites')).toEqual([]);
    });

    it('delivered: a STAGED {37,4} (the live table after the press) builds L37 and is reported', () => {
        const run = createLevelRun({ levelSource: DELIVERED, boot: { level: 37, x: 288, y: 16 },
            persistence: [{ level: 37, tag: 4 }], noDamage: true });
        expect(run.level).toBe(37);
        expect(run.ledger('unreadRoomWrites')).toEqual([
            { level: 37, tag: 4, by: 'L38 buttonroom@144,288', from: null, t: null, staged: true },
        ]);
    });

    it('a clear with NO cross-room writer is still the build\'s derivation error', () => {
        expect(() => createLevelRun({ levelSource: DELIVERED, boot: { level: 37, x: 288, y: 16 },
            persistence: [{ level: 37, tag: 5 }], noDamage: true }))
            .toThrow(/the tape clears tag\(s\) 5, which no entity in this level reads/);
    });
});

describe('fidelity CROSSROOM — D3: a clear-tag pressed from another level', () => {
    it('the goal admits an optional presser, and refuses a malformed one', () => {
        expect(assertGoal({ ...L39_PLUG }, 0)).toEqual(L39_PLUG);
        expect(() => assertGoal({ ...L39_PLUG, presser: { level: 38, class: 'buttonroom', x: 32 } }, 0))
            .toThrow(/presser \{level, class, x, y\}/);
    });

    it('without a presser, a flag in another level is still `wrong-level`', () => {
        const run = createRunForStaging(arrivalStaging(L38_BUTTON, { items: ITEMS }), DELIVERED);
        const { presser, ...noPresser } = L39_PLUG;
        const e = refusalOf(() => solveSegment({ run, goals: [noPresser], name: 'crossroom-wrong-level',
            boot: L38_BUTTON }));
        expect(e?.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'wrong-level' });
    });

    it('a presser that does not write this flag is refused by name', () => {
        const run = createRunForStaging(arrivalStaging(L38_BUTTON, { items: ITEMS }), DELIVERED);
        const e = refusalOf(() => solveSegment({ run, goals: [{ ...L39_PLUG,
            presser: { level: 38, class: 'buttonroom', x: 144, y: 288 } }], name: 'crossroom-wrong-presser',
        boot: L38_BUTTON }));
        expect(e?.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'cross-room-presser' });
        expect(e.message).toMatch(/writes \{37,4\} = false .* not the clear \{39,8\}/);
    });

    it('SOLVES from L38\'s arrival: through the room\'s chain to buttonroom@32,48, {39,8} on the ledger, then into L39', () => {
        const run = createRunForStaging(arrivalStaging(L38_BUTTON, { items: ITEMS }), DELIVERED);
        const out = solveSegment({ run, goals: [{ ...L39_PLUG }, { kind: 'reach-exit', exit: { x: 144, y: 0 } }],
            name: 'crossroom-l38-l39', boot: L38_BUTTON });
        const rec = out.records.find((r) => r.goal === 'clear-tag' && r.arm === 'cross-room-press');
        expect(rec).toMatchObject({ arm: 'cross-room-press', presser: 'buttonroom@32,48', from: 38,
            flag: { level: 39, tag: 8 } });
        expect(run.ledger('earnedClears')).toContainEqual(expect.objectContaining({ level: 39, tag: 8 }));
        expect(run.ledger('playerHits')).toEqual([]);
        // L39's build read the write: the run stands in L39, past the plug's landing
        expect(run.level).toBe(39);
    }, 120000);
});
