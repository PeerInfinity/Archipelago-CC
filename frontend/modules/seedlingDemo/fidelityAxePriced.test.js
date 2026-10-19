/**
 * ⛓ fidelity AXEFORCEDU D2/D3 — A SPINNING AXE'S FORCED U, PRICED (`CONTACT_FIDELITY.axePricedCrossing`, OFF by default;
 * `axePricedCrossing.js`, `solverBot`'s ladder after the forced-hit rung).
 *
 *     SpinningAxe.as:49-76   the blade sweeps its reach once a revolution; hitPlayer: force 5, damage 1
 *     Player.as:336          20 i-frames after a hit
 *
 * L71's north exit (sweep leg 603), L75's north exit (636) and L103's east exit (774) go round a hub AGAINST the blade:
 * no stall and no dash-chain phase crosses clean, and the forced-hit rung's input tree cannot reach a blade met 47–153
 * ticks out. The rung certifies that (every phase of the corridor is in blade contact) and then prices each member on
 * a fork with the run's own billing. MEASURED: the billing refuses every one — the knockback throws the player into L71's
 * lava (or the blade lands its third hit) and into L103's pit; in L75 the hit's camera shake leaves `lavarunner@104,64`
 * neither surely on nor surely off screen, which the model refuses to guess (⚖ never the cosmetic RNG).
 *
 * Game witnesses (p4f headless, `botLoadTape`/`botDrain` + the last `botStatus` poll per tick; the AXEFORCEDU report's
 * `drivers/game.mjs`), recorded from the members the fork refused:
 *   - `axeforcedu-l71-603-member` — leg 603 at `seamTime` 5412, the doorstep stall 2: the blade at t48, the lava death,
 *     the respawn at (296,104) at t81, and the loop again (5 hits) — 417 game rows.
 *   - `axeforcedu-l103-774-member` — leg 774 at 5528, the doorstep stall 12: the blade at t156, the pit, the respawn at
 *     (24,72) at t178 — 554 game rows.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { AXE_PRICED_CROSSING, admitAxeCrossing, isAxeHit } from './axePricedCrossing.js';
import { FORCED_HITS } from './forcedHit.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${name}.json`), 'utf8'));
const L603 = witness('axeforcedu-l71-603-member');
const L774 = witness('axeforcedu-l103-774-member');
const S152 = witness('axetiming-l61-152-plan');

/** The model's replay of a witness against its game rows: the ticks it parts at, its hits, its deaths. */
const replay = (W, axeHit) => withContactFidelity({ spinningAxePlayerHit: axeHit }, () => {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(W.tape)), { levelSource: SRC,
        onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        col[r.value.observation.t] = r.value.observation;
        r = st.next();
    }
    const parted = W.rows.filter((g) => !col[g.t] || col[g.t].x !== g.x || col[g.t].y !== g.y
        || col[g.t].level !== g.level).map((g) => g.t);
    return { parted, hits: run.playerHits.map((h) => `t${h.t} ${h.source}`),
        deaths: (run.ledger('playerDeaths') ?? []).map((d) => `t${d.t} ${d.source}`) };
});

/** The game's own reading: the ticks `botStatus().hits` rose, and the ticks it fell back to 0 (a respawn). */
const gameHits = (W) => W.rows.filter((g, i) => i > 0 && typeof g.hits === 'number' && typeof W.rows[i - 1].hits === 'number'
    && g.hits > W.rows[i - 1].hits).map((g) => g.t);

describe('AXEFORCEDU D2 — the switch and its bounds', () => {
    it('ships OFF, appended after every older key (wave 18\'s last, `statueTalkRange`)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.axePricedCrossing).toBe(false);
        expect(CONTACT_FIDELITY_KEYS.indexOf('axePricedCrossing'))
            .toBe(CONTACT_FIDELITY_KEYS.indexOf('statueTalkRange') + 1);
    });
    it('its bounds: a preview bound for the certificate, eight members priced on forks', () => {
        expect({ maxPreviews: AXE_PRICED_CROSSING.maxPreviews, forkCandidates: AXE_PRICED_CROSSING.forkCandidates })
            .toEqual({ maxPreviews: 200, forkCandidates: 8 });
        expect(AXE_PRICED_CROSSING.enabled).toBe(false);
        withContactFidelity({ axePricedCrossing: true }, () => expect(AXE_PRICED_CROSSING.enabled).toBe(true));
    });
});

