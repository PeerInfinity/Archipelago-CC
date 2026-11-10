/**
 * seedlingDemo/editSolve — **SOLVE IN THE EDIT ARM** (Seedling editor E1).
 *
 * The EDIT arm's SOLVE used to refuse every press ("this arm has NO ORACLE"): a room with no ladder has no
 * palette and no pin union, and inventing an inventory would certify it under one nobody asked for. This
 * module answers the press with the SAME oracle GENERATE certifies with — `procgenSeedling.seedlingOracle`,
 * whose `solve` is `procgenOracle.solve` under `pinsForRecord(record)` — and resolves the old refusal's two
 * reasons by making them INPUTS the reader can see:
 *
 *   · **the GOAL** is one of the room's own goals, picked by the reader (`editSolveGoals`): every collectable
 *     body (a pickup, an AP item, a chest) and every exit that leads back INTO this room. An exit to another
 *     level is listed and refused by name — the oracle solves ONE room (`procgenOracle.solve` builds its level
 *     source from this record alone), so crossing it would ask the engine for a room it does not have
 *     (MEASURED: `seedling atlas has no level 0` on L1's door). A room with no goal at all refuses by name.
 *   · **the INVENTORY** is typed, not invented (`parseSolveItems`): seam item flags as JSON, `{}` by default,
 *     and the verdict names the inventory it was reached under.
 *
 * ⛔ WHY NOT `seedlingGenRoom.certifyGenRoom`: it re-draws the GENERATED room's model from the payload's seed,
 * size and knobs (`redrawGenRoom`) and certifies every location of a pipeline sidecar. A hand-edited vanilla
 * or pasted room has no seed and no sidecar, so there is nothing for it to re-draw; it stays the pipeline
 * round trip's certifier and this is the editor's.
 *
 * ⛔ NO SOLVER, MODEL OR ORACLE EDIT: this file only chooses the goal, the boot and the items, and calls.
 */
import { seedlingOracle } from './procgenSeedling.js';
import { collectGoal } from './procgenOracle.js';
import { PICKUP_TAGS } from './seedlingPickupSkin.js';
import { LINK_TAGS } from './seedlingAtlasDerivation.js';

export class EditSolveError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EditSolveError';
    }
}

/** The bodies a `collect-placement` goal can name: the pickups, the AP items and the chests. */
export const COLLECT_GOAL_TAGS = Object.freeze(new Set([...PICKUP_TAGS, 'apitem', 'chest']));

/**
 * ⛓⛓ THE ROOM's OWN GOALS, in a stable order (collectables, then exits; each in `entities` order):
 * `[{id, label, goal | null, refused | null}]`. `id` is `collect@x,y` / `exit@x,y` in OEL pixels, so a
 * page's `<select>` and a test name the same goal the same way.
 */
export function editSolveGoals(record) {
    const out = [];
    for (const e of record?.entities ?? []) {
        if (!COLLECT_GOAL_TAGS.has(e.type)) continue;
        out.push(Object.freeze({
            id: `collect@${e.x},${e.y}`,
            label: `collect the <${e.type}> at (${e.x},${e.y})`,
            goal: Object.freeze(collectGoal(e.x, e.y)),
            refused: null,
        }));
    }
    for (const e of record?.entities ?? []) {
        if (!LINK_TAGS.includes(e.type)) continue;
        const to = Number.parseInt(e.attrs?.to ?? '', 10);
        const self = to === record.level;
        out.push(Object.freeze({
            id: `exit@${e.x},${e.y}`,
            label: `reach the <${e.type}> at (${e.x},${e.y})${self ? '' : ` — leads to level ${e.attrs?.to}`}`,
            goal: self ? Object.freeze({ kind: 'reach-exit', exit: { x: e.x, y: e.y } }) : null,
            refused: self ? null : `the <${e.type}> at (${e.x},${e.y}) leads to level ${e.attrs?.to ?? '(none)'}, `
                + `not back into this room (level ${record.level}). ⛔ The oracle solves ONE room — its level `
                + 'source is this record alone — so crossing that exit would ask the engine for a room it does '
                + 'not hold. Pick a collectable, or an exit that leads back into this room.',
        }));
    }
    return Object.freeze(out);
}

/** ⛓ The refusal a room with no goal at all gets, by name. */
export const NO_GOAL_REFUSAL = 'this room has NO GOAL the oracle can be asked about — no pickup, AP item or '
    + 'chest to collect and no exit at all. ⛔ SOLVE refuses rather than inventing one: a certification '
    + 'is an answer to a question, and this room poses none. Place a pickup (or an exit back into the room).';

/**
 * ⛓ THE INVENTORY, as typed: `''` or `{}` → `null` (the oracle's own "no items"), else a JSON object of seam
 * item flags. ⛔ Refused by name when it is not a JSON object — an inventory read wrong would certify the room
 * under one nobody typed.
 */
export function parseSolveItems(text) {
    const raw = String(text ?? '').trim();
    if (raw === '' || raw === '{}') return null;
    let v;
    try { v = JSON.parse(raw); } catch (e) {
        throw new EditSolveError(`the SOLVE inventory does not parse as JSON (${e.message}). It is seam item `
            + 'flags, e.g. {"hasSword": true}; empty means no items.');
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
        throw new EditSolveError(`the SOLVE inventory must be a JSON OBJECT of item flags, got ${raw}.`);
    }
    return v;
}

/**
 * ⛓⛓⛓ SOLVE THE EDITED ROOM. `boot` is the page's spawn (`{level, x, y}`, the same corner the still frame
 * drew the player at), `goalId` one of `editSolveGoals(record)`'s ids, `items` from `parseSolveItems`.
 * Returns the oracle's verdict object unchanged (refusals included), plus `goalId` and `items`.
 * ⛔ Throws `EditSolveError` (a refusal BY NAME, before any solve) for no goal, an unknown goal or a goal that
 * cannot be asked; the oracle's own refusals come back as verdicts, never as throws.
 */
export function solveEditedRoom(record, { boot, goalId = null, items = null, budget } = {}) {
    const goals = editSolveGoals(record);
    if (goals.length === 0) throw new EditSolveError(NO_GOAL_REFUSAL);
    const pick = goalId === null ? (goals.find((g) => g.goal) ?? goals[0]) : goals.find((g) => g.id === goalId);
    if (!pick) {
        throw new EditSolveError(`no goal ${JSON.stringify(goalId)} in this room — it offers `
            + `[${goals.map((g) => g.id).join(', ')}].`);
    }
    if (!pick.goal) throw new EditSolveError(pick.refused);
    if (!boot || !Number.isFinite(boot.x) || !Number.isFinite(boot.y)) {
        throw new EditSolveError('SOLVE has no spawn for this room — the page found no walkable tile to boot '
            + 'the player on, so there is no walk to ask about.');
    }
    const model = { boot: () => ({ level: record.level, x: boot.x, y: boot.y }), goals: [pick.goal] };
    const out = seedlingOracle({ model, items, ...(budget ? { budget } : {}) }).solve(record);
    return { ...out, goalId: pick.id, goalLabel: pick.label, items };
}
