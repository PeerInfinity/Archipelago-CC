/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE DD — a press kill whose target died on the walk (`PRESS_KILL_DONE_ON_WALK`, OFF).
 *
 * The kill rung's chaser arm in `solveSegmentUnder` (`-> kill (<id>) by press`) walks to its stance and then dwells
 * until the body has left `strikeBodies`. When the walk's own presses killed the body, `runDwell` refuses an `until`
 * already true; ON, the arm reads the press ledger (`killedOnWalk`) and records the kill as done.
 *
 * The staging is survey step 50's (`bobsoldier2Staging`) booted at (32,112) (`plan-seedling-hammer-dd-walkkill.mjs`):
 * at the defaults it is the shape fidelity CEREMONYSHOVE measured on step 50 under `strikeIframeLapse` +
 * `ceremonyShove`. The witness `fixtures/hammer-dd-walkkill-witness/` is the ON plan replayed on the game (p4f).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    PRESS_KILL_DONE_ON_WALK, PRESS_KILL_DONE_ON_WALK_DEFAULT, killedOnWalk, withPressKillDoneOnWalk,
} from './solverBot.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { buildStagedTape } from './botDriverV1.js';
import {
    BODY, NAME, OFF_REFUSAL_TICK, WITNESS_DIR, walkKillSolve, walkKillStaging,
} from '../../../scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs';
import { bobsoldier2Staging } from '../../../scripts/procgen/plan-seedling-bobsoldier2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOLVE_MS = 120000;
const keysMd5 = (keys) => createHash('md5').update(JSON.stringify(keys.map((k) => [...k].sort()))).digest('hex');
const committed = () => JSON.parse(readFileSync(join(WITNESS_DIR, `${NAME}.tape.json`), 'utf8'));
const game = () => JSON.parse(readFileSync(join(WITNESS_DIR, `${NAME}.game.json`), 'utf8'));

describe('DD — the switch\'s contract', () => {
    it('ships OFF', () => {
        expect(PRESS_KILL_DONE_ON_WALK_DEFAULT).toBe(false);
        expect(PRESS_KILL_DONE_ON_WALK.enabled).toBe(false);
    });

    it('`withPressKillDoneOnWalk` restores the previous value, on a throw too', () => {
        expect(withPressKillDoneOnWalk(true, () => PRESS_KILL_DONE_ON_WALK.enabled)).toBe(true);
        expect(PRESS_KILL_DONE_ON_WALK.enabled).toBe(false);
        expect(() => withPressKillDoneOnWalk(true, () => { throw new Error('x'); })).toThrow('x');
        expect(PRESS_KILL_DONE_ON_WALK.enabled).toBe(false);
    });

    it('`killedOnWalk` names the press of THIS walk that KILLED the body, and nothing else', () => {
        const hit = (id, killed) => ({ as3: 'Enemy', id, landed: true, killed });
        const ledgerOf = (presses, level = 30) => ({ level, ledger: (kind) => (kind === 'presses' ? presses : []) });
        const P = [
            { t: 9, fired: 10, level: 30, weapon: 'sword', direction: 1, hits: [hit('a', true)] }, // before the walk
            // landed, not a kill
            { t: 20, fired: 21, level: 30, weapon: 'sword', direction: 2, hits: [hit('a', false)] },
            { t: 30, fired: 31, level: 30, weapon: 'sword', direction: 3, hits: [hit('b', true)] }, // another body
            { t: 40, fired: 41, level: 30, weapon: 'ghostsword', direction: 0, hits: [hit('a', true)] },
        ];
        const run = ledgerOf(P);
        // the window is the ledger's index at the walk's start
        expect(killedOnWalk(run, 'a', 1)).toEqual({ pressedAt: 40, firedAt: 41, weapon: 'ghostsword', direction: 0 });
        expect(killedOnWalk(run, 'a', 4)).toBe(null);
        expect(killedOnWalk(run, 'c', 0)).toBe(null);
        expect(killedOnWalk(ledgerOf([P[0]]), 'a', 0)?.firedAt).toBe(10);
        expect(killedOnWalk(ledgerOf([P[0]]), 'a', 1)).toBe(null);
        expect(killedOnWalk(ledgerOf([]), 'a', 0)).toBe(null);
        // ⛔ a kill fired at a LATER tick but appended BEFORE the walk is not this walk's (the L40 table's measurement)
        const earlier = ledgerOf([{ ...P[3], t: 103, fired: 104 }, P[1]]);
        expect(killedOnWalk(earlier, 'a', 1)).toBe(null);
        // ⛔ the same id on another level is another body
        expect(killedOnWalk(ledgerOf([P[3]], 31), 'a', 0)).toBe(null);
        // a press that lands on the body without killing it is not its kill, before or after the kill
        const after = ledgerOf([P[3],
            { t: 50, fired: 51, level: 30, weapon: 'sword', direction: 1, hits: [hit('a', false)] }]);
        expect(killedOnWalk(after, 'a', 0)?.firedAt).toBe(41);
        expect(killedOnWalk(ledgerOf([P[1]]), 'a', 0)).toBe(null);
    });
});

