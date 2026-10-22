/**
 * seedling-fidelity-rope — the `rope` verb's game witnesses (`CONTACT_FIDELITY.ropeCutVerb`): the solver's own plans for
 * a `clear-tag` on a rope's tag, the staging they boot from, and the model's samples of a tape in the probe's format.
 * Shared by `scripts/procgen/probe-seedling-rope-verb.mjs` (plays them on the game, `--record`) and
 * `fidelityRope.test.js` (replays the recordings against the model). See the probe's header for the three witnesses.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const ROPE_WITNESS_DIR = join(HERE, 'fixtures', 'rope-witness');
const SOURCE_TAPE = join(HERE, 'fixtures', 'tapes', 'r9-solve-16.json');

/** Idle ticks appended to every plan (see `ropePlan`). */
export const IDLE_TAIL = 4;

const L16_CUT = { kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 }, obstacle: 'rope@32,16' };
const L28_CUT = { kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 }, obstacle: 'rope@160,64' };

/** The witnesses: a boot (null = the source tape's own), the items (null = the source's), the goals. */
export const ROPE_WITNESSES = Object.freeze([
    Object.freeze({ name: 'rope-l16-cut-cross', boot: null, items: null,
        goals: [L16_CUT, { kind: 'reach-exit', exit: { x: 352, y: 80 } }], flags: [0], to: 18 }),
    Object.freeze({ name: 'rope-l16-verb', boot: { level: 16, x: 72, y: 40 }, items: null, goals: [L16_CUT], flags: [0],
        to: 16 }),
    Object.freeze({ name: 'rope-l28-cut', boot: { level: 28, x: 96, y: 16 }, items: ['hasSword'], persistence: [],
        goals: [L28_CUT], flags: [0, 1], to: 28 }),
]);

/** The staging one witness boots from: `r9-solve-16`'s, its boot/items/persistence replaced where the row says. */
export async function ropeStaging(w) {
    const { parseTape } = await import('./tapeFormat.js');
    const { stagingFromTape } = await import('./tapeRunner.js');
    const base = stagingFromTape(parseTape(readFileSync(SOURCE_TAPE, 'utf8')));
    const staging = { ...base };
    if (w.boot) staging.boot = { ...w.boot };
    if (w.items) {
        staging.seam = { ...base.seam, items: Object.fromEntries(Object.keys(base.seam.items)
            .map((k) => [k, w.items.includes(k)])) };
    }
    if (w.persistence) staging.persistence = w.persistence;
    return staging;
}

/** The solver's plan (the switch ON) and its tape. */
export async function ropePlan(w) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await withContactFidelity({ ropeCutVerb: true }, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    const tape = buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        // The plan ends on the tick its write is CONFIRMED (`pull + 1`), and a probe drops a tape's final tick, so a
        // short idle tail puts the game's write inside the sampled window.
        perTick: [...solved.out.perTick, ...Array.from({ length: IDLE_TAIL }, () => new Set())],
        name: w.name,
    });
    return { staging, solved, tape: { ...tape, description: `seedling-fidelity-rope: the solver's \`rope\` plan for `
        + `${w.goals.map((g) => g.obstacle ?? g.kind).join(' then ')} (probe-seedling-rope-verb.mjs)` } };
}

/** The model's samples of a tape (the switch ON), in the probe's format, by tick. */
export async function modelSamples(tapeJson) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const out = [];
    let pulls = [];
    withContactFidelity({ ropeCutVerb: true }, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            out[o.t] = { x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0 };
            r = st.next();
        }
        pulls = run ? run.ledger('ropePulls') : [];
    });
    return { samples: out, pulls };
}

/** Compare a game witness with the model: every sampled tick's position, level and hits. */
export function compareWitness(game, model) {
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
