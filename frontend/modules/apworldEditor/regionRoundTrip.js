/**
 * apworldEditor/regionRoundTrip — **THE HUB'S DOOR INTO A REGION'S ROOM**
 * (APWORLD EDITOR HUB slice H4b; plan §3 idea 2, §5's H4b row, §17).
 *
 * ⛔ PURE OF SUBSTRATES, AND THAT IS THE POINT. This file knows about a
 * rules.json document — its regions, its sidecars, its AP names — and about
 * `substrateRegistry`. It imports NO substrate module. Two facts are the
 * substrate's and are resolved as DATA off its registry entry:
 *
 *     roomEditor      { kind, … }        → WHICH editor opens the room (W3)
 *     regionRoundTrip { open, save }     → what that editor wants handed IN,
 *                                          and how to read its save back
 *
 * ⇒ a substrate that grows a room editor gets an Edit door here by DECLARING
 * two things, and nothing in `apworldEditor/` learns its name. That is H3's
 * `compositeMap.drawRegion` precedent and the user's standing ⚖: *"I don't
 * want to hardcode support for … specific substrates"*.
 *
 * ── ⛓⛓⛓ THE BASELINE, AND WHY EVERY CLAIM HERE RESTS ON IT ────────────
 *
 * The naive door is *"open the room, take the save, write the payload and the
 * re-derived rules back"*. MEASURED over all 1,046 committed maze-payload
 * sidecar regions and the H4a fixture's 10 bounce ones, that door is WRONG
 * three different ways, and none of the three is visible without running it:
 *
 *   1. **A room editor's document is not a placed region.** The maze lab edits
 *      a REGION LIBRARY, whose capture path deliberately strips the exit
 *      stitching and the AP location names (see `mazeRegionRoundTrip`). Written
 *      back raw it deletes every connection line and every baked location name.
 *   2. **A document's ACCESS RULES are not all derivable from its tiles.**
 *      Grid-level gating the pipeline composed is not in the room, and a
 *      Python round-tripped document spells `HasAll([a, b])` where the frontend
 *      emits `And(Has a, Has b)`. Overwriting those with the derived rule would
 *      silently OPEN a gated world.
 *   3. **Some regions cannot be round-tripped at all.** A `procgen_topdown`
 *      maze region's locations are named by the SOURCE GAME (`global_name`,
 *      which the payload does not carry). ⛓ **H6b (2026-09-05) RETIRED THE
 *      SECOND EXAMPLE THIS LINE USED TO CARRY** — a bounce region whose exit
 *      portal is authored (`exit_up`) re-assembled under a different id, which
 *      this door found and which turned out to be a defect in the ASSEMBLER
 *      rather than a fact about the payload. `assembleBounceRegionFromLevel`
 *      now reads the level's own portal ids and the bounce corpus goes
 *      15/25 → **25/25**. The door found it precisely BECAUSE the baseline is
 *      a byte check: nothing else was looking. ⛔ Today the whole class is the
 *      ten `seedling_atlas_maze` rooms (payloads the atlas derivation writes
 *      and `serializeMazeWorld` does not) — H6a's to answer for.
 *
 * ⛓ **ONE MECHANISM ANSWERS ALL THREE: RUN THE ROUND TRIP ON THE UNEDITED
 * PAYLOAD FIRST.** `regionRoundTrip.open()` returns both the editor's session
 * AND the value that editor's save would carry for a session nobody touched;
 * feeding that back through `save()` is the BASELINE — what this door does to a
 * region when the reader changes nothing. Then:
 *
 *   · **the door is offered only where the baseline is a NO-OP** — byte-equal
 *     payload, every endpoint mapped to a document name and back. A region
 *     where an unedited save would already move bytes is a region this door
 *     would rewrite behind the reader, and it is DISABLED BY NAME with which
 *     of the two failed;
 *   · **a rule moves only where the baseline REPRODUCES the document's own** —
 *     the door may overwrite a rule it can prove it authored, and nothing else.
 *     The rest are named in the message and left exactly as they are.
 *
 * ⛔ Both halves are checks on the DOCUMENT IN HAND, not on a substrate name.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { getRegionEditor } from '../procgenPipeline/regionEditors.js';
import { extractItemRequirementFromRule } from '../procgenPipeline/ruleRequirements.js';
import {
    apExitNameCandidates, apLocationNameCandidates,
} from '../procgenCore/apLocationNaming.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';

const bytes = (v) => JSON.stringify(v ?? null);

/**
 * ⛓ The declaration, or a REFUSAL SENTENCE. ⛔ A malformed one is NAMED and not
 * swallowed — `regionEditors.js`'s own rule, for its own reason: "no round trip
 * yet" and "this entry declares one and it is wrong" are different facts and
 * only one of them is somebody's bug.
 */