describe('DD — the walk killed the body (step 50\'s staging at (32,112))', () => {
    it('OFF: `runDwell` refuses the arm\'s dwell, already true, at t174 (the BEFORE)', async () => {
        const off = await walkKillSolve(await walkKillStaging(), false);
        expect(off.ticks).toBe(OFF_REFUSAL_TICK);
        expect(off.message).toMatch(/-> kill \(bobsoldier@48,80\) by press: the dwell's condition .* is ALREADY TRUE before a tick is spent/s);
        expect(off.hits).toEqual([]);
    }, SOLVE_MS);

    it('ON: past the dwell — the kill is recorded as the walk\'s, and the solve reaches L32 as the witness tape', async () => {
        const staging = await walkKillStaging();
        const on = await walkKillSolve(staging, true);
        expect(on.message).toBe(null);
        expect(on.level).toBe(32);
        expect(on.keys).toHaveLength(381);
        expect(on.hits).toEqual([]);
        const rec = on.records.find((r) => r.strategy === 'kill' && r.target === BODY);
        expect(rec).toMatchObject({ arm: 'chaser', kind: 'dwell', ticks: 0 });
        expect(rec.killedOnWalk).toEqual({ pressedAt: 169, firedAt: 170, weapon: 'sword', direction: 0 });
        const { description: _d, ...want } = committed();
        const { description: _e, ...got } = JSON.parse(JSON.stringify(buildStagedTape({ staging, perTick: on.keys, name: NAME })));
        expect(got).toEqual(want);
    }, SOLVE_MS);
});

describe('DD — the body is alive at the stance (step 50\'s own staging, (176,48))', () => {
    it('ON keeps the dwell: the record is the dwell\'s own, and the solve is OFF\'s byte for byte', async () => {
        const staging = await bobsoldier2Staging();
        const off = await walkKillSolve(staging, false);
        const on = await walkKillSolve(staging, true);
        expect(off.message).toBe(null);
        expect(on.message).toBe(null);
        expect(on.keys).toHaveLength(460);
        expect(keysMd5(on.keys)).toBe(keysMd5(off.keys));
        const rec = on.records.find((r) => r.strategy === 'kill' && r.target === BODY);
        expect(rec.kind).toBe('dwell');
        expect(rec.ticks).toBeGreaterThan(0);
        expect(rec.killedOnWalk).toBeUndefined();
    }, SOLVE_MS);
});

describe('DD — the game witness (`hammer-dd-l30-walkkill`, p4f)', () => {
    it('the game plays the ON plan as the model does: every tick\'s level, player and hits, the body\'s rows, the end', () => {
        const g = game();
        const tape = parseTape(readFileSync(join(WITNESS_DIR, `${NAME}.tape.json`), 'utf8'));
        const model = new Map();
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const b = run && run.level === 30
                ? (run.entities('chasers') ?? []).filter((c) => c.id === BODY && !c.removed) : [];
            model.set(o.t, { level: run?.level, p: [o.x, o.y], hits: run?.ledger('playerHits').length ?? 0,
                bodies: b.map((c) => [c.x, c.y, c.hits]) });
            r = st.next();
        }
        expect(g.samples.length).toBeGreaterThan(370);
        let compared = 0;
        for (const s of g.samples) {
            const m = model.get(s.t);
            if (!m) continue;
            compared += 1;
            expect({ t: s.t, level: s.level, p: s.p, hits: s.hits, bodies: s.bodies })
                .toEqual({ t: s.t, level: m.level, p: m.p, hits: m.hits, bodies: m.bodies });
        }
        expect(compared).toBe(g.samples.length);
        expect(g.end).toEqual({ tick: 381, level: 32, hits: 0 });
        expect(r.value.playerHits ?? []).toHaveLength(0);
    });
});
