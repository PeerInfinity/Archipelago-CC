/**
 * Room accessibility — what the wrapper tells the engine about one room's
 * exits and locations, given the host's state snapshot and static data.
 *
 * ⛔ UNKNOWN IS INACCESSIBLE. The engine seeds every exit and item
 * `accessible: true` on `loadWorld`, so a bridge that simply skipped the
 * evaluation while the snapshot was still in flight left a gated exit
 * rendered (and clickable) as open until the snapshot landed. The static data
 * answers in one round trip; the snapshot is a `pingWorker` round trip to the
 * state-manager worker, so under load it arrives LATER than the world is built
 * — the concept trial's Phase A flake (measured: the guarded exit painted
 * `tae-link-accessible` ~10 ms before `STATE_SNAPSHOT`, holding no sword).
 * Until there is a snapshot and static data to evaluate against, every exit
 * and location of the room is reported inaccessible; the next snapshot
 * re-evaluates.
 *
 * ⚠ A RULE THAT THROWS IS PASSABLE, AND SAYS SO. It still reads accessible
 * (the bridge's long-standing policy: a rule the evaluator cannot read must
 * not softlock the player), but it is no longer silent. Its message lands in
 * `ruleErrors` — the third state, beside open and shut — and is logged at
 * `error` once per call, naming the room, the exit or location and the
 * message. One call is one evaluation pass (a snapshot or a region change),
 * not a frame, so the console line does not repeat on every render. The bridge
 * marks the link from `ruleErrors` (`ruleErrorMarker.js`). That is a different
 * question from "no state yet", which stays shut (`known: false`) and carries
 * no rule errors: nothing was evaluated.
 *
 * @param {{exits: {id: string}[], items: {id: string}[]}} room
 * @param {{exits: Object<string, object|null>, items: Object<string, object|null>}} rules
 * @param {object|null} snapshot  the host's latest state snapshot
 * @param {object|null} staticData
 * @param {{createContext: Function, evaluate: Function, log?: Function}} deps
 * @returns {{known: boolean, exits: Object<string, boolean>, items: Object<string, boolean>,
 *     ruleErrors: {exits: Object<string, string>, items: Object<string, string>}}}
 *     `ruleErrors` holds an entry only for an exit or location whose rule threw.
 */
export function roomAccessibility(room, rules, snapshot, staticData, { createContext, evaluate, log = () => {} }) {
    const all = (value) => ({
        exits: Object.fromEntries(room.exits.map((e) => [e.id, value])),
        items: Object.fromEntries(room.items.map((i) => [i.id, value])),
        ruleErrors: { exits: {}, items: {} },
    });
    if (!snapshot || !staticData) return { known: false, ...all(false) };

    let ctx;
    try {
        ctx = createContext(snapshot, staticData, {});
    } catch (err) {
        log('warn', 'createSnapshotInterface failed:', err);
        return { known: false, ...all(false) };
    }

    const ruleErrors = { exits: {}, items: {} };
    const evalRule = (kind, id, rule) => {
        if (rule == null) return true;
        try {
            return !!evaluate(rule, ctx);
        } catch (err) {
            const message = String(err?.message ?? err);
            ruleErrors[kind][id] = message;
            log('error', `access rule threw in room "${room.id}", ${kind === 'exits' ? 'exit' : 'location'} "${id}"`
                + ` — left passable: ${message}`, rule);
            return true;
        }
    };
    return {
        known: true,
        exits: Object.fromEntries(room.exits.map((e) => [e.id, evalRule('exits', e.id, rules.exits?.[e.id])])),
        items: Object.fromEntries(room.items.map((i) => [i.id, evalRule('items', i.id, rules.items?.[i.id])])),
        ruleErrors,
    };
}
