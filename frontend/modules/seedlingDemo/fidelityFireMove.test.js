/**
 * ⛓⛓⛓ SEEDLING FIDELITY FIREMOVE — the solver moves a `PushableBlockFire` by FIRE presses and a fire block parked on a
 * button dwells (`CONTACT_FIDELITY.fireBlockRoute`, OFF; wave 29).
 *
 * The gap (three of the top unserved edges): `deriveBlockRoute` had a lean and a spear thrust and no Fire press, and
 * `deriveWeigh` skipped the fire family, so the frontier refused *"NO block in this room can reach it"* — L39's opener,
 * L40's t5 holder (`wandlock@800,400`), L41's wandlock button. Rows:
 *   · the switch ships OFF, and OFF the weigh still skips the fire family by name;
 *   · ON, the solver's own L40 route for the t5 holder IS FIREPUSH's scripted, game-witnessed `FIREPUSH_ROUTE`;
 *   · ON, the L41 recording (the survey's step 94, solved; `fixtures/firemove-witness/`, p4g headless) replays at 0 px,
 *     its six presses are one tile each from (7,9) to the button (11,11), and there the weigh's parked arm answers;
 *   · ON, L39's block 2 is routed as `r5Shaft.SHAFT_PLAN`'s presses 4-8, and a stance whose flame reaches a spinner is
 *     refused by name (the audit).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    FIREMOVE_L40, FIREMOVE_L41, FIREMOVE_L41_WITNESS, FIREMOVE_SWITCHES, FIREMOVE_WITNESS_DIR,
    compareFireMoveWitness, fireMoveModelSamples, unpackFireMoveSample,
} from './fidelityFireMove.js';
import { FIREPUSH_ROUTE, firePushPrefixTape } from './fidelityFirePush.js';
import { MAX_FIRE_ROUTE_ORDERS, MAX_ROUTE_EXPANSIONS, deriveBlockRoute, deriveWeigh } from './solverBot.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { SHAFT_PLAN } from './r5Shaft.js';

const W = JSON.parse(readFileSync(join(FIREMOVE_WITNESS_DIR, `${FIREMOVE_L41_WITNESS}.json`), 'utf8'));
const GAME = W.samples.map(unpackFireMoveSample);

let prefixOnce = null;
const prefixT2 = () => (prefixOnce ??= firePushPrefixTape(0, { route: false }));

/** A model run at the end of a prefix tape, under `over`. */
const runAtEnd = (tapeJson, over) => withContactFidelity(over, () => {
    const tape = parseTape(JSON.stringify(tapeJson));
    const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
    for (let t = 0; t < tape.tick_count; t += 1) run.advance(new Set(heldKeysAt(tape, t)));
    return run;
});

describe('FIREMOVE — the switch', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_FIRE_BLOCK_ROUTE)('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.fireBlockRoute).toBe(false);
        expect(CONTACT_FIDELITY.fireBlockRoute).toBe(false);
    });
});

describe('FIREMOVE — L40, the t5 holder (from the state after `r5-l40-part5`\'s t2 wait)', () => {
    it('OFF: the weigh skips the fire family by name ("it moves on a PRESS, not on a lean")', async () => {
        const over = { ...FIREMOVE_SWITCHES, fireBlockRoute: false };
        const run = runAtEnd(await prefixT2(), over);
        const d = withContactFidelity(over, () => deriveWeigh(run, FIREMOVE_L40.onto, new Set(FIREMOVE_L40.contacts)));
        expect(d.plan).toBeNull();
        expect(d.rejected.find((r) => r.option === `weigh with ${FIREMOVE_L40.block}`).why)
            .toContain('moves on a PRESS, not on a');
    }, 120_000);

    it('ON: the solver\'s own route is FIREPUSH_ROUTE, press for press (35 Fire presses, each stance and cell)', async () => {
        const run = runAtEnd(await prefixT2(), FIREMOVE_SWITCHES);
        const row = run.world.pushables.find((p) => p.id === FIREMOVE_L40.block);
        const r = withContactFidelity(FIREMOVE_SWITCHES, () => deriveBlockRoute(run, row,
            { kind: 'press', onto: FIREMOVE_L40.onto }, new Set(FIREMOVE_L40.contacts), []));
        expect(r.refused).toBeNull();
        expect(r.steps.length).toBe(FIREPUSH_ROUTE.length);
        expect(r.steps.length).toBeLessThanOrEqual(MAX_FIRE_ROUTE_ORDERS);
        expect(r.expansions).toBeLessThan(MAX_ROUTE_EXPANSIONS);
        r.steps.forEach((s, i) => {
            const p = FIREPUSH_ROUTE[i];
            expect(s.verb).toBe('fire');
            expect(s.from).toEqual(p.from);
            expect(s.to).toEqual(p.to);
            expect(s.stance).toEqual({ x: p.stance.tx * 16 + 8, y: p.stance.ty * 16 + 8 });
        });
    }, 240_000);
});

