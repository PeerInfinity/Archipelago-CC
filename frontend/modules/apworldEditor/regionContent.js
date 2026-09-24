/**
 * apworldEditor/regionContent — **A REGION'S CONTENT REPLACED BY A SUBSTRATE'S
 * ZONE** (APWORLD SUBSTRATE CHANGE R5b; the substrate-change plan §12, ⚖ RULED
 * 2026-09-23: *"Yes, let's go with your recommendations"*).
 *
 * The op is `replace-region-content` in `rulesDocOps.js`: `{player, region,
 * source: {kind: 'zone', substrate, zoneIdx, zone?}}`, ONE op and ONE undo. It is
 * the CONTENT-REPLACEMENT class: unlike R0's regenerate (which keeps the
 * document's locations and rebuilds the payload around them), a zone brings its
 * OWN locations, so the region's locations, the items they place, the pool and the
 * canonical placements move together with the sidecar entry.
 *
 * ── ⛓⛓⛓ THE CASCADE (the ruling) ────────────────────────────────────────
 *
 *   1. the zone's locations REPLACE the region's: `${region}__${task}` (what the
 *      engine's zone path mints and `ap_locations` says), `id: null` (the hub's
 *      `add-location`), the zone's access rule (else `True_`), and the `item`
 *      placement object `compileRegionGraph` writes;
 *   2. every item the zone places is registered if absent — `compileRegionGraph`'s
 *      fields `{name, id: null, classification, groups: ['Everything']}`, the id
 *      null as `add-item` mints it — and each NEW placement adds 1 to its pool
 *      count and writes `canonical_placements`;
 *   3. the OLD locations' placements are DELETED and NAMED; their items STAY in the
 *      pool, unplaced — *"it's the user's responsibility to find a way to make the
 *      data valid again"*; the Placements tab lists them (`unplacedPoolItems`);
 *      ⛓ R6 (plan §14.7 #4, within the ruling): EXCEPT the target's declared
 *      FILLER — an item its `libraryItems` classifies `filler`, inlined in the
 *      zone answer as `fillerItems` — which leaves the pool, −1 per displaced
 *      placement (the zone's own filler placements add theirs back), so filler
 *      never inflates the pool; the item's DEFINITION is never touched;
 *      a location that keeps its name AND its item is neither displaced nor new
 *      (so a region re-taking its OWN zone leaves the document as it was);
 *   4. exits unchanged (the old payload's, verbatim; `regions[p][R].exits` is
 *      not touched), the entry = `assembleZoneRegion` + `serializeRegionEntry`,
 *      `grid_cell` kept, and a field the OLD payload HOSTED for its siblings (a
 *      declaration's `references` target) CARRIED onto the new one, so nothing
 *      strands (trap 1395).
 *
 * ── ⛓⛓ WHERE THE ZONE COMES FROM — AND WHY THE PAGE NEVER INSTALLS ─────────
 *
 * A zone channel (`extractZoneRules`) reads module state `applyPipelineConfig`
 * installs, and the page's registry is the pipeline panel's too. So the
 * EXTRACTION (`zoneContentFor`: install the config the document records, verify
 * that every committed zone of the slot reproduces under it, extract) runs only in
 * the generation WORKER or in Node; its answer is INLINED in the op as
 * `source.zone` (R5a's precedent: the library entry is inlined), and the op's
 * apply (`applyZoneContent`) is pure data — a refold, an undo or a replay never
 * installs, never fetches, and reads no page state.
 *
 * The config is what the TARGET declares it can read back (`zoneConfigFromSlot`);
 * what it cannot is `assumed` and VERIFIED by re-extracting every committed zone
 * of the slot — a slot that does not reproduce is refused by name, never guessed.
 * ⛓ R6b — what the document RECORDS (`procgen_metadata.substrate_configs[id]`,
 * written by the pipeline's compile) is handed to the read-back as `recorded`,
 * which the target prefers over `assumed`; the verification is unchanged.
 *
 * ⛔ No substrate is named here: the channel, the recovery, the held-zone reading
 * and the hosted fields are all read off the registry entry.
 */

