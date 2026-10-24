/**
 * seedling-fidelity-searchgaps D-A — L41's CRUSHER, BAITED BY THE SOLVER (`CONTACT_FIDELITY.crusherBaitPressGoal`): the
 * game witness's plan and the staging it boots from (`fidelityRope.ropeStaging`, re-pointed at the L41 arrival from L40's
 * `teleporter@944,96`). Shared by `scripts/procgen/probe-seedling-crusher-press.mjs` (plays it on the game, `--record`)
 * and `fidelityCrusherPress.test.js` (replays the recording against the model at 0 px).
 *
 *   crusherpress-l41-bait   the solver's plan toward `totempart@240,144` with the key ON, CUT where the bait ends (the
 *                           frontier's next order, the wandlock's): the walk to (216,88) undashed, the shield swing
 *                           that breaks `breakablerock@224,64`/`@224,80`, R5's three chains W,S,E — `crusher@240,64`
 *                           parked on `button@248,232`, `cover@112,128` open. The rest of the room (the fire block onto
 *                           `button@176,176`, the wandlock) is not this key's: the solve refuses there, by name.
 *
 * ⚠ The crusher's position is in no game readout (`Bot.botMobiles` lists `Mobile`s; a `Crusher` is an `Activators`), so
 * the claim on the game is R5's: the player's stream (x, y, level, hits) equals the model's on every tick, and the
 * game's player is never hit — a crusher contact is 1000 damage, a death the stream cannot hide.
 */
import { ropeStaging } from './fidelityRope.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRUSHERPRESS_WITNESS_DIR = join(HERE, 'fixtures', 'crusherpress-witness');

/** The switches the witness is planned under: this slice's key (the rest at their defaults). */
export const CRUSHERPRESS_SWITCHES = Object.freeze({ crusherBaitPressGoal: true });

/** Idle ticks at the end, so the last state is sampled at rest on both sides. */
export const CRUSHERPRESS_TAIL = 60;

/** The probe walk's aim: `crusher@240,64`'s own constructor cell (15,5) — a Solid wherever the crusher stayed home. */
export const CRUSHERPRESS_PROBE = Object.freeze({ x: 248, y: 88 });
/** The probe walk's arrival tolerance (px): the walk's waypoints, driven by `botDriverV2.driveStepHeld`. */
export const CRUSHERPRESS_PROBE_TOLERANCE = 2;

export const CRUSHERPRESS_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'crusherpress-l41-bait',
        boot: Object.freeze({ level: 41, x: 16, y: 160 }),
        items: ['hasSword', 'hasShield', 'hasFire', 'hasTorch', 'canSwim'],
        persistence: [],
        goals: [{ kind: 'collect-placement', placement: { x: 240, y: 144 } }],
    }),
]);

/**
 * The solver's plan with the key ON, from the witness staging: `solveSegment` on a fresh run (its `forkRun` a fresh
 * run from the same staging), `dashMode: 'all'`. The room refuses past the bait (not this key's wall), so the plan is
 * the refusal's `perTick`, cut at the first trace row after the bait's own that is neither the bait nor a walk — the
 * frontier's next order. Returns `{staging, rows, bait, cut, refusal, tape}`.
 */
export async function crusherPressTape(w) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { solveSegment } = await import('./solverBot.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    const levelSource = atlasLevelSource();
    let out = null;
    let refusal = null;
    withContactFidelity(CRUSHERPRESS_SWITCHES, () => {
        try {
            out = solveSegment({ run: createRunForStaging(staging, levelSource), goals: w.goals, name: w.name,
                boot: staging.boot, dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
        } catch (e) {
            if (!Array.isArray(e?.perTick)) throw e;
            refusal = e;
        }
    });
    const rows = (out?.trace?.rows ?? refusal?.rows ?? []);
    const perTick = out?.perTick ?? refusal.perTick;
    const baitAt = rows.findIndex((r) => r.strategy?.verb === 'bait');
    const next = baitAt < 0 ? null
        : rows.slice(baitAt + 1).find((r) => !['bait', 'walk'].includes(r.strategy?.verb));
    const cut = next ? next.tick : perTick.length;
    /**
     * ⛓ THE DISCRIMINATOR. The player's stream alone cannot tell a crusher that moved from one that stayed home, so the
     * tape then WALKS INTO THE CRUSHER'S HOME (`CRUSHERPRESS_PROBE`, tile (15,5): its constructor body, walled by the
     * rocks it no longer has to fear) — planned and driven on the model; on a game whose crusher had not left, the walk
     * stops at its body and the stream diverges.
     */
    const { driveStepHeld, livePerVisitOpts, planWaypoints, waypointReached } = await import('./botDriverV2.js');
    const run = createRunForStaging(staging, levelSource);
    const head = perTick.slice(0, cut);
    for (const held of head) run.advance(held);
    const walk = [];
    const wps = planWaypoints(run.world, run.state, CRUSHERPRESS_PROBE, null, livePerVisitOpts(run));
    wps.forEach((wp, i) => {
        const intermediate = i < wps.length - 1;
        for (let t = 0; t < 400 && !waypointReached(run.state, wp, CRUSHERPRESS_PROBE_TOLERANCE, intermediate); t += 1) {
            const held = driveStepHeld(run, wp, CRUSHERPRESS_PROBE_TOLERANCE);
            walk.push(held);
            run.advance(held);
        }
    });
    const probeReached = waypointReached(run.state, CRUSHERPRESS_PROBE, CRUSHERPRESS_PROBE_TOLERANCE, false);
    const tape = buildStagedTape({
        staging,
        perTick: [...head, ...walk, ...Array.from({ length: CRUSHERPRESS_TAIL }, () => new Set())],
        name: w.name,
    });
    return { staging, rows, bait: baitAt < 0 ? null : rows[baitAt], cut, probeTicks: walk.length, probeReached,
        refusal: refusal?.message ?? null,
        tape: { ...tape, description: `seedling-fidelity-searchgaps D-A: ${w.name} — the solver's L41 bait (the shield `
            + 'swing, chains W,S,E) cut where the frontier turns to the wandlock (probe-seedling-crusher-press.mjs)' } };
}

/**
 * The model's samples of a tape, by tick: the player (x, y, level, hits) and, at the end, every crusher's position,
 * whether all are parked, the crusher contacts and the open activators. A run that throws stops the samples there.
 */
export async function crusherPressModelSamples(tapeJson) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let run = null;
    let error = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    try {
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            samples[o.t] = { x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0 };
            r = st.next();
        }
    } catch (e) {
        error = e.message;
    }
    const end = run ? {
        crushers: Object.fromEntries([...(run.entities('crushers') ?? [])].map(([id, c]) => [id, { x: c.x, y: c.y }])),
        parked: run.entities('crushersParked'),
        contacts: run.ledger('crusherContacts').length,
        open: [...(run.entities('openActivators') ?? [])].sort(),
        broken: [...(run.entities('brokenRocks') ?? [])].sort(),
    } : null;
    return { samples, end, error };
}

/** One game poll (`botStatus`), folded to a sample. */
export function crusherPressSampleOf(s) {
    return { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null };
}

/** Compare a game witness with the model, every sampled tick: the player's position, level and hits. `[]` = 0 px. */
export function compareCrusherPressWitness(game, model) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (m.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${m.hits}`);
    }
    return bad;
}
