/**
 * apworldEditor/regionRederive — **`Re-derive rules ▸`: A REGION'S ACCESS RULES,
 * RE-DERIVED FROM ITS PAYLOAD AFTER A RAW EDIT** (PRESET SIDECARS S2;
 * `NewDocs/plans/preset-sidecars-plan.md` §3 D1, §5b Q1 C, §9.3 rung 7).
 *
 * ⚖ user, 2026-09-10, Q1 C: a raw save writes the entry alone, and a SEPARATE
 * button re-derives — *"but we can disable the buttons for substrates where
 * that feature is currently unavailable."*
 *
 * ── ⛓⛓⛓ WHY THE BASELINE COMES FROM THE RECORD ────────────────────────
 *
 * H4b's Edit ▸ proves authorship with a BASELINE: a rule may move only where the
 * round trip of the payload REPRODUCES the document's own rule (grid-composed
 * gates are not in the room, so they never reproduce and stay frozen). After a
 * RAW save the payload in the document is already the edited one, so a baseline
 * taken from it proves nothing: every rule whose geometry changed reads as "not
 * reproduced" and freezes — which is every rule the button exists to move.
 *
 * ⇒ the pre-edit payload is recovered from the SESSION'S RECORD: the base
 * document folded forward op by op (`editCore.foldEdits`, the fold undo is),
 * stopping at the most recent op that MOVED this region's payload. The state
 * just before that op holds the payload the region's rules were written for.
 *
 * ⛔ "Moved the payload" is read off the states, never off an op-name list: a
 * raw edit reaches the payload through `set-region-sidecar` (the block) AND
 * through the Document tab's whole-slot `set-key` (the S1 record drove one),
 * and a Re-derive that writes the payload byte for byte did not move it.
 *
 * ── ⛓⛓ THE RULE, PER ENDPOINT (name → rule, the document's names) ───────
 *
 *   · AGREES   the current payload's derivation already produces the rule the
 *              document holds — left exactly as it is (never re-spelled:
 *              `HasAll` stays `HasAll`);
 *   · MOVES    the PRE-EDIT payload's derivation produced the document's rule —
 *              the room wrote it, so the room's new answer replaces it;
 *   · FROZEN   neither — a gate the grid composed, a rule written by hand, or one
 *              outside `sameRule`'s comparable fragment. Left as it is, NAMED and
 *              COUNTED in the message.
 *
 * With NO pre-edit state in the record (the document arrived already
 * hand-edited, or the edit was undone) nothing can be proven the room's, so
 * nothing moves — the message says why and points at Edit ▸, which opens a room
 * and re-derives from what the reader does there.
 *
 * ⛔ The totality refusals are H4b's: an endpoint the room has and the document
 * does not name is refused here; an endpoint the document has and the room lost
 * is refused by the OP (`replace-region-sidecar`), asked of a preview so the
 * panel prints it rather than meeting it in the session's alert.
 */

import { foldEdits } from '../procgenCore/editCore.js';
import { applyRulesDocOp } from './rulesDocOps.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { deriveRegionRules, prettyBytes, sameRule, sidecarOf } from './regionRoundTrip.js';

const bytes = (v) => JSON.stringify(v ?? null);

/**
 * ⛓ The clause a message carries when the record holds no pre-edit payload for
 * the region. EXPORTED so the rows assert the sentence the product wrote.
 */
export const REDERIVE_NO_BASELINE = 'no earlier payload for this region in this session\'s edits';

/** ⛓ …and where that message points: the door that re-derives from a room it opens. */
export const REDERIVE_POINTS_AT_EDIT = 'open the room with Edit ▸ and save there';

/** ⛓ The clause for a payload written back exactly as it stood. */
export const REDERIVE_PAYLOAD_KEPT = 'payload kept byte for byte';

/** ⛓ The clause's head for a payload the serializer rewrote. */
export const REDERIVE_PAYLOAD_NORMALISED = 'payload normalised by the serializer';

const payloadOf = (doc, player, name) => sidecarOf(doc, player, name)?.playable_payload;

/**
 * ⛓⛓ **THE DOCUMENT AS IT STOOD BEFORE THE REGION'S PAYLOAD LAST MOVED.**
 *
 * @param {{base: object, ops: object[], doc: object}} history the session's
 *   base RECORD (the one it was opened on), its op list, and the document now
 * @returns {{doc: object|null, index: number, of: number, op: string|null,
 *   why: string|null}} `doc` null when there is no such state, and `why` says
 *   which of the reasons it is
 */
export function priorRegionState({ base, ops, doc }, player, name) {
    const none = (why) => ({ doc: null, index: -1, of: ops?.length ?? 0, op: null, why });
    if (!base || typeof base !== 'object' || !Array.isArray(ops)) {
        return none('no edit history was handed in');
    }
    let record = base;
    let found = null;
    try {
        ops.forEach((op, i) => {
            const next = foldEdits(rulesEditAdapter, record, [op]).record;
            const a = payloadOf(record, player, name);
            const b = payloadOf(next, player, name);
            if (a !== b && bytes(a) !== bytes(b)) found = { doc: record, index: i, op: op?.op ?? null };
            record = next;
        });
    } catch (e) {
        return none(`the session's edit list could not be re-folded — ${e.message}`);
    }
    // ⛔ A history that does not end at the document in hand describes some
    //   other document, and a baseline read off it would prove nothing here.
    if (doc && !rulesEditAdapter.equal(record, doc)) {
        return none('the session\'s edit list does not reproduce the document in hand');
    }
    if (!found) return none(REDERIVE_NO_BASELINE);
    return { ...found, of: ops.length, why: null };
}

