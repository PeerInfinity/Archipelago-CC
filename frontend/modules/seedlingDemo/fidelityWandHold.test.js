/**
 * seedling-fidelity-wandhold (wave 28) — THE WANDLOCK HOLDS: L40's lobber-reach hold and L39's covered presser.
 *
 * ⛓ L40 (sweep legs 368 / 371, `Totem Part 64,144`). The default solver refuses both at `buttonroom@272,208`'s
 * 131-tick still hold, inside `bombpusher@112,128`'s 256 px reach (`lobberHoldRefusal`). The group is LATCHED
 * (`ButtonRoom.as`'s setter, *"Can't be reset to false!!"*), so standing still is the SOLVER's choice, not the game's.
 * MOVINGWAIT already built the wait the game allows (`movingWait`, OFF), and with it ON leg 371's walk then throws on
 * a blast that lands on `spinner@192,160` unless `bombBlastBody` (OFF) lands it. With both ON, both legs SOLVE — two
 * paced holds each — and the game (p4g, headless, damage on) plays the solver's own inputs to the part with 0 hits at
 * 0 px, every bomb to the bit (`fixtures/bomb-witness/wandhold-l4{1,2}-*-paced.json`).
 *
 * ⛓ L39 (js links-b-onward, `Totem Part 72,40` from the L38 arrival). `wandlock@144,64`'s presser `button@112,144`
 * lies under `cover@112,144` {t 2}, whose only presser is the plain `button@160,144`. Guard (iii) hypothesised the
 * cover open by a `hold` (the outlive refinement asks `KILL_LOCK_TAGS` only) and the walk ground 400 ticks against it.
 * The game witness `wandhold-l39-cover-shuts`: stand on `button@160,144` (the cover opens), step west — the cover
 * shuts the moment the button drops, and the player stops at x 130.25 against it. `coverWeighRefine` (OFF) asks a
 * cover the lock's question; ON the refusal is by name, at 0 ticks, and names the cover as the wall.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { SolverRefusal } from './solverBot.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'bomb-witness', `${n}.json`), 'utf8'));
const { l40buttonStaging, L40BUTTON_GOAL } = await import('../../../scripts/procgen/plan-seedling-l40button-witness.mjs');

/** The L40 arm: the paced wait and the blast on a body, the two OFF switches this slice measured together. */
const L40_ON = Object.freeze({ movingWait: true, bombBlastBody: true });
const L40_LEGS = [
    { name: 'wandhold-l41-368-paced', leg: 368, key: 'level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144',
        boot: { level: 40, x: 928, y: 96 }, still: '(279.41302761753104,215.58073362346732)', ticks: 1601, blasts: 15, bodyHits: 0,
        verbs: ['brave', 'kill', 'hold', 'break', 'hold', 'collect'] },
    { name: 'wandhold-l42-371-paced', leg: 371, key: 'level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144',
        boot: { level: 40, x: 848, y: 16 }, still: '(280.68648150954834,215.81733159973635)', ticks: 1667, blasts: 18, bodyHits: 1,
        verbs: ['brave', 'hold', 'kill', 'break', 'hold', 'collect'] },
];

async function solveL40(boot) {
    const staging = await l40buttonStaging(boot);
    const levelSource = atlasLevelSource();
    return twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [L40BUTTON_GOAL], name: 'wandhold', boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
}

/** L39 from the L38 arrival (144,608), `{39,8}` staged (the plug L38's button removes), the survey's sphere items. */
async function solveL39() {
    const staging = await l40buttonStaging({ level: 39, x: 144, y: 608 });
    staging.persistence = [...(staging.persistence ?? []), { level: 39, tag: 8 }];
    const levelSource = atlasLevelSource();
    return twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [{ kind: 'collect-placement', placement: { x: 72, y: 40 } }], name: 'wandhold-l39', boot: staging.boot,
        dashMode: 'all', persistence: staging.persistence, log: () => {},
    });
}

const caught = async (p) => { try { await p; return null; } catch (e) { return e; } };

/** The model's run per sampled tick of a recorded witness (the game's camera read on uncertain shake ticks). */
function replay(w) {
    const tape = parseTape(JSON.stringify(w.tape));
    const cams = new Map(w.samples.map((s) => [s.t, s.cam]));
    let run = null;
    const st = createTapeStepper(tape, {
        levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        cameraWitness: (t) => cams.get(t) ?? null,
    });
    const cols = new Map();
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        cols.set(o.t, {
            p: [o.x, o.y],
            bombs: run.entities('bombs').map((b) => [b.x, b.y, b.v.x, b.v.y]),
            anim: run.entities('bombPushers')[0]?.anim ?? null,
            open: new Set(run.entities('openActivators')),
        });
        if (o.t >= w.upto) break;
    }
    return { cols, run };
}

/** Every sampled tick the model disagrees with the game on: the player, each bomb to the bit, the lobber's anim. */
function disagreements(w, cols) {
    const bad = [];
    for (const s of w.samples) {
        const m = cols.get(s.t);
        if (!m) { bad.push(`t${s.t}: no model tick`); continue; }
        if (m.p[0] !== s.p[0] || m.p[1] !== s.p[1]) bad.push(`t${s.t}: player ${s.p} vs ${m.p}`);
        const gb = [...s.bombs].sort((a, b) => a[0] - b[0]);
        const mb = [...m.bombs].sort((a, b) => a[0] - b[0]);
        if (JSON.stringify(gb) !== JSON.stringify(mb)) bad.push(`t${s.t}: bombs ${JSON.stringify(gb)} vs ${JSON.stringify(mb)}`);
        if ((s.anim ?? '') !== (m.anim ?? '')) bad.push(`t${s.t}: anim ${s.anim} vs ${m.anim}`);
    }
    return bad;
}

