/**
 * seedlingDemo/seedlingEditAdapter — **SEEDLING, AS AN `editCore` ADAPTER, AND
 * THE FIRST SUBSTRATE THAT RESOLVES ITS OWN `base`.**
 *
 * EDITOR v3, slice B (`NewDocs/plans/seedling-editor-v3.md` §7.2, §3.2). A1
 * shipped the core with the maze as its only adapter and left Seedling's
 * `watchEdit.js` untouched (§9.8 residue). This is the wrapper, and it is as
 * thin as the maze's for the same reason: the core already carries both of
 * `watchEdit`'s laws, so there is nothing for a wrapper to re-decide.
 *
 * ── ⛔⛔ EVERYTHING IT NEEDS IS INJECTED, AND THE LIST IS THE CHECKLIST ────
 *
 * The `.oep` schema, the level source, the vanilla set's content hash and the
 * OEL parser all arrive as construction parameters, and each is refused BY NAME
 * at the moment it is needed. ⛓ Three separate reasons, none of them taste:
 *
 *   ·  **the schema and the level source** are DISK in node and a `fetch` in the
 *      browser, and one `node:fs` anywhere in this graph makes the page
 *      unloadable (`levelSource.js`'s own note, learned the hard way);
 *   ·  **the OEL parser** lives in `scripts/procgen/seedlingOgmo.js`. It has
 *      ZERO imports and would load fine — but MEASURED, **no module under
 *      `frontend/` imports anything under `scripts/`**: the direction is
 *      scripts → frontend, every time. Reversing it for one function would be
 *      the first inversion in the tree, and moving the parser is outside this
 *      slice's file set. So it is a parameter, which is this repo's own answer
 *      to exactly this question everywhere else;
 *   ·  **the vanilla `set_id`** is a fact about a committed fixture, and a
 *      module that read it would be a second reader of the identity the
 *      stamper owns.
 *
 * ── ⛓ THE BOUNDS THIS ADAPTER NAMES ──────────────────────────────────────
 *
 *  1. **A PASTE DOES NOT CLEAR THE DESTINATION'S BODIES.** The maze has a
 *     `clearEntity` op; Seedling's vocabulary has `remove`, which takes *the
 *     last entity in the cell* one at a time and refuses an empty cell — and
 *     `writeOps` sees a DESCRIPTOR, not the record, so it cannot know how many
 *     to emit. ⇒ `writeOps` PAINTS the two layers and PLACES the descriptor's
 *     bodies on top of whatever is there. A paste onto an empty cell reproduces
 *     it exactly (that is the fixed point law 7 asks for); a paste onto an
 *     occupied cell ACCUMULATES. Measured and pinned, not discovered later.
 *  2. **`cliff` IS ALWAYS A FIELD, even in a room with no cliffsides layer**
 *     (`null` there). The core refuses a filter for a field the descriptor
 *     lacks, and a filter that existed only in rooms that happened to have the
 *     layer would be a control that came and went.
 *  3. **`attrs` DEFAULTS ARE NOT FILLED** unless the caller asks. See
 *     `watchEdit.normalizeAttrsAgainst`' docblock: the brief's premise that Ogmo
 *     always writes every declared value is measurably false (183 of 2,461
 *     shipped instances), so filling is a convenience and not the format.
 */

import {
    ProcgenLevelError, assertRoomSize, layerNamed, tileAtOel, tileCellAt,
} from './procgenLevel.js';
import {
    WatchEditError, applyEdit, describeEdit, entityIndexAt, normalizeGroupOrEdit, recordsEqual,
    resizeWarnings,
} from './watchEdit.js';
import { TILE_SIZE } from './levelWorld.js';

export class SeedlingEditAdapterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeedlingEditAdapterError';
    }
}

const fail = (message) => { throw new SeedlingEditAdapterError(message); };