import {
    DEFAULT_REGION_SIZE, assembleZoneRegion, serializeRegionEntry,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { mergeSubstrateItemLib } from '../procgenPipeline/sphereConfigHooks.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';
import { walkRuleTrees } from '../procgenCore/rulesGraph.js';
import { sidecarFieldsOf } from '../procgenCore/sidecarFields.js';
import { recordedConfigOf } from '../procgenCore/substrateConfigRecord.js';
import { strandedReferences } from './regionRegenerate.js';

/** ⛓ The op this module is the mechanics of. */
export const REPLACE_REGION_CONTENT_OP = 'replace-region-content';

/** ⛓ The two registry hooks the zone source READS BACK a document through. */
export const ZONE_CONFIG_HOOK = 'zoneConfigFromSlot';
export const ZONE_OF_PAYLOAD_HOOK = 'zoneOfPayload';

/** ⛓ The Source row's word for a target's zones when the entry declares none (`zoneSourceLabel`). */
export const ZONE_SOURCE_LABEL_DEFAULT = 'Zone N';

/**
 * ⛓ R5c — how many rounds of served documents a read-back may ask for before
 * the resolver gives up (the atlas intake asks twice: the index, then the atlas).
 */
export const ZONE_FETCH_ROUNDS = 4;

/** ⛓ The item classification a location's placement object is written with when
 *  the target's library does not classify it — `compileRegionGraph`'s default. */
export const ZONE_ITEM_DEFAULT_CLASSIFICATION = 'progression';

/** ⛓ The group every registered item carries — `compileRegionGraph`'s convention. */
export const ZONE_ITEM_GROUPS = Object.freeze(['Everything']);

/** ⛓ The top-level keys the op may touch, per player (the deep-diff row's law). */
export const REPLACE_REGION_CONTENT_KEYS = Object.freeze([
    'regions', 'items', 'itempool_counts', 'canonical_placements', 'preset_sidecars',
]);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const tick = (s) => `\`${s}\``;

/* ── the sentences (the op quotes them; EXPORTED so rows assert the constant) ── */

export const ZONE_NEVER_CREATES = '⛔ replace-region-content REPLACES a region\'s content and never '
    + 'CREATES a room';
export const ZONE_NO_CHANNEL = 'declares no zone channel (`zoneCount` + `extractZoneRules`)';
export const ZONE_NO_RECOVERY = `declares no \`${ZONE_CONFIG_HOOK}\` — the hub cannot read back, from the `
    + 'document, the config its zones were built with';
export const ZONE_NOT_RECORDED = 'the document does not record the config its zones were built with';
export const ZONE_HELD = 'is already held by';
export const ZONE_OUT_OF_RANGE = 'is not a zone of this slot';
export const ZONE_DISPLACED = 'displaced';
export const ZONE_UNPLACED_CLAUSE = 'their items stay in the pool, unplaced — the Placements tab lists them; '
    + 'it is the reader\'s to make the data valid again';
/** ⛓ R6 — the clause naming the displaced FILLER placements the pool dropped. */
export const ZONE_FILLER_DROPPED = 'displaced and dropped from the pool';
/** ⛓ R6 — the classification a target's `libraryItems` gives its filler. */
export const ZONE_FILLER_CLASSIFICATION = 'filler';
export const ZONE_HOST_CARRIED = 'carried';
export const ZONE_DANGLING_REFS = 'now name a location the document no longer holds';
export const ZONE_PAGE_NEVER_EXTRACTS = 'the zone channel\'s answer is computed where the config may be '
    + 'installed (the generation worker, or Node) and INLINED in the op as `source.zone`';
export const ZONE_NEEDS_FETCH = 'reads its config from served documents that have not been fetched';
export const ZONE_FETCH_FAILED = 'could not be fetched';

/* ── the facts, pure ──────────────────────────────────────────────────── */

/**
 * ⛓⛓ **DOES THIS TARGET OFFER THE ZONE SOURCE?** — the spiral's own test for a
 * zone substrate: a numeric `zoneCount` and an `extractZoneRules` channel.
 * `recovers` = it also declares how to read its config back from a document.
 *
 * @returns {{offers: boolean, recovers: boolean, why: string|null}}
 */
export function zoneSourceFacts(entry) {
    if (!entry) return { offers: false, recovers: false, why: 'no such substrate is registered' };
    const offers = typeof entry.zoneCount === 'number' && typeof entry.extractZoneRules === 'function';
    const recovers = offers && typeof entry[ZONE_CONFIG_HOOK] === 'function';
    const why = !offers ? `${tick(entry.id)} ${ZONE_NO_CHANNEL}`
        : !recovers ? `${tick(entry.id)} ${ZONE_NO_RECOVERY}` : null;
    return { offers, recovers, why };
}

/** ⛓ R5c — the Source row's word for `entry`'s zones (the entry's `zoneSourceLabel`, else *Zone N*). */
export function zoneSourceLabelOf(entry) {
    const label = entry?.zoneSourceLabel;
    return typeof label === 'string' && label !== '' ? label : ZONE_SOURCE_LABEL_DEFAULT;
}

/**
 * ⛓ R5c — the document's top-level blocks the target WRITES (`rulesJsonBlocks`),
 * keyed by the entry's own answer, never typed: a read-back may need them (an
 * atlas is named only in `region_atlas`). A key the document lacks is present
 * with `undefined`, so the read-back can refuse it by name.
 */
function blocksOf(doc, entry) {
    let keys = [];
    try { keys = Object.keys(entry?.rulesJsonBlocks?.() ?? {}); } catch { keys = []; }
    return Object.fromEntries(keys.map((k) => [k, doc?.[k]]));
}

/** ⛓ R5c — a region's exit SIDES in document order (a side-bound channel binds one door per side). */
export function exitSidesOfEntry(entry) {
    const exits = entry?.playable_payload?.exits;
    return (Array.isArray(exits) ? exits : []).map((x) => x?.side).filter((sd) => typeof sd === 'string');
}

/** ⛓ The slot's entries of `substrate`, by region (document order). */
function entriesOf(doc, player, substrate) {
    const out = {};
    for (const [region, e] of Object.entries(doc?.preset_sidecars?.[player] ?? {})) {
        if (isObj(e) && e.substrate === substrate) out[region] = e;
    }
    return out;
}

/** ⛓ region → `[{name, item, access_rule}]` over the slot (`item` = the placed item, or null). */
function locationsByRegion(doc, player) {
    const placements = doc?.canonical_placements?.[player] ?? {};
    const out = {};
    for (const [region, body] of Object.entries(doc?.regions?.[player] ?? {})) {
        out[region] = (Array.isArray(body?.locations) ? body.locations : []).map((l) => ({
            name: l?.name,
            item: typeof placements[l?.name] === 'string' ? placements[l.name] : null,
            access_rule: l?.access_rule ?? null,
        }));
    }
    return out;
}

/**
 * ⛓⛓ **THE CONFIG THE DOCUMENT RECORDS FOR `substrate`'s ZONES IN THIS SLOT** —
 * the target's own read-back (`zoneConfigFromSlot`), never an install.
 *
 * ⛓ R6b — `recorded` is the document's record for `substrate` (or null); the
 * answer's `recorded` names the config fields taken from it.
 *
 * @returns {{ok: true, cfg: object, assumed: object, recorded: string[], zoneCount: number, host: string|null}
 *          | {ok: false, why: string}}
 */
export function installedZoneConfigFrom(doc, player, substrate, { fetched = {} } = {}) {
    const entry = substrateRegistry.get(substrate);
    const facts = zoneSourceFacts(entry);
    if (!facts.recovers) return { ok: false, why: `apworld: ${facts.why}.` };
    const res = entry[ZONE_CONFIG_HOOK]({
        entries: entriesOf(doc, player, substrate),
        locations: locationsByRegion(doc, player),
        blocks: blocksOf(doc, entry),
        fetched,
        recorded: recordedConfigOf(doc, substrate),
    });
    // ⛓ R5c — a read-back that needs SERVED documents answers which; the caller
    //   fetches them (`resolveZoneFetches`) and asks again. Never a guess.
    if (!res?.ok && Array.isArray(res?.needs) && res.needs.length) {
        return {
            ok: false,
            needs: [...res.needs],
            why: `apworld: ${tick(substrate)} ${ZONE_NEEDS_FETCH} [${res.needs.join(', ')}] (slot ${player}) — `
                + 'the generation worker fetches them before it extracts.',
        };
    }
    if (!res?.ok) {
        return { ok: false, why: `apworld: ${ZONE_NOT_RECORDED} (slot ${player}, ${tick(substrate)}): ${res?.why}.` };
    }
    return {
        ok: true,
        cfg: res.cfg,
        assumed: res.assumed ?? {},
        recorded: Array.isArray(res.recorded) ? [...res.recorded] : [],
        zoneCount: res.zoneCount,
        host: res.host ?? null,
        ...(Array.isArray(res.zoneNames) ? { zoneNames: res.zoneNames } : {}),
        unplaceable: Array.isArray(res.unplaceable) ? res.unplaceable : [],
    };
}

/**
 * ⛓⛓ R5c — **FETCH WHAT THE READ-BACK ASKS FOR, THEN ASK AGAIN** (the worker, the
 * page's picker, the control — each with its own `fetchJson`). Bounded by
 * `ZONE_FETCH_ROUNDS`; a failed fetch is a refusal naming the path.
 *
 * @param {(path: string) => Promise<object>} fetchJson
 * @returns {Promise<{ok: true, fetched: object} | {ok: false, why: string, fetched: object}>}
 */
export async function resolveZoneFetches(doc, player, substrate, fetchJson, { fetched = {} } = {}) {
    const have = { ...fetched };
    for (let round = 0; round < ZONE_FETCH_ROUNDS; round += 1) {
        const rec = installedZoneConfigFrom(doc, String(player), substrate, { fetched: have });
        if (!rec.needs) return { ok: true, fetched: have };
        for (const path of rec.needs) {
            if (path in have) continue;
            try {
                // eslint-disable-next-line no-await-in-loop
                have[path] = await fetchJson(path);
            } catch (e) {
                return {
                    ok: false,
                    fetched: have,
                    why: `apworld: ${tick(substrate)}'s config reads the served document ${tick(path)}, which `
                        + `${ZONE_FETCH_FAILED} (${String(e?.message ?? e).split('\n')[0]}) — nothing was changed.`,
                };
            }
        }
    }
    return {
        ok: false,
        fetched: have,
        why: `apworld: ${tick(substrate)}'s read-back still asks for documents after ${ZONE_FETCH_ROUNDS} rounds.`,
    };
}

/**
 * ⛓ **WHICH REGION OF THE SLOT HOLDS `substrate`'s zone `zoneIdx`** (read through
 * the entry's `zoneOfPayload`), other than `except` — or null.
 */
export function zoneHeldBy(doc, player, substrate, zoneIdx, { except = null, cfg = undefined } = {}) {
    const reader = substrateRegistry.get(substrate)?.[ZONE_OF_PAYLOAD_HOOK];
    if (typeof reader !== 'function') return null;
    for (const [region, e] of Object.entries(entriesOf(doc, player, substrate))) {
        if (region !== except && reader(e.playable_payload, cfg) === zoneIdx) return region;
    }
    return null;
}

/**
 * ⛓ The zone a region's entry plays, or null (the entry's own reader). `cfg` is
 * the read-back's config — R5c: a room's ordinal is its index in the ATLAS, which
 * the payload names only by room (jta's reader ignores it).
 */
export function zoneOfRegion(doc, player, region, { cfg = undefined } = {}) {
    const e = doc?.preset_sidecars?.[player]?.[region];
    const reader = substrateRegistry.get(e?.substrate)?.[ZONE_OF_PAYLOAD_HOOK];
    return typeof reader === 'function' ? reader(e?.playable_payload, cfg) : null;
}

/**
 * ⛓⛓ **THE PICKER'S OPTIONS** — `0..zoneCount-1` from the RECORDED config (no
 * install), each held zone disabled and labelled with the region holding it.
 *
 * @returns {{ok: true, zoneCount: number, options: Array<{zoneIdx, label, heldBy, own, disabled}>}
 *          | {ok: false, why: string}}
 */
export function zoneOptions(doc, player, region, substrate, { fetched = {} } = {}) {
    const rec = installedZoneConfigFrom(doc, player, substrate, { fetched });
    if (!rec.ok) return rec;
    const cfg = { ...rec.cfg, ...rec.assumed };
    const own = doc?.preset_sidecars?.[player]?.[region]?.substrate === substrate
        ? zoneOfRegion(doc, player, region, { cfg }) : null;
    const options = [];
    for (let z = 0; z < rec.zoneCount; z += 1) {
        const heldBy = zoneHeldBy(doc, player, substrate, z, { except: region, cfg });
        // ⛓ R5c — a zone the read-back NAMES (an atlas room) is listed by its
        //   name; an ordinal-only zone keeps R5b's `Zone N`.
        const name = rec.zoneNames?.[z];
        options.push({
            zoneIdx: z,
            label: `${typeof name === 'string' ? name : `Zone ${z}`}${z === own ? ' (this region\'s own)' : ''}`
                + `${heldBy ? ` — held by ${heldBy}` : ''}`,
            ...(typeof name === 'string' ? { name } : {}),
            heldBy, own: z === own, disabled: !!heldBy,
        });
    }
    // ⛓ R5c — what the channel cannot place is LISTED, disabled, with its reason.
    for (const u of rec.unplaceable) {
        options.push({
            zoneIdx: null, label: `${u.name} — ${u.why}`, name: u.name, heldBy: null, own: false, disabled: true,
            unplaceable: u.why,
        });
    }
    return { ok: true, zoneCount: rec.zoneCount, options };
}

/**
 * ⛓⛓⛓ **EVERY REFUSAL THE OP CAN NAME BEFORE ANYTHING IS WRITTEN** — pure (no
 * install): the entry, the region, the channel, the recovery, the range, the
 * held zone. `null` when the op may proceed.
 */
export function zoneSourceRefusal(doc, { player, region, substrate, zoneIdx }, { fetched = {}, answerInlined = false } = {}) {
    const slot = doc?.preset_sidecars?.[player];
    if (typeof region !== 'string' || !isObj(slot?.[region])) {
        return `apworld: player ${player} has no sidecar entry for region ${JSON.stringify(region)}. `
            + `${ZONE_NEVER_CREATES} — this slot's sidecars are [${Object.keys(slot ?? {}).join(', ') || 'none'}].`;
    }
    if (!isObj(doc?.regions?.[player]?.[region])) {
        return `apworld: slot ${player} has a sidecar for "${region}" but no region of that name to hold its locations.`;
    }
    if (typeof substrate !== 'string' || !substrateRegistry.has(substrate)) {
        return `apworld: no substrate ${JSON.stringify(substrate)} is registered — the registry holds `
            + `[${substrateRegistry.getAll().map((e) => e.id).join(', ')}].`;
    }
    const facts = zoneSourceFacts(substrateRegistry.get(substrate));
    if (!facts.offers || !facts.recovers) return `apworld: ${facts.why}.`;
    const rec = installedZoneConfigFrom(doc, player, substrate, { fetched });
    // ⛓ R5c — an op carrying the channel's answer INLINED applies pure (a refold,
    //   an undo, a replay without the network): a config that must be FETCHED to
    //   be read back was read, range-checked and held-checked where the answer
    //   was computed (the worker), so its absence here is not a refusal.
    if (!rec.ok && rec.needs && answerInlined) return Number.isInteger(zoneIdx) && zoneIdx >= 0 ? null
        : `apworld: zone ${JSON.stringify(zoneIdx)} ${ZONE_OUT_OF_RANGE}.`;
    if (!rec.ok) return rec.why;
    if (!Number.isInteger(zoneIdx) || zoneIdx < 0 || zoneIdx >= rec.zoneCount) {
        return `apworld: zone ${JSON.stringify(zoneIdx)} ${ZONE_OUT_OF_RANGE} — ${tick(substrate)} offers zones `
            + `0..${rec.zoneCount - 1} here.`;
    }
    const heldBy = zoneHeldBy(doc, player, substrate, zoneIdx, { except: region, cfg: { ...rec.cfg, ...rec.assumed } });
    if (heldBy) {
        return `apworld: zone ${zoneIdx} of ${tick(substrate)} ${ZONE_HELD} region "${heldBy}" in slot ${player} — `
            + 'two regions playing one zone would share its task locations. Free it first (give that region '
            + 'another zone or substrate).';
    }
    return null;
}

/** ⛓ The shape `source.zone` must have — the channel's own answer. */
export function zoneAnswerRefusal(zone) {
    if (!isObj(zone) || !Array.isArray(zone.locations) || !isObj(zone.payload)
        || (zone.itemClasses !== undefined && !isObj(zone.itemClasses))
        || (zone.fillerItems !== undefined && !(Array.isArray(zone.fillerItems)
            && zone.fillerItems.every((n) => typeof n === 'string')))) {
        return 'apworld: `source.zone` is the zone channel\'s answer `{locations: [...], payload: {...}, '
            + `itemClasses?, fillerItems?}\` — got ${zone === undefined ? 'none' : JSON.stringify(zone).slice(0, 80)}.`;
    }
    if (zone.locations.some((l) => !isObj(l) || (typeof l.id !== 'string' && typeof l.id !== 'number'))) {
        return 'apworld: every location of `source.zone` carries an `id` (a task id).';
    }
    return null;
}

/* ── the channel, run under the recorded config (WORKER / NODE ONLY) ───── */

/** ⛓ Compile one zone answer into the document's location shape (names, rules, items). */
function compiledZoneLocations(region, substrate, zone) {
    const descriptor = assembleZoneRegion({
        substrate, region_id: region, regionSize: { ...DEFAULT_REGION_SIZE }, exitSides: [],
        zoneRules: { locations: zone.locations, payload: zone.payload }, zonePayload: {},
    });
    const compiled = compileRegion(descriptor.extracted_rules, { obstacleLib: DEFAULT_OBSTACLES });
    return compiled.locations.map((l) => ({
        name: l.global_name ?? makeLocationName(region, l.id, l.position),
        item: l.item ?? null,
        rule: l.rule,
    }));
}

/**
 * ⛓⛓ R5c — **THE SIDECAR ENTRY A ZONE ANSWER SERIALISES TO** for `region` (the
 * apply's, and the verification's — one builder, so the check compares what the
 * op would write): the zone's payload with the fields the OLD payload hosted for
 * its siblings carried, the OLD exits (`regions[p][R].exits` untouched; a
 * side-bound channel joins its bound doors onto them in `serializeWorld`), the
 * old `grid_cell`, and the 5th `serializeWorld` argument naming each exit's
 * target substrate.
 */
function zoneEntryFor(doc, player, region, substrate, zone) {
    const old = doc.preset_sidecars[player][region];
    const hosted = hostedFields(doc, player, old);
    const payload = { ...zone.payload };
    const hostCarried = [];
    for (const f of hosted) {
        if (!(f in payload)) {
            payload[f] = old.playable_payload[f];
            hostCarried.push(f);
        }
    }
    const descriptor = assembleZoneRegion({
        substrate, region_id: region, regionSize: { ...DEFAULT_REGION_SIZE }, exitSides: [],
        zoneRules: { locations: zone.locations, payload }, zonePayload: {},
    });
    const oldExits = Array.isArray(old.playable_payload?.exits) ? JSON.parse(JSON.stringify(old.playable_payload.exits)) : [];
    descriptor.exits = new Map(oldExits.map((x, i) => [x?.exit_id ?? x?.exitName ?? `#${i}`, x]));
    const cell = old.grid_cell;
    const slot = doc.preset_sidecars[player];
    const entry = serializeRegionEntry({ ...descriptor, cell: cell ?? { gx: 0, gy: 0 } }, {
        manaEnabled: old.playable_payload?.manaEnabled === true,
        fogEnabled: old.playable_payload?.fogEnabled !== false,
        baseObstacleLib: DEFAULT_OBSTACLES,
        baseItemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, [substrate]),
        serializeContext: { substrateOfRegion: (target) => slot?.[target]?.substrate ?? null },
    });
    if (cell === undefined) delete entry.grid_cell;
    else entry.grid_cell = cell;
    return { built: JSON.parse(JSON.stringify(entry)), hostCarried };
}