export function regionRoundTripOf(substrate) {
    const decl = substrateRegistry.get(substrate)?.regionRoundTrip;
    if (!decl || typeof decl !== 'object') {
        return {
            rt: null,
            why: `the "${substrate}" substrate has a room editor but declares no `
                + '`regionRoundTrip`, so there is no way to hand it a room out of a '
                + 'rules.json document or to read its save back into one.',
        };
    }
    if (typeof decl.refused === 'string' && decl.refused) {
        return { rt: null, why: decl.refused };
    }
    if (typeof decl.open !== 'function' || typeof decl.save !== 'function') {
        return {
            rt: null,
            why: `the "${substrate}" substrate's \`regionRoundTrip\` declares `
                + `open=${typeof decl.open} / save=${typeof decl.save}, and both must be `
                + 'functions (or `refused` must say why there is no round trip).',
        };
    }
    return { rt: decl, why: null };
}

/** ⛓ The sidecar entry for one region of one slot, or null. */
export const sidecarOf = (doc, player, name) => doc?.preset_sidecars?.[player]?.[name] ?? null;

/**
 * ⛓⛓ **RULE EQUIVALENCE, OVER A NAMED FRAGMENT.** Two rule trees count as the
 * same rule when they are byte-equal, OR when `extractItemRequirementFromRule`
 * — the repo's own inverse compiler — reports the SAME item requirement for
 * both AND says it was EXACT for both.
 *
 * ⛔ The `exact` guard is load-bearing and measured: the extractor answers
 * `{requirement: [], exact: true}` for `True_` and `{requirement: [], exact:
 * false}` for `False_`, so without it an unreachable exit would compare equal
 * to an always-open one. With it, the fragment is exactly the one the extractor
 * documents as logically equivalent — `True_ / Has / And / HasAll` — which is
 * what the Python round trip renormalizes (`And(Has a, Has b)` ⇄
 * `HasAll([a, b])`) and therefore what this door has to see through.
 */
export function sameRule(a, b) {
    if (bytes(a) === bytes(b)) return true;
    const ra = extractItemRequirementFromRule(a);
    const rb = extractItemRequirementFromRule(b);
    if (!ra.exact || !rb.exact) return false;
    return [...ra.requirement].sort().join(' ') === [...rb.requirement].sort().join(' ')
        && bytes(ra.counts) === bytes(rb.counts);
}

/**
 * ⛓ Map the round trip's compiled endpoints onto the DOCUMENT's own names.
 * Returns `{byName, unnamed, unmatched}` — `unnamed` is an endpoint the
 * document does not name, `unmatched` a document endpoint the room no longer
 * has. Both are REFUSALS somewhere; neither is ever silently dropped.
 */
function mapEndpoints(regionName, compiled, docList, candidatesOf) {
    const docNames = new Set(docList.map((e) => e?.name));
    const byName = new Map();
    const unnamed = [];
    for (const end of compiled) {
        const name = end.name && docNames.has(end.name)
            ? end.name
            : candidatesOf(regionName, end).find((c) => docNames.has(c));
        if (!name || byName.has(name)) unnamed.push(end);
        else byName.set(name, end);
    }
    const unmatched = docList.filter((e) => !byName.has(e?.name));
    return { byName, unnamed, unmatched };
}

const exitCandidates = (regionName, e) => apExitNameCandidates(regionName, e.id);
const locCandidates = (regionName, l) => apLocationNameCandidates(regionName, l.id, l.position);

