/**
 * ⛓⛓⛓ seedling-fidelity-afterrows (wave 41) — the AFTER rows' shared readers.
 *
 * Hammer's L40 flip (`l40FlipSet.js`, train 77) wrapped fidelity rows in `withL40Flip(false)`: BEFORE pins of the
 * pre-flip defaults. Each such row now has an AFTER row beside it that pins the same request at the SHIPPED defaults.
 * Where an AFTER plan is a new solve, it is played on the game (p4g, headless) and recorded with
 * `probe-seedling-bombpusher.mjs --record` (a plain tape witness: the player, hits and camera per sampled tick) into
 * `fixtures/bomb-witness/afterrows-*.json`; the L40 chains use their own probes' witness tables. These readers
 * replay a recorded witness through the model and say where it parts from the game.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A `probe-seedling-bombpusher.mjs --record` witness by name (`fixtures/bomb-witness/<name>.json`). */
export function afterWitness(name) {
    return JSON.parse(readFileSync(join(HERE, 'fixtures', 'bomb-witness', `${name}.json`), 'utf8'));
}

/**
 * The model's replay of a bomb-witness recording at the process's switches: `{parted, hits, ticks}` — `parted` the
 * sampled ticks where the model's player is not the game's (to the bit), `hits` the model's player-hit rows.
 */
export function afterWitnessReplay(w) {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: atlasLevelSource(),
        onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        col[r.value.observation.t] = r.value.observation;
        r = st.next();
    }
    const parted = w.samples.filter((sm) => !col[sm.t] || col[sm.t].x !== sm.p[0] || col[sm.t].y !== sm.p[1])
        .map((sm) => sm.t);
    return { parted, hits: (run?.playerHits ?? []).map((h) => [h.t, h.source, h.id]), ticks: col.length };
}

/** A tape's `inputs` spans in one canonical order (the probe's recorded tape re-orders them): by key, from, to. */
export function sortedInputs(inputs) {
    return [...inputs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.from - b.from || a.to - b.to));
}