describe('FIREMOVE — L41, the wandlock\'s holder (`firemove-l41-part3`, p4g headless)', () => {
    it('the recording replays at 0 px with the keys ON (the player and every pushable block, every tick)', async () => {
        const model = await fireMoveModelSamples(W.tape, FIREMOVE_SWITCHES);
        expect(model.error).toBeNull();
        expect(GAME.length).toBeGreaterThan(2000);
        expect(compareFireMoveWitness(GAME, model.samples, FIREMOVE_L41.level)).toEqual([]);
    }, 240_000);

    it('the solver\'s presses move the block one tile each, (7,9) to the button (11,11), and there it is PARKED', () => {
        const tape = parseTape(JSON.stringify(W.tape));
        const cells = [];
        let parked = null;
        withContactFidelity(FIREMOVE_SWITCHES, () => {
            let run = null;
            const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            for (let r = st.next(); !r.done; r = st.next()) {
                const b = run?.level === FIREMOVE_L41.level ? run.entities('pushables').get(FIREMOVE_L41.block) : null;
                if (!b || b.removed || b.rect.x % 16 || b.rect.y % 16) continue;
                const c = { tx: b.rect.x / 16, ty: b.rect.y / 16 };
                if (!cells.length || cells.at(-1).tx !== c.tx || cells.at(-1).ty !== c.ty) cells.push(c);
                if (parked === null && c.tx === FIREMOVE_L41.onto.tx && c.ty === FIREMOVE_L41.onto.ty) {
                    parked = deriveWeigh(run, FIREMOVE_L41.onto, new Set()).parked;
                }
            }
        });
        expect(cells[0]).toEqual(FIREMOVE_L41.from);
        expect(cells.at(-1)).toEqual(FIREMOVE_L41.onto);
        expect(cells.length - 1).toBe(6);
        cells.slice(1).forEach((c, i) => expect(Math.abs(c.tx - cells[i].tx) + Math.abs(c.ty - cells[i].ty)).toBe(1));
        expect(parked).toEqual({ blockId: FIREMOVE_L41.block, from: FIREMOVE_L41.onto });
    }, 240_000);
});

describe('FIREMOVE — L39, the shaft (`r5-press-delay`\'s boot, before any press)', () => {
    const boot = () => {
        const tape = parseTape(readFileSync(join(import.meta.dirname, 'fixtures', 'tapes', 'r5-press-delay.json'), 'utf8'));
        return createRunForStaging(stagingFromTape(tape), atlasLevelSource());
    };
    const route = () => withContactFidelity(FIREMOVE_SWITCHES, () => {
        const run = boot();
        const row = run.world.pushables.find((p) => p.id === 'pushableblockfire@208,80');
        return deriveBlockRoute(run, row, { kind: 'press', onto: { tx: 12, ty: 9 } }, new Set(), []);
    });

    it('block 2 to (12,9) is SHAFT_PLAN\'s presses 4-8, stance for stance (W off its spawn, then S down column 12)',
        () => {
            const r = route();
            const plan = SHAFT_PLAN.slice(3, 8);
            expect(r.steps.map((s) => s.verb)).toEqual(plan.map(() => 'fire'));
            r.steps.forEach((s, i) => {
                expect([s.from.tx, s.from.ty]).toEqual(plan[i].moves[0].from);
                expect([s.to.tx, s.to.ty]).toEqual(plan[i].moves[0].to);
                expect(s.stance).toEqual({ x: plan[i].stance.tx * 16 + 8, y: plan[i].stance.ty * 16 + 8 });
            });
        }, 120_000);

    it('the flame is audited: the N press from (13,6) also reaches spinner@224,112, so it is refused by name', () => {
        const rej = route().rejected.find((x) => x.option === 'fire N');
        expect(rej.why).toContain('also reaches spinner@224,112');
    }, 120_000);
});
