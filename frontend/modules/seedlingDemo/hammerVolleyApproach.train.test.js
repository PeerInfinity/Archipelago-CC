// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier. Runs on js-land/** train pushes and on dispatch (`-f train=true`),
// NOT on a slice push. `npm run test:unit:train`.
/**
 * seedlingDemo/hammerVolleyApproach.train.test — ⛓⛓ SEEDLING HAMMER-PHASE VOLLEY-APPROACH (`VOLLEY_APPROACH`, OFF) on
 * the two workloads where LWEIGH's reordered corpse weigh is hit on its way into `iceturret@472,400`'s range.
 *   - Leg 860's captured request (860/1 at L40C's seam 5950) under SPIN's arm A5 (CPAIR-3, ICEST, OPP, LWF,
 *     `orbitFreeAim`, SBD) + `PRESS_ESCAPE_EXACT` + fidelity's `forecastShieldBump`, `frozenPressForecast` ON, the deadline
 *     at 10240 work units: OFF it refuses at t2118 by LWEIGH's name (volley 2's #2.0 on the stance walk, which stood at
 *     (471.2,456.0) through the t2111 startshot). ON the walk is rewound to t2035 (the last tick outside the range +
 *     the staging clearance), APPROACH's fork search finds the up side via (466,445) after a wait of 34, and the solve
 *     runs past t2118 to its next wall: the weigh's own fade dwell (`execCorpseWeigh`, "corpse home"), whose condition
 *     is already true when it is asked — the wall OFF's dashless pass meets too.
 *   - The latch chain (L40LATCH's boot) with CPAIR size 3 + LWF, `TURRET_APPROACH` and `turretSnapPricing` OFF
 *     (`hammerLatchWeigh.train.test.js`'s second row, which pins OFF's t917 refusal): ON the walk is rewound to t817,
 *     the right side via (467,402) after a wait of 46 is hitless, and the chain then applies the four orders
 *     L40C's guard-off arm applied and meets the strategy bound at `pushableblock@576,560`; with `FIFTH_ORDER` as well
 *     it SOLVES Boss Key 2 at 4286 ticks, hitless on a fresh run of the model.
 * ⛔ Each 860 solve is ~4 min, the latch solve ~2–4 min.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { withPressEscapeShieldClaim } from './pressKillGuards.js';
import { SHIELD_BUMP_FORECAST_KEY, withPressEscapeExact } from './pressEscapeExact.js';
import {
    CHOOSER_PAIR, VOLLEY_APPROACH_COUNTS, resetVolleyApproachCounts, withChooserPair, withFifthOrder,
    withIceTurretStaticKill, withLatchWeighFirst, withTurretApproach, withVolleyApproach,
} from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TURRET = 'iceturret@472,400';
const LWEIGH_REFUSAL = 'the reordered corpse weigh took a hit at t2118 (blast:iceturret@472,400#2.0) on its way to '
    + 'iceturret@472,400\'s kill stance (488,445) — the approach into the turret\'s range is not certified (⛓ LWEIGH: '
    + 'a volley-aware approach is the unbuilt arm)';
const FADE_WALL = /-> weigh \(fade, corpse home\): the dwell's condition \(every shut responder in group t=2 \[wandlock@448,432, wandlock@512,480\] is open\) is ALREADY TRUE before a tick is spent/;
const SNAP_OFF = CONTACT_FIDELITY_KEYS.includes('turretSnapPricing') ? { turretSnapPricing: false } : {};

function leg860Request(seam = 5950) {
    const row = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'spin-witness', 'leg860-request.json.gz')))
        .toString('utf8'));
    const c = row.request;
    return restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: seam } } });
}

/** Run `fn` with `CHOOSER_PAIR`'s largest set at `size`, restoring it. */
async function withPairSize(size, fn) {
    const was = CHOOSER_PAIR.size;
    CHOOSER_PAIR.size = size;
    try {
        return await fn();
    } finally {
        CHOOSER_PAIR.size = was;
    }
}

/** Step `perTick` (with `equips`) on a fresh run of the latch boot: the hits, deaths, the turret's death, the lock, keys. */
async function replayLatch(perTick, equips) {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const boot = await l40LatchBoot();
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, 'volley',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'volley', tick_count: perTick.length,
        inputs: folded.inputs, equips: [...(boot.equips ?? []), ...(equips ?? [])] }));
    let run = null;
    let turretDead = null;
    let lockOpen = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) {
        const t = r.value.observation.t;
        const u = run.entities('turrets').get(TURRET);
        if (u.dead && turretDead === null) turretDead = { t, tile: [Math.floor(u.x / 16), Math.floor(u.y / 16)] };
        if (lockOpen === null && run.entities('openActivators').has('wandlock@448,432')) lockOpen = t;
    }
    return { hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })), deaths: run.playerDeaths.length,
        turretDead, lockOpen, collected: run.ledger('collected') };
}

