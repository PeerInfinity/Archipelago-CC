/**
 * bounceRegionEditor/bounceLevelOps — **THE BOUNCE LEVEL'S ATOMIC OPS**
 * (EDITOR INTEGRATION slice B-b; plan §3.1's bounce row).
 *
 * ⛔ PURE, COPY-ON-WRITE, AND IT KNOWS NOTHING ABOUT A PANEL. Every op in
 * `BOUNCE_OP_KINDS` takes a level and returns a NEW one sharing every untouched
 * array, so `editCore.foldEdits` can walk a chain of them and `undo` can
 * re-fold a shorter list. Nothing here reads the DOM, the session or the
 * contract.
 *
 * ── ⛓ WHERE THE REFUSAL SENTENCES COME FROM ───────────────────────────
 *
 * `bounceDemo/level.js`'s `validateLevel` is the level model's own authority,
 * and its sentences are what a person already sees in the editor's status line
 * (`_analyze` prints them). ⛔ So an op that would produce a level the
 * validator refuses REFUSES WITH THE VALIDATOR'S OWN SENTENCE — *"platform
 * 'p3': unknown type 'pink'"*, *"portal 'exit_up': bad direction 'sideways'"*,
 * *"pickups 'loc_0': on='p3' references no platform"* — rather than inventing a
 * second vocabulary for the same fact. A reader who has seen the message once
 * has seen it everywhere.
 *
 * ⚠ AND AN OP THAT WOULD LEAVE THE LEVEL VALID-BUT-DIFFERENT IS NOT REFUSED.
 * `editCore`'s own law: nothing here adjudicates whether the level is any GOOD
 * (reachable, solvable, braid-legal) — that is the oracle's question and the
 * panel's `_analyze` readout. What is refused is a level the MODEL cannot hold.
 *
 * ── ⛓⛓ THE CASCADE IS A `group`, AND `delete-platform` REFUSES AN ORPHAN ──
 *
 * The panel's delete drops the platform AND every entity hosted on it
 * (`_deletePlatform`'s five-array sweep). §3.1 says that is a `group` of one
 * `remove-entity` per orphan followed by the delete, and this file makes the
 * split enforceable rather than conventional: **atomic `delete-platform`
 * REFUSES while any entity still names the platform as its host**, in
 * `checkEntities`' own sentence. So there is no way to record a delete that
 * leaves a level the validator rejects, and `undo` of the group restores the
 * entities because they are in the op list rather than implied by it.
 * `deletePlatformOps(level, id)` is the builder — it reads the level to
 * enumerate the orphans, which is exactly why the group is built by a caller
 * that HAS the level rather than resolved inside a single op.
 *
 * ── ⛓ `replace-level` CARRIES THE RESULT, NEVER THE RECIPE ─────────────
 *
 * Regenerate runs the generator ONCE, with a seed, and the op records the level
 * that came out. ⛔ An op that re-ran the generator on the fold would be a
 * recipe whose output moves the day any input to `generateZoneForSpecs` moves —
 * a recorded edit list that reconstructs a DIFFERENT level from the one the
 * person saw (trap 787's family: a recorded draw is an index into a stream, and
 * a replay that re-draws is not a replay). The level is bytes; the seed is a
 * fact about where they came from and rides in the description.
 */

import { validateLevel } from '../bounceDemo/level.js';

/** The five entity arrays, in the order the panel's toggles present them. */
export const ENTITY_KINDS = Object.freeze([
    'springs', 'jetpacks', 'pickups', 'portals', 'teleports',
]);

/** ⛓ The level model's own two closed sets — quoted, not re-spelled. */
export const PLATFORM_TYPES = Object.freeze(['green', 'blue', 'brown']);
export const PORTAL_DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);

/** The op names this module answers, as data — the panel's roster derives. */
export const BOUNCE_OP_KINDS = Object.freeze([
    'resize',
    'add-platform',
    'set-platform',
    'delete-platform',
    'add-entity',
    'remove-entity',
    'set-pickup-item',
    'set-portal-direction',
    'replace-level',
]);