/** ⛓ The first difference between a region's committed content and its zone's. */
function reproductionDifference(doc, player, region, entry, zone, substrate) {
    const mine = compiledZoneLocations(region, substrate, zone);
    const placements = doc?.canonical_placements?.[player] ?? {};
    const theirs = (doc?.regions?.[player]?.[region]?.locations ?? []).map((l) => ({
        name: l?.name, item: placements[l?.name] ?? null, rule: l?.access_rule,
    }));
    if (mine.length !== theirs.length) {
        return `it holds ${theirs.length} location${theirs.length === 1 ? '' : 's'}, the zone makes ${mine.length}`;
    }
    for (let i = 0; i < mine.length; i += 1) {
        for (const k of ['name', 'item', 'rule']) {
            if (JSON.stringify(mine[i][k]) !== JSON.stringify(theirs[i][k])) {
                return `location ${i} (${JSON.stringify(theirs[i].name)}): ${k} ${JSON.stringify(theirs[i][k])} in the `
                    + `document, ${JSON.stringify(mine[i][k])} from the zone`;
            }
        }
    }
    // ⛓ R5c — the payload is compared AS THE OP WOULD WRITE IT (`zoneEntryFor`):
    //   a side-bound channel's `bound_doors` exist only until `serializeWorld`
    //   joins them onto the exits. Every key the committed payload holds or the
    //   zone names is compared; a key only the serialiser's envelope adds, which
    //   the committed payload lacks, is not a difference (R5b's envelope rule).
    const pay = entry.playable_payload ?? {};
    let built;
    try {
        built = zoneEntryFor(doc, player, region, substrate, zone).built.playable_payload ?? {};
    } catch (e) {
        return `its entry cannot be rebuilt from the zone — ${String(e?.message ?? e)}`;
    }
    const keys = new Set([...Object.keys(pay), ...Object.keys(zone.payload).filter((k) => k in built)]);
    for (const k of keys) {
        if (JSON.stringify(built[k]) !== JSON.stringify(pay[k])) return `its payload's \`${k}\` differs from the zone's`;
    }
    return null;
}

