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
import { strandedReferences } from './regionRegenerate.js';

/** ⛓ The op this module is the mechanics of. */
export const REPLACE_REGION_CONTENT_OP = 'replace-region-content';

/** ⛓ The two registry hooks the zone source READS BACK a document through. */
export const ZONE_CONFIG_HOOK = 'zoneConfigFromSlot';
export const ZONE_OF_PAYLOAD_HOOK = 'zoneOfPayload';

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
export const ZONE_HOST_CARRIED = 'carried';
export const ZONE_DANGLING_REFS = 'now name a location the document no longer holds';
export const ZONE_PAGE_NEVER_EXTRACTS = 'the zone channel\'s answer is computed where the config may be '
    + 'installed (the generation worker, or Node) and INLINED in the op as `source.zone`';

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
 * @returns {{ok: true, cfg: object, assumed: object, zoneCount: number, host: string|null}
 *          | {ok: false, why: string}}
 */
export function installedZoneConfigFrom(doc, player, substrate) {
    const entry = substrateRegistry.get(substrate);
    const facts = zoneSourceFacts(entry);
    if (!facts.recovers) return { ok: false, why: `apworld: ${facts.why}.` };
    const res = entry[ZONE_CONFIG_HOOK]({
        entries: entriesOf(doc, player, substrate), locations: locationsByRegion(doc, player),
    });
    if (!res?.ok) {
        return { ok: false, why: `apworld: ${ZONE_NOT_RECORDED} (slot ${player}, ${tick(substrate)}): ${res?.why}.` };
    }
    return { ok: true, cfg: res.cfg, assumed: res.assumed ?? {}, zoneCount: res.zoneCount, host: res.host ?? null };
}

/**
 * ⛓ **WHICH REGION OF THE SLOT HOLDS `substrate`'s zone `zoneIdx`** (read through
 * the entry's `zoneOfPayload`), other than `except` — or null.
 */
export function zoneHeldBy(doc, player, substrate, zoneIdx, { except = null } = {}) {
    const reader = substrateRegistry.get(substrate)?.[ZONE_OF_PAYLOAD_HOOK];
    if (typeof reader !== 'function') return null;
    for (const [region, e] of Object.entries(entriesOf(doc, player, substrate))) {
        if (region !== except && reader(e.playable_payload) === zoneIdx) return region;
    }
    return null;
}

/** ⛓ The zone a region's entry plays, or null (the entry's own reader). */
export function zoneOfRegion(doc, player, region) {
    const e = doc?.preset_sidecars?.[player]?.[region];
    const reader = substrateRegistry.get(e?.substrate)?.[ZONE_OF_PAYLOAD_HOOK];
    return typeof reader === 'function' ? reader(e?.playable_payload) : null;
}

/**
 * ⛓⛓ **THE PICKER'S OPTIONS** — `0..zoneCount-1` from the RECORDED config (no
 * install), each held zone disabled and labelled with the region holding it.
 *
 * @returns {{ok: true, zoneCount: number, options: Array<{zoneIdx, label, heldBy, own, disabled}>}
 *          | {ok: false, why: string}}
 */
export function zoneOptions(doc, player, region, substrate) {
    const cfg = installedZoneConfigFrom(doc, player, substrate);
    if (!cfg.ok) return cfg;
    const own = doc?.preset_sidecars?.[player]?.[region]?.substrate === substrate
        ? zoneOfRegion(doc, player, region) : null;
    const options = [];
    for (let z = 0; z < cfg.zoneCount; z += 1) {
        const heldBy = zoneHeldBy(doc, player, substrate, z, { except: region });
        options.push({
            zoneIdx: z,
            label: `Zone ${z}${z === own ? ' (this region\'s own)' : ''}${heldBy ? ` — held by ${heldBy}` : ''}`,
            heldBy, own: z === own, disabled: !!heldBy,
        });
    }
    return { ok: true, zoneCount: cfg.zoneCount, options };
}

/**
 * ⛓⛓⛓ **EVERY REFUSAL THE OP CAN NAME BEFORE ANYTHING IS WRITTEN** — pure (no
 * install): the entry, the region, the channel, the recovery, the range, the
 * held zone. `null` when the op may proceed.
 */