const refuse = (error) => ({ ok: false, error });

const ok = (level, description, value) => (value === undefined
    ? { ok: true, level, description }
    : { ok: true, level, description, value });

/**
 * ⛓ FIRST FREE `${prefix}N` — the panel's `_nextId` rule, verbatim, including
 * its underscore variant for pickups (`loc_0`).
 *
 * ⛔ IT IS A FUNCTION OF THE RECORD, so an `add-…` op that omits its id gets
 * the same id on every fold of the same list from the same base. That is what
 * lets the panel record `{op:'add-platform'}` with no id and still have undo
 * reproduce the level byte for byte.
 */
export function nextId(prefix, list) {
    const used = new Set((list ?? []).map((e) => e.id));
    let n = 0;
    while (used.has(`${prefix}${n}`) || used.has(`${prefix}_${n}`)) n += 1;
    return prefix === 'loc' ? `loc_${n}` : `${prefix}${n}`;
}

/** The id prefix each entity array uses — the panel's `_toggleEntity` rule. */
const ENTITY_PREFIX = (kind) => (kind === 'pickups' ? 'loc' : kind.replace(/s$/, ''));

const listOf = (level, kind) => level[kind] ?? [];
const platformsOf = (level) => level.platforms ?? [];

/** ⛓ Replace ONE array, sharing everything else — the copy-on-write unit. */
const withList = (level, kind, list) => ({ ...level, [kind]: list });

/**
 * ⛓⛓ **ONE ATOMIC OP** → `{ok, level, description, value?}` or
 * `{ok:false, error}`.
 *
 * ⛔ The shape is `atlasOps.applyAtlasOp`'s, deliberately: B-a's adapter maps
 * `error` → `description` and `atlas` → `record` in three lines, and this one
 * maps `error` → `description` and `level` → `record` in the same three. Two
 * substrates, one adapter shape.
 */
export function applyBounceOp(level, op) {
    if (!level || typeof level !== 'object' || Array.isArray(level)) {
        return refuse(`bounce: a level is an object, got ${JSON.stringify(level)}.`);
    }
    switch (op?.op) {
        case 'resize': return opResize(level, op);
        case 'add-platform': return opAddPlatform(level, op);
        case 'set-platform': return opSetPlatform(level, op);
        case 'delete-platform': return opDeletePlatform(level, op);
        case 'add-entity': return opAddEntity(level, op);
        case 'remove-entity': return opRemoveEntity(level, op);
        case 'set-pickup-item': return opSetPickupItem(level, op);
        case 'set-portal-direction': return opSetPortalDirection(level, op);
        case 'replace-level': return opReplaceLevel(level, op);
        default:
            return refuse(`bounce: unknown op ${JSON.stringify(op?.op)} — the vocabulary is `
                + `[${BOUNCE_OP_KINDS.join(', ')}].`);
    }
}

/* ── resize ──────────────────────────────────────────────────────────── */

/**
 * ⛓ `{dim: 'width'|'height', value}`. The panel's `_resizeLevel` rounding and
 * its floor of 1 live HERE, so the op list records the number that was applied
 * rather than the number that was typed.
 */
function opResize(level, op) {
    if (op.dim !== 'width' && op.dim !== 'height') {
        return refuse(`bounce: resize dim must be 'width' or 'height', got `
            + `${JSON.stringify(op.dim)}.`);
    }
    if (!Number.isFinite(op.value)) {
        return refuse(`bounce: resize ${op.dim} must be a finite number, got `
            + `${JSON.stringify(op.value)}.`);
    }
    const v = Math.max(1, Math.round(op.value));
    return ok(
        { ...level, size: { ...level.size, [op.dim]: v } },
        `${op.dim} → ${v}`,
        v,
    );
}