/** ⛓ R5c — the zone channel's answer, or its throw as a sentence (a real room refuses sides it lacks). */
function extractOrWhy(entry, zoneIdx, regionId, exitSides) {
    try {
        return { answer: entry.extractZoneRules(zoneIdx, { region_id: regionId, exitSides }) };
    } catch (e) {
        return { why: String(e?.message ?? e) };
    }
}

/**
 * ⛓⛓⛓ **THE ZONE'S ANSWER, UNDER THE CONFIG THE DOCUMENT RECORDS** — installs
 * (the module-global the page must never touch: run in the worker or in Node),
 * VERIFIES that every region of the slot the target already plays reproduces its
 * committed locations and payload under that config (else: refused, naming what
 * the document does not record and the first difference), then extracts
 * `zoneIdx` for `region`.
 *
 * @returns {{ok: true, zone: {locations, payload, itemClasses}, verified: string[]}
 *          | {ok: false, why: string}}
 */
export function zoneContentFor(doc, player, region, substrate, zoneIdx, { fetched = {} } = {}) {
    const refusal = zoneSourceRefusal(doc, { player, region, substrate, zoneIdx }, { fetched });
    if (refusal) return { ok: false, why: refusal };
    const entry = substrateRegistry.get(substrate);
    const rec = installedZoneConfigFrom(doc, player, substrate, { fetched });
    const cfg = { ...rec.cfg, ...rec.assumed };
    entry.applyPipelineConfig(cfg);
    const reader = entry[ZONE_OF_PAYLOAD_HOOK];
    const verified = [];
    for (const [r, e] of Object.entries(entriesOf(doc, player, substrate))) {
        const z = typeof reader === 'function' ? reader(e.playable_payload, cfg) : null;
        if (!Number.isInteger(z)) continue;
        // ⛓ R5c — the region's own exit SIDES, in document order: a side-bound
        //   channel binds the k-th door to the k-th side (jta ignores them).
        const got = extractOrWhy(entry, z, r, exitSidesOfEntry(e));
        const answer = got.answer;
        const diff = got.why ? `the channel refuses it: ${got.why}`
            : reproductionDifference(doc, player, r, e, answer, substrate);
        if (diff) {
            const assumed = Object.entries(rec.assumed)
                .map(([k, v]) => `${tick(k)} (assumed ${JSON.stringify(v)})`).join(', ');
            const recorded = rec.recorded.map((k) => `${tick(k)} (${JSON.stringify(rec.cfg[k])})`).join(', ');
            return {
                ok: false,
                why: `apworld: ${ZONE_NOT_RECORDED} (slot ${player}, ${tick(substrate)}): region "${r}" does not `
                    + `reproduce as its own zone ${z} — ${diff}. `
                    + (recorded ? `The document records ${recorded}. ` : '')
                    + (assumed ? `The document does not record ${assumed}, and the region's content was not built `
                        + 'under those defaults (or not by the zone channel at all), '
                        : (recorded ? 'The region\'s content was not built under that record (or it was edited '
                            + 'since), ' : ''))
                    + 'so a zone of this slot cannot be rebuilt without guessing.',
            };
        }
        verified.push(r);
    }
    const got = extractOrWhy(entry, zoneIdx, region, exitSidesOfEntry(doc.preset_sidecars[player][region]));
    if (got.why) return { ok: false, why: `apworld: ${got.why}` };
    const { answer } = got;
    const lib = mergeSubstrateItemLib(DEFAULT_ITEMS, [substrate]);
    const itemClasses = {};
    for (const l of answer.locations ?? []) {
        if (typeof l.item === 'string' && !(l.item in itemClasses)) {
            itemClasses[l.item] = lib[l.item]?.classification ?? ZONE_ITEM_DEFAULT_CLASSIFICATION;
        }
    }
    return {
        ok: true,
        zone: JSON.parse(JSON.stringify({
            locations: answer.locations ?? [], payload: answer.payload ?? {}, itemClasses,
            fillerItems: zoneFillerItemsOf(entry),
        })),
        verified,
        config: { recorded: [...rec.recorded], assumed: Object.keys(rec.assumed) },
    };
}