/**
 * ⛓⛓⛓ **WHAT THE Edit DOOR KNOWS BEFORE IT IS PRESSED.** Runs the substrate's
 * round trip on the UNEDITED payload and answers whether this document's region
 * can be edited through it — and if not, WHY, in one sentence fit for a
 * button's `title`.
 *
 * @returns {Promise<object>} `{ok:true, substrate, session, ctx, rt,
 *   movableExits, movableLocations, frozen}` or `{ok:false, substrate, why,
 *   hidden?}`. `hidden` means there is nothing to edit here at all (a classic
 *   AP region with no sidecar), which is an ABSENT button rather than a
 *   disabled one.
 */
export async function inspectRegionRoom(doc, player, name) {
    const sidecar = sidecarOf(doc, player, name);
    if (!sidecar) return { ok: false, hidden: true, substrate: null, why: 'no sidecar' };
    const substrate = sidecar.substrate ?? null;
    const region = doc?.regions?.[player]?.[name] ?? null;
    if (!region) {
        return {
            ok: false,
            substrate,
            why: `player ${player} has a sidecar for "${name}" but no region by that name in `
                + '`regions`, so there is nothing to write the edited rules onto.',
        };
    }
    if (!getRegionEditor(substrate)) {
        return {
            ok: false,
            substrate,
            why: `no region editor for "${substrate}" yet — this substrate's registry entry `
                + 'declares no `roomEditor`.',
        };
    }
    const { rt, why } = regionRoundTripOf(substrate);
    if (!rt) return { ok: false, substrate, why };

    const payload = sidecar.playable_payload;
    const ctx = {
        regionId: name,
        player,
        payload,
        region,
        itemPool: Object.keys(doc?.items?.[player] ?? {}),
        expectedItems: Array.isArray(doc?.starting_items?.[player])
            ? doc.starting_items[player] : [],
    };
    let opened;
    let baseline;
    try {
        opened = await rt.open(ctx);
        baseline = await rt.save(opened.unedited, ctx);
    } catch (e) {
        return {
            ok: false,
            substrate,
            why: `"${substrate}" refused this region's payload — ${e.message}`,
        };
    }

    /* ⛓ (1) an unedited save must not move a byte. */
    if (bytes(baseline.payload) !== bytes(payload)) {
        return {
            ok: false,
            substrate,
            why: `opening and saving "${name}" UNCHANGED would already rewrite its sidecar `
                + 'payload, so this door would edit the region behind you. (The room is not '
                + 'one this substrate\'s editor round-trips exactly — a payload written by a '
                + 'different producer, or one carrying fields its serializer does not emit.)',
        };
    }

    /* ⛓ (2) every endpoint has to map to a document name, and back. */
    const ex = mapEndpoints(name, baseline.exits ?? [], region.exits ?? [], exitCandidates);
    const lo = mapEndpoints(name, baseline.locations ?? [], region.locations ?? [], locCandidates);
    if (ex.unnamed.length || lo.unnamed.length || ex.unmatched.length || lo.unmatched.length) {
        const bits = [
            ...ex.unnamed.map((e) => `the room's exit \`${e.id}\` is not named by the document`),
            ...lo.unnamed.map((l) => `the room's location \`${l.id}\` is not named by the document`),
            ...ex.unmatched.map((e) => `the document's exit "${e.name}" is not in the room`),
            ...lo.unmatched.map((l) => `the document's location "${l.name}" is not in the room`),
        ];
        return {
            ok: false,
            substrate,
            why: `"${name}" cannot be mapped between the room and the document — `
                + `${bits.slice(0, 3).join('; ')}`
                + `${bits.length > 3 ? ` (and ${bits.length - 3} more)` : ''}. ⛔ Without a `
                + 'name for every endpoint an edit could not say which access rule it moved.',
        };
    }

    /* ⛓ (3) which rules this door may move: the ones it reproduced. */
    const movableExits = new Set();
    const frozen = [];
    for (const e of region.exits ?? []) {
        if (sameRule(ex.byName.get(e.name)?.rule, e.access_rule)) movableExits.add(e.name);
        else frozen.push(`exit "${e.name}"`);
    }
    const movableLocations = new Set();
    for (const l of region.locations ?? []) {
        if (sameRule(lo.byName.get(l.name)?.rule, l.access_rule)) movableLocations.add(l.name);
        else frozen.push(`location "${l.name}"`);
    }

    return {
        ok: true,
        substrate,
        session: opened.session,
        /**
         * ⛓ The value the editor's save would carry for a session nobody
         * touched. Kept on the inspection because it IS the baseline the two
         * checks above were computed from — a row (or a caller wanting to know
         * what "no change" looks like) reads the same object those checks did
         * rather than rebuilding one that could differ.
         */
        unedited: opened.unedited,
        ctx,
        rt,
        movableExits,
        movableLocations,
        frozen,
    };
}

