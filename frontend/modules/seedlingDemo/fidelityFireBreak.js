/**
 * seedling-fidelity-firebreak (wave 40) — the `break` verb's FIRE arm (`CONTACT_FIDELITY.fireBreakArm`): the solver's
 * own plans for a run that holds Fire and NO Sword, the staging they boot from (`fidelityRope`'s, `r9-solve-16`'s seam
 * with the items replaced), and the model's samples. Shared by `scripts/procgen/probe-seedling-fire-break.mjs` (plays
 * the plans on the game, `--record`) and `fidelityFireBreak.test.js` (replays the recordings against the model at 0 px).
 *
 * THE GAME'S RULE (ROCKFIRE's trace, `fidelityRockFire.js`): `Player.fire()` → `genericHit(e, "Fire", …)` →
 * `(e as BreakableRock).hit(hasGhostSword ? 1 : 0)`, and `hit` is `if (rockType <= _t) play("break")`. Fire breaks an
 * ordinary rock with or without the Ghost Sword. The flame's first hit tick is press + 4; `goneAt` is hit + 7; the
 * rock's flag is written on observation `goneAt + 1` and its cell opens on `goneAt + 2`.
 *
 * The game exposes no rock row (`botMobiles` walks `Mobile`), so a rock is read through its PERSISTENCE WRITE
 * (`botStatus.persistence_cleared`) and through the walk that crosses its cell afterwards.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDLE_TAIL, ropeStaging } from './fidelityRope.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const FIREBREAK_WITNESS_DIR = join(HERE, 'fixtures', 'firebreak-witness');

/** The switch every plan is made under. */
export const FIREBREAK_SWITCHES = Object.freeze({ fireBreakArm: true });

const rockGoal = (level, tag, x, y) => Object.freeze({ kind: 'clear-tag', tag: Object.freeze({ level, tag }),
    at: Object.freeze({ x, y }), obstacle: `breakablerock@${x},${y}` });

/**
 * The witnesses: `{name, boot, items, goals, rocks: [{id, tag}], to}` — every one a run with Fire and NO Sword, the
 * rocks standing (a fresh save).
 *   firebreak-l0-rock-east    L0 from the L2 door's landing (256,256): the clear-tag {0,1}, `breakablerock@288,176`
 *   firebreak-l0-rock-west    L0 from the L13 door's landing (48,192): the clear-tag {0,4}, `breakablerock@80,112`
 *   firebreak-l0-wand-fire    the east rock again with the WAND selected and Fire held: the plan selects the Fire's
 *                             slot for the press (`equip`) and restores the wand's
 *   firebreak-l3-pocket       L3 from the L11 door's landing (96,128), a one-cell pocket whose only way off is
 *                             `breakablerock@96,112`: latched on the door, the plan breaks the rock FROM the door
 *                             (the step-off's `break`), steps off through its cell and back on — the crossing to L11
 *   firebreak-l30-pit         L30 from the L28 door's landing (16,128): `breakablerock@48,224` stands on the pit to
 *                             L31; the plan walks the room, breaks it from (40,216) and falls — the crossing to L31
 *   firebreak-l92-cross       L92 from the L87 door's landing (272,128), Fire with swim, shield, torch and feather: BOTH
 *                             of the room's rocks (`@256,112` then `@176,48`, each `tag = -1`: no flag the readout
 *                             holds, so `rocks` is empty and the crossing itself is the reading) and out to L91.
 *                             ⚠ `arrival: true` — staged by `fidelityArrival.arrivalStaging` (the census's own boot),
 *                             not `r9-solve-16`'s seam: the room holds a spinner, a jellyfish and a bob, and under that
 *                             tape's game clock the same request refuses at the spinner's hammer beside (200,72).
 */
export const FIREBREAK_WITNESSES = Object.freeze([
    Object.freeze({ name: 'firebreak-l0-rock-east', boot: Object.freeze({ level: 0, x: 256, y: 256 }), items: ['hasFire'],
        persistence: [], goals: [rockGoal(0, 1, 288, 176)], rocks: [{ id: 'breakablerock@288,176', tag: 1 }], to: 0 }),
    Object.freeze({ name: 'firebreak-l0-rock-west', boot: Object.freeze({ level: 0, x: 48, y: 192 }), items: ['hasFire'],
        persistence: [], goals: [rockGoal(0, 4, 80, 112)], rocks: [{ id: 'breakablerock@80,112', tag: 4 }], to: 0 }),
    Object.freeze({ name: 'firebreak-l0-wand-fire', boot: Object.freeze({ level: 0, x: 256, y: 256 }),
        items: ['hasFire', 'hasWand'], select: 'wand', persistence: [], goals: [rockGoal(0, 1, 288, 176)],
        rocks: [{ id: 'breakablerock@288,176', tag: 1 }], to: 0 }),
    Object.freeze({ name: 'firebreak-l3-pocket', boot: Object.freeze({ level: 3, x: 96, y: 128 }), items: ['hasFire'],
        persistence: [], goals: [Object.freeze({ kind: 'reach-exit', exit: Object.freeze({ x: 96, y: 128 }) })],
        rocks: [{ id: 'breakablerock@96,112', tag: 0 }], to: 11 }),
    Object.freeze({ name: 'firebreak-l30-pit', boot: Object.freeze({ level: 30, x: 16, y: 128 }), items: ['hasFire'],
        persistence: [], goals: [Object.freeze({ kind: 'reach-pit', pit: Object.freeze({ tx: 3, ty: 14, x: 48, y: 224 }) })],
        rocks: [{ id: 'breakablerock@48,224', tag: 1 }], to: 31 }),
    Object.freeze({ name: 'firebreak-l92-cross', boot: Object.freeze({ level: 92, x: 272, y: 128 }),
        items: ['hasFire', 'canSwim', 'hasShield', 'hasTorch', 'hasFeather'], arrival: true, persistence: [],
        goals: [Object.freeze({ kind: 'reach-exit', exit: Object.freeze({ x: 32, y: 144 }) })],
        rocks: [], breaks: ['breakablerock@256,112', 'breakablerock@176,48'], to: 91 }),
]);