/** 860 under A5 + `PRESS_ESCAPE_EXACT` + `forecastShieldBump` + `frozenPressForecast`; `TURRET_APPROACH` pinned OFF. */
function solve860(volley) {
    const { passes = ANYTIME_PASSES, source, ...tape } = leg860Request();
    const passesSeen = [];
    const solve = () => solveAnytime({ ...tape, budgetWork: 10240, source, levelSource: levelSourceFromAtlas(source.records) },
        { passes, onPass: (one) => passesSeen.push({ pass: one.pass, ok: one.ok, message: one.message }) });
    const exact = () => withPressEscapeShieldClaim(false, () => withPressEscapeExact(true, solve));
    const keys = () => withContactFidelity({ orbitFreeAim: true, strategyBoundDistinct: true,
        [SHIELD_BUMP_FORECAST_KEY]: true, frozenPressForecast: true }, exact);
    const switches = () => withLatchWeighFirst(true, () => withTurretApproach(false,
        () => withVolleyApproach(volley, keys)));
    const answer = withPairSize3Sync(() => withChooserPair(true, () => withIceTurretStaticKill(true,
        () => withOpportunisticStrike(true, switches))));
    return { answer, passesSeen };
}

/** `withPairSize(3, …)` for a synchronous `fn`. */
function withPairSize3Sync(fn) {
    const was = CHOOSER_PAIR.size;
    CHOOSER_PAIR.size = 3;
    try {
        return fn();
    } finally {
        CHOOSER_PAIR.size = was;
    }
}

const NEEDS = !CONTACT_FIDELITY_KEYS.includes(SHIELD_BUMP_FORECAST_KEY) || !CONTACT_FIDELITY_KEYS.includes('frozenPressForecast');

describe('hammer-phase VOLLEY-APPROACH (train)', () => {
    it.skipIf(NEEDS)('leg 860, A5: OFF refuses by LWEIGH\'s name at t2118; ON rewinds to t2035, approaches hitless, and '
        + 'runs past t2118 to the weigh\'s fade dwell', async () => {
        const off = solve860(false);
        expect(off.answer.ok).toBe(false);
        expect(off.answer.message).toContain(`-> weigh (wandlock@448,432): ${LWEIGH_REFUSAL}`);
        resetVolleyApproachCounts();
        const on = solve860(true);
        expect(on.answer.ok).toBe(false);
        expect(on.answer.message).not.toContain('took a hit at t2118');
        expect(on.answer.message).toMatch(FADE_WALL);
        expect(on.answer.work).toBeGreaterThan(off.answer.work);
        // the full pass's retry (the dashless pass's walk was not hit, so nothing was asked there)
        expect(VOLLEY_APPROACH_COUNTS.retries).toEqual([expect.objectContaining({ turret: TURRET, from: 1448,
            entry: 2035, t: 2035, verdict: 'approached', side: 'up', via: { x: 466, y: 445 }, wait: 34 })]);
        expect(on.passesSeen.map((p) => p.pass)).toEqual(['dashless', 'full']);
        for (const p of on.passesSeen) expect(p.message).toMatch(FADE_WALL);
    }, 1_800_000);

    it('the latch chain, CPAIR size 3 + LWF (TURRET_APPROACH OFF): ON rewinds the t917 approach to t817 and approaches '
        + 'hitless; alone it meets the four-order bound, with FIFTH_ORDER it SOLVES Boss Key 2 hitless at 4286', async () => {
        const boot = await l40LatchBoot();
        const latch = (fifth) => withContactFidelity(SNAP_OFF, () => withPairSize(3, () => withChooserPair(true,
            () => withLatchWeighFirst(true, () => withTurretApproach(false, () => withFifthOrder(fifth,
                () => withVolleyApproach(true, () => l40LatchSolve(boot))))))));
        const RETRY = expect.objectContaining({ turret: TURRET, from: 0, entry: 817, t: 817, verdict: 'approached',
            side: 'right', via: { x: 467, y: 402 }, wait: 46 });
        resetVolleyApproachCounts();
        const alone = await latch(false);
        expect(alone.out).toBeNull();
        expect(alone.refusal.message).toContain('applied 4 strategies for one goal [shove(pushableblockfire@576,576), '
            + 'weigh(wandlock@448,432), hold(wandlock@480,560), weigh(wandlock@800,400)]');
        expect(alone.refusal.obstacle).toMatchObject({ kind: 'solid', id: 'pushableblock@576,560' });
        expect(VOLLEY_APPROACH_COUNTS.retries).toEqual([RETRY]);
        resetVolleyApproachCounts();
        const fifth = await latch(true);
        expect(fifth.refusal).toBeNull();
        expect(fifth.out.perTick).toHaveLength(4286);
        expect(VOLLEY_APPROACH_COUNTS.retries).toEqual([RETRY]);
        // the walk certified is the walk driven: the solve's keys on a fresh run of the latch boot
        const g = await replayLatch(fifth.out.perTick.map((k) => [...k]), fifth.out.equips);
        expect(g.hits).toEqual([]);
        expect(g.deaths).toBe(0);
        expect(g.turretDead).toEqual({ t: 1103, tile: [30, 26] });
        expect(g.lockOpen).toBe(1371);
        expect(g.collected).toEqual([expect.objectContaining({ t: 4286, level: 40, keyType: 2 })]);
    }, 1_800_000);
});
