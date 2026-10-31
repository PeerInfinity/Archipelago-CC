/**
 * ⛓⛓ SEEDLING FIDELITY L32ROCK (wave 35) — THE BOBBOSS ARENA ROCK'S ARM IS A CLEAR.
 *
 * `FallRockLarge.fall()` (`FallRockLarge.as:137-143` @ccdf189776) writes `Game.setPersistence(tag, false)` on the
 * frame the rock ARMS: a `bossRock` arms when the nearest Player stands above `fallTo - 16 - 8` and is not
 * `fallFromCeiling` (`:71-80`), once (`set activate` latches `_active`), and only while its tag is held (a cleared
 * tag builds the rock fallen, `_active` set, `:50-56`). L32's rock is `fallrocklarge@64,128` tag 1 (bossrock,
 * thirdboss). The model stepped the arm (`bobBossEvents`' `rock-armed`) but banked no clear, so
 * `jsRuntimeCore.liveClears` never reported {32,1}; the game reports it on the arm frame.
 *
 * `CONTACT_FIDELITY.bobArenaRockClear` ON banks the write as L82's arena rock's arm does (`rockFlags` by
 * `fallrocklarge` + `pendingEarnedClears`). OFF: byte-identical.
 *
 * GAME = the first SAMPLED p4g tick holding {32,1} (`probe-seedling-encounter-ticks.mjs`'s clears readout, the
 * default build, headless; the sample before it is the tick before, so the write is exact).
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { liveClears } from './jsRuntimeCore.js';
import { withContactFidelity } from './contactFidelity.js';

/** tape -> the game's first tick holding {32,1} (p4g). See the report's W0/D1 rows for the runs. */
const GAME = Object.freeze({
    // CI 40579343337 @8bd8a81d8a (js plan §5.157) and this slice's probe at 9dadbdfc4b: t9 (prev sample t8).
    'apb-l32-fresh-no-fire': 9,
});

function replay(name) {
    let run = null;
    const first = new Map();
    const pos = [];
    const st = createTapeStepper(loadTape(name), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        pos.push([o.x, o.y]);
        for (const c of liveClears(run)) if (!first.has(`${c.level}:${c.tag}`)) first.set(`${c.level}:${c.tag}`, o.t);
    }
    return { run, first, pos };
}

const on = (fn) => withContactFidelity({ bobArenaRockClear: true }, fn);
const off = (fn) => withContactFidelity({ bobArenaRockClear: false }, fn);

describe('L32ROCK — the arena rock\'s arm banks {32,1}', () => {
    it.each(Object.entries(GAME))('%s: ON, the model reports {32,1} on the game\'s tick (t%i)', (name, t) => {
        const r = on(() => replay(name));
        expect(r.first.get('32:1')).toBe(t);
        const row = r.run.ledger('earnedClears').find((c) => c.level === 32 && c.tag === 1);
        expect(row).toMatchObject({ by: 'fallrocklarge', t });
        // …on the arm frame: the ledger's `rock-armed` row carries `ticksCompleted`, the tick BEFORE it.
        expect(r.run.ledger('bobBossEvents').find((e) => e.what === 'rock-armed').t).toBe(t - 1);
    });

    it.each(Object.keys(GAME))('%s: OFF, the residue — {32,1} is never reported', (name) => {
        const r = off(() => replay(name));
        expect(r.first.has('32:1')).toBe(false);
        // …though the arm itself is stepped: the gap was the record, not the event.
        expect(r.run.ledger('bobBossEvents').some((e) => e.what === 'rock-armed')).toBe(true);
    });

    it('the walk does not move: ON and OFF step the same positions and the same R4 reports', () => {
        const a = off(() => replay('apb-l32-fresh-no-fire'));
        const b = on(() => replay('apb-l32-fresh-no-fire'));
        expect(b.pos).toEqual(a.pos);
        expect(b.first.get('32:3')).toBe(a.first.get('32:3'));
        expect(b.first.get('32:4')).toBe(a.first.get('32:4'));
    });

    it('a rock built FALLEN (the tag cleared at the boot) does not arm, so nothing new is banked', () => {
        const r = on(() => replay('apb-l32-both-reported'));
        expect(r.run.ledger('bobBossEvents').some((e) => e.what === 'rock-armed')).toBe(false);
        expect(r.run.ledger('earnedClears').some((c) => c.level === 32 && c.tag === 1)).toBe(false);
    });
});