/**
 * ⛓ R6 — **THE TARGET'S DECLARED FILLER**: the items its registry entry's
 * `libraryItems` classifies `filler` (the declaration the pipeline's item
 * library already merges — no new slot; jta: `JtA Filler`, the item its zone
 * channel places on every task that carries no perk). Read in the worker and
 * INLINED in the answer, so the apply stays pure.
 *
 * @returns {string[]}
 */
export function zoneFillerItemsOf(entry) {
    return Object.entries(entry?.libraryItems ?? {})
        .filter(([, d]) => d?.classification === ZONE_FILLER_CLASSIFICATION).map(([name]) => name);
}

/* ── the apply, pure ───────────────────────────────────────────────────── */

/** ⛓ The fields the OLD payload HOSTS for its siblings (declared `references` targets it carries). */
function hostedFields(doc, player, entry) {
    const fields = new Set();
    for (const e of Object.values(doc?.preset_sidecars?.[player] ?? {})) {
        let decl = null;
        try { decl = sidecarFieldsOf(substrateRegistry.get(e?.substrate)); } catch { decl = null; }
        for (const d of Object.values(decl ?? {})) {
            if (isObj(d?.references)) fields.add(d.references.field);
        }
    }
    const pay = entry?.playable_payload ?? {};
    return [...fields].filter((f) => isObj(pay[f]));
}

