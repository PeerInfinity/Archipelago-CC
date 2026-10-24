/**
 * seedling-fidelity-searchgaps (wave 28) D-A — sweep 40015230731's weight-22 leg.
 *
 * D-A — L41's CRUSHER BAIT (`CONTACT_FIDELITY.crusherBaitPressGoal`, OFF). Leg 871 refused: *"the ordering search found
 * nothing … (the round trip) … (102 state(s) expanded …)"*. W0 (measured on the leg's captured request): the round trip is
 * NOT what fails — the search reaches R5's own W,S,E ordering (the crusher on `button@248,232`, the start cell still in the
 * player's component) and throws it away because the AIM is still shut: the part is behind `wandlock@240,96`, whose button
 * only the fire block can hold, and the block is behind `cover@112,128`, whose button only the crusher can hold. And the
 * frontier's `break` of the shield rocks walked into the charge: every swing stance is in the west lane it opens (the
 * player died at t147, crusher 1000, and the run respawned them at the arrival).
 * ON: the search also answers a PRESS goal (the shortest ordering whose parks newly hold a presser of a shut group, round
 * trip kept); a rock in a resting crusher's lane is its SHIELD, resolved as that crusher's `bait` (an undashed walk to
 * chain 1's stance, the swing as the head of chain 1's approach); and R5's three L41 chains are looked up
 * (`BAIT_CHOREOGRAPHIES_L41`). The room then refuses at the wandlock (the fire block's push — not this key's region).
 * Game witness (p4g, `probe-seedling-crusher-press.mjs --record`): the plan through the bait plus a walk into the crusher's
 * vacated constructor cell, 0 px, never hit.
 *
 * Mutants (predicted first; copy + edit + run + restore), the results in the report.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment, SolverRefusal } from './solverBot.js';
import { L41_PART3 } from './r5Totem.js';
import {
    BAIT_CHOREOGRAPHIES, BAIT_CHOREOGRAPHIES_L41, chainsOf, choreographyFor, crusherShieldOf, searchBaitOrdering,
} from './crusherBait.js';
import { ropeStaging } from './fidelityRope.js';
import {
    CRUSHERPRESS_WITNESS_DIR, CRUSHERPRESS_WITNESSES, compareCrusherPressWitness, crusherPressModelSamples,
    crusherPressTape,
} from './fidelityCrusherPress.js';

const SRC = atlasLevelSource();
const W = CRUSHERPRESS_WITNESSES[0];
const ON = (fn) => withContactFidelity({ crusherBaitPressGoal: true }, fn);
const OFF = (fn) => withContactFidelity({ crusherBaitPressGoal: false }, fn);
const arrival = async () => createRunForStaging(await ropeStaging(W), SRC);
const SHIELD = ['breakablerock@224,64', 'breakablerock@224,80'];
const PART = { x: 244, y: 148, right: 252, bottom: 156 };
const searchShielded = (run) => {
    const live = run.liveGeometryOpts();
    return searchBaitOrdering({ run, liveOpts: { ...live, brokenRocks: new Set([...(live.brokenRocks ?? []), ...SHIELD]) },
        inventory: run.progress('inventory'), aimRect: PART, allowTeleporter: null });
};
const solve = async () => {
    const staging = await ropeStaging(W);
    try {
        return { out: solveSegment({ run: createRunForStaging(staging, SRC), goals: W.goals, name: 'crusherpress', boot: staging.boot,
            dashMode: 'all', forkRun: () => createRunForStaging(staging, SRC) }), refusal: null };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { out: null, refusal: e };
    }
};

describe('fidelity SEARCHGAPS D-A — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.crusherBaitPressGoal).toBe(false);
        expect(CONTACT_FIDELITY.crusherBaitPressGoal).toBe(false);
    });
});

describe('fidelity SEARCHGAPS D-A — the ordering search at L41', () => {
    it('both rocks stand in crusher@240,64\'s west lane: each is its SHIELD', async () => {
        const run = await arrival();
        for (const id of SHIELD) expect(crusherShieldOf(run, id)).toEqual({ crusher: 'crusher@240,64', rocks: SHIELD });
        expect(crusherShieldOf(run, 'breakablerock@999,999')).toBeNull();
    });
    it('W0: OFF, the search EXHAUSTS 102 states although it reaches R5\'s W,S,E — the aim is behind the wandlock', async () => {
        const run = await arrival();
        const found = OFF(() => searchShielded(run));
        expect(found.ordering).toBeNull();
        expect(found.stats.expanded).toBe(102);
        expect(found.why).toMatch(/the round trip/);
    });
    it('ON: the PRESS goal — W,S,E, the crusher parked on button@248,232, the round trip kept', async () => {
        const run = await arrival();
        const found = ON(() => searchShielded(run));
        expect(found.goal).toBe('press');
        expect(found.holds).toEqual(['button@248,232 {t 0}']);
        expect(found.ordering.map((s) => s.dir).join('')).toBe('WSE');
        expect(found.parks['crusher@240,64']).toEqual(L41_PART3.parks[2].to);
        expect(chainsOf(found.ordering).map((c) => c.charges.join(''))).toEqual(['W', 'S', 'E']);
    });
    it('the L41 rows are R5\'s chains, field for field, and are read only while the key is ON', async () => {
        BAIT_CHOREOGRAPHIES_L41.forEach((row, i) => {
            const b = L41_PART3.baits[i];
            expect(row.src).toBe(`L41_PART3.baits[${i}]`);
            expect({ from: row.from, park: row.park, charges: row.charges.join(''), start: row.start,
                approach: row.approach, spans: row.spans })
                .toEqual({ from: b.from, park: b.park, charges: b.dir, start: b.stance, approach: b.approach, spans: b.spans });
        });
        expect(BAIT_CHOREOGRAPHIES.some((r) => r.level === 41)).toBe(false);
        const run = await arrival();
        const chains = chainsOf(ON(() => searchShielded(run)).ordering);
        expect(OFF(() => chains.map((c) => choreographyFor(41, c)))).toEqual([null, null, null]);
        expect(ON(() => chains.map((c) => choreographyFor(41, c)))).toEqual([...BAIT_CHOREOGRAPHIES_L41]);
    });
});

describe('fidelity SEARCHGAPS D-A — the solver at L41', () => {
    it('OFF: the leg\'s refusal, after the bare `break` walked into the charge (a death at t147)', async () => {
        const { refusal } = await OFF(solve);
        expect(refusal.message).toMatch(/bait crusher@240,64 in level 41 — the ordering search found nothing/);
    }, 120_000);
    it('ON: the shield swing and three chains, then the room refuses at the wandlock (not this key\'s wall)', async () => {
        const { out, refusal } = await ON(solve);
        expect(out).toBeNull();
        const bait = refusal.rows.find((r) => r.strategy?.verb === 'bait');
        expect(bait.obstacle.id).toBe('breakablerock@224,80');
        expect(refusal.rows.some((r) => r.strategy?.verb === 'break')).toBe(false);
        expect(refusal.rows.find((r) => r.strategy?.verb === 'hold')?.obstacle?.id).toBe('wandlock@240,96');
        expect(refusal.message).toMatch(/wandlock at \(240,96\)/);
    }, 120_000);
});

describe('fidelity SEARCHGAPS D-A — the game witness (p4g, fixtures/crusherpress-witness)', () => {
    const rec = JSON.parse(readFileSync(join(CRUSHERPRESS_WITNESS_DIR, `${W.name}.json`), 'utf8'));
    it('the solver still plans the recorded tape (the bait cut, then the probe walk)', async () => {
        const { tape, cut } = await crusherPressTape(W);
        expect(cut).toBe(rec.cut);
        expect(tape).toEqual(rec.tape);
    }, 120_000);
    it('the model reproduces the game at 0 px, never hit; the crusher parked on the button and the cover open', async () => {
        const model = await crusherPressModelSamples(rec.tape);
        expect(model.error).toBeNull();
        expect(compareCrusherPressWitness(rec.samples, model.samples)).toEqual([]);
        expect(rec.samples.every((s) => s.hits === 0)).toBe(true);
        expect(model.end).toEqual(rec.model);
        expect(model.end.crushers['crusher@240,64']).toEqual({ x: 256, y: 240 });
        expect(model.end.contacts).toBe(0);
        expect(model.end.open).toContain('cover@112,128');
    }, 120_000);
    it('the stream DISCRIMINATES: without the shield swing\'s press the model stops short of the crusher\'s home', async () => {
        const inputs = rec.tape.inputs.filter((s) => s.key !== 'primary');
        const control = await crusherPressModelSamples({ ...rec.tape, inputs });
        const last = rec.samples.at(-1);
        const m = control.samples[last.t];
        expect(Math.hypot(m.x - last.x, m.y - last.y)).toBeGreaterThan(8);
    }, 120_000);
});
