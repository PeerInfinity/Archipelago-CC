/**
 * seedling-fidelity-drillkill — THE SOLVER KILLS L28's DRILLS FIRST, THEN CUTS THE ROPE (`CONTACT_FIDELITY.
 * drillKillFirst`): the game witnesses' tapes, the staging they boot from (`fidelityRope.ropeStaging`), and the model's
 * samples of a tape — the player, every drill (position, anim, `hits`, `hitsTimer`) and the bobsoldier, tick by tick.
 * Shared by `scripts/procgen/probe-seedling-drill-kill.mjs` (plays them on the game, `--record`) and
 * `fidelityDrillKill.witness.test.js` (replays the recordings against the model at 0 px).
 *
 *   drillkill-l28-sword-l25   the solver's plan from the L25 arrival with the Sword: `drill@128,96` killed from its
 *                             north stance (3 landings), then the cut
 *   drillkill-l28-spear-l25   the same with the Spear (2 landings) — the cut ROPESTANCE refused at t59
 *   drillkill-l28-sword-l26   from the L26 arrival with the Sword: both drills killed from the west, then the cut
 *   drillkill-l28-spear-l26   the same with the Spear
 *   drillkill-l28-fire-l26    FIRE AT A DRILL (scripted): from the L26 arrival, wake `drill@80,96` and burn it every
 *                             time the flame is ready — its `hits` never move (`hitByFire` false); the tape ends after
 *                             the drill's contact lands on the player
 */
import { ropeStaging, IDLE_TAIL } from './fidelityRope.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const DRILLKILL_WITNESS_DIR = join(HERE, 'fixtures', 'drillkill-witness');

/** The switches every witness is planned and replayed under: this slice's key (the rest at their defaults). */
export const DRILLKILL_SWITCHES = Object.freeze({ drillKillFirst: true });

const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const FROM_L25 = Object.freeze({ level: 28, x: 96, y: 16 });
const FROM_L26 = Object.freeze({ level: 28, x: 16, y: 96 });

export const DRILLKILL_WITNESSES = Object.freeze([
    Object.freeze({ name: 'drillkill-l28-sword-l25', boot: FROM_L25, items: ['hasSword'], persistence: [],
        script: { goals: [L28_CUT] } }),
    Object.freeze({ name: 'drillkill-l28-spear-l25', boot: FROM_L25, items: ['hasSpear'], persistence: [],
        script: { goals: [L28_CUT] } }),
    Object.freeze({ name: 'drillkill-l28-sword-l26', boot: FROM_L26, items: ['hasSword'], persistence: [],
        script: { goals: [L28_CUT] } }),
    Object.freeze({ name: 'drillkill-l28-spear-l26', boot: FROM_L26, items: ['hasSpear'], persistence: [],
        script: { goals: [L28_CUT] } }),
    Object.freeze({ name: 'drillkill-l28-fire-l26', boot: FROM_L26, items: ['hasFire'], persistence: [],
        script: { fire: { walkRight: 20, burns: 90 } } }),
]);

/** A fire press while `firing` is up is swallowed by `useItem`'s `if (!firing)`; the model refuses it by name. */
const FIRE_CADENCE = 11;

/**
 * The scripted Fire tape: from the L26 arrival, `walkRight` ticks of "right" (the player wakes `drill@80,96` at 48 px),
 * then `burns` ticks pressing the primary (Fire) every `FIRE_CADENCE` ticks — the flame's reach is the player's box plus
 * `sprFire`, so the drill is inside it once it has hopped.
 */
function fireTicks(script) {
    const out = [];
    for (let i = 0; i < script.walkRight; i += 1) out.push(new Set(['right']));
    for (let i = 0; i < script.burns; i += 1) out.push(new Set(i % FIRE_CADENCE === 0 ? ['primary'] : []));
    return out;
}

/** The solver's plan (the key ON) for a goal witness, via `twoPassSolve` as the page solves it, and its tape. */
export async function drillKillTape(w) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    if (w.script.fire) {
        const tape = buildStagedTape({ staging, perTick: fireTicks(w.script.fire), name: w.name });
        return { staging, solved: null, tape: { ...tape, description: `seedling-fidelity-drillkill: ${w.name} — Fire at `
            + 'a drill (probe-seedling-drill-kill.mjs)' } };
    }
    const levelSource = atlasLevelSource();
    const solved = await withContactFidelity(DRILLKILL_SWITCHES, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.script.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    const tape = buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick: [...solved.out.perTick, ...Array.from({ length: IDLE_TAIL }, () => new Set())],
        name: w.name,
    });
    return { staging, solved, tape: { ...tape, description: `seedling-fidelity-drillkill: ${w.name} — the solver's `
        + 'drill kills, then the rope cut (probe-seedling-drill-kill.mjs)' } };
}

