/**
 * seedling-fidelity-bombpusher — THE LOBBER, WITNESSED ON THE GAME (`CONTACT_FIDELITY.bombPusherLive`).
 *
 * L40BUTTON's damage-on walks (sweep legs 378/381) were refuted by `bombpusher@112,128`'s bombs, which the model did
 * not step. The two witnesses are the GAME's rows (p4f, `probe-seedling-bombpusher.mjs --record`): the player, its
 * `hits`, the camera, every `Bomb` and the lobber's anim at each sampled tick, through the last tick before the
 * respawn (each walk dies: L42 to the spinner's hammer at t1221 after two bomb hits, L41 to its third bomb at t1337).
 * The replay reads the game's camera on the shake band's uncertain ticks (⚖ the cosmetic RNG is never modelled).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'bomb-witness', `${n}.json`), 'utf8'));
const WITNESSES = [
    { name: 'bombpusher-l42-part0-damage', leg: 381, gameHits: [1064, 1156], firstHit: 1064 },
    { name: 'bombpusher-l41-part0-damage', leg: 378, gameHits: [1153, 1291], firstHit: 1153 },
];

/** Replay the witness's tape through `upto`; per sampled tick, the model's player, bombs and lobber anim. */
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
        });
        if (o.t >= w.upto) break;
    }
    return { cols, run };
}

describe('BOMBPUSHER — the switch', () => {
    it('bombPusherLive ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.bombPusherLive).toBe(false);
    });
});

describe.each(WITNESSES)('BOMBPUSHER — the game witness $name (leg $leg)', ({ name, gameHits, firstHit }) => {
    const w = witness(name);

    it('the GAME was hit by bombs at the measured ticks', () => {
        const rises = [];
        for (let i = 1; i < w.samples.length; i += 1) {
            if (w.samples[i].hits > w.samples[i - 1].hits) rises.push(w.samples[i].t);
        }
        // ⚠ a rise is read at its first SAMPLED tick (L41's t1143..t1153 were not sampled)
        expect(rises.length).toBe(gameHits.length);
    });

    it('ON: the model reproduces every sampled tick through the respawn at 0 px — the player, each bomb to the bit, the anim', () => {
        const { cols, run } = withContactFidelity({ bombPusherLive: true }, () => replay(w));
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
        expect(bad.slice(0, 5)).toEqual([]);
        const bombHits = run.ledger('playerHits').filter((h) => h.source === 'bomb');
        expect(bombHits.length).toBeGreaterThanOrEqual(2);
        // the Explosion's damage pass is at `updateLists()`: the ledger row is stamped the tick after the sample
        expect(bombHits[0].t).toBe(firstHit + 1);
        expect(bombHits[0].knockback.dy).toBe(0); // `knockback`'s |centre.y| > 0.5 gate
    }, 120_000);

    it('OFF: the quiet room — no bomb, and the model leaves the game the tick after the first hit', () => {
        const { cols, bombs: bombsOff, pushers: pushersOff } = withContactFidelity({ bombPusherLive: false }, () => {
            const tape = parseTape(JSON.stringify(w.tape));
            let rn = null;
            const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, r) => { rn = r; } });
            const out = new Map();
            for (let r = st.next(); !r.done; r = st.next()) {
                out.set(r.value.observation.t, [r.value.observation.x, r.value.observation.y]);
                if (r.value.observation.t > firstHit + 1) break;
            }
            // read INSIDE the scope: the families answer the switch at call time
            return { cols: out, run: rn, bombs: rn.entities('bombs'), pushers: rn.entities('bombPushers') };
        });
        expect(bombsOff).toEqual([]);
        expect(pushersOff).toEqual([]);
        const firstMiss = w.samples.find((s) => {
            const m = cols.get(s.t);
            return m && (m[0] !== s.p[0] || m[1] !== s.p[1]);
        });
        expect(firstMiss.t).toBe(firstHit + 1);
    }, 120_000);
});