const list = (xs) => (xs.length <= 3
    ? xs.join(', ')
    : `${xs.slice(0, 3).join(', ')} and ${xs.length - 3} more`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * ⛓⛓⛓ **THE ONE OP, OR ONE SENTENCE WHY NOT.** Async — two round trips, ~90 ms a
 * region each on the maze — so it runs on the PRESS.
 *
 * @param {{base, ops, doc}} history see `priorRegionState`
 * @returns {Promise<object>} `{op, substrate, moved, frozen, agreed, normalised,
 *   baseline, message}` — `op` ONE `replace-region-sidecar` whose payload is the
 *   serializer's form of the current one and whose rules map is total; `moved`
 *   / `frozen` / `agreed` the endpoints as `exit "n"` / `location "n"`;
 *   `normalised` null or `{keys, before, after}` (the top-level payload keys
 *   the serializer rewrote, and the pretty size at the block's indent before
 *   and after); `baseline` `{index, of, op}` or `{why}` — or `{error}`.
 */
export async function rederiveRegionRules(history, player, name) {
    const doc = history?.doc;
    const now = await deriveRegionRules(doc, player, name);
    if (!now.ok) return { error: now.hidden ? `"${name}" has no sidecar entry in slot ${player}` : now.why };
    if (now.unnamed.length) {
        return {
            error: `the payload of "${name}" now has ${now.unnamed.join(', ')} that this document `
                + 'does not name. ⛔ Adding an AP location or entrance to a FILLED document needs an '
                + 'id and a pool entry, which a re-derivation cannot mint — add it in the Regions '
                + 'tab first, or edit the payload back.',
        };
    }

    const prior = priorRegionState(history, player, name);
    let before = null;
    let baseline;
    if (prior.doc) {
        const was = await deriveRegionRules(prior.doc, player, name);
        if (was.ok) {
            before = was;
            baseline = { index: prior.index, of: prior.of, op: prior.op };
        } else {
            baseline = { why: `the payload before op ${prior.index + 1} of ${prior.of} could not `
                + `be derived — ${was.why}` };
        }
    } else {
        baseline = { why: prior.why };
    }

    const region = doc.regions[player][name];
    const rules = { exits: {}, locations: {} };
    const moved = [];
    const frozen = [];
    const agreed = [];
    const fill = (list0, derivedNow, derivedBefore, into, what) => {
        for (const entry of list0) {
            const derived = derivedNow.get(entry.name);
            if (derived === undefined) continue;          // the room lost it: the OP refuses
            const label = `${what} "${entry.name}"`;
            if (sameRule(derived, entry.access_rule)) {
                into[entry.name] = entry.access_rule;
                agreed.push(label);
            } else if (derivedBefore && sameRule(derivedBefore.get(entry.name), entry.access_rule)) {
                into[entry.name] = derived;
                moved.push(label);
            } else {
                into[entry.name] = entry.access_rule;
                frozen.push(label);
            }
        }
    };
    fill(region.exits ?? [], now.exits, before?.exits, rules.exits, 'exit');
    fill(region.locations ?? [], now.locations, before?.locations, rules.locations, 'location');

    const op = { op: 'replace-region-sidecar', player, region: name, payload: now.payload, rules };
    const preview = applyRulesDocOp(doc, op);
    if (!preview.ok) return { error: preview.error };

    const current = payloadOf(doc, player, name);
    const normalised = bytes(now.payload) === bytes(current) ? null : {
        keys: [...new Set([...Object.keys(current ?? {}), ...Object.keys(now.payload ?? {})])]
            .filter((k) => bytes(current?.[k]) !== bytes(now.payload?.[k])),
        before: prettyBytes(current),
        after: prettyBytes(now.payload),
    };

    const parts = [`region ${name}: re-derived ${plural(moved.length, 'rule')} from its payload`
        + `${moved.length ? ` (${list(moved)})` : ''}`];
    parts.push(`${frozen.length} frozen${frozen.length
        ? ` (${list(frozen)} — ${before
            ? 'the room before the edit did not produce them either: grid-composed, hand-written, '
            : 'nothing proves the room wrote them: '}or outside the comparable fragment)`
        : ''}`);
    parts.push(`${agreed.length} already agree`);
    const payloadClause = normalised
        ? `${REDERIVE_PAYLOAD_NORMALISED} (${list(normalised.keys.map((k) => `\`${k}\``))} rewritten; `
            + `${normalised.before.toLocaleString('en-US')} → ${normalised.after.toLocaleString('en-US')} B)`
        : REDERIVE_PAYLOAD_KEPT;
    let message = `${parts.join(', ')}; ${payloadClause}.`;
    if (before) {
        message += ` Baseline: the payload before op ${baseline.index + 1} of ${baseline.of} `
            + `(\`${baseline.op}\`).`;
    } else {
        const why = baseline.why === REDERIVE_NO_BASELINE
            ? `${REDERIVE_NO_BASELINE} (the document arrived with this payload, or its edit was undone)`
            : `${REDERIVE_NO_BASELINE} that can be used — ${baseline.why}`;
        message += ` ⚠ ${why}, so no rule could be proven the room's own and none moved. To `
            + `re-derive from the room, ${REDERIVE_POINTS_AT_EDIT}.`;
    }

    return {
        op, substrate: now.substrate, moved, frozen, agreed, normalised, baseline, message,
    };
}