/**
 * ⛓⛓ **THE CELL, AS A CLOSED COMPARABLE VALUE** — `{tile, cliff, entities}`,
 * the THREE-WAY descriptor A2 §10.9 said slice B had to decide.
 *
 * ⚠ `entities` IS A LIST, not "the entity". A Seedling cell routinely holds
 * more than one body (`watchEdit`'s own "last one wins" rule exists because of
 * it), and a descriptor that named just the last would lose the rest on every
 * copy — the same argument the maze's `parts` bag makes for a different reason.
 *
 * ⚠ AND THE BODIES CARRY NO POSITION. Their OEL x/y is the CELL's, and a
 * descriptor that carried the absolute pixel would paste a body back at the
 * cell it came from however far the paste moved. ⛔ Entity coordinates in
 * vanilla are NOT always grid-aligned (`statue2` in OverWorld.oel sits at
 * x=184), so a cell read out of a vanilla room and written elsewhere SNAPS to
 * the destination cell's corner. That is a real loss and it is named: the
 * descriptor is a CELL, and a sub-cell offset is not a fact a cell can hold.
 */
export function readSeedlingCell(record, tx, ty) {
    const entities = (record.entities ?? [])
        .filter((e) => {
            const at = tileAtOel(e.x, e.y);
            return at.tx === tx && at.ty === ty;
        })
        .map((e) => {
            const body = { type: e.type, attrs: { ...(e.attrs ?? {}) } };
            if (e.nodes) {
                // ⛓ RELATIVE to the cell's corner, for the same reason the body's
                // own position is dropped: a rope's span must survive a paste.
                body.nodes = e.nodes.map((n) => ({ dx: n.x - tx * TILE_SIZE, dy: n.y - ty * TILE_SIZE }));
            }
            return body;
        });
    return {
        tile: tileCellAt(record, tx, ty, 'tiles'),
        cliff: tileCellAt(record, tx, ty, 'cliffsides'),
        entities,
    };
}

/**
 * ⛓⛓ **THE INVERSE — THE OPS THAT MAKE (tx, ty) LOOK LIKE `desc`.**
 *
 * ⛔ THE ORDER IS THE CONTRACT: the two tile layers first, then the bodies, and
 * a body's `nodes` op after its `place` — because `nodes` addresses *the last
 * entity in the cell*, which the `place` immediately before it just made.
 *
 * ⚠ IT EMITS OPS ONLY FOR THE FIELDS THE DESCRIPTOR PRESENTS — that is the
 * core's filter contract (`only: 'tile' | 'cliff' | 'entities'`), and it is why
 * the three filters are a projection of this shape rather than a second op set.
 */
export function seedlingWriteOps(desc, tx, ty) {
    const out = [];
    const has = (k) => Object.prototype.hasOwnProperty.call(desc ?? {}, k);
    if (has('tile') && desc.tile) out.push({ op: 'paint', tx, ty, column: desc.tile.column });
    if (has('cliff') && desc.cliff) {
        out.push({ op: 'paint', tx, ty, layer: 'cliffsides', column: desc.cliff.column });
    }
    if (has('entities')) {
        for (const e of desc.entities ?? []) {
            out.push({ op: 'place', tx, ty, type: e.type, attrs: { ...e.attrs } });
            if (e.nodes) {
                out.push({
                    op: 'nodes',
                    tx,
                    ty,
                    nodes: e.nodes.map((n) => ({
                        x: tx * TILE_SIZE + n.dx, y: ty * TILE_SIZE + n.dy,
                    })),
                });
            }
        }
    }
    return out;
}

/**
 * ⛓ THE SENTENCE ONE OP GETS IN A READOUT — `describeEdit`, plus the warnings
 * that are about the RECORD rather than the op (⚖ ruling 5's boss classes, and
 * a grown room's untiled cells).
 */
