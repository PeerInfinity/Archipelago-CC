// frontend/modules/procgenCore/worldSetAdapter.js
/**
 * ⛓⛓⛓ **THE COMPOSITE SET ADAPTER — ONE SESSION OVER SEVERAL SET DOCUMENTS.**
 *
 * EDITOR INTEGRATION slice W2 (`NewDocs/plans/editor-integration.md` §2.2 #4).
 *
 * A world's rooms are the parts' rooms CONCATENATED in part order:
 * `bounds = {w: Σ each part's w, h: 1}`, and a global index resolves to
 * `(part, local index)`. Every op that carries a `room` is FORWARDED to the
 * part that owns that index with the index re-based and the result re-wrapped;
 * `add-room` and `reorder` are addressed by PART NAME; `connect`/`disconnect`
 * go to a part or to `world.links` depending on their endpoints.
 *
 * ── ⛔ EVERY SUBSTRATE HALF ARRIVES INJECTED ──────────────────────────
 *
 * `procgenCore/` may not import `seedlingDemo/`, `mazeRoom/` or `flashPanel/`
 * (`bindingContract.test.js`). So a part is a DESCRIPTOR — its adapter, its
 * readers, and the two functions that turn a `(document, overlay)` pair into
 * that substrate's record and back. Nothing here knows what a level set or a
 * region library is.
 *
 * ── ⛓⛓ THE DESCRIPTOR GAINS `part` AND `substrate`, AND BOTH ARE READOUTS ─
 *
 * `readCell` returns the part's own descriptor with `part` and `substrate`
 * added; `writeOps` strips them. ⛔ **LAW 7 SURVIVES BECAUSE `substrate` IS A
 * PER-PART CONSTANT FOR EVERY PART THAT CAN DERIVE** — measured: a Seedling
 * room's substrate is `substrateIdFor(atlas.game)` for every room in the set,
 * and a region library CAN mix in storage but the maze derivation refuses PER
 * ENTRY anything it cannot read (W1 §7.3), so a part whose entries disagreed
 * could not produce an atlas at all. A field the destination cell is not free
 * to adopt is exactly what §20.3 kept a room `id` OUT of a descriptor for; this
 * one is safe for the same reason that rule exists, and the row says which
 * measurement is holding it up.
 *
 * ── ⛔⛔ A CROSS-PART DOOR IS A DIFFERENT OP SHAPE, NOT A DIFFERENT ARGUMENT ─
 *
 * The parts spell an exit differently: Seedling's `connect` takes an exit
 * ORDINAL (`from: [room, 0]`) and the maze's an exit ID (`from: [room,
 * 'exit_1']`) — while a WORLD link must name the DERIVED ATLAS exit id, because
 * that is what the merged atlas's `connect` endpoints are. Translating an
 * ordinal into a derived id would cost a derivation inside an op. ⇒ the two
 * shapes are made visibly different instead:
 *
 *   `connect {from: [gRoom, exit], to: [gRoom, exit], …}`   ARRAY  → one part
 *   `connect {from: {part, room, exit}, to: {…}, one_way}`  OBJECT → world.links
 *
 * and each refuses the other's case by name. An array pair straddling two parts
 * says to use the object form and why; an object pair inside one part says the
 * door is that part's own `connect`.
 */

import { canonicalJson } from './editCore.js';
import { addRoomMapping, removeRoomMapping, reorderMapping } from './setEditorCore.js';
import {
    assertWorld, linksErrors, partIdsOf, renumberWorldLinks,
} from './worldDocument.js';

export class WorldSetAdapterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WorldSetAdapterError';
    }
}

const fail = (message) => { throw new WorldSetAdapterError(`worldSetAdapter: ${message}`); };

export const isWorldSetRefusal = (e) => e?.name === 'WorldSetAdapterError';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** ⛓ The ops this adapter owns outright — everything else is a part's. */
export const WORLD_ONLY_OP_KINDS = Object.freeze(['connect', 'disconnect', 'set-field']);
/** ⛓ …and the ones addressed by PART NAME rather than by room. */
export const PART_ADDRESSED_OP_KINDS = Object.freeze(['add-room', 'reorder']);