/* ── platforms ───────────────────────────────────────────────────────── */

/**
 * ⛓ `{id?, x?, y?, type?}` — `value` is the platform that was added.
 *
 * ⚠ The defaults are the panel's: centre of the level, `green`, the first free
 * `pN`. They are computed from the LEVEL, so they replay identically.
 */
function opAddPlatform(level, op) {
    const platforms = platformsOf(level);
    const id = op.id ?? nextId('p', platforms);
    if (platforms.some((p) => p.id === id)) {
        return refuse(`platforms: duplicate id '${id}'`);
    }
    const type = op.type ?? 'green';
    if (!PLATFORM_TYPES.includes(type)) {
        return refuse(`platform '${id}': unknown type '${type}'`);
    }
    const x = op.x ?? Math.round((level.size?.width ?? 0) / 2);
    const y = op.y ?? Math.round((level.size?.height ?? 0) / 2);
    const bad = outsideBounds(level, x, y);
    if (bad) return refuse(`platform '${id}': ${bad}`);
    const platform = { id, type, x, y };
    return ok(
        withList(level, 'platforms', [...platforms, platform]),
        `+ platform ${id} (${type}) at (${x},${y})`,
        platform,
    );
}

/**
 * ⛓ `{id, patch}` — the sidebar's x / y / type fields.
 *
 * ⛔ A PATCH MAY NOT NAME `id`. Renaming a platform is a four-site cascade (its
 * springs, jetpacks, pickups, portals and teleports all carry `on`), so a patch
 * that quietly changed it would orphan every entity hosted on it and the level
 * would fail the validator one render later. Refused by name; the rename op
 * that would do it properly does not exist because the panel offers no rename.
 */
function opSetPlatform(level, op) {
    const platforms = platformsOf(level);
    const found = platforms.find((p) => p.id === op.id);
    if (!found) {
        return refuse(`bounce: no platform '${op.id}' to set — the level holds `
            + `[${platforms.map((p) => p.id).join(', ')}].`);
    }
    const patch = op.patch ?? {};
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return refuse(`bounce: set-platform '${op.id}' needs a patch object, got `
            + `${JSON.stringify(patch)}.`);
    }
    if ('id' in patch) {
        return refuse(`bounce: set-platform '${op.id}' may not patch \`id\` — every spring, `
            + 'jetpack, pickup, portal and teleport hosted on it carries the id in `on`, so a '
            + 'rename here would orphan them all. There is no rename op because the editor '
            + 'offers no rename.');
    }
    if ('type' in patch && !PLATFORM_TYPES.includes(patch.type)) {
        return refuse(`platform '${op.id}': unknown type '${patch.type}'`);
    }
    for (const k of ['x', 'y']) {
        if (k in patch && !Number.isFinite(patch[k])) {
            return refuse(`platform '${op.id}': x/y must be numbers`);
        }
    }
    const next = { ...found, ...patch };
    const bad = outsideBounds(level, next.x, next.y);
    if (bad) return refuse(`platform '${op.id}': ${bad}`);
    return ok(
        withList(level, 'platforms', platforms.map((p) => (p.id === op.id ? next : p))),
        `platform ${op.id} ← ${Object.keys(patch).map((k) => `${k}=${patch[k]}`).join(', ')}`,
        next,
    );
}

/**
 * ⛓⛓ `{id}` — the platform ALONE, and it REFUSES while anything is hosted on
 * it. See the file docblock: the cascade is a `group` built by
 * `deletePlatformOps`, so undo restores the entities from the op list.
 */
