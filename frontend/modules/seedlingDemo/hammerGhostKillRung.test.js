/**
 * seedlingDemo/hammerGhostKillRung.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE G1: THE KILL RUNG'S GHOST-SWORD GATE.
 *
 * The combat ladder's kill rung, in its lock-less spinner arm, asked `derivePressKill` only for a `sword` primary and
 * refused every other one by name, although C2 had taught `derivePressKill` the ghost's press (hammer-phase D's
 * finding: L40 legs 378 / 381 / 397 / 414 and C1's staging A refuse a ghost run there). `GHOST_KILL_RUNG` (OFF) lets
 * the rung ask it for a weapon `derivePressKill` admits. OFF is the gate it replaces, byte for byte.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    GHOST_KILL_RUNG, GHOST_KILL_RUNG_DEFAULT, GHOST_SPINNER_PRESS, killRungPresses, withGhostKillRung,
    withGhostSpinnerPress,
} from './ghostSpinnerPress.js';
import { atlasLevelSource } from './levelSource.js';
import { SLASH_REACH } from './presses.js';
import { solveSegment } from './solverBot.js';
import { SPINNER } from './spinner.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, solveStaging, stagingFromTape } from './tapeRunner.js';

describe('GHOST_KILL_RUNG — the switch (hammer-phase G1, D1)', () => {
    it('is OFF by default and opted in by `SEEDLING_GHOST_KILL_RUNG=1`; the wrapper restores it', () => {
        expect(GHOST_KILL_RUNG_DEFAULT).toBe(false);
        expect(GHOST_KILL_RUNG.enabled).toBe(process.env.SEEDLING_GHOST_KILL_RUNG === '1');
        const was = GHOST_KILL_RUNG.enabled;
        expect(withGhostKillRung(true, () => GHOST_KILL_RUNG.enabled)).toBe(true);
        expect(withGhostKillRung(false, () => GHOST_KILL_RUNG.enabled)).toBe(false);
        expect(() => withGhostKillRung(true, () => { throw new Error('x'); })).toThrow('x');
        expect(GHOST_KILL_RUNG.enabled).toBe(was);
    });

    it('`killRungPresses`: OFF only the sword; ON also the ghost sword, and only where `derivePressKill` admits it '
        + '(`GHOST_SPINNER_PRESS` ON)', () => {
        const table = () => ['sword', 'ghostsword', null, 'fire', 'spear'].map((w) => [w, killRungPresses(w)]);
        const off = [['sword', true], ['ghostsword', false], [null, false], ['fire', false], ['spear', false]];
        withGhostSpinnerPress(true, () => {
            expect(withGhostKillRung(false, table)).toEqual(off);
            expect(withGhostKillRung(true, table)).toEqual([['sword', true], ['ghostsword', true], [null, false],
                ['fire', false], ['spear', false]]);
        });
        withGhostSpinnerPress(false, () => {
            expect(withGhostKillRung(false, table)).toEqual(off);
            expect(withGhostKillRung(true, table)).toEqual(off);
        });
    });
});

/**
 * The game witness (D2): `hammer-g1-l40-ghostkill`, C1's staging A with the ghost sword, `solveSegment`'s executed
 * prefix with the switch ON (`scripts/procgen/plan-seedling-hammer-g1-ghostkill.mjs`). The game played it tick for tick
 * (the drained player stream 2196 / 2196, `Bot.slashTests` at every sampled tick) and its Spinner rows are the model's
 * (the committed samples beside the tape). Not a roster tape: these rows replay it.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'hammer-g1-ghostkill-witness');
const NAME = 'hammer-g1-l40-ghostkill';
const TARGETS = ['spinner@880,848', 'spinner@816,848'];
const GATE = 'the kill this rung derives is a SWORD press';
const tape = parseTape(readFileSync(join(DIR, `${NAME}.tape.json`), 'utf8'));
const game = JSON.parse(readFileSync(join(DIR, `${NAME}.game-bodies.json`), 'utf8'));

function walk() {
    const staging = stagingFromTape(tape);
    const held = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    const keys = held.filter(Boolean);
    const run = createRunForStaging({ ...staging, equips: [] }, atlasLevelSource());
    const row = () => (run.entities('spinnerBodies') ?? []).map((b) => [b.id, b.hits, b.hitsTimer, b.rect]);
    const rows = [row()];
    for (const k of keys) {
        run.advance(k);
        rows.push(row());
    }
    return { staging, keys, run, rows };
}

/** The boot view P1 committed (staging A) with the ghost sword granted, the sword kept — the witness's staging. */
function stagingA() {
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(join(HERE, 'fixtures',
        'hammer-p1-l40-south-boot.json'), 'utf8'))));
    staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
    return staging;
}

