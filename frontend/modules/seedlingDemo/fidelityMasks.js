/**
 * seedling-fidelity-masks — THE SWING'S LINE OF SIGHT SAMPLES THE "Solid" PIXELMASKS (`CONTACT_FIDELITY.
 * pixelMaskSightLines`): the game witnesses' tapes and the model's samples of them. Shared by
 * `scripts/procgen/probe-seedling-mask-lines.mjs` (plays them on the game, `--record`) and `fidelityMasks.test.js`
 * (replays the recordings against the model at 0 px).
 *
 * `Player.slash` gates every hit on `!collideLine("Solid", x, y, v[i].x, v[i].y) || hasGhostSword || … || v[i] is
 * Flyer` (`Player.as:917`); `World.collideLine` asks `collidePoint` per sample, and an OpenTree / CliffSide / Building
 * answers from its opaque pixels. The run's chaser arm (`applyThrust`, `r.as3 === 'Enemy'`) asked no line at all. L65
 * holds `bob@208,80` beside `opentree@176,48`:
 *
 *   mask-l65-opentree    (a CONTROL) boot (192,40), idle, the sword pressed at t2 and every 12 ticks: at t87-89 the
 *                        swing's line from (200,48) to the bob starts inside the OpenTree's opaque pixels, and the
 *                        game's bob IS hit (knocked back at t88). An `OpenTree` extends `Tree`, whose ctor writes
 *                        `type = "Tree"` — `collideLine("Solid")` never sees it (the first cut of D2 sampled it and
 *                        refused the hit; this recording is what corrected it)
 *   mask-l65-wall        boot (216,72), idle, the same presses: the player stands at (224,80), and the line's first
 *                        sample meets the Body Wall tile at (224,80) — the boxes the arm never asked either
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ropeStaging } from './fidelityRope.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const MASK_WITNESS_DIR = join(HERE, 'fixtures', 'mask-witness');

/** The switches every witness is replayed under: this slice's key (the rest at their defaults). */
export const MASK_SWITCHES = Object.freeze({ pixelMaskSightLines: true });

/** The witnesses: `script` is `{ticks, swingFrom, every}` — stand still, the primary (the sword) pressed one tick at
 * `swingFrom` and every `every` ticks after. A `control` is one the key must NOT move (OFF = ON = the game). */
export const MASK_WITNESSES = Object.freeze([
    Object.freeze({ name: 'mask-l65-opentree', boot: { level: 65, x: 192, y: 40 }, items: ['hasSword'], persistence: [],
        script: { ticks: 110, swingFrom: 2, every: 12 }, control: true }),
    Object.freeze({ name: 'mask-l65-wall', boot: { level: 65, x: 216, y: 72 }, items: ['hasSword'], persistence: [],
        script: { ticks: 60, swingFrom: 2, every: 12 } }),
]);

/** The witness's tape. */
export async function maskTape(w) {
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    const { ticks, swingFrom, every } = w.script;
    const perTick = Array.from({ length: ticks },
        (_, t) => new Set(t >= swingFrom && (t - swingFrom) % every === 0 ? ['primary'] : []));
    const tape = buildStagedTape({ staging, perTick, name: w.name });
    return { ...tape, description: `seedling-fidelity-masks: ${w.name} (probe-seedling-mask-lines.mjs)` };
}

/**
 * The model's samples of a tape under `MASK_SWITCHES` (or `over`) — `fidelityDrill.drillModelSamples`' rows (the
 * player, the drills, the chasers), plus the run's `chaserPressHits` (`hits`).
 */
export async function maskModelSamples(tapeJson, over = MASK_SWITCHES) {
    const { drillModelSamples } = await import('./fidelityDrill.js');
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const base = await drillModelSamples(tapeJson, over);
    let pressHits = [];
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(tapeJson)),
            { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            for (let r = st.next(); !r.done; r = st.next()) { /* to the end */ }
        } catch { /* the error is `base.error` */ }
        pressHits = run ? run.chaserPressHits : [];
    });
    return { ...base, pressHits };
}
