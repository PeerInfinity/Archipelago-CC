/**
 * ⛓⛓ SEEDLING FIDELITY ENCOUNTERS2 — WHICH FRAME A PICKUP'S `removed()` RUNS ON.
 *
 * D3. On the game, a `special` pickup's item flag lands one frame AFTER its
 * ceremony's text closes (`NPC.removed()` nulls `myText` at the end of the
 * closing frame; `pick_up()`'s `!myText` arm, and so `removed()`, is the next
 * frame's). The game's first observation holding the flag was recorded per tape
 * (`fixtures/pickup-removal-witness.json`, `probe-seedling-encounter-ticks.mjs`
 * on p4f). The model, replaying the same tapes:
 *
 *   `PICKUP_REMOVED_NEXT_FRAME` ON   lands each flag on the game's observation;
 *   OFF (the default, the BEFORE)    one observation early — the stream (x/y)
 *                                    identical either way.
 *
 * The encounter executors read the ceremony's end off the `collected` record,
 * so their plans are the same tick for tick under either switch (the Witch's
 * here; the Bob Boss's is `plan-seedling-encounters.mjs --check`, byte-identical
 * with `SEEDLING_PICKUP_REMOVED_NEXT=1`).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { solveSegment } from './solverBot.js';
import { PICKUP_REMOVED_NEXT_FRAME_DEFAULT, withPickupRemovedNextFrame } from './pickupRemoval.js';

const WITNESS = JSON.parse(readFileSync(
    new URL('./fixtures/pickup-removal-witness.json', import.meta.url), 'utf8'));
const tapeOf = (name) => JSON.parse(readFileSync(
    new URL(`./fixtures/tapes/${name}.json`, import.meta.url), 'utf8'));

/** Replay `tape` in the model: the first observation holding `property`, the x/y stream, and the run. */
function replay(tape, property) {
    let run = null;
    let first = null;
    const stream = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        stream.push([o.t, o.x, o.y, o.level]);
        if (first === null && run?.inventory?.[property] === true) first = o.t;
    }
    return { first, stream, run };
}

describe('the switch', () => {
    it('ships OFF (the BEFORE model) until a default flip is licensed', () => {
        expect(PICKUP_REMOVED_NEXT_FRAME_DEFAULT).toBe(false);
    });
});

describe('⛓⛓ the game\'s frame: a special pickup\'s flag lands one frame after its ceremony closes', () => {
    it('the witness names four tapes, a runtime add and placed pickups among them, each read at both ticks', () => {
        expect(WITNESS.rows.map((r) => `${r.tape}:${r.property}`)).toEqual([
            'enc-l12-witch:hasDarkSword', 'enc-l32-live-arrival:hasFire', 'bobsoldier2-l30-torch:hasTorch',
            'r8-solve-10:hasSword']);
        for (const r of WITNESS.rows) {
            expect(r.sampled).toEqual([r.gameObs - 1, r.gameObs]);
            expect(r.streamWorst).toBe(0);
        }
    });
    // ⚠ `r8-solve-10` (the Sword) is the residue: its flag is late on the game too, but ON moves its stream (t73: a
    // press on the closing frame the game swings and the ON model does not), so it is pinned for the flag only.
    const STREAM_RESIDUE = new Set(['r8-solve-10']);
    for (const w of WITNESS.rows) {
        it(`${w.tape}: ON lands ${w.property} on the game's observation ${w.gameObs}; OFF one early`
            + `${STREAM_RESIDUE.has(w.tape) ? ' (the stream: the residue)' : '; the stream identical'}`, () => {
            const tape = tapeOf(w.tape);
            const on = withPickupRemovedNextFrame(true, () => replay(tape, w.property));
            const off = withPickupRemovedNextFrame(false, () => replay(tape, w.property));
            expect(on.first).toBe(w.gameObs);
            expect(off.first).toBe(w.gameObs - 1);
            if (STREAM_RESIDUE.has(w.tape)) expect(on.stream).not.toEqual(off.stream);
            else expect(on.stream).toEqual(off.stream);
            expect(on.run.inventory[w.property]).toBe(true);
        });
    }
});

describe('the encounter ledger rows land on the removal frame', () => {
    it('enc-l12-witch: `darksword-removed` at t378 ON (the game\'s), t377 OFF; the close and the contact unmoved', () => {
        const tape = tapeOf('enc-l12-witch');
        const rows = (on) => withPickupRemovedNextFrame(on, () => replay(tape, 'hasDarkSword')).run
            .ledger('witchEvents').map((r) => `${r.what}@${r.t}`);
        expect(rows(true)).toEqual(['witch-open@286', 'witch-close@340', 'darksword-added@340',
            'darksword-contact@341', 'darksword-removed@378']);
        expect(rows(false)).toEqual(['witch-open@286', 'witch-close@340', 'darksword-added@340',
            'darksword-contact@341', 'darksword-removed@377']);
    });
    it('enc-l32-live-arrival: `fire-removed` at t833 ON (the game\'s), t832 OFF', () => {
        const tape = tapeOf('enc-l32-live-arrival');
        const at = (on) => withPickupRemovedNextFrame(on, () => replay(tape, 'hasFire')).run
            .ledger('bobBossEvents').find((r) => r.what === 'fire-removed');
        expect(at(true)).toMatchObject({ t: 833, level: 32, flag: { level: 31, tag: 29, value: false } });
        expect(at(false)).toMatchObject({ t: 832, level: 32, flag: { level: 31, tag: 29, value: false } });
    });
});

describe('the Witch executor plans the same ticks under either switch', () => {
    it('enc-l12-witch\'s staging: the encounter goal alone ends on the close frame + 1 (OFF: the flag; ON: the collect)', () => {
        const W = tapeOf('enc-l12-witch');
        const solve = (on) => withPickupRemovedNextFrame(on, () => {
            const staging = solveStaging(stagingFromTape(parseTape({ ...W, name: 'w', tick_count: 0, inputs: [] })));
            const run = createRunForStaging(staging, atlasLevelSource());
            const out = solveSegment({ run, goals: [{ kind: 'encounter', at: { x: 416, y: 384 },
                drop: { item: 'Progressive Sword' }, then: null }], name: 'w', boot: staging.boot });
            return { keys: out.perTick.map((h) => [...h].sort().join('+')), held: run.inventory.hasDarkSword };
        });
        const off = solve(false);
        const on = solve(true);
        expect(on.keys).toEqual(off.keys);
        expect(off.keys).toHaveLength(377);
        // OFF holds the sword on the plan's last observation; ON holds it one frame later — the game's frame,
        // which the game runs on the disarm frame after the tape (the probe's `--tail`).
        expect(off.held).toBe(true);
        expect(on.held).toBe(false);
    });
});