/**
 * ⛓⛓ **THE ONE OP, FROM WHAT THE EDITOR SAVED.** Takes the value the room
 * editor's `onSave` carried and the inspection that opened it, and returns the
 * `replace-region-sidecar` op — or a refusal sentence.
 *
 * ⛔ The rules map is TOTAL by construction: every document endpoint gets an
 * entry, either the newly derived rule (when this door proved it authored the
 * old one) or the document's own, UNTOUCHED. An endpoint the edited room LOST
 * has no derived rule at all and is left OUT, so the OP refuses it by name —
 * the op is the authority on that, not this file, and a re-folded edit list is
 * therefore checked exactly the way the first apply was.
 */
export async function buildSidecarOp({ saved, inspection }) {
    const { rt, ctx } = inspection;
    const name = ctx.regionId;
    const player = ctx.player ?? DEFAULT_PLAYER_ID;
    const region = ctx.region;
    let out;
    try {
        out = await rt.save(saved, ctx);
    } catch (e) {
        return {
            error: `the "${inspection.substrate}" editor's save could not be read back — `
                + `${e.message}`,
        };
    }
    const ex = mapEndpoints(name, out.exits ?? [], region.exits ?? [], exitCandidates);
    const lo = mapEndpoints(name, out.locations ?? [], region.locations ?? [], locCandidates);
    if (ex.unnamed.length || lo.unnamed.length) {
        const bits = [
            ...ex.unnamed.map((e) => `a new exit \`${e.id}\``),
            ...lo.unnamed.map((l) => `a new location \`${l.id}\``),
        ];
        return {
            error: `the edited room of "${name}" has ${bits.join(', ')} that this document does `
                + 'not name. ⛔ Adding an AP location or entrance to a FILLED document needs an '
                + 'id and a pool entry, which a geometry editor cannot mint — add it in the '
                + 'Regions tab first, then edit the room.',
        };
    }
    const rules = { exits: {}, locations: {} };
    let moved = 0;
    const fill = (list, mapped, movable, into) => {
        for (const entry of list) {
            const derived = mapped.byName.get(entry.name)?.rule;
            if (derived === undefined) continue;         // the room lost it: the OP refuses
            const may = movable.has(entry.name);
            into[entry.name] = may ? derived : entry.access_rule;
            if (may && bytes(derived) !== bytes(entry.access_rule)) moved += 1;
        }
    };
    fill(region.exits ?? [], ex, inspection.movableExits, rules.exits);
    fill(region.locations ?? [], lo, inspection.movableLocations, rules.locations);
    return {
        op: {
            op: 'replace-region-sidecar', player, region: name, payload: out.payload, rules,
        },
        moved,
    };
}

/**
 * ⛓ Open the room. `onOp` is called ONCE, with `{op, moved}` or `{error}`, when
 * the editor's save comes back — the linked editors' single return path,
 * wrapped in the hub's single op.
 *
 * ⛔ The value handed to the editor is the WORKING COPY's (⚖ *"Let's implement
 * working copy for now"*): `inspection` was built from `session.record()` and
 * the session is what the op is applied to. Nothing here reads applied state.
 *
 * @returns the editor's own handle when it has one (`{ok, why, close}` for the
 *   lab door), so the caller can PARK it and close it on a re-render.
 */
export async function openRegionRoom(inspection, onOp) {
    const open = getRegionEditor(inspection.substrate);
    const onSave = (saved) => {
        buildSidecarOp({ saved, inspection }).then(onOp, (e) => onOp({ error: e.message }));
    };
    return open({ ...inspection.session, onSave });
}