describe('WANDHOLD — the switch', () => {
    // ⛓ planning-11's flip (⚖ user, 2026-10-23: "Flip ON" coverWeighRefine, "Flip both ON" the L40 pair).
    it('coverWeighRefine and the L40 pair (movingWait, bombBlastBody) are ON by default (flipped)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.coverWeighRefine).toBe(true);
        expect(CONTACT_FIDELITY_DEFAULTS.movingWait).toBe(true);
        expect(CONTACT_FIDELITY_DEFAULTS.bombBlastBody).toBe(true);
    });
});

describe('WANDHOLD L39 — a cover held by a plain Button does not outlive the walker', () => {
    const w = witness('wandhold-l39-cover-shuts');

    it('the GAME witness: on button@160,144 the cover opens; stepping west it shuts and the player stops at x 130.25', () => {
        const { cols } = replay(w);
        expect(disagreements(w, cols)).toEqual([]);
        expect(w.samples.every((s) => s.hits === 0)).toBe(true);
        // the model's own cover state over the same ticks: open while the button is held, shut once it drops
        expect(cols.get(40).open.has('cover@112,144')).toBe(true);
        expect(cols.get(60).open.has('cover@112,144')).toBe(true);
        expect(cols.get(64).open.has('cover@112,144')).toBe(false);
        expect(cols.get(w.upto).open.has('cover@112,144')).toBe(false);
        // stopped against the shut cover's east face (the cover is x 112..128; no tile there)
        expect(w.samples.at(-1).p).toEqual([130.24999999999997, 149.25]);
        expect(cols.get(100).p[0]).toBe(cols.get(88).p[0]);
    });

    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('OFF (coverWeighRefine OFF): the hold stance is hypothesised behind the cover and the walk grinds 400 ticks against it', async () => {
        const e = await withContactFidelity({ coverWeighRefine: false }, () => caught(solveL39()));
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toContain('hold stance (wandlock@144,64): the re-planned corridor failed too');
        expect(e.message).toContain('waypoint 1 (120,152): not reached within 400 ticks; stalled at (119.37585598070463,162.0184411286208)');
        expect(e.message).toContain('cover at (112,144) on the Y axis');
    }, 120_000);

    it('ON: refused by name with no 400-tick grind — the cover is a wall guard (iii) cannot redeem durably', async () => {
        const e = await withContactFidelity({ coverWeighRefine: true }, () => caught(solveL39()));
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toContain('no REACHABLE stance inside button@112,144 in level 39');
        expect(e.message).toContain('cover@112,144 — its group t=2 publishes only while a Solid sits on button@160,144, '
            + 'and NO block in this room can reach it');
        expect(e.message).toContain('SEALED BEHIND A WALL: with cover@112,144 discharged');
        expect(e.message).not.toContain('not reached within 400 ticks');
    }, 120_000);
});

describe.each(L40_LEGS)('WANDHOLD L40 — leg $leg', (row) => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('OFF (movingWait, bombBlastBody OFF): the sweep\'s refusal — a still hold inside the lobber\'s reach', async () => {
        const e = await withContactFidelity({ movingWait: false, bombBlastBody: false }, () => caught(solveL40(row.boot)));
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toContain(`hold stance (wandlock@176,80) -> hold: the hold stands still for up to 131 tick(s) at ${row.still}, `
            + 'inside bombpusher@112,128\'s 256 px reach');
    }, 120_000);

    it('ON (movingWait + bombBlastBody): SOLVED, two paced holds, and the plan is the witness tape key for key', async () => {
        const solved = await withContactFidelity(L40_ON, () => solveL40(row.boot));
        expect(solved.out.records.map((r) => r.strategy)).toEqual(row.verbs);
        expect(solved.out.records.filter((r) => r.paced).length).toBe(2);
        expect(solved.out.perTick.length).toBe(row.ticks);
        const w = witness(row.name);
        const tape = parseTape(JSON.stringify(w.tape));
        const keysOf = (set) => [...set].sort().join('+');
        const drove = Array.from({ length: row.ticks }, (_, i) => keysOf(heldKeysAt(tape, i)));
        expect(solved.out.perTick.map(keysOf)).toEqual(drove);
    }, 180_000);

    it('the GAME (p4g, damage on) played the ON plan to the part with 0 hits; the ON model reproduces every sampled tick at 0 px', () => {
        const w = witness(row.name);
        expect(w.page).toBe('seedling_bot_ap_p4g');
        // the headless page may skip a poll (an unsampled tick); every tick it did sample is compared
        expect(w.samples.length).toBeGreaterThanOrEqual(w.upto - 2);
        expect(w.samples.every((s) => s.hits === 0)).toBe(true);
        const { cols, run } = withContactFidelity(L40_ON, () => replay(w));
        expect(disagreements(w, cols).slice(0, 5)).toEqual([]);
        expect(run.ledger('playerHits')).toEqual([]);
        const blasts = run.ledger('bombEvents').filter((e) => e.what === 'blast');
        expect(blasts.length).toBe(row.blasts);
        // leg 371's walk is where a blast lands on a body (`spinner@192,160`): the row `bombBlastBody` lands
        expect(run.ledger('bombEvents').filter((e) => e.what === 'body-hit').length).toBe(row.bodyHits);
        expect(blasts.some((e) => e.hitPlayer)).toBe(false);
        // at the cut the player stands on the part's cell (the next tick is the game's pickup freeze)
        const last = w.samples.at(-1).p;
        expect(Math.abs(last[0] - 72) < 4 && Math.abs(last[1] - 142) < 4).toBe(true);
    }, 180_000);
});