/** A witness's staging: `ropeStaging`'s, with the named slot selected at t0 when the row says `select`. */
export async function fireBreakStaging(w) {
    const { inventorySlotsFor, INVENTORY_ITEM_IDS } = await import('./tapeFormat.js');
    if (w.arrival) {
        const { arrivalStaging } = await import('./fidelityArrival.js');
        return arrivalStaging(w.boot, { items: w.items });
    }
    const staging = await ropeStaging(w);
    if (!w.select) return staging;
    const slot = inventorySlotsFor(staging.seam.items).indexOf(INVENTORY_ITEM_IDS[w.select]);
    if (slot < 0) throw new Error(`fireBreakStaging: ${w.name} holds no ${w.select} slot`);
    return slot === 0 ? staging : { ...staging, equips: [...(staging.equips ?? []), { t: 0, slot }] };
}

/** The solver's plan (`over` laid on the switch; default: ON) and its tape. A refusal propagates. */
export async function fireBreakPlan(w, over = FIREBREAK_SWITCHES) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await fireBreakStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await withContactFidelity(over, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence ?? [], log: () => {},
    }));
    const tape = buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        // The probe drops a tape's final tick; a short idle tail keeps the last write inside the sampled window.
        perTick: [...solved.out.perTick, ...Array.from({ length: IDLE_TAIL }, () => new Set())],
        name: w.name,
    });
    return { staging, solved, tape: { ...tape, description: 'seedling-fidelity-firebreak: the solver\'s `break` plan '
        + `for ${w.goals.map((g) => g.obstacle ?? g.kind).join(' then ')} with Fire and no Sword `
        + '(probe-seedling-fire-break.mjs)' } };
}

/** One `botStatus` poll, folded to a sample. */
export function fireBreakSampleOf(s, level) {
    return { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null,
        cleared: (s.persistence_cleared ?? []).filter((c) => c.level === level).map((c) => c.tag).sort((a, b) => a - b) };
}

/**
 * The model's samples of a tape (`over` laid on the defaults), by observation: the player, the hits, and `written` —
 * the rock flags the game's readout holds by then (`endAnim` runs on update `goneAt`, so from observation
 * `goneAt + 1`; ROCKFIRE's convention). Also the rocks broken and the Fire presses with their rock rows.
 */
export async function fireBreakModelSamples(tapeJson, over = FIREBREAK_SWITCHES) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let rocks = [];
    let presses = [];
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            // the BOOT level's rocks: a crossing leaves the room, and the game's readout keeps the flag it wrote there
            const broken = run ? run.rocksBroken.filter((k) => k.level === tape.boot.level) : [];
            samples[o.t] = { x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0,
                written: broken.filter((k) => k.goneAt + 1 <= o.t && (k.tag ?? -1) >= 0).map((k) => k.tag)
                    .sort((a, b) => a - b) };
            r = st.next();
        }
        rocks = run ? run.rocksBroken.map((k) => ({ id: k.id, hitTick: k.hitTick, goneAt: k.goneAt, tag: k.tag })) : [];
        presses = run ? run.presses.map((p) => ({ t: p.t, fired: p.fired, weapon: p.weapon,
            hits: p.hits.filter((h) => h.as3 === 'BreakableRock').map((h) => ({ id: h.id, broke: h.broke })) })) : [];
    });
    return { samples, rocks, presses };
}

/**
 * Compare a game witness with the model on every sampled tick: the player at 0 px, the level, the hits, and the
 * rock flags of `tags` (the witness's own rocks: other writers of the room are not this arm's).
 */
export function compareFireBreak(game, model, tags) {
    const bad = [];
    const only = (list) => list.filter((t) => tags.includes(t)).join(',');
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (m.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${m.hits}`);
        if (only(g.cleared) !== only(m.written)) {
            bad.push(`t ${g.t}: rock flags game [${only(g.cleared)}] model [${only(m.written)}]`);
        }
    }
    return bad;
}