function opDeletePlatform(level, op) {
    const platforms = platformsOf(level);
    if (!platforms.some((p) => p.id === op.id)) {
        return refuse(`bounce: no platform '${op.id}' to delete — the level holds `
            + `[${platforms.map((p) => p.id).join(', ')}].`);
    }
    const orphans = hostedOn(level, op.id);
    if (orphans.length) {
        const [first] = orphans;
        return refuse(`${first.kind} '${first.id}': on='${op.id}' references no platform `
            + `— deleting '${op.id}' would orphan ${orphans.length} entit`
            + `${orphans.length === 1 ? 'y' : 'ies'}. ⛔ The cascade is a GROUP: one `
            + '`remove-entity` per orphan, THEN the delete, so one undo restores them all. '
            + 'Use `deletePlatformOps(level, id)` to build it.');
    }
    return ok(
        withList(level, 'platforms', platforms.filter((p) => p.id !== op.id)),
        `− platform ${op.id}`,
    );
}

/** Every entity hosted on `platformId`, as `{kind, id}`, in ENTITY_KINDS order. */
export function hostedOn(level, platformId) {
    const out = [];
    for (const kind of ENTITY_KINDS) {
        for (const e of listOf(level, kind)) {
            if (e.on === platformId) out.push({ kind, id: e.id });
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ **THE CASCADE, AS A FLAT OP LIST** — one `remove-entity` per orphan
 * followed by the `delete-platform`.
 *
 * ⛔ THE ORDER IS LOAD-BEARING and it is the only order that works: every
 * intermediate level inside the group is one the validator accepts, so a group
 * whose last member refuses leaves nothing half-applied. Reversed, the delete
 * would refuse on its own orphans.
 *
 * ⚠ It is a plain ARRAY, not a `group`: the caller wraps it, because
 * `editCore.group` is the core's and this module imports nothing from it.
 */
export function deletePlatformOps(level, platformId) {
    return [
        ...hostedOn(level, platformId).map(({ kind, id }) => ({
            op: 'remove-entity', kind, id,
        })),
        { op: 'delete-platform', id: platformId },
    ];
}

/* ── entities ────────────────────────────────────────────────────────── */

/**
 * ⛓ `{kind, on, id?, x?, y?, item?, direction?}` — `value` is the entity.
 *
 * ⚠ `item` (a pickup's) is the PANEL's choice and rides IN the op. The level
 * model does not store an item for a location by nature — it is backfilled from
 * the contract's `locationSpecs` when a session opens — so an op that defaulted
 * it here would be inventing a fact about a world it cannot see.
 */
function opAddEntity(level, op) {
    const kindError = badKind(op.kind);
    if (kindError) return refuse(kindError);
    const host = platformsOf(level).find((p) => p.id === op.on);
    if (!host) return refuse(`${op.kind} '${op.id ?? '(new)'}': on='${op.on}' references no platform`);
    const list = listOf(level, op.kind);
    if (list.some((e) => e.on === op.on)) {
        return refuse(`bounce: platform '${op.on}' already hosts a ${singular(op.kind)} — the `
            + "editor's toggle is keyed on the HOST, so a second one on the same platform "
            + 'would be unreachable from the panel and ambiguous to every reader of `on`.');
    }
    const id = op.id ?? nextId(ENTITY_PREFIX(op.kind), list);
    if (list.some((e) => e.id === id)) return refuse(`${op.kind}: duplicate id '${id}'`);
    const x = op.x ?? host.x;
    const y = op.y ?? host.y;
    const bad = outsideBounds(level, x, y);
    if (bad) return refuse(`${op.kind} '${id}': ${bad}`);
    const entity = { id, x, y, on: op.on };
    if (op.kind === 'portals') {
        const direction = op.direction ?? 'up';
        if (!PORTAL_DIRECTIONS.includes(direction)) {
            return refuse(`portal '${id}': bad direction '${direction}'`);
        }
        entity.direction = direction;
    }
    if (op.kind === 'pickups') entity.item = op.item ?? null;
    return ok(
        withList(level, op.kind, [...list, entity]),
        `+ ${singular(op.kind)} ${id} on ${op.on}`,
        entity,
    );
}

/** ⛓ `{kind, id}` — the other half of the panel's toggle. */
function opRemoveEntity(level, op) {
    const kindError = badKind(op.kind);
    if (kindError) return refuse(kindError);
    const list = listOf(level, op.kind);
    const found = list.find((e) => e.id === op.id);
    if (!found) {
        return refuse(`bounce: no ${singular(op.kind)} '${op.id}' to remove — the level holds `
            + `[${list.map((e) => e.id).join(', ')}].`);
    }
    return ok(
        withList(level, op.kind, list.filter((e) => e.id !== op.id)),
        `− ${singular(op.kind)} ${op.id}`,
        found,
    );
}

/** ⛓ `{id, item}` — the sidebar's item picker. `null` is "grants nothing". */
function opSetPickupItem(level, op) {
    const list = listOf(level, 'pickups');
    const found = list.find((e) => e.id === op.id);
    if (!found) {
        return refuse(`bounce: no pickup '${op.id}' to set an item on — the level holds `
            + `[${list.map((e) => e.id).join(', ')}].`);
    }
    if (op.item !== null && typeof op.item !== 'string') {
        return refuse(`bounce: a pickup's item is a string or null, got `
            + `${JSON.stringify(op.item)}.`);
    }
    const next = { ...found, item: op.item };
    return ok(
        withList(level, 'pickups', list.map((e) => (e.id === op.id ? next : e))),
        `pickup ${op.id} grants ${op.item === null ? '(nothing)' : op.item}`,
        next,
    );
}

/** ⛓ `{id, direction}` — the validator's own four, and its own sentence. */
function opSetPortalDirection(level, op) {
    const list = listOf(level, 'portals');
    const found = list.find((e) => e.id === op.id);
    if (!found) {
        return refuse(`bounce: no portal '${op.id}' to aim — the level holds `
            + `[${list.map((e) => e.id).join(', ')}].`);
    }
    if (!PORTAL_DIRECTIONS.includes(op.direction)) {
        return refuse(`portal '${op.id}': bad direction '${op.direction}'`);
    }
    const next = { ...found, direction: op.direction };
    return ok(
        withList(level, 'portals', list.map((e) => (e.id === op.id ? next : e))),
        `portal ${op.id} → ${op.direction}`,
        next,
    );
}

/* ── the whole document ──────────────────────────────────────────────── */

/**
 * ⛓⛓⛓ `{level, why?}` — Regenerate, as ONE op carrying the RESULT.
 *
 * ⛔ It is the only op whose payload is a whole document, and that is what
 * makes undo of a regenerate exact: the pre-regenerate level is simply the fold
 * of a shorter list. ⚠ It VALIDATES, because a `replace-level` is the one op
 * that can put an arbitrary object into the record, and the validator's errors
 * are the sentences the panel already prints.
 */
function opReplaceLevel(level, op) {
    const errors = validateLevel(op.level);
    if (errors.length) {
        return refuse(`bounce: replace-level was handed a level the model refuses — `
            + `${errors.slice(0, 4).join(' · ')}${errors.length > 4
                ? ` (+${errors.length - 4} more)` : ''}`);
    }
    return ok(op.level, op.why ?? `replaced the level (${
        (op.level.platforms ?? []).length} platforms)`);
}

/* ── shared refusals ─────────────────────────────────────────────────── */

function badKind(kind) {
    if (ENTITY_KINDS.includes(kind)) return null;
    return `bounce: ${JSON.stringify(kind)} is not an entity kind — the level's are `
        + `[${ENTITY_KINDS.join(', ')}].`;
}

const singular = (kind) => kind.replace(/s$/, '');

/** `checkEntities`' own out-of-bounds sentence, minus the subject. */
function outsideBounds(level, x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return 'x/y must be numbers';
    const { width, height } = level.size ?? {};
    if (!(width > 0) || !(height > 0)) return null;
    if (x < 0 || x > width || y < 0 || y > height) {
        return `position (${x},${y}) outside level bounds`;
    }
    return null;
}