describe('BOMBPUSHER D3 — standing within a lobber\'s range is priced', async () => {
    const { dangerAt, dangerWhileWaiting } = await import('./dangerMap.js');
    const { playerBoxAt } = await import('./playerPhysicsV2.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { l40buttonStaging } = await import('../../../scripts/procgen/plan-seedling-l40button-witness.mjs');
    // the NW cluster's own boot: 154 px from `bombpusher@112,128`'s centre (136,152)
    const boot = { level: 40, x: 272, y: 224 };
    const runAt = async () => createRunForStaging(await l40buttonStaging(boot), atlasLevelSource());

    it('ON: a 101-tick wait at the buttonroom stance is a bomb hit (the lobber fires on tick 1, the blast lands ≈ +61)', async () => {
        const run = await runAt();
        const d = withContactFidelity({ bombPusherLive: true },
            () => dangerWhileWaiting(run, run.ticksCompleted + 101, playerBoxAt(280.7, 215.3)));
        expect(d.sources.filter((s) => s.kind === 'bomb').map((s) => s.id)).toEqual(['bombpusher@112,128#1']);
    });

    it('ON: a wait shorter than the first blast is clean, and so is a wait out of range', async () => {
        const run = await runAt();
        withContactFidelity({ bombPusherLive: true }, () => {
            expect(dangerWhileWaiting(run, run.ticksCompleted + 50, playerBoxAt(280.7, 215.3))
                .sources.filter((s) => s.kind === 'bomb')).toEqual([]);
            // (480, 300): 380 px from the lobber
            expect(dangerWhileWaiting(run, run.ticksCompleted + 200, playerBoxAt(480, 300))
                .sources.filter((s) => s.kind === 'bomb')).toEqual([]);
        });
    });

    it('OFF: the same wait prices no bomb (byte-inert)', async () => {
        const run = await runAt();
        const d = withContactFidelity({ bombPusherLive: false },
            () => dangerWhileWaiting(run, run.ticksCompleted + 101, playerBoxAt(280.7, 215.3)));
        expect(d.sources.filter((s) => s.kind === 'bomb')).toEqual([]);
    });

    it('ON: the walk forecast returns the blast on the sample whose box is the end-of-tick player, and only a box in its disc is hit', async () => {
        const run = await runAt();
        withContactFidelity({ bombPusherLive: true }, () => {
            const f = run.spitForecast();
            const stand = { x: run.state.x, y: run.state.y };
            let blast = null;
            for (let k = 0; k < 80 && !blast; k += 1) blast = f.step(stand).find((s) => s.kind === 'bomb') ?? null;
            expect(blast).not.toBe(null);
            expect(blast.hitsPlayer).toBe(true);
            const tick = run.ticksCompleted;
            expect(dangerAt(run, tick, playerBoxAt(stand.x, stand.y), { mode: 'transit', spits: [blast] })
                .sources.map((s) => s.kind)).toContain('bomb');
            expect(dangerAt(run, tick, playerBoxAt(stand.x + 20, stand.y), { mode: 'transit', spits: [blast] })
                .sources.map((s) => s.kind)).not.toContain('bomb');
        });
    });
});

describe('BOMBPUSHER D3 — the hold inside the lobber\'s reach is refused by name', async () => {
    const { SolverRefusal } = await import('./solverBot.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const { L40BUTTON_GOAL, l40buttonStaging } = await import('../../../scripts/procgen/plan-seedling-l40button-witness.mjs');
    const solveFromCluster = async () => {
        const staging = await l40buttonStaging({ level: 40, x: 272, y: 224 });
        const makeRun = (p) => createRunForStaging({ ...staging, persistence: p }, atlasLevelSource());
        return twoPassSolve({ makeRun, goals: [L40BUTTON_GOAL], name: 'bombpusher-test', boot: staging.boot,
            persistence: staging.persistence, log: () => {} });
    };

    it('ON: the cluster boot\'s plan stops at buttonroom@272,208\'s hold, naming the lobber and the blast', async () => {
        let refusal = null;
        await withContactFidelity({ bombPusherLive: true }, async () => {
            try { await solveFromCluster(); } catch (e) { refusal = e; }
        });
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.message).toMatch(/-> hold: the hold stands still .* inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at/);
        expect(refusal.obstacle).toMatchObject({ kind: 'danger', id: 'bombpusher@112,128' });
        // the survey files it under its own family (`surveyFamily.FAMILY_RULES`, appended)
        const { familyOf } = await import('../../../scripts/procgen/surveyFamily.js');
        expect(familyOf(refusal.message)).toMatch(/^BOMB — the wait stands still inside bombpusher@112,128's reach/);
    }, 300_000);
});
