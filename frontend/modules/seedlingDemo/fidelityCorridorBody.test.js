/**
 * fidelity CORRIDOR (planner `seedling-fidelity-planning-8`, wave 17) — the walk's corridor prices the live wallflyers
 * and drills at the ticks it passes them (`CONTACT_FIDELITY.corridorBodyPricing`, OFF by default).
 *
 * The witnesses (`fixtures/corridor-witness/`): route survey steps 47 (L22, wallflyers) and 114 (L88, the drill) — the
 * walks the solver returns at e967758748, played on the GAME by fidelity UNBILLEDGATE D1 (p4f headless, clock shift
 * [0]), whose `hits` rise at t84 (47) and t48 / t110 (114). The forecast (`run.corridorBodyForecast`), stepped against
 * the drive's own player with the drive's own sword hits, holds every body at 0 px and lands its contacts on exactly
 * those ticks. The solves: step 53 (two deaths OFF) and step 170 (a lavarunner the dark shield's i-frame hid from the
 * gate) walk clean ON.
 * Report: `CC/docs/cloud-reports/seedling-fidelity-corridor.md`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { corridorBodyDanger, dangerAt } from './dangerMap.js';
import { previewWalk, solveSegment } from './solverBot.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const json = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const W = (n) => json('fixtures', 'corridor-witness', n);
const MAP = json('..', 'flashPanel', 'atlases', 'seedling-map.json');
const SRC = levelSourceFromAtlas(patchedMapDocument(MAP));
const on = (fn) => withContactFidelity({ corridorBodyPricing: true }, fn);
const off = (fn) => withContactFidelity({ corridorBodyPricing: false }, fn);

/** The game's `hits` rises, `[t]`, within one level. */
function gameRises(rows) {
    const out = [];
    for (let i = 1; i < rows.length; i += 1) {
        if (rows[i][1] === rows[i - 1][1] && rows[i][2] > rows[i - 1][2]) out.push(rows[i][0]);
    }
    return out;
}

/**
 * The walk tape driven on the model, the forecast stepped against the drive's player at each tick's start and handed
 * the drive's own landed sword tests (`chaserPressHits`, the same ids, so `swing` asks only line of sight and the
 * receiver): returns the worst body |Δ|, the forecast's landing contacts and the model's wallflyer/drill hits.
 */
function forecastAgainstDrive(walk) {
    const tape = parseTape(JSON.stringify(walk));
    const run = createRunForStaging(solveStaging(stagingFromTape(tape)), SRC);
    const fc = run.corridorBodyForecast();
    const level = run.level;
    let worst = 0;
    const contacts = [];
    for (let t = 0; t < tape.tick_count; t += 1) {
        const rows = fc.step(run.state, { slashing: run.progress('slashInfo')?.state?.slashing === true });
        const pre = { x: run.state.x, y: run.state.y };
        const before = run.ticksCompleted;
        const { transition } = run.advance(heldKeysAt(tape, t));
        if (transition || run.level !== level) break;
        const struck = new Set(run.chaserPressHits.filter((h) => h.t === before
            && (h.tag === 'wallflyer' || h.tag === 'drill') && !String(h.why ?? '').startsWith('distanceRectPoint'))
            .map((h) => h.id));
        if (struck.size) fc.swing(pre, (rect, id) => struck.has(id));
        for (const r of rows) if (r.hitsPlayer) contacts.push(before + 1);
        const live = [...run.wallFlyers.bodies, ...run.drills.bodies];
        for (const r of rows) {
            const l = live.find((b) => b.id === r.id);
            worst = Math.max(worst, Math.abs(l.x - r.x), Math.abs(l.y - r.y));
        }
    }
    const hits = run.ledger('playerHits').filter((h) => h.source === 'wallflyer' || h.source === 'drill').map((h) => h.t);
    return { worst, contacts, hits };
}

function solveBoot(name) {
    const w = W(name);
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(w.tape))));
    const out = solveSegment({ run: createRunForStaging(staging, SRC), goals: w.goals, name, boot: staging.boot,
        forkRun: () => createRunForStaging(staging, SRC) });
    const run = createRunForStaging(staging, SRC);
    for (const held of out.perTick) run.advance(held);
    return { ticks: out.perTick.length, hits: run.ledger('playerHits').map((h) => `t${h.t} ${h.id}${h.died ? ' †' : ''}`) };
}