describe('AXEFORCEDU D2 — the admission: the forced-hit rung\'s budget, axe hits only, alive, at the goal', () => {
    const axe = (t) => ({ t, level: 71, source: 'spinningaxe', id: 'spinningaxe@256,144', hits: 1 });
    const base = { died: 0, crossed: true, hitsMax: 3, hitsNow: 0, budgetLeft: FORCED_HITS.maxPerSegment,
        maxHitsPerCrossing: FORCED_HITS.maxHitsPerCrossing, margin: FORCED_HITS.margin };
    it('one axe hit, alive, at the goal: admitted', () => {
        expect(admitAxeCrossing({ ...base, billed: [axe(48)] })).toEqual({ ok: true });
    });
    it('a death is refused first, whatever it billed', () => {
        expect(admitAxeCrossing({ ...base, billed: [axe(48)], died: 1 }).why).toBe('the crossing dies on the fork');
    });
    it('a walk that does not reach the crossing\'s level is refused', () => {
        expect(admitAxeCrossing({ ...base, billed: [], crossed: false }).ok).toBe(false);
    });
    it('a hit that is not a spinning axe\'s is refused by name (the certificate prices the axes only)', () => {
        const lava = { t: 76, level: 71, source: 'lava', id: 'lava@L71', hits: 1 };
        expect(isAxeHit(lava)).toBe(false);
        expect(admitAxeCrossing({ ...base, billed: [lava] }).why).toMatch(/not a spinning axe's \(t76 lava:lava@L71\)/);
    });
    it('the cap is FORCED_HITS\': two hits over one per crossing, one hit with one already taken (margin 1)', () => {
        expect(admitAxeCrossing({ ...base, billed: [axe(48), axe(80)] }).why).toMatch(/takes 2 axe hit\(s\), over the budget's 1/);
        expect(admitAxeCrossing({ ...base, billed: [axe(48)], hitsNow: 1 }).why).toMatch(/over the budget's 0/);
    });
});

describe('AXEFORCEDU D3 — the refused members on the game: 0 px, the hit, the death, the respawn', () => {
    for (const [name, W, level, hitTicks, respawn] of [
        ['axeforcedu-l71-603-member', L603, 71, [48, 128, 208, 288, 368], { t: 81, x: 296, y: 104 }],
        ['axeforcedu-l103-774-member', L774, 103, [156], { t: 178, x: 24, y: 72 }]]) {
        it(`${name}: a game row for each of the tape's ${W.tape.tick_count} ticks and t0; the game's hits rise at ${hitTicks.join(', ')}`, () => {
            expect(W.rows).toHaveLength(W.tape.tick_count + 1);
            expect(W.rows[0]).toMatchObject({ t: 0, level });
            expect(gameHits(W)).toEqual(hitTicks);
            // the respawn: back at the room's entry with hits 0, the tick after the fall's last frame
            expect(W.rows[respawn.t]).toMatchObject({ x: respawn.x, y: respawn.y, hits: 0, level });
        });
        it(`${name}: spinningAxePlayerHit ON replays it at 0 px on every tick, billing the game's hits and the death`, () => {
            const r = replay(W, true);
            expect(r.parted).toEqual([]);
            expect(r.hits.filter((h) => h.endsWith('spinningaxe')).map((h) => Number(h.slice(1).split(' ')[0])))
                .toEqual(hitTicks);
            expect(r.deaths[0]).toMatch(level === 71 ? /^t\d+ lava$/ : /^t\d+ pit$/);
        });
        it(`${name}: OFF the model leaves the game at the first hit`, () => {
            expect(replay(W, false).parted[0]).toBe(hitTicks[0]);
        });
    }
});

/** The witness tape's own staging, solved by the dashless pass (`dashMode: 'none'`, the page's first pass). */
const solveFrom = (W, goal, over, dashMode = 'none', extra = {}) => {
    const staging = { ...stagingFromTape(parseTape(JSON.stringify(W.tape))), ...extra };
    return withContactFidelity(over, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, SRC),
        goals: [goal], name: 'axeforcedu', boot: staging.boot, persistence: staging.persistence, log: () => {},
        ...(dashMode ? { dashMode } : {}),
    }).then((s) => ({ ticks: s.out.perTick.length, forcedHits: s.out.forcedHits ?? null }),
        (e) => ({ refusal: e.message })));
};