export function zoneSourceRefusal(doc, { player, region, substrate, zoneIdx }) {
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
    const cfg = installedZoneConfigFrom(doc, player, substrate);
    if (!cfg.ok) return cfg.why;
    if (!Number.isInteger(zoneIdx) || zoneIdx < 0 || zoneIdx >= cfg.zoneCount) {
        return `apworld: zone ${JSON.stringify(zoneIdx)} ${ZONE_OUT_OF_RANGE} — ${tick(substrate)} offers zones `
            + `0..${cfg.zoneCount - 1} here.`;
    }
    const heldBy = zoneHeldBy(doc, player, substrate, zoneIdx, { except: region });
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
        || (zone.itemClasses !== undefined && !isObj(zone.itemClasses))) {
        return 'apworld: `source.zone` is the zone channel\'s answer `{locations: [...], payload: {...}, '
            + `itemClasses?}\` — got ${zone === undefined ? 'none' : JSON.stringify(zone).slice(0, 80)}.`;
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
    const pay = entry.playable_payload ?? {};
    for (const [k, v] of Object.entries(zone.payload)) {
        if (JSON.stringify(v) !== JSON.stringify(pay[k])) return `its payload's \`${k}\` differs from the zone's`;
    }
    return null;
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
export function zoneContentFor(doc, player, region, substrate, zoneIdx) {
    const refusal = zoneSourceRefusal(doc, { player, region, substrate, zoneIdx });
    if (refusal) return { ok: false, why: refusal };
    const entry = substrateRegistry.get(substrate);
    const rec = installedZoneConfigFrom(doc, player, substrate);
    entry.applyPipelineConfig({ ...rec.cfg, ...rec.assumed });
    const reader = entry[ZONE_OF_PAYLOAD_HOOK];
    const verified = [];
    for (const [r, e] of Object.entries(entriesOf(doc, player, substrate))) {
        const z = typeof reader === 'function' ? reader(e.playable_payload) : null;
        if (!Number.isInteger(z)) continue;
        const answer = entry.extractZoneRules(z, { region_id: r });
        const diff = reproductionDifference(doc, player, r, e, answer, substrate);
        if (diff) {
            const assumed = Object.entries(rec.assumed)
                .map(([k, v]) => `${tick(k)} (assumed ${JSON.stringify(v)})`).join(', ');
            return {
                ok: false,
                why: `apworld: ${ZONE_NOT_RECORDED} (slot ${player}, ${tick(substrate)}): region "${r}" does not `
                    + `reproduce as its own zone ${z} — ${diff}. `
                    + (assumed ? `The document does not record ${assumed}, and the region's content was not built `
                        + 'under those defaults (or not by the zone channel at all), ' : '')
                    + 'so a zone of this slot cannot be rebuilt without guessing.',
            };
        }
        verified.push(r);
    }
    const answer = entry.extractZoneRules(zoneIdx, { region_id: region });
    const lib = mergeSubstrateItemLib(DEFAULT_ITEMS, [substrate]);
    const itemClasses = {};
    for (const l of answer.locations ?? []) {
        if (typeof l.item === 'string' && !(l.item in itemClasses)) {
            itemClasses[l.item] = lib[l.item]?.classification ?? ZONE_ITEM_DEFAULT_CLASSIFICATION;
        }
    }
    return {
        ok: true,
        zone: JSON.parse(JSON.stringify({ locations: answer.locations ?? [], payload: answer.payload ?? {}, itemClasses })),
        verified,
    };
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
export function applyZoneContent({ doc, player, region, substrate, zoneIdx, zone }) {
    const refusal = zoneSourceRefusal(doc, { player, region, substrate, zoneIdx }) ?? zoneAnswerRefusal(zone);
    if (refusal) return { ok: false, why: refusal };
    const p = String(player);
    const old = doc.preset_sidecars[p][region];
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

    // 4. the entry: the zone's payload + the hosted field carried, the OLD exits
    const hosted = hostedFields(doc, p, old);
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
    const entry = serializeRegionEntry({ ...descriptor, cell: cell ?? { gx: 0, gy: 0 } }, {
        manaEnabled: old.playable_payload?.manaEnabled === true,
        fogEnabled: old.playable_payload?.fogEnabled !== false,
        baseObstacleLib: DEFAULT_OBSTACLES,
        baseItemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, [substrate]),
    });
    if (cell === undefined) delete entry.grid_cell;
    else entry.grid_cell = cell;
    const built = JSON.parse(JSON.stringify(entry));

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
export function replaceRegionContentFromZone({ doc, player, region, substrate, zoneIdx }) {
    const got = zoneContentFor(doc, String(player), region, substrate, zoneIdx);
    if (!got.ok) return got;
    const res = applyZoneContent({ doc, player: String(player), region, substrate, zoneIdx, zone: got.zone });
    return res.ok ? { ...res, zone: got.zone, verified: got.verified } : res;
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
    const parts = [
        `region ${region}: content replaced by zone ${zoneIdx} of ${tick(substrate)} — locations `
            + `${res.locations.before} → ${res.locations.after}`,
        res.itemsRegistered.length
            ? `${res.itemsRegistered.length} item${res.itemsRegistered.length === 1 ? '' : 's'} registered `
                + `[${listed(res.itemsRegistered, (s) => s)}]`
            : 'no item registered',
        n ? `${n} placement${n === 1 ? '' : 's'} ${ZONE_DISPLACED}: ${listed(res.placementsDisplaced,
            (d) => `${tick(d.item)} at ${tick(d.location)}`)} — ${ZONE_UNPLACED_CLAUSE}`
            : `0 placements ${ZONE_DISPLACED}`,
    ];
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
