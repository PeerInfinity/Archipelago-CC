/**
 * The ER-C1-C3 rows' shared helpers (`hammerErGaps.test.js`, `hammerErGaps.train.test.js`): the witness probe's own
 * stagings (`probe-seedling-er-landings.mjs`'s `landingStaging`, `CASES`) solved as its MODEL rows solve them
 * (`solveFrom`, the survey's `twoPassSolve`), and a solved plan replayed on a fresh tape stepper. Test support only.
 */

import { buildStagedTape } from './botDriverV1.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { CASES, landingStaging, solveFrom } from '../../../scripts/procgen/probe-seedling-er-landings.mjs';

/** The solver from one witness case's staging, with the case's own (bare) goal: `{solved, staging}` or `{refusal}`. */
export async function solveCase(name) {
    const staging = await landingStaging(CASES[name]);
    try {
        return { staging, solved: await solveFrom(staging, [CASES[name].goal], `er-gaps-${name}`) };
    } catch (refusal) {
        return { staging, refusal };
    }
}

/** A solved plan replayed on a fresh tape stepper (its equips and pass persistence): the stepper's record. */
export function replaySolved(staging, solved, name) {
    const tape = buildStagedTape({ staging: { ...staging, persistence: solved.persistence,
        equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] }, perTick: solved.out.perTick, name });
    const st = createTapeStepper(parseTape(JSON.stringify(tape)), { levelSource: atlasLevelSource() });
    let r;
    for (r = st.next(); !r.done; r = st.next());
    return r.value;
}