const PART_MEMBERS = Object.freeze([
    'recordOf', 'splitRecord', 'readSetCell', 'exitsOfRoom', 'whatLinksHere',
    'bounds', 'isRefusal',
]);

function assertParts(parts) {
    if (!Array.isArray(parts) || parts.length === 0) {
        fail('createWorldSetAdapter needs a non-empty `parts` array — a world with no parts has '
            + 'no rooms, and `bounds` would be {w: 0}, which contract law 1 refuses');
    }
    const seen = new Set();
    for (const part of parts) {
        if (!isPlainObject(part) || typeof part.id !== 'string' || part.id === '') {
            fail(`a part descriptor is {id, adapter, ${PART_MEMBERS.join(', ')}}, got `
                + JSON.stringify(part));
        }
        if (seen.has(part.id)) fail(`two parts are called "${part.id}"`);
        seen.add(part.id);
        if (!isPlainObject(part.adapter) || typeof part.adapter.apply !== 'function') {
            fail(`part "${part.id}" was injected without an \`adapter\` — the SUBSTRATE's own `
                + 'set adapter, whose `apply`, `equal` and `writeOps` this one forwards to');
        }
        for (const member of PART_MEMBERS) {
            if (typeof part[member] !== 'function') {
                fail(`part "${part.id}" was injected without \`${member}\` — every substrate half `
                    + 'is a parameter here, because `procgenCore/` may import neither of the two '
                    + 'set adapters');
            }
        }
    }
    return parts;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE GRID — global index ⇄ (part, local)
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ Each part's record, assembled from the held document and the world's overlay. */
export function partRecordOf(record, part) {
    return part.recordOf(record?.parts?.[part.id], record?.world?.overlays?.[part.id]);
}

/** ⛓ `{part, offset, count, record}` per part, in DECLARATION order. */
export function partSpans(record, parts) {
    let offset = 0;
    return parts.map((part) => {
        const partRecord = partRecordOf(record, part);
        const count = part.bounds(partRecord).w;
        const span = { part, offset, count, record: partRecord };
        offset += count;
        return span;
    });
}

export const worldBounds = (record, parts) => ({
    w: partSpans(record, parts).reduce((n, s) => n + s.count, 0),
    h: 1,
});

/**
 * ⛓⛓ **WHICH PART OWNS GLOBAL ROOM `x`** — and the refusal NAMES the spans,
 * because "room 7 of 6" says nothing about which part the reader meant.
 */
export function partAt(record, x, parts, where = 'this op') {
    const spans = partSpans(record, parts);
    if (!Number.isInteger(x) || x < 0) {
        fail(`${where} names room ${JSON.stringify(x)}; a world room is a non-negative INDEX `
            + 'into the parts\' rooms concatenated in part order');
    }
    const span = spans.find((s) => x >= s.offset && x < s.offset + s.count);
    if (span === undefined) {
        fail(`${where} names room ${x}; this world holds `
            + `${spans.reduce((n, s) => n + s.count, 0)} room(s) — `
            + `${spans.map((s) => `"${s.part.id}" ${s.offset}..${s.offset + s.count - 1}`).join(', ')}`);
    }
    return { ...span, local: x - span.offset, global: x };
}

/**
 * ⛓⛓⛓ **THE INVERSE OF `partAt` — (part, LOCAL index) → the GLOBAL one.**
 *
 * EDITOR INTEGRATION W4 (§9.6 #2). `partAt` answers the direction every op
 * needs; the PAGE needs the other one, because a room editor is opened for
 * *room 2 of the level set* and the composite's `replace-room` is addressed by
 * the GLOBAL index. ⛔ It was already spelled ONCE, inline, inside
 * `whatLinksHereInWorld`'s `globalOf` — and a second spelling on the page is
 * exactly the pair that parts company at the part seam (the mutant is an
 * off-by-one there, and it is invisible inside part 0 because part 0's local
 * indices ARE its global ones). ⇒ one exported function, and `globalOf` is it.
 *
 * ⛔ **IT REFUSES AN OUT-OF-RANGE LOCAL INDEX BY NAME** rather than returning a
 * number outside the world: `partAt(record, that number)` would then answer the
 * NEXT part, so a silent answer would address a different document.
 *
 * @param {object} record the world record
 * @param {string} partId
 * @param {number} local  the index inside that part
 * @param {Array<object>} parts
 * @param {string} [where] what to call the caller in the refusal
 * @returns {number} the index into the concatenated one-row grid
 */
export function globalIndexOf(record, partId, local, parts, where = 'this op') {
    const span = partNamed(record, partId, parts, where);
    if (!Number.isInteger(local) || local < 0 || local >= span.count) {
        fail(`${where} names room ${JSON.stringify(local)} of part "${partId}", which holds `
            + `${span.count} room(s) (0..${span.count - 1})`);
    }
    return span.offset + local;
}

/** ⛓ …and by NAME, for the part-addressed ops. */
export function partNamed(record, id, parts, where = 'this op') {
    const span = partSpans(record, parts).find((s) => s.part.id === id);
    if (span === undefined) {
        fail(`${where} names part ${JSON.stringify(id)}; this world holds `
            + `${parts.map((p) => `"${p.id}"`).join(', ')}`);
    }
    return span;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ THE CELL
 * ══════════════════════════════════════════════════════════════════════ */

export function readWorldCell(record, x, y, parts) {
    if (y !== 0) {
        fail(`readCell was asked for row ${y}. A world's rooms are a ONE-ROW grid — each part's `
            + 'rooms are a positionally addressed LIST and the world concatenates them, so there '
            + 'is no second row on either side of the join.');
    }
    const { part, local, record: partRecord } = partAt(record, x, parts, 'readCell');
    const desc = part.readSetCell(partRecord, local, 0);
    return {
        ...desc,
        part: part.id,
        /**
         * ⛓ WHICH SUBSTRATE PLAYS THIS ROOM — the part's own reader, injected,
         * because the answer is a Seedling constant on one side and an ENTRY
         * field on the other. `null` when the part declares none rather than a
         * guess: the compile default is the compiler's answer, not a cell's.
         */
        substrate: part.substrateOfRoom?.(partRecord, local) ?? null,
    };
}

export function worldWriteOps(desc, x, y, parts) {
    if (y !== 0) fail(`writeOps was asked for row ${y}; a world's rooms are a ONE-ROW grid`);
    if (!isPlainObject(desc)) {
        fail(`writeOps needs a cell descriptor, got ${JSON.stringify(desc)}`);
    }
    const part = parts.find((p) => p.id === desc.part);
    if (part === undefined) {
        fail(`writeOps was handed a descriptor from part ${JSON.stringify(desc.part)}, and this `
            + `world holds ${parts.map((p) => `"${p.id}"`).join(', ')}. ⛓ A cell descriptor `
            + 'carries the part it came from precisely so a paste can be checked — `writeOps` '
            + 'never sees the record (that is the core\'s signature), so the CHECK that the '
            + 'destination is in the same part happens in `apply`.');
    }
    const { part: _p, substrate: _s, ...inner } = desc;
    return part.adapter.writeOps(inner, x, 0).map((op) => ({ ...op, part: desc.part }));
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE READERS THE CORE'S `roomRowsOf` TAKES
 * ══════════════════════════════════════════════════════════════════════ */

export function exitsOfWorldRoom(record, room, parts) {
    const { part, local, record: partRecord } = partAt(record, room, parts, 'exitsOfRoom');
    return part.exitsOfRoom(partRecord, local);
}

/**
 * ⛓⛓ **"WHAT LINKS HERE" IS THE PART'S ANSWER RE-BASED, PLUS THE WORLD'S OWN
 * CROSSINGS.** A part cannot see a world link — it is not in its document — so
 * a room reached only from the other part would read as linked from nowhere.
 */
export function whatLinksHereInWorld(record, room, parts) {
    const { part, local, offset, record: partRecord } = partAt(record, room, parts, 'whatLinksHere');
    const inner = part.whatLinksHere(partRecord, local);
    const links = inner.links.map((l) => ({
        ...l,
        from: Number.isInteger(l.from) ? l.from + offset : l.from,
        part: part.id,
    }));
    /**
     * ⛓ EDITOR INTEGRATION W4 — through the EXPORTED mapping, so the page and
     * this reader cannot disagree about where a part's room sits. ⛔ `null` on a
     * refusal, because a crossing whose far endpoint is out of range is still a
     * crossing INTO this room and the row must not die describing it.
     */
    const globalOf = (e) => {
        try {
            return globalIndexOf(record, e?.part, e?.room, parts, 'whatLinksHere');
        } catch (err) {
            if (!isWorldSetRefusal(err)) throw err;
            return null;
        }
    };
    (record?.world?.links ?? []).forEach((link, index) => {
        const twoWay = link.one_way === false;
        if (link.to?.part === part.id && link.to.room === local) {
            links.push({ from: globalOf(link.from), kind: 'world-link', index, exit_id: link.to.exit });
        } else if (twoWay && link.from?.part === part.id && link.from.room === local) {
            links.push({ from: globalOf(link.to), kind: 'world-link', index, exit_id: link.from.exit });
        }
    });
    return { links, unreadable: inner.unreadable ?? [] };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE OPS
 * ══════════════════════════════════════════════════════════════════════ */

const withPartRecord = (record, part, next) => {
    const { doc, overlay } = part.splitRecord(next);
    return Object.freeze({
        world: {
            ...record.world,
            overlays: { ...record.world.overlays, [part.id]: overlay },
        },
        parts: { ...record.parts, [part.id]: doc },
    });
};

/** ⛓ The mapping a renumbering op performs, from the PART's own three. */
function mappingFor(op, span) {
    if (op.op === 'reorder') return reorderMapping(op.order);
    if (op.op === 'add-room') return addRoomMapping(Number.isInteger(op.at) ? op.at : span.count);
    if (op.op === 'remove-room') return removeRoomMapping(op.room);
    return null;
}

/**
 * ⛓ Forward one op to the part that owns it, re-key the world's links when the
 * op renumbers, and re-wrap the result.
 *
 * ⛔⛔ **`op` IS THE WORLD'S OWN OP AND `inner` IS THE RE-BASED ONE, AND THE
 * RESULT CARRIES `op`.** The session STORES what `apply` hands back and REFOLDS
 * the stored list from the base on every undo — so returning the re-based op
 * would put a LOCAL room index into a list that is replayed against GLOBAL
 * ones, and the replay would silently address a different part. Found by the
 * undo row of `seedlingDemo/worldChain.test.js`, which reddened with the maze
 * part's own `connect` arriving at the Seedling part on the first refold.
 */
function forward(record, span, op, inner, opKindsOf) {
    const { part } = span;
    if (!opKindsOf(part).includes(op.op)) {
        return {
            ok: false,
            description: `world: part "${part.id}" (${part.kind ?? part.adapter.name}) has no op `
                + `"${op.op}" — its vocabulary is ${opKindsOf(part).join(', ')}`,
        };
    }
    const result = part.adapter.apply(span.record, inner);
    if (!result.ok) {
        return { ...result, description: `world: part "${part.id}": ${result.description}` };
    }
    let next = withPartRecord(record, part, result.record);
    let dropped = 0;
    const mapping = mappingFor(inner, span);
    if (mapping !== null) {
        /**
         * ⛔ **THE PART'S OWN MAPPING, NEVER A SECOND ONE.** The part has
         * already re-keyed its own overlay through `renumberSet`; this is the
         * same decision applied to the one thing the part cannot see — the
         * world's crossings into it.
         */
        const before = next.world.links ?? [];
        const after = renumberWorldLinks(before, part.id, mapping);
        dropped = before.length - after.length;
        next = Object.freeze({ ...next, world: { ...next.world, links: after } });
    }
    return {
        ok: true,
        op,
        record: next,
        description: `world: part "${part.id}": ${result.description}`
            + (dropped > 0 ? ` (${dropped} world link(s) into a room that is gone went with it)` : ''),
    };
}

const isWorldEndpoint = (e) => isPlainObject(e) && typeof e.part === 'string';

function worldConnect(record, op, parts) {
    const link = { from: op.from, to: op.to, one_way: op.one_way };
    const errors = linksErrors([link], {
        partIds: partIdsOf(record.world),
        roomCounts: Object.fromEntries(partSpans(record, parts).map((s) => [s.part.id, s.count])),
    });
    const existing = record.world.links ?? [];
    if (errors.length === 0) {
        errors.push(...linksErrors([...existing, link], {
            partIds: partIdsOf(record.world),
        }).filter((e) => e.startsWith(`world.links[${existing.length}]`)));
    }
    if (errors.length > 0) {
        return { ok: false, description: `world: this crossing is refused — ${errors.join(' | ')}` };
    }
    return {
        ok: true,
        op,
        record: Object.freeze({ ...record, world: { ...record.world, links: [...existing, link] } }),
        description: `world: connect ${link.from.part}/${link.from.room}/${link.from.exit} `
            + `${link.one_way ? '->' : '<->'} ${link.to.part}/${link.to.room}/${link.to.exit}`,
    };
}

function worldDisconnect(record, op) {
    const links = record.world.links ?? [];
    const target = op.from;
    const index = links.findIndex((l) => ['from', 'to'].some(
        (side) => l[side]?.part === target.part && l[side]?.room === target.room
            && l[side]?.exit === target.exit,
    ));
    if (index < 0) {
        return {
            ok: false,
            description: `world: no world link joins ${target.part}/${target.room}/${target.exit}`
                + `. This world's crossings are ${links.length === 0 ? '(none)' : links
                    .map((l) => `${l.from.part}/${l.from.room}/${l.from.exit} → `
                        + `${l.to.part}/${l.to.room}/${l.to.exit}`).join(', ')}. ⛓ A door INSIDE `
                + 'a part is disconnected by that part\'s own op, addressed by room.',
        };
    }
    const gone = links[index];
    return {
        ok: true,
        op,
        record: Object.freeze({
            ...record,
            world: { ...record.world, links: links.filter((_, i) => i !== index) },
        }),
        description: `world: disconnect ${gone.from.part}/${gone.from.room}/${gone.from.exit} → `
            + `${gone.to.part}/${gone.to.room}/${gone.to.exit}`,
    };
}

/** The world's own fields — everything else about a world is a part's. */
export const WORLD_FIELDS = Object.freeze(['name', 'description']);

function worldSetField(record, op) {
    if (!WORLD_FIELDS.includes(op.path)) {
        return {
            ok: false,
            description: `world: \`set-field\` may write ${WORLD_FIELDS.join(', ')} on the world `
                + `itself, not ${JSON.stringify(op.path)}. ⛓ A field of a PART is written by `
                + 'naming it: `{op:\'set-field\', part, path, value}`. ⛔ `world_id` is STAMPED at '
                + 'download, not set.',
        };
    }
    if (typeof op.value !== 'string') {
        return { ok: false, description: `world: \`${op.path}\` must be a string` };
    }
    return {
        ok: true,
        op,
        record: Object.freeze({ ...record, world: { ...record.world, [op.path]: op.value } }),
        description: `world: set ${op.path}`,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ADAPTER
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} o
 * @param {Array<object>} o.parts each `{id, kind?, adapter, recordOf(doc, overlay),
 *   splitRecord(record) => {doc, overlay}, readSetCell, exitsOfRoom, whatLinksHere,
 *   bounds, isRefusal, opKinds?, substrateOfRoom?, validateForDownload?,
 *   closeRoomSession?, deriveAtlasOf?, regionIdOfRoom?}`
 */
export function createWorldSetAdapter({ parts = [] } = {}) {
    assertParts(parts);
    /**
     * ⛓⛓ **THE ROSTER IS THE UNION OF THE PARTS' OWN VOCABULARIES**, derived —
     * never a list typed here, which would decay the first time a substrate
     * grew a thirteenth op ([[reference_seedling_arc_traps]] 574).
     */
    const opKindsOf = (part) => part.opKinds ?? part.adapter.SET_OP_KINDS ?? [];
    const kinds = [...new Set([
        ...parts.flatMap((p) => opKindsOf(p)),
        ...WORLD_ONLY_OP_KINDS,
        ...PART_ADDRESSED_OP_KINDS,
    ])].sort();

    const refuse = (description) => ({ ok: false, description });

    return Object.freeze({
        name: 'world-set',
        SET_OP_KINDS: Object.freeze(kinds),
        parts: Object.freeze(parts.map((p) => p.id)),

        apply(record, op) {
            const kind = op?.op;
            try {
                if (!kinds.includes(kind)) {
                    return refuse(`world: no op "${kind}" — this world's vocabulary is the UNION `
                        + `of its parts' (${parts.map((p) => `"${p.id}": ${opKindsOf(p).join(', ')}`)
                            .join(' | ')}) plus the world's own `
                        + `${[...WORLD_ONLY_OP_KINDS, ...PART_ADDRESSED_OP_KINDS].sort().join(', ')}`);
                }
                /* ── the world's own ops ─────────────────────────────── */
                if (kind === 'connect' && (isWorldEndpoint(op.from) || isWorldEndpoint(op.to))) {
                    if (!isWorldEndpoint(op.from) || !isWorldEndpoint(op.to)) {
                        return refuse('world: a CROSSING names both endpoints as {part, room, '
                            + 'exit}; a door inside one part uses that part\'s own array form '
                            + '[room, exit]. ⛔ Half of each is neither.');
                    }
                    return worldConnect(record, op, parts);
                }
                if (kind === 'disconnect' && isWorldEndpoint(op.from)) {
                    return worldDisconnect(record, op);
                }
                if (kind === 'set-field' && op.part === undefined) return worldSetField(record, op);
                /* ── array-endpoint connect/disconnect: ONE part or refuse ── */
                if (kind === 'connect' && Array.isArray(op.from) && Array.isArray(op.to)) {
                    const from = partAt(record, op.from[0], parts, '`connect`.from');
                    const to = partAt(record, op.to[0], parts, '`connect`.to');
                    if (from.part.id !== to.part.id) {
                        return refuse(`world: \`connect\` joins room ${op.from[0]} of part `
                            + `"${from.part.id}" to room ${op.to[0]} of part "${to.part.id}" in the `
                            + 'ARRAY form, which is a part\'s own op and cannot cross. ⛓ A CROSSING '
                            + 'is `{op:\'connect\', from:{part, room, exit}, to:{part, room, exit}, '
                            + 'one_way}` — an object endpoint, because a world link names the '
                            + 'DERIVED ATLAS exit id while a part\'s own array endpoint spells its '
                            + 'exits its own way (Seedling an ORDINAL, the maze an exit id).');
                    }
                    return forward(record, from, op, {
                        ...op, from: [from.local, op.from[1]], to: [to.local, op.to[1]],
                    }, opKindsOf);
                }
                /* ── part-addressed by NAME ──────────────────────────── */
                if (PART_ADDRESSED_OP_KINDS.includes(kind)) {
                    if (typeof op.part !== 'string') {
                        return refuse(`world: \`${kind}\` is PER PART and must name one — `
                            + `${parts.map((p) => `"${p.id}"`).join(', ')}. ⛓ A ${kind} cannot `
                            + 'cross parts: position is identity inside each one, and a room that '
                            + 'moved between them would change which document it is in.');
                    }
                    const span = partNamed(record, op.part, parts, `\`${kind}\``);
                    const { part: _named, ...inner } = op;
                    return forward(record, span, op, inner, opKindsOf);
                }
                /* ── room-addressed: forward with the index re-based ──── */
                if (Number.isInteger(op.room)) {
                    const span = partAt(record, op.room, parts, `\`${kind}\``);
                    if (op.part !== undefined && op.part !== span.part.id) {
                        return refuse(`world: this \`${kind}\` carries a descriptor from part `
                            + `"${op.part}" and room ${op.room} is in part "${span.part.id}". ⛔ A `
                            + 'PASTE ACROSS PARTS IS REFUSED: the two hold different kinds of '
                            + 'document, so the descriptor\'s own fields would mean something '
                            + 'else on the other side — and law 7 would be writing a room to a '
                            + 'cell the substrate cannot address.');
                    }
                    const { part: _owner, ...rest } = op;
                    return forward(record, span, op, { ...rest, room: span.local }, opKindsOf);
                }
                return refuse(`world: \`${kind}\` names neither a room nor a part — every op that `
                    + 'reaches a room carries `room` (a GLOBAL index), and `add-room`/`reorder` '
                    + 'carry `part`');
            } catch (err) {
                if (isWorldSetRefusal(err)) {
                    return { ok: false, description: err.message, reason: err.name };
                }
                for (const part of parts) {
                    if (part.isRefusal(err)) {
                        return { ok: false, description: `world: part "${part.id}": ${err.message}`, reason: err.name };
                    }
                }
                throw err;
            }
        },

        /**
         * ⛓ BOTH HALVES, CANONICALLY — the WORLD (its manifest, its overlays
         * and its links) and each part's own `equal` over the held document.
         * ⚠ The overlays are compared twice, once here and once inside the
         * part's `equal`, and that is deliberate: they live in the world, so the
         * part's answer is about the DOCUMENT and the world's is about
         * everything a part cannot see.
         */
        equal: (a, b) => canonicalJson(a?.world) === canonicalJson(b?.world)
            && parts.every((part) => part.adapter.equal(partRecordOf(a, part), partRecordOf(b, part))),

        bounds: (record) => worldBounds(record, parts),
        readCell: (record, x, y) => readWorldCell(record, x, y, parts),
        writeOps: (desc, x, y) => worldWriteOps(desc, x, y, parts),
    });
}

/** ⛓ A world record from its two halves, refused by name when it is not one. */
export function worldRecord(world, docs) {
    assertWorld(world, { docs: docs ?? {} });
    return Object.freeze({ world, parts: docs });
}

/**
 * ⛓ The readers `setEditorCore.roomRowsOf` and `reportOver` take, bound to one
 * part list — so a page hands the core the same four functions it hands it for
 * a single-substrate session.
 */
export function worldAdapterFns(parts) {
    assertParts(parts);
    return Object.freeze({
        bounds: (record) => worldBounds(record, parts),
        readSetCell: (record, x, y) => readWorldCell(record, x, y, parts),
        exitsOfRoom: (record, room) => exitsOfWorldRoom(record, room, parts),
        whatLinksHere: (record, room) => whatLinksHereInWorld(record, room, parts),
        isRefusal: (e) => isWorldSetRefusal(e) || parts.some((p) => p.isRefusal(e)),
    });
}

/**
 * ⛓⛓ **THE DOWNLOAD CHECK — EVERY PART'S OWN VALIDATOR, PLUS THE LINKS.**
 *
 * ⛔ Each part's `validateForDownload` takes a SESSION, and all it asks of one
 * is `record()`. A world hands it `{record: () => <that part's record>}` rather
 * than a second validator: the sentence a reader gets has to be the substrate's
 * own, and a world that re-derived "is this level set valid" would be a second
 * answer to a question `validateLevelSet` already owns.
 */
export function validateWorldForDownload(session, parts) {
    assertParts(parts);
    const record = typeof session?.record === 'function' ? session.record() : session;
    const errors = [];
    const warnings = [];
    const byPart = {};
    for (const span of partSpans(record, parts)) {
        const { part } = span;
        if (typeof part.validateForDownload !== 'function') continue;
        const check = part.validateForDownload({ record: () => span.record });
        byPart[part.id] = check;
        for (const e of check.errors ?? []) errors.push(`part "${part.id}": ${e}`);
        for (const w of check.warnings ?? []) warnings.push(`part "${part.id}": ${w}`);
    }
    errors.push(...linksErrors(record.world?.links, {
        partIds: partIdsOf(record.world),
        roomCounts: Object.fromEntries(partSpans(record, parts).map((s) => [s.part.id, s.count])),
    }));
    return {
        ok: errors.length === 0,
        errors,
        warnings,
        parts: byPart,
        world_id: record.world?.world_id ?? null,
    };
}
