/**
 * Seedling fidelity AXE: the solver crosses a spinning axe by its phase.
 *
 *   · The game's rule (`Puzzlements/SpinningAxe.as:49-63`): the sprite angle
 *     gains `rate` degrees per update of the axe itself, from 0 at the ctor, and
 *     each update tests the Player against the 32 px blade (`collideLine`) and a
 *     12x12 hub rect (`collideRect`, inclusive). It updates before the Player, so
 *     frame f tests the box of observation f − 1, at update f − V (V = the visit's
 *     arrival observation) — `probe-seedling-axe-phase.mjs`, six game arms (D1).
 *   · The model before: the danger map priced every axe as the 32 px disc it
 *     sweeps, at every tick; ten survey steps (L48, L61 ×6, L71, L75, L101) were
 *     refused "the combat ladder is EXHAUSTED".
 *   · Now: `dangerMap.hazardDanger` prices an axe in TRANSIT at its exact update
 *     count (`axeVisitClock`), keeping the disc for a WAIT and for a visit whose
 *     clock it cannot vouch for; the DODGE rung's AXE arm stalls at the doorstep
 *     of the reach, or bends the corridor (`deriveChaserDetour`) to one a stall
 *     can time, and walks the rest of that corridor.
 *   · The witnesses (`scripts/procgen/plan-seedling-axe-witness.mjs`, recorded
 *     on the game, 0 px): `axe-l61-reach-l62`, `axe-l61-reach-l63`,
 *     `axe-l48-reach-l49`, `axe-l71-reach-l76`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { AXE_UPDATE_OFFSET, axePeriod, axeVisitClock, dangerAt } from './dangerMap.js';
import { AXE_DODGE_RUNG, DEADLINE_SITES } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const expectation = (name) => JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'expectations', `${name}.json`), 'utf8'));
const witness = () => import(join(REPO, 'scripts', 'procgen', 'plan-seedling-axe-witness.mjs'));

describe('fidelity AXE — the axe is priced at its own update count in TRANSIT', () => {
    it('the offset is the one the game measured (D1: six arms, K = 0)', () => {
        expect(AXE_UPDATE_OFFSET).toBe(0);
        const oracle = JSON.parse(readFileSync(join(REPO, 'CC', 'docs', 'cloud-reports',
            'seedling-fidelity-axe-evidence', 'axe-phase-oracle.json'), 'utf8'));
        expect(oracle.agreeingOffsets).toEqual([AXE_UPDATE_OFFSET]);
        expect(oracle.arms).toHaveLength(6);
        expect(oracle.arms.every((a) => a.matches.includes(0) && a.gameFirstMove > 0)).toBe(true);
    });

    it('L61, the game\'s south arm: the blade on frame 53, clear before it, the disc in WAIT', async () => {
        const { AXE_WITNESSES, axeStaging } = await witness();
        const run = createRunForStaging(await axeStaging(AXE_WITNESSES[0]), SRC);
        expect(run.level).toBe(61);
        expect(axeVisitClock(run)).toEqual({ v: 0, why: null });
        // The probe's south arm stood at (72,172); the game knocked it on frame 53.
        const box = playerBoxAt(72, 172);
        const at = (tick, mode) => dangerAt(run, tick, box, { mode }).sources
            .filter((s) => s.id === 'spinningaxe@64,144');
        expect(at(53, 'transit')).toMatchObject([{ kind: 'hazard', arm: 'blade',
            axe: { cx: 72, cy: 152, rate: 5, period: 72, updates: 53 } }]);
        expect(at(52, 'transit')).toEqual([]);
        expect(at(40, 'transit')).toEqual([]);
        // ⛔ A WAIT is a union over the dwell window, so the disc stands.
        expect(at(40, 'wait')).toHaveLength(1);
        expect(at(40, 'wait')[0].arm).toBeUndefined();
    });

    it('the visit clock refuses — and the disc stands — when a dead span or a rebuild lands inside the visit', () => {
        const fake = (over) => ({ level: 61, transitions: [], endingReboots: [], deadFrameSpans: [],
            ledger: () => [], ...over });
        expect(axeVisitClock(fake({ transitions: [{ t: 10, from_level: 60, to_level: 61 }] })))
            .toEqual({ v: 10, why: null });
        expect(axeVisitClock(fake({ transitions: [{ t: 10, from_level: 61, to_level: 60 }] })).v).toBeNull();
        expect(axeVisitClock(fake({ deadFrameSpans: [{ frames: 20, kind: 'load', t: null }] })).v).toBe(0);
        expect(axeVisitClock(fake({ deadFrameSpans: [{ frames: 8, kind: 'help', t: 3 }] })).v).toBeNull();
        expect(axeVisitClock(fake({ ledger: (k) => (k === 'playerDeaths' ? [{ t: 5 }] : []) })).v).toBeNull();
        expect(axeVisitClock(fake({ endingReboots: [{ t: 2 }] })).v).toBeNull();
    });

    it('a revolution is 360 / |rate| updates, rounded up', () => {
        expect([5, 7, -5, 6, -2].map(axePeriod)).toEqual([72, 52, 72, 60, 180]);
    });

    it('the AXE arm is bounded and has its own deadline site', () => {
        expect(DEADLINE_SITES).toContain('axe-dodge');
        expect(AXE_DODGE_RUNG).toMatchObject({ step: 4, offsets: 8, detourOffsets: 2, detourPreviews: 60 });
    });
});

describe('fidelity AXE — the witnesses, recorded on the game', () => {
    const NAMES = ['axe-l61-reach-l62', 'axe-l61-reach-l63', 'axe-l48-reach-l49', 'axe-l71-reach-l76'];

    it.each(NAMES)('%s: the model replays the game\'s recording at 0 px, through the old disc, with no contact', async (name) => {
        const { AXE_WITNESSES, axeVisit } = await witness();
        const w = AXE_WITNESSES.find((x) => x.name === name);
        const model = runTape(tape(name), { levelSource: SRC }).ticks;
        const rec = expectation(name).ticks;
        expect(model).toHaveLength(rec.length);
        let worst = 0;
        for (let i = 0; i < rec.length; i += 1) {
            expect(model[i].level).toBe(rec[i].level);
            worst = Math.max(worst, Math.abs(model[i].x - rec[i].x), Math.abs(model[i].y - rec[i].y));
        }
        expect(worst).toBe(0);
        expect(model.at(-1).level).toBe(w.to);
        for (const v of await axeVisit(model, w)) {
            expect(v.inside, v.id).toBeGreaterThan(0);
            expect(v.hits, v.id).toBe(0);
        }
    });

    it('route step 128: the solver\'s plan is the DODGE rung\'s AXE arm, and it is the committed tape', async () => {
        const { AXE_WITNESSES, axePlan } = await witness();
        const { solved } = await axePlan(AXE_WITNESSES[0]);
        const dodge = solved.out.trace.rows.filter((r) => r.strategy?.rung === 'dodge');
        expect(dodge).toHaveLength(1);
        expect(dodge[0].strategy).toMatchObject({ stall: { at: 13, ticks: 26 }, axe: 'spinningaxe@64,144',
            vias: [{ x: 120, y: 152 }] });
        expect(dodge[0].rejected.map((r) => r.option)).toEqual(['avoid']);
        const keys = solved.out.perTick.map((s) => [...s].sort().join('+'));
        const committed = tape('axe-l61-reach-l62');
        const held = Array.from({ length: committed.tick_count }, (_, i) => committed.inputs
            .filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key).sort().join('+'));
        expect(keys).toEqual(held);
    }, 120_000);
});
