/**
 * seedlingDemo/wandWitness — ⛓⛓⛓ SEEDLING FIDELITY WAND: the MODEL's side of a wand witness.
 *
 * One reading per tick (index 0 = boot) of what `probe-seedling-wand-mobiles.mjs` joins against the game's
 * `botMobiles()` / `botStatus()`: the player, the live `WandShot`s of the current level (`run.wandShotsLive`) and
 * the flags the run has CLEARED (`run.earnedClears`, as `"level:tag"`). Shared by the probe (which records the
 * game) and `fidelityWand.test.js` (which replays the recording against this), so the two cannot read the model
 * two different ways.
 */

import { buildLevelWorld } from './levelWorld.js';
import { createTapeStepper } from './tapeRunner.js';
import { withWandVerb } from './wandVerb.js';

/**
 * ⚠ The model runs with `WAND_VERB` ON: a `MagicalLock`'s `setPersistence(tag, false)` reaches `earnedClears` only
 * there, and the game writes it on every hit. A tape that hits no `MagicalLock` reads the same either way.
 */
export function modelWandSamples(tape, levelSource) {
    return withWandVerb(true, () => modelWandSamplesNow(tape, levelSource));
}

function modelWandSamplesNow(tape, levelSource) {
    const col = [];
    let run = null;
    const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        col[o.t] = {
            px: o.x,
            py: o.y,
            level: run ? run.level : tape.boot.level,
            shots: (run?.wandShotsLive ?? []).filter((s) => !s.removed)
                .map((s) => ({ x: s.x, y: s.y, anim: s.anim })),
            cleared: (run?.earnedClears ?? []).map((c) => `${c.level}:${c.tag}`),
        };
        r = st.next();
    }
    return col;
}

/**
 * The flags a wand witness makes its claim about, as `"level:tag"`: every `MagicalLock` (what a shot opens) and every
 * `WandLock` (what it does not) the boot level's census builds with a tag. Read off the built world, never typed.
 */
export function wandSubjectTags(level, levelSource) {
    const w = buildLevelWorld(levelSource(level), { roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard'] });
    const tags = new Set();
    for (const l of w.magicalLocks ?? []) if (l.tag >= 0) tags.add(`${level}:${l.tag}`);
    for (const a of w.activators ?? []) {
        if (a.tag === 'wandlock' && Number.isInteger(a.persistTag) && a.persistTag >= 0) {
            tags.add(`${level}:${a.persistTag}`);
        }
    }
    return tags;
}