describe('AXEFORCEDU D2 — leg 603 (L71 from (296,104) to teleporter@96,0), the dashless pass', () => {
    const goal = { kind: 'reach-exit', exit: { x: 96, y: 0 } };
    let off = null;
    it('OFF: the ladder EXHAUSTS on the blade, and the priced crossing is not asked', async () => {
        off = await solveFrom(L603, goal, { axePricedCrossing: false });
        expect(off.refusal).toMatch(/the combat ladder is EXHAUSTED\. The corridor passes through danger at \(280\.2,158\.4\) — hazard:spinningaxe@256,144/);
        expect(off.refusal).not.toMatch(/AXEPRICED/);
    }, 240000);
    it('ON: certified (every one of the 52 phases in blade contact), then every member priced dies — the same refusal, one clause longer', async () => {
        const on = await solveFrom(L603, goal, { axePricedCrossing: true });
        expect(on.refusal).toMatch(/AXEPRICED, \d+ preview\(s\)\): the corridor is hit at every phase \(52 member\(s\) over 1 family/);
        expect(on.refusal).toMatch(/stall 2 at sample 14 \(walk\): the crossing dies on the fork at t81 \(lava, after spinningaxe:spinningaxe@256,144 hit it at t48\)/);
        expect(on.refusal.startsWith(off.refusal)).toBe(true);
    }, 240000);
    // ⛓ found by the flip battery: SPINNINGAXE D2's step-163 row pins the axe's player arm OFF, and a fork then bills
    // nothing — a "priced" crossing the game hits. The rung refuses before any preview when the run cannot bill the axe.
    it('ON with spinningAxePlayerHit OFF: refused by name before any preview (the run cannot price the blade)', async () => {
        const r = await solveFrom(L603, goal, { axePricedCrossing: true, spinningAxePlayerHit: false });
        expect(r.refusal).toMatch(/AXEPRICED, 0 preview\(s\)\): the run does not bill a spinning axe \(`spinningAxePlayerHit` OFF\), so a crossing through its blade cannot be priced$/);
    }, 240000);
});

/**
 * ⛓ THE ADMITTED PATH, where nothing can be billed: the same staging under `noDamage` (`Player.hit` returns at its first
 * line, so the run bills no axe and no knockback). The danger map still sees the blade, so the ladder climbs exactly as
 * above; the certificate holds, the first member driven on a fork reaches the exit with nothing billed, and it is
 * replayed on the live run (the fork's keys, its rows — none — and its transition must be the run's).
 */
describe('AXEFORCEDU D2 — leg 603 under noDamage: the first member is admitted and replayed', () => {
    const goal = { kind: 'reach-exit', exit: { x: 96, y: 0 } };
    it('OFF: still EXHAUSTED (the danger map prices the blade whatever the damage)', async () => {
        const r = await solveFrom(L603, goal, { axePricedCrossing: false }, 'none', { noDamage: true });
        expect(r.refusal).toMatch(/the combat ladder is EXHAUSTED/);
    }, 240000);
    it('ON: SOLVED in 359 t through the doorstep stall 2, billing nothing (no forcedHits row)', async () => {
        const r = await solveFrom(L603, goal, { axePricedCrossing: true }, 'none', { noDamage: true });
        expect(r.ticks).toBe(359);
        expect(r.forcedHits).toBeNull();
    }, 240000);
});

describe('AXEFORCEDU D2 — the certificate refuses where a gap exists (survey step 152, L61, the AXE TIMING rung OFF)', () => {
    it('a dash-chain phase crosses free of blade contact: no hit is forced, so nothing is priced', async () => {
        const r = await solveFrom(S152, { kind: 'reach-exit', exit: { x: 0, y: 160 } },
            { axeTimingRung: false, axePricedCrossing: true }, null);
        expect(r.refusal).toMatch(/AXEPRICED, \d+ preview\(s\)\): the corridor entered \d+ tick\(s\) after the doorstep \(chain\+\d+\) crosses free of blade contact in its preview — a gap exists, so no hit is forced/);
    }, 240000);
});
