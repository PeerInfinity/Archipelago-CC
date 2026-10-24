/**
 * ⛓ fidelity L32 arena prefix (R7 combined A/B 39370062402, sweep legs 349 / 350) — a reach-pit to L32's pit, from
 * the L30 door arrival with Bob alive, goes THROUGH the fight (`solverBot.arenaPrefixFor`).
 *
 * With `apReportBosses` ON, `FallRockLarge.as` (R4) adds the boss while `{32,3}` holds, with no `hasFire` guard, so
 * the walk up arms the rock, lands it and opens Bob's dialogue. Before the prefix, the dashless pass stood frozen at
 * (72,116.75) for 400 ticks (the walk's `up` never pages) and the dash pass refused on its planned press landing in
 * the rock's arm frame (`FROZEN_TICK_PRESS`). Fixture: the two legs' captured requests, as the page's worker got
 * them. ~28 s a solve, so the slow tier.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { solveAnytime } from './jsRuntimeSolver.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE = join(HERE, '..', '..', '..', 'CC', 'docs', 'cloud-reports', 'seedling-fidelity-l32arena-evidence');

const LEGS = gunzipSync(readFileSync(join(EVIDENCE, 'legs-349-350-requests.jsonl.gz'))).toString('utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

const solvePass = (row, i) => {
    const { passes, source, ...tape } = restoreRequest(row.requests[0].request);
    return solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes: [passes[i]] });
};

describe('L32 arena prefix — the pit legs from the L30 door fight Bob first', () => {
    it('the fixture is the two legs, staged at the door with Fire held', () => {
        expect(CONTACT_FIDELITY.apReportBosses).toBe(true);
        expect(LEGS.map((r) => r.key)).toEqual([
            'level_32 <- in_L30_224_160 -> exit:out_pit_14_5',
            'level_32 <- in_L30_224_160 -> exit:out_pit_15_5',
        ]);
        for (const r of LEGS) expect(r.requests[0].request.staging.seam.items.hasFire).toBe(true);
    });

    it.each([{ id: 349, i: 0, pass: 'dashless' }, { id: 349, i: 1, pass: 'full' },
        { id: 350, i: 0, pass: 'dashless' }, { id: 350, i: 1, pass: 'full' }])(
        'leg $id, the $pass pass: solves through the kill and the burn, and lands on L30', ({ id, i, pass }) => {
            const a = solvePass(LEGS.find((r) => r.id === id), i);
            expect(a.ok, a.message).toBe(true);
            expect(a.plan.pass).toBe(pass);
            expect(a.plan.verbs).toEqual(expect.arrayContaining(['kill', 'burn']));
            expect(a.plan.expected.at(-1)).toMatchObject({ level: 30, deaths: 0 });
        });
});