describe('fidelity CORRIDOR — the walk corridor prices the live wallflyers and drills', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_CORRIDOR_BODY_PRICING)(
        'ships OFF: no forecast, and a preview carries no `corridorBodies`', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.corridorBodyPricing).toBe(false);
            const w = W('survey-step-47.json');
            const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(w.walk)))), SRC);
            expect(run.corridorBodyForecast()).toBeNull();
            const walk = previewWalk(run, [{ x: 72, y: 136 }]);
            expect(walk.samples.length).toBeGreaterThan(0);
            expect(walk.samples.some((s) => 'corridorBodies' in s)).toBe(false);
            on(() => {
                expect(run.corridorBodyForecast()).not.toBeNull();
                expect(previewWalk(run, [{ x: 72, y: 136 }]).samples.every((s) => Array.isArray(s.corridorBodies)))
                    .toBe(true);
            });
        });

    it('corridorBodyDanger: a landing contact or an uncertain verdict is a `chaser` source naming its body', () => {
        const rows = [
            { kind: 'wallflyer', id: 'wallflyer@8,8', x: 15, y: 15, hitsPlayer: true, contact: true },
            { kind: 'drill', id: 'drill@32,32', x: 40, y: 40, hitsPlayer: false, contact: true },  // i-framed player
            { kind: 'drill', id: 'drill@64,64', x: 72, y: 72, hitsPlayer: false, contact: false, uncertain: true },
            { kind: 'wallflyer', id: 'wallflyer@96,8', x: 103, y: 15, hitsPlayer: false, contact: false },
        ];
        expect(corridorBodyDanger(rows).map((s) => [s.kind, s.id, s.body]))
            .toEqual([['chaser', 'wallflyer@8,8', 'wallflyer'], ['chaser', 'drill@64,64', 'drill']]);
        expect(corridorBodyDanger(null)).toEqual([]);
    });

    it('dangerAt prices the rows in TRANSIT only — the WAIT question has no walk to forecast them along', () => {
        const w = W('survey-step-47.json');
        const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(w.walk)))), SRC);
        const box = { x: 0, y: 0, w: 1, h: 1, right: 1, bottom: 1 };
        const rows = [{ kind: 'wallflyer', id: 'wallflyer@8,8', x: 15, y: 15, hitsPlayer: true }];
        const ids = (d) => d.sources.map((s) => s.id);
        expect(ids(dangerAt(run, 1, box, { mode: 'transit', corridorBodies: rows }))).toContain('wallflyer@8,8');
        expect(ids(dangerAt(run, 1, box, { mode: 'wait', corridorBodies: rows }))).not.toContain('wallflyer@8,8');
        expect(ids(dangerAt(run, 1, box, { mode: 'transit' }))).not.toContain('wallflyer@8,8');
    });

    it('the witness, wallflyers (step 47): the forecast holds every flyer at 0 px and lands at t84, as the game does',
        () => {
            const w = W('survey-step-47.json');
            expect(gameRises(w.game)).toEqual([84]);
            const r = on(() => forecastAgainstDrive(w.walk));
            expect(r).toEqual({ worst: 0, contacts: [84], hits: [84] });
        });

    it('the witness, the drill (step 114): 0 px, contacts at t48 and t110 — the game\'s — and none inside the i-frame',
        () => {
            const w = W('survey-step-114.json');
            expect(gameRises(w.game)).toEqual([48, 110]);
            const r = on(() => forecastAgainstDrive(w.walk));
            expect(r).toEqual({ worst: 0, contacts: [48, 110], hits: [48, 110] });
        });

    it('step 53 (L22): OFF the walk dies twice to wallflyers; ON it walks clean', () => {
        const a = off(() => solveBoot('survey-step-53-boot.json'));
        expect(a.ticks).toBe(406);
        expect(a.hits.filter((h) => h.endsWith('†'))).toHaveLength(2);
        const b = on(() => solveBoot('survey-step-53-boot.json'));
        expect(b.hits).toEqual([]);
        expect(b.ticks).toBe(126);
    }, 120_000);

    it('step 170 (L77): the lavarunner\'s contact gate reads its own i-frame, not the dark shield\'s — ON walks clean',
        () => {
            const a = off(() => solveBoot('survey-step-170-boot.json'));
            expect(a).toEqual({ ticks: 475, hits: ['t17 lavarunner@112,256'] });
            const b = on(() => solveBoot('survey-step-170-boot.json'));
            expect(b).toEqual({ ticks: 491, hits: [] });
        }, 120_000);
});