/** ⛓ Every `CanReachLocation` outside `region` that names one of `names`. */
function referencesTo(doc, player, region, names) {
    const out = [];
    walkRuleTrees(doc, player, (node, ctx) => {
        if (node?.rule === 'CanReachLocation' && names.has(node.args?.location_name)
            && ctx.regionName !== region) {
            out.push({ region: ctx.regionName, at: ctx.exitName ?? ctx.locationName, location: node.args.location_name });
        }
    });
    return out;
}

/**
 * ⛓⛓⛓ **APPLY A ZONE ANSWER TO THE DOCUMENT** — pure, copy-on-write over the five
 * touched keys only. The caller has refused what `zoneSourceRefusal` names; this
 * checks the answer's shape and writes the cascade.
 *
 * @returns {{ok: true, doc: object, entry: object, locations: {before: number, after: number},
 *            itemsRegistered: string[], placementsDisplaced: Array<{location, item}>,
 *            placementsAdded: Array<{location, item}>, hostCarried: string[],
 *            danglingReferences: object[], stranded: object[]} | {ok: false, why: string}}
 */
export function applyZoneContent({ doc, player, region, substrate, zoneIdx, zone, fetched = {} }) {
    const refusal = zoneSourceRefusal(doc, { player, region, substrate, zoneIdx }, { fetched, answerInlined: true })
        ?? zoneAnswerRefusal(zone);
    if (refusal) return { ok: false, why: refusal };
    const p = String(player);
    const oldRegion = doc.regions[p][region];
    const oldLocations = Array.isArray(oldRegion.locations) ? oldRegion.locations : [];
    const placements = doc.canonical_placements?.[p] ?? {};
    const items = doc.items?.[p] ?? {};
    const pool = doc.itempool_counts?.[p] ?? {};
    const classes = zone.itemClasses ?? {};

    // 1. the zone's locations, in the document's shape
    const fresh = compiledZoneLocations(region, substrate, zone);
    // ⛓ A location that keeps its NAME keeps its numeric `id` — a new one gets
    //   `null`, as the hub's `add-location` mints it.
    const oldIds = new Map(oldLocations.filter((l) => typeof l?.name === 'string').map((l) => [l.name, l.id]));
    const newLocations = fresh.map((l) => {
        const cls = l.item ? (classes[l.item] ?? items[l.item]?.classification ?? ZONE_ITEM_DEFAULT_CLASSIFICATION) : null;
        return {
            name: l.name,
            id: oldIds.has(l.name) ? oldIds.get(l.name) : null,
            access_rule: l.rule,
            ...(l.item ? {
                item: { name: l.item, player: Number(p), advancement: cls === 'progression', type: cls },
            } : {}),
        };
    });
    const freshBy = new Map(fresh.map((l) => [l.name, l.item]));

    // 3. the old placements: kept (same name, same item) or DISPLACED
    const nextPlacements = { ...placements };
    const placementsDisplaced = [];
    for (const l of oldLocations) {
        const name = l?.name;
        if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(placements, name)) continue;
        if (freshBy.get(name) === placements[name]) continue;
        placementsDisplaced.push({ location: name, item: placements[name] });
        delete nextPlacements[name];
    }
    // 2. the new placements: registered, pooled, placed
    const nextItems = { ...items };
    const nextPool = { ...pool };
    const itemsRegistered = [];
    const placementsAdded = [];
    for (const l of fresh) {
        if (!l.item) continue;
        if (oldIds.has(l.name) && placements[l.name] === l.item) continue;
        if (!Object.prototype.hasOwnProperty.call(nextItems, l.item)) {
            nextItems[l.item] = {
                name: l.item, id: null,
                classification: classes[l.item] ?? ZONE_ITEM_DEFAULT_CLASSIFICATION,
                groups: [...ZONE_ITEM_GROUPS],
            };
            itemsRegistered.push(l.item);
        }
        nextPool[l.item] = (Number.isFinite(nextPool[l.item]) ? nextPool[l.item] : 0) + 1;
        nextPlacements[l.name] = l.item;
        placementsAdded.push({ location: l.name, item: l.item });
    }
    // 3b. ⛓ R6 — a displaced FILLER placement leaves the pool (−1 each; a count
    //   that reaches 0 leaves the pool block); every other displaced item stays,
    //   unplaced, as ruled. An answer recorded before R6 carries no
    //   `fillerItems` and replays exactly as it did.
    const fillers = new Set(Array.isArray(zone.fillerItems) ? zone.fillerItems : []);
    const fillerDropped = [];
    for (const d of placementsDisplaced) {
        if (!fillers.has(d.item) || !(Number.isFinite(nextPool[d.item]) && nextPool[d.item] > 0)) continue;
        nextPool[d.item] -= 1;
        if (nextPool[d.item] === 0) delete nextPool[d.item];
        fillerDropped.push(d);
    }

    // 4. the entry: the zone's payload + the hosted field carried, the OLD exits
    let built;
    let hostCarried;
    try {
        ({ built, hostCarried } = zoneEntryFor(doc, p, region, substrate, zone));
    } catch (e) {
        // ⛓ R5c — a side-bound serialiser refuses an exit no door was bound to.
        return { ok: false, why: `apworld: ${String(e?.message ?? e)}` };
    }

    const removed = new Set(oldLocations.map((l) => l?.name).filter((n) => typeof n === 'string' && !freshBy.has(n)));
    const next = {
        ...doc,
        regions: { ...doc.regions, [p]: { ...doc.regions[p], [region]: { ...oldRegion, locations: newLocations } } },
        items: { ...(doc.items ?? {}), [p]: nextItems },
        itempool_counts: { ...(doc.itempool_counts ?? {}), [p]: nextPool },
        canonical_placements: { ...(doc.canonical_placements ?? {}), [p]: nextPlacements },
        preset_sidecars: { ...doc.preset_sidecars, [p]: { ...doc.preset_sidecars[p], [region]: built } },
    };
    return {
        ok: true,
        doc: next,
        entry: built,
        locations: { before: oldLocations.length, after: newLocations.length },
        itemsRegistered,
        placementsDisplaced,
        placementsAdded,
        fillerDropped,
        hostCarried,
        danglingReferences: referencesTo(next, p, region, removed),
        stranded: strandedReferences(doc, p, region, built),
    };
}