function solveA(enabled) {
    const staging = stagingA();
    const run = createRunForStaging(staging, atlasLevelSource());
    return withGhostKillRung(enabled, () => {
        try {
            return { perTick: solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 880, y: 816 } }],
                name: NAME, boot: staging.boot, dashMode: 'all' }).perTick, message: null };
        } catch (e) {
            return { perTick: e.perTick ?? [], message: String(e?.message ?? e) };
        }
    });
}

describe(`${NAME} — the kill rung's ghost press kill, on the game (hammer-phase G1, D2)`, () => {
    const w = walk();
    const landed = w.run.spinnerPressHits.filter((h) => h.landed);

    it('⛓⛓⛓ the walk\'s every press and landing is the ghost sword\'s, and it kills both spinners', () => {
        expect(GHOST_SPINNER_PRESS.enabled).toBe(true);
        // the solve's 2195-tick prefix; the tape's `tick_count` holds one more (`buildStagedTape`'s), with no key
        expect(w.keys.length).toBe(2196);
        expect([...w.keys[2195]]).toEqual([]);
        expect([...new Set(w.run.presses.map((p) => p.weapon))]).toEqual(['ghostsword']);
        expect(landed.map((h) => [h.t, h.id, h.weapon, h.hits, h.killed])).toEqual([
            [501, TARGETS[0], 'ghostsword', 2, false], [2078, TARGETS[0], 'ghostsword', 2, false],
            [2114, TARGETS[0], 'ghostsword', 4, true], [2149, TARGETS[1], 'ghostsword', 2, false],
            [2182, TARGETS[1], 'ghostsword', 4, true]]);
        expect(landed.filter((h) => h.reach > SLASH_REACH).length).toBe(4);
        const live = w.run.entities('spinnerBodies').map((b) => b.id);
        expect(TARGETS.filter((id) => live.includes(id))).toEqual([]);
        // the chaser's three hits on the way, the third a death (the respawn at the door), are the plan's own
        expect(w.run.playerHits.map((h) => [h.t, h.id, h.died])).toEqual([[972, 'bob@736,752', false],
            [1184, 'bob@736,752', false], [1216, 'bob@736,752', true]]);
    });

    it('⛓⛓⛓ THE GAME AGREES: its rows of the two killed Spinners (position, hits, hits_timer) are the model\'s at '
        + 'every sampled tick, and each reaches hits 4', () => {
        const bad = [];
        for (const [t, x, y, hits, hitsTimer] of game.rows) {
            const m = w.rows[t]?.find((b) => Math.abs(b[3].x + SPINNER.originX - x) < 1e-9
                && Math.abs(b[3].y + SPINNER.originY - y) < 1e-9);
            if (!m || !TARGETS.includes(m[0]) || m[1] !== hits || m[2] !== hitsTimer) bad.push(t);
        }
        expect(bad).toEqual([]);
        expect(game.rows.length).toBe(4293);
        expect(Math.max(...game.rows.map((r) => r[3]))).toBe(4);
    });

    it('OFF: the kill rung refuses staging A\'s ghost primary at t0, by name (the BEFORE)', () => {
        const off = solveA(false);
        expect(off.perTick.length).toBe(0);
        expect(off.message).toContain(GATE);
    }, 120_000);

    it('⛓⛓⛓ ON: the rung asks the press kill, and the solve\'s executed prefix IS the witness, key for key', () => {
        const on = solveA(true);
        expect(on.message).not.toContain(GATE);
        expect(on.perTick.length).toBe(2195);
        expect(on.perTick.map((k) => [...k].sort())).toEqual(w.keys.slice(0, 2195).map((k) => [...k].sort()));
    }, 900_000);
});
