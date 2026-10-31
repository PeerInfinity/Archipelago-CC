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
 * A rule that THROWS still defaults to accessible (the bridge's long-standing
 * policy for a rule the evaluator cannot read); that is a different question
 * from "no state yet".
 *
 * @param {{exits: {id: string}[], items: {id: string}[]}} room
 * @param {{exits: Object<string, object|null>, items: Object<string, object|null>}} rules
 * @param {object|null} snapshot  the host's latest state snapshot
 * @param {object|null} staticData
 * @param {{createContext: Function, evaluate: Function, log?: Function}} deps
 * @returns {{known: boolean, exits: Object<string, boolean>, items: Object<string, boolean>}}
 */
export function roomAccessibility(room, rules, snapshot, staticData, { createContext, evaluate, log = () => {} }) {
    const all = (value) => ({
        exits: Object.fromEntries(room.exits.map((e) => [e.id, value])),
        items: Object.fromEntries(room.items.map((i) => [i.id, value])),
    });
    if (!snapshot || !staticData) return { known: false, ...all(false) };

    let ctx;
    try {
        ctx = createContext(snapshot, staticData, {});
    } catch (err) {
        log('warn', 'createSnapshotInterface failed:', err);
        return { known: false, ...all(false) };
    }

    const evalRule = (rule) => {
        if (rule == null) return true;
        try {
            return !!evaluate(rule, ctx);
        } catch (err) {
            log('debug', 'rule eval threw, defaulting accessible:', err);
            return true;
        }
    };
    return {
        known: true,
        exits: Object.fromEntries(room.exits.map((e) => [e.id, evalRule(rules.exits?.[e.id])])),
        items: Object.fromEntries(room.items.map((i) => [i.id, evalRule(rules.items?.[i.id])])),
    };
}