/**
 * ⛓⛓ **THE WHOLE OPERATION, FROM THE DOCUMENT ALONE** (worker / Node): extract
 * under the recorded config, then apply. The brief's API; the op calls it when
 * `source.zone` is absent.
 */
export function replaceRegionContentFromZone({ doc, player, region, substrate, zoneIdx, fetched = {} }) {
    const got = zoneContentFor(doc, String(player), region, substrate, zoneIdx, { fetched });
    if (!got.ok) return got;
    const res = applyZoneContent({ doc, player: String(player), region, substrate, zoneIdx, zone: got.zone });
    return res.ok ? { ...res, zone: got.zone, verified: got.verified, config: got.config } : res;
}

/* ── the description (the op's, and the form's answer) ─────────────────── */

const listed = (xs, fmt, limit = 12) => {
    const shown = xs.slice(0, limit).map(fmt).join(', ');
    return xs.length > limit ? `${shown}, … (+${xs.length - limit})` : shown;
};

/**
 * ⛓ The op's description: the zone, locations before → after, items registered,
 * placements displaced BY NAME, the host field carried, and the references the
 * removed locations leave dangling.
 */
export function describeZoneReplacement({ region, substrate, zoneIdx, res }) {
    const n = res.placementsDisplaced.length;
    const f = res.fillerDropped?.length ?? 0;
    const parts = [
        `region ${region}: content replaced by zone ${zoneIdx} of ${tick(substrate)} — locations `
            + `${res.locations.before} → ${res.locations.after}`,
        res.itemsRegistered.length
            ? `${res.itemsRegistered.length} item${res.itemsRegistered.length === 1 ? '' : 's'} registered `
                + `[${listed(res.itemsRegistered, (s) => s)}]`
            : 'no item registered',
        n ? `${n} placement${n === 1 ? '' : 's'} ${ZONE_DISPLACED}: ${listed(res.placementsDisplaced,
            (d) => `${tick(d.item)} at ${tick(d.location)}`)} — ${f ? 'the filler excepted (below), ' : ''}`
            + ZONE_UNPLACED_CLAUSE
            : `0 placements ${ZONE_DISPLACED}`,
    ];
    if (f) {
        const names = [...new Set(res.fillerDropped.map((d) => d.item))].map(tick).join(', ');
        parts.push(`${f} filler placement${f === 1 ? '' : 's'} ${ZONE_FILLER_DROPPED} (${names} — the target's `
            + 'declared filler; the zone\'s own filler placements are counted in)');
    }
    if (res.hostCarried.length) {
        parts.push(`${res.hostCarried.map(tick).join(', ')} ${ZONE_HOST_CARRIED} (the siblings' references still resolve)`);
    }
    if (res.danglingReferences.length) {
        const k = res.danglingReferences.length;
        parts.push(`${k} \`CanReachLocation\` reference${k === 1 ? '' : 's'} ${ZONE_DANGLING_REFS}: `
            + listed(res.danglingReferences, (d) => `${d.location} (from ${d.region} › ${d.at})`));
    }
    if (res.stranded?.length) {
        parts.push(`${res.stranded.length} sibling reference(s) now point at a value no entry carries: `
            + listed(res.stranded, (s) => `${s.region}.${s.field}`));
    }
    return `${parts.join('; ')}.`;
}

