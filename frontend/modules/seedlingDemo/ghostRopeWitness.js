/**
 * seedling-hammer-ghost-rope (GHOSTROPE) — **DOES THE GHOST SWORD CUT A ROPE?** The game's answer, as tapes.
 *
 * ⚖ The user (2026-10-30): *"ghost sword replaces the sword, so the solver shouldn't attempt to switch to regular
 * sword when it has ghost sword."* So the question this file asks the game is not "can the run switch back" but "does
 * a ghost swing cut a `RopeStart`, and from where".
 *
 * The AS3 (`vendor/seedling/src/Player.as`):
 *   · `update()` calls `slash()` only `if (hasSword)` (`:560-563`) — the endgame bag holds both flags;
 *   · `slash()` collects with `getSlashRect()` (`:931-952`): under `hasGhostSword` `h = slashingSprite.width * 2` = 48,
 *     so the rect is 24 along the swing and 48 across it; the reach gate is `distanceRectPoint <= width * scaleX` = 24;
 *   · the line test is waived twice over (`|| hasGhostSword || … || v[i].type == "Rope"`, `:917`);
 *   · `genericHit(v[i], "Spear", …)` → `RopeStart.hit()` (`:1095-1097`), which takes NO `t`: the weapon's hit type
 *     does not reach the rope at all.
 * ⇒ the game cuts a rope with the ghost sword, from up to 24 px (the sword: 16).
 *
 * The witnesses: L16's `rope@32,16` (rect x 32-96, y 16-32), the r9-solve-16 staging (`fidelityRope.ropeStaging`)
 * booted below the rope, a face tap UP, ONE press, an idle tail. The bag is the endgame's pair `{hasSword,
 * hasGhostSword}` (the slot holds item 4 alone — the ghost sword REPLACED the sword) or the sword alone (the control).
 *   ghostrope-l16-near         boot (72,40), ghost — the press stands ~15 px below the rope: CUT (both swords reach)
 *   ghostrope-l16-reach        boot (72,48), ghost — ~23 px below it: CUT (the ghost's reach 24 only)
 *   ghostrope-l16-reach-sword  boot (72,48), sword — the same press with the plain sword: NOT cut (reach 16)
 *   ghostrope-l16-out          boot (72,52), ghost — ~27 px: NOT cut (beyond 24)
 * (the staging's boot lands the player at (80, y+8); `ghostRopeModel.pressFrom` is the measured point)
 * Shared by `scripts/procgen/probe-seedling-ghost-rope.mjs` (plays them on the game, `--record`) and
 * `hammerGhostRope.test.js` (the recordings against the model, a pinned row).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const GHOST_ROPE_WITNESS_DIR = join(HERE, 'fixtures', 'ghost-rope-witness');

/** Idle ticks after the press: the swing's seven tests and the persistence write, inside the sampled window. */
export const GHOST_ROPE_IDLE = 12;

const GHOST = Object.freeze(['hasSword', 'hasGhostSword']);
const SWORD = Object.freeze(['hasSword']);

export const GHOST_ROPE_WITNESSES = Object.freeze([
    Object.freeze({ name: 'ghostrope-l16-near', boot: { level: 16, x: 72, y: 40 }, items: GHOST, cut: true }),
    Object.freeze({ name: 'ghostrope-l16-reach', boot: { level: 16, x: 72, y: 48 }, items: GHOST, cut: true }),
    Object.freeze({ name: 'ghostrope-l16-reach-sword', boot: { level: 16, x: 72, y: 48 }, items: SWORD, cut: false }),
    Object.freeze({ name: 'ghostrope-l16-out', boot: { level: 16, x: 72, y: 52 }, items: GHOST, cut: false }),
]);

/**
 * The rope every witness swings at. Tick 0 is the face tap, tick 1 the press (`set slashing`), and the swing's FIRST
 * hit test runs in tick 2's `slash()` — the model's `ropePulls` row is t2 and the game writes {16,0} on t3.
 */
export const GHOST_ROPE_TARGET = Object.freeze({ id: 'rope@32,16', level: 16, tag: 0, pressTick: 1, testTick: 2,
    rect: Object.freeze({ x: 32, y: 16, w: 64, h: 16, right: 96, bottom: 32 }) });

/**
 * ⛓ The SOLVER's own plan, switch ON (`GHOST_ROPE_CUT`): L16's `clear-tag {16,0}` from the boot (72,40) with the
 * endgame pair — the `rope` verb's ghost swing (`arm: 'verb'`, `weapon: 'ghostsword'`), the walk it certifies played on
 * the game (⚖ 30(c)).
 */
export const GHOST_ROPE_PLAN_WITNESSES = Object.freeze([
    Object.freeze({ name: 'ghostrope-l16-verb-plan', boot: { level: 16, x: 72, y: 40 }, items: GHOST, cut: true,
        goals: Object.freeze([{ kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 },
            obstacle: 'rope@32,16' }]) }),
]);

/** The solver's plan for a plan witness (the switch ON) and its tape, an idle tail after the plan. */
export async function ghostRopePlanTape(w) {
    const { ropeStaging } = await import('./fidelityRope.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withGhostRopeCut } = await import('./ghostRopeCut.js');
    const staging = await ropeStaging({ boot: w.boot, items: [...w.items] });
    const levelSource = atlasLevelSource();
    const solved = await withGhostRopeCut(true, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals.map((g) => ({ ...g })), name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    const tape = buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick: [...solved.out.perTick, ...Array.from({ length: GHOST_ROPE_IDLE }, () => new Set())],
        name: w.name,
    });
    return { staging, solved, tape: { ...tape, description: 'seedling-hammer-ghost-rope: the solver\'s `rope` plan '
        + `(GHOST_ROPE_CUT ON) for ${GHOST_ROPE_TARGET.id} from (${w.boot.x},${w.boot.y}) with the ghost sword `
        + '(probe-seedling-ghost-rope.mjs)' } };
}

/** One witness's tape: a face tap up, one `primary` press, `GHOST_ROPE_IDLE` idle ticks. */
export async function ghostRopeTape(w) {
    const { ropeStaging } = await import('./fidelityRope.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging({ boot: w.boot, items: [...w.items] });
    const perTick = [new Set(['up']), new Set(['primary']),
        ...Array.from({ length: GHOST_ROPE_IDLE }, () => new Set())];
    const tape = buildStagedTape({ staging, perTick, name: w.name });
    return { staging, tape: { ...tape, description: `seedling-hammer-ghost-rope: one ${w.items.includes('hasGhostSword')
        ? 'GHOST' : 'plain'} sword press at ${GHOST_ROPE_TARGET.id} from the boot (${w.boot.x},${w.boot.y}) `
        + '(probe-seedling-ghost-rope.mjs)' } };
}

/**
 * The model's account of a witness tape: per-tick samples (`fidelityRope.modelSamples`'s format), the rope pulls, and
 * `testFrom` — where the player stands at the first hit test's tick, with its distance to the rope's rect (the
 * game's `distanceRectPoint` gate: 24 for the ghost sword, 16 for the sword).
 */
export async function ghostRopeModel(tapeJson) {
    const { modelSamples } = await import('./fidelityRope.js');
    const { distanceRectPoint } = await import('./presses.js');
    const { samples, pulls } = await modelSamples(tapeJson);
    const at = samples[GHOST_ROPE_TARGET.testTick];
    return { samples, pulls, testFrom: at ? { x: at.x, y: at.y,
        d: Math.round(distanceRectPoint(at.x, at.y, GHOST_ROPE_TARGET.rect) * 1000) / 1000 } : null };
}