/**
 * The model's samples of a tape, by tick, under `over`: the player (x, y, level, hits), every drill not yet removed
 * (`run.drills.bodies`: id, x, y, anim, hits, hitsTimer) and the chasers. A run that throws stops the samples there.
 */
export async function drillKillModelSamples(tapeJson, over = DRILLKILL_SWITCHES) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const out = [];
    let events = [];
    let pulls = [];
    let error = null;
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                out[o.t] = {
                    x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0,
                    drills: run ? run.drills.bodies.filter((d) => !d.removed).map((d) => ({ id: d.id, x: d.x, y: d.y,
                        anim: d.anim, hits: d.hits, hitsTimer: d.hitsTimer })) : [],
                    chasers: run ? run.chasers.map((c) => ({ id: c.id, x: c.x, y: c.y })) : [],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        events = run ? run.drills.events : [];
        pulls = run ? (run.ledger('ropePulls') ?? []).map((p) => ({ id: p.id, t: p.t })) : [];
    });
    return { samples: out, events, pulls, error };
}

/** One game poll (`botStatus` + `botMobiles`), folded to a sample: DRILL's, plus each drill's `hits` and the rope. */
export function drillKillSampleOf(s, m) {
    const rows = m.mobiles ?? [];
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null,
        drills: rows.filter((r) => /Drill$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, anim: r.anim,
            hits: r.enemy?.hits ?? null, hitsTimer: r.enemy?.hits_timer ?? null, hitByFire: r.enemy?.hit_by_fire ?? null })),
        chasers: rows.filter((r) => /(^|:)(Bob|BobSoldier)$/.test(r.cls))
            .map((r) => ({ tag: /BobSoldier$/.test(r.cls) ? 'bobsoldier' : 'bob', x: r.x, y: r.y })),
    };
}

/**
 * Compare a game witness with the model, every sampled tick: the player (position, level, hits); every drill
 * (position, anim, `hits`, `hitsTimer`), joined by the cheapest pairing; every chaser's position. `[]` = 0 px.
 */
export function compareDrillKillWitness(game, model, level = 28) {
    const bad = [];
    const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)])
        .map((p) => [x, ...p])));
    const pair = (gs, ms) => {
        let best = null;
        let cost = Infinity;
        for (const p of perms(ms)) {
            const c = gs.reduce((sum, g, i) => sum + Math.hypot(g.x - p[i].x, g.y - p[i].y), 0);
            if (c < cost) { cost = c; best = p; }
        }
        return best ?? [];
    };
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (m.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${m.hits}`);
        if (g.level !== level || m.level !== level) continue;
        const gd = g.drills ?? [];
        if (gd.length !== m.drills.length) {
            bad.push(`t ${g.t}: game has ${gd.length} drill(s), the model ${m.drills.length}`);
            continue;
        }
        const pd = pair(gd, m.drills);
        gd.forEach((d, i) => {
            const b = pd[i];
            if (d.x !== b.x || d.y !== b.y) bad.push(`t ${g.t} ${b.id}: game (${d.x}, ${d.y}) model (${b.x}, ${b.y})`);
            if (d.anim !== b.anim) bad.push(`t ${g.t} ${b.id}: game anim "${d.anim}" model "${b.anim}"`);
            if (d.hits !== b.hits) bad.push(`t ${g.t} ${b.id}: game hits ${d.hits} model ${b.hits}`);
            if (d.hitsTimer !== b.hitsTimer) bad.push(`t ${g.t} ${b.id}: game hitsTimer ${d.hitsTimer} model ${b.hitsTimer}`);
        });
        const tags = [...new Set((g.chasers ?? []).map((c) => c.tag))];
        for (const tag of tags) {
            const gc = g.chasers.filter((c) => c.tag === tag);
            const mc = m.chasers.filter((c) => c.id.startsWith(`${tag}@`));
            if (gc.length !== mc.length) {
                bad.push(`t ${g.t}: game has ${gc.length} ${tag}(s), the model ${mc.length}`);
                continue;
            }
            const pc = pair(gc, mc);
            gc.forEach((c, i) => {
                const b = pc[i];
                if (c.x !== b.x || c.y !== b.y) bad.push(`t ${g.t} ${b.id}: game (${c.x}, ${c.y}) model (${b.x}, ${b.y})`);
            });
        }
    }
    return bad;
}