/**
 * ⛓ R6b — **WHICH CONFIG FIELDS THE EXTRACTION TOOK FROM THE DOCUMENT'S RECORD
 * AND WHICH IT ASSUMED** — the clause the hub appends to a zone op's answer.
 * `config` is `zoneContentFor`'s `{recorded, assumed}` (field names).
 */
export function zoneConfigSplitSentence(config, verifiedCount) {
    const rec = config?.recorded ?? [];
    const ass = config?.assumed ?? [];
    const names = (xs) => (xs.length ? xs.map(tick).join(', ') : 'none');
    return `config: recorded ${names(rec)}; assumed ${names(ass)} — verified on ${verifiedCount} `
        + `region${verifiedCount === 1 ? '' : 's'} of the slot`;
}

/* ── the Placements tab's readout ───────────────────────────────────────── */

/**
 * ⛓⛓ **POOL ITEMS PLACED NOWHERE** — `itempool_counts[p][item]` minus the
 * canonical placements holding it, where positive. What the cascade leaves
 * behind (the displaced items) is exactly this; the Placements tab draws it.
 *
 * @returns {Array<{item: string, pool: number, placed: number, unplaced: number}>}
 */
export function unplacedPoolItems(doc, player) {
    const pool = doc?.itempool_counts?.[player] ?? {};
    const placed = {};
    for (const item of Object.values(doc?.canonical_placements?.[player] ?? {})) {
        if (typeof item === 'string') placed[item] = (placed[item] ?? 0) + 1;
    }
    const out = [];
    for (const [item, count] of Object.entries(pool)) {
        const n = Number.isFinite(count) ? count : 0;
        const k = placed[item] ?? 0;
        if (n > k) out.push({ item, pool: n, placed: k, unplaced: n - k });
    }
    return out;
}

/* ── the generation worker's answer ─────────────────────────────────────── */

/**
 * ⛓⛓ **ONE ZONE JOB, AS THE WORKER ANSWERS IT** (`regionRegenerateWorker.js`):
 * the whole operation on the document the worker was HANDED, answered as the
 * zone (which the page inlines in the op it lands) plus the next document's
 * touched slices and the entry — never the whole document back across the
 * boundary. A refusal is the op's own sentence, `refused: true`.
 */
export async function zoneJobAnswer({ doc, player, region, substrate, source }, { fetchJson = null } = {}) {
    // ⛓ R5c — the served documents the read-back names are fetched HERE, in the
    //   worker, with the rest of the job (the page's timer bounds it).
    let fetched = {};
    if (typeof fetchJson === 'function' && substrateRegistry.has(substrate)) {
        const got = await resolveZoneFetches(doc, player, substrate, fetchJson);
        if (!got.ok) return { ok: false, refused: true, threw: got.why, freeItems: [], hostsSurplus: false };
        fetched = got.fetched;
    }
    const res = replaceRegionContentFromZone({ doc, player, region, substrate, zoneIdx: source?.zoneIdx, fetched });
    if (!res.ok) return { ok: false, refused: true, threw: res.why, freeItems: [], hostsSurplus: false };
    const p = String(player);
    return {
        ok: true,
        zone: res.zone,
        verified: res.verified,
        config: res.config,
        entry: res.entry,
        next: {
            locations: res.doc.regions[p][region].locations,
            items: res.doc.items[p],
            itempool_counts: res.doc.itempool_counts[p],
            canonical_placements: res.doc.canonical_placements[p],
        },
        locations: res.locations,
        itemsRegistered: res.itemsRegistered,
        placementsDisplaced: res.placementsDisplaced,
        placementsAdded: res.placementsAdded,
        fillerDropped: res.fillerDropped,
        hostCarried: res.hostCarried,
        danglingReferences: res.danglingReferences,
        stranded: res.stranded,
    };
}