function describeApplied(record, op) {
    const base = describeEdit(op);
    if (op.op !== 'resize') return base;
    const warnings = resizeWarnings(record, op);
    return warnings.length === 0 ? base : `${base} — ${warnings.join(' · ')}`;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ §3.2's `base` UNION — the FOUR KINDS, and which of them this
 * adapter resolves
 * ══════════════════════════════════════════════════════════════════════ */

/** The four kinds §3.2 declares, as data — the refusals read this. */
export const BASE_KINDS = Object.freeze(['generate', 'atlas', 'oel', 'set-room']);

function atlasBase(tag, { levelSource, vanillaSetId }) {
    if (typeof tag.set_id !== 'string' || !Number.isInteger(tag.level)) {
        fail(`seedlingEditAdapter: an \`atlas\` base is {kind, set_id, level}, got `
            + `${JSON.stringify(tag)}.`);
    }
    if (!levelSource) {
        fail('seedlingEditAdapter: an `atlas` base needs a `levelSource`, and none was '
            + 'injected. The committed extract is ~975 KB of disk in node and a `fetch` in '
            + 'the browser; a module that read it would put `node:fs` on the page\'s graph.');
    }
    if (!vanillaSetId) {
        fail('seedlingEditAdapter: an `atlas` base needs the vanilla set\'s `set_id`, and '
            + 'none was injected — without it the hash check below cannot be asked, and an '
            + 'unasked identity check is worse than none because the payload still claims one.');
    }
    /**
     * ⛔⛔ ⚖ RULING 2 — THE CONTENT HASH IS THE IDENTITY, AND A MISMATCH REFUSES
     * BY NAME. The sentence is the SAVE STAMP's shape on purpose: the game
     * refuses a save written against different level bytes, and an edited L14
     * whose base names a different vanilla set is the same failure one layer up
     * — the edits would land on a room that is not the room they were made on.
     */
    if (tag.set_id !== vanillaSetId) {
        fail(`seedlingEditAdapter: this \`atlas\` base names set_id `
            + `${JSON.stringify(tag.set_id)} and the vanilla set here is `
            + `${JSON.stringify(vanillaSetId)}. ⛔ REFUSED: the id carries the CONTENT HASH `
            + 'of the 116 rooms, so an edit list recorded against other bytes would be '
            + 'replayed onto a room it was never made on — the same refusal the game\'s save '
            + 'stamp makes about a save written against a different set.');
    }
    const record = levelSource(tag.level);
    if (!record) {
        fail(`seedlingEditAdapter: the level source has no level ${tag.level}.`);
    }
    return record;
}

function oelBase(tag, { parseOel }) {
    if (typeof tag.xml !== 'string' || tag.xml === '') {
        fail(`seedlingEditAdapter: an \`oel\` base is {kind, xml}, got `
            + `${JSON.stringify(tag)?.slice(0, 120)}.`);
    }
    if (!parseOel) {
        fail('seedlingEditAdapter: an `oel` base needs a `parseOel`, and none was injected. '
            + 'The one OEL reader in the repo is `scripts/procgen/seedlingOgmo.parseOelLevel` '
            + '— and NO module under `frontend/` imports anything under `scripts/` (measured: '
            + 'the direction is scripts → frontend, every time), so it arrives as a parameter '
            + 'rather than as the tree\'s first inversion.');
    }
    const parsed = parseOel(tag.xml, tag.path ?? '<pasted oel>');
    /**
     * ⚠ THE PARSER ANSWERS `{width, height, layers, entities}` AND A RECORD IS
     * MORE THAN THAT. `level` is the id a `levelSource` answers to and a staging
     * block's `boot.level` names; `class` and `path` are provenance the atlas
     * carries. They are the TAG's to supply, defaulted rather than invented —
     * and `tiles_outside_level` is dropped, because it is a fact about the DISK
     * FILE (how many placements the parser discarded) and not about the room.
     */
    const { tiles_outside_level: _dropped, ...core } = parsed;
    assertRoomSize({ width: core.width, height: core.height }, 'seedlingEditAdapter: oel base');
    return {
        level: tag.level ?? 0,
        class: tag.class ?? 'PastedOel',
        path: tag.path ?? 'pasted.oel',
        ...core,
    };
}

/**
 * ⛓⛓⛓ **§3.2's FOURTH BASE — A ROOM OF A LOADED SET** (EDITOR v3 slice C2).
 *
 * ⛔ **IT RESOLVES THROUGH THE `oel` ARM AND THAT IS THE WHOLE POINT.** A set's
 * room IS an OEL document plus a manifest row; giving `set-room` its own parse
 * would be a second reader of one format, and the two would part on the first
 * thing the manifest could not express. So this resolves the ROOM and hands the
 * XML to `oelBase`, which is already the one door for pasted rooms.
 *
 * ⛔ **THE SET IS INJECTED, LIKE EVERYTHING ELSE.** `levelSetSource(set_id)` is
 * the page's own held document (a set arrives by paste or by fetch, both of
 * which are the page's business), and an adapter that reached for one would be
 * reading a document nobody handed it.
 *
 * ⛔⛔ **AN `embed`-SOURCED ROOM REFUSES BY NAME, AND THAT IS THE WHOLE VANILLA
 * SET.** An `embed` is a path into a SWF's `[Embed]` table — a fact about a
 * SOURCE TREE, not about this document — and all 116 rooms of
 * `fixtures/seedling-vanilla-set.json` carry one. ⇒ the vanilla set cannot be
 * opened this way and the refusal says so; `?source=edit&level=N` (the ATLAS
 * base, ⚖ ruling 2's hash) is its door.
 */
function setRoomBase(tag, { levelSetSource, parseOel }) {
    if (typeof tag.set_id !== 'string' || !Number.isInteger(tag.room)) {
        fail(`seedlingEditAdapter: a \`set-room\` base is {kind, set_id, room}, got `
            + `${JSON.stringify(tag)}.`);
    }
    if (!levelSetSource) {
        fail('seedlingEditAdapter: a `set-room` base needs a `levelSetSource`, and none was '
            + 'injected. A level set arrives by PASTE or by fetch — both of them the PAGE\'s '
            + 'business — so the document is handed in, exactly as the atlas is.');
    }
    const set = levelSetSource(tag.set_id);
    if (!set) {
        fail(`seedlingEditAdapter: no level set with set_id ${JSON.stringify(tag.set_id)} is `
            + 'loaded here. ⛔ REFUSED rather than opened against whatever set happens to be '
            + 'in hand: a `set_id` carries the DOCUMENT\'s CONTENT HASH '
            + '(`stampLevelSetIdentity`), so a room resolved out of a different set would be '
            + 'a room this base never named — the same refusal ⚖ ruling 2 makes about the '
            + 'vanilla atlas one layer down.');
    }
    const room = (set.rooms ?? [])[tag.room];
    if (!room) {
        fail(`seedlingEditAdapter: set ${JSON.stringify(tag.set_id)} has no room `
            + `${tag.room} — it has ${(set.rooms ?? []).length} (0..`
            + `${Math.max(0, (set.rooms ?? []).length - 1)}). ⚠ A room id is its POSITION in `
            + '`rooms[]` (the schema\'s own rule), which is why a reorder rewrites every '
            + '`@to`.');
    }
    if (!room.source || typeof room.source.xml !== 'string') {
        fail(`seedlingEditAdapter: room ${tag.room} ${JSON.stringify(room.name ?? '')} of `
            + `${JSON.stringify(tag.set_id)} is `
            + `${room.source?.embed ? `EMBED-sourced (${room.source.embed})` : 'sourced by '
                + `${JSON.stringify(room.source)}`} and this page has no embeds. ⛔ An `
            + '`embed` is a path into a SWF\'s `[Embed]` table — a fact about a SOURCE TREE, '
            + 'not about this document — and all 116 rooms of the committed VANILLA set '
            + 'carry one, so that set cannot be opened room by room here. Its door is '
            + '`?source=edit&level=N`, the ATLAS base.');
    }
    return oelBase({
        kind: 'oel',
        xml: room.source.xml,
        level: tag.room,
        class: room.name ?? `Room${tag.room}`,
        path: `${tag.set_id}#${tag.room}`,
    }, { parseOel });
}

const refuseKind = (kind, why) => () => fail(
    `seedlingEditAdapter: \`${kind}\` is one of §3.2's four base kinds and this adapter does `
    + `NOT resolve it — ${why}`,
);

/**
 * ⛓⛓⛓ **THE ADAPTER.** Every dependency is a construction parameter; every one
 * of them refuses BY NAME at the moment it is missing rather than at boot, so a
 * page that needs only `oel` does not have to hand over a level source.
 *
 * @param {object} [o]
 * @param {object} [o.schema]        the `.oep` extract (typed attrs; ⛔ without
 *                                   it the ops are slice 11's, untyped)
 * @param {Function} [o.levelSource] `(level) => record`, for the `atlas` base
 * @param {string} [o.vanillaSetId]  the vanilla set's stamped `set_id` (⚖ ruling 2)
 * @param {Function} [o.parseOel]    `(xml, where) => {width, height, layers, entities}`
 * @param {Function} [o.levelSetSource] `(set_id) => set`, for the `set-room` base
 * @param {boolean} [o.fillDefaults] fill omitted attrs from the schema's defaults
 */
export function createSeedlingEditAdapter({
    schema = null, levelSource = null, vanillaSetId = null, parseOel = null,
    levelSetSource = null, fillDefaults = false,
} = {}) {
    const opts = { schema, fillDefaults };
    return Object.freeze({
        name: 'seedling',
        /**
         * ⛓⛓ ONE ATOMIC OP. `applyEdit` is already PURE — a new frozen record
         * out, the old one untouched — so unlike the maze's adapter there is no
         * clone here and nothing to discard on a refusal.
         *
         * ⛔⛔ **ONE CATCH, AND IT NAMES THE CLASS.** Two error classes can come
         * out of the op path — `WatchEditError` (the op's own shape and the
         * schema) and `ProcgenLevelError` (the record's: bounds, the room size,
         * a crop that would drop something) — and both are REFUSALS in the
         * core's vocabulary. ⚠ Anything else is NOT caught: a `TypeError` from
         * this file is a defect, and swallowing it into `{ok:false}` would make
         * a crash look like a level the substrate declined to build.
         */
        apply(record, rawOp) {
            let op;
            try {
                op = normalizeGroupOrEdit(rawOp, opts);
                return {
                    ok: true,
                    op,
                    record: applyEdit(record, op, opts),
                    description: describeApplied(record, op),
                };
            } catch (err) {
                if (err instanceof WatchEditError || err instanceof ProcgenLevelError) {
                    return {
                        ok: false,
                        description: `seedling: ${err.message}`,
                        reason: err.name,
                    };
                }
                throw err;
            }
        },
        equal: recordsEqual,
        bounds: (record) => ({ w: record.width, h: record.height }),
        readCell: readSeedlingCell,
        writeOps: seedlingWriteOps,
        /**
         * ⛓⛓⛓ §3.2's FOUR KINDS — two resolved here, two refused BY NAME.
         *
         * ⛔ THE TWO REFUSALS ARE MEMBERS RATHER THAN ABSENCES, and that is the
         * point: `resolveBase` says *"[atlas, oel] is what this adapter offers"*
         * for a kind it has never heard of, which is a different and less useful
         * sentence than *"`generate` is resolved by the GENERATE ladder, not
         * here"*. A kind that exists in the union and is somebody else's job is
         * a fact worth a sentence.
         */
        bases: Object.freeze({
            atlas: (tag) => atlasBase(tag, { levelSource, vanillaSetId }),
            oel: (tag) => oelBase(tag, { parseOel }),
            generate: refuseKind('generate',
                'it is the GENERATE ladder\'s identity (seed, biome, directives, skeleton) '
                + 'and reconstructing it means RUNNING the ladder. "Open in editor" hands the '
                + 'record over; the tag rides along so the identity line survives.'),
            /**
             * ⛓ EDITOR v3 C2 — it has a BODY now, and it still refuses by name
             * when no set is loaded or the room is `embed`-sourced. ⚠ Without a
             * `levelSetSource` the sentence is about the missing DOCUMENT, not
             * about the kind: a page with no set has not asked a bad question.
             */
            'set-room': (tag) => setRoomBase(tag, { levelSetSource, parseOel }),
        }),
    });
}

/** ⛓ Re-exported so a caller reads the vocabulary off the adapter's own module
 *  rather than reaching past it. ⛔ The SAME frozen values, not copies. */
export { entityIndexAt, layerNamed };
