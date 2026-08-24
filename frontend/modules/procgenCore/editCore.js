/**
 * procgenCore/editCore — **THE SUBSTRATE-AGNOSTIC EDIT CORE.**
 *
 * EDITOR v3 arc, slice A1 (`NewDocs/plans/seedling-editor-v3.md` §7.2, §8.1).
 * ⛔ PURE: no DOM, no node, and — like every shipping module of this directory
 * — **no substrate import at all** (`bindingContract.test.js`'s own scan is what
 * holds that, and this file is in its subject). Its own test drives a TOY
 * adapter written in the test file, because a core proven only against the maze
 * would be a maze editor with an extra indirection.
 *
 * ── ⛔⛔ THE TWO LAWS ─────────────────────────────────────────────────
 *
 * **(a) IDENTITY = `base` + `ops`.** An edited level is *the base, then the
 * ops, in order*, and `foldEdits` is the ONE reconstruction of it. UNDO is that
 * same fold over a SHORTER LIST — never an inverse op and never a stack of
 * records. This is `seedlingDemo/watchEdit.js`'s law, adopted whole: a level
 * reached by undoing is byte-identical to a level that never had the popped
 * edit, which a stack can only be if nothing else ever touched the record.
 * (The maze's `mazeLab.undoEdit` IS a stack pop today; `mazeEditAdapter.test.js`
 * pins that the two agree, so A2 can replace one with the other.)
 *
 * **(b) A NO-OP IS NOT AN EDIT** (trap 263). The question is asked of the
 * RECORD — *did it change?* — through the adapter's own `equal`, never of the
 * op and never of the adapter's descriptor. `MazeRoomEditor._setTile` returns
 * `ok: true, type: 'tile'` for a click on a cell that already holds that tile;
 * a core that trusted that would bump the edit count and drop the CERTIFICATION
 * for a press that moved no bytes.
 *
 * ⛔ AND NOTHING HERE ADJUDICATES LEGALITY. Free means free; certification is
 * the guard. A refusal in this file is always about the SHAPE of an op or an
 * adapter (an unknown member, a nested group, an out-of-bounds rectangle) —
 * never about whether the level that results is any good, which is the oracle's
 * question and the adapter's `apply` is where the substrate's own rules live.
 *
 * ── ⛓ WHAT AN ADAPTER IS ─────────────────────────────────────────────
 *
 * A plain object the CALLER passes in — the core never registers, discovers or
 * imports one:
 *
 * ```
 * {
 *   name:     'toy' | 'maze' | …,          // what a refusal calls the substrate
 *   apply:    (record, op) => {ok, op, description, record?},
 *   equal:    (a, b) => boolean,
 *   bounds:   (record) => {w, h},
 *   readCell: (record, x, y) => descriptor,
 *   writeOps: (descriptor, x, y) => op[],
 * }
 * ```
 *
 *  · **`apply`** applies ONE ATOMIC op and returns the RESOLVED op (every
 *    drawn parameter spent — the maze's `setButton index` law, and the same one
 *    a recorded directive follows). `ok: false` is a refusal BY NAME in
 *    `description`; `record` is then unread. ⛔ On success `record` is the NEW
 *    record and the input is NEVER mutated — the core hands the same record to
 *    two calls (a group's dry run and its commit are the same walk, but
 *    `rectCopy` and a caller's own reader both hold one).
 *  · **`equal`** is law (b)'s comparison, and it is the adapter's because
 *    "did the record change" is a question about a shape only the substrate
 *    knows. ⛔ There must be exactly ONE spelling of it per substrate — the
 *    maze's is `procgenMaze.worldsEqual`, which `mazeLab.applyEdit` calls too.
 *  · **`readCell` / `writeOps`** are inverses over a CELL DESCRIPTOR: a closed,
 *    comparable, JSON-stringifiable value. `writeOps` emits the atomic ops that
 *    make (x, y) look like the descriptor — and it emits ops only for the
 *    fields the descriptor PRESENTS, which is what makes `tilesOnly` /
 *    `entitiesOnly` a filter on the descriptor rather than a second op set.
 *
 * ── ⛓ THE GROUP ──────────────────────────────────────────────────────
 *
 * `{op: 'group', label, ops: [...]}` — a stroke, a fill, a paste. Applied
 * ALL-OR-NOTHING (a refused member refuses the whole group and leaves the
 * record untouched), ONE entry in the op list, ONE undo. ⛔ **NESTED GROUPS ARE
 * REFUSED BY NAME**: a stroke is FLAT. Nesting would make "one undo" ambiguous
 * (does undo pop the outer group or the inner one?) and would let a paste of a
 * paste carry a tree into a payload a person is supposed to be able to read —
 * and the one thing a group buys is that a reader can count the undos.
 */

import { reachableFrom } from './gridFlood.js';

export class EditCoreError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EditCoreError';
    }
}

const fail = (message) => { throw new EditCoreError(message); };

/** ⛓ THE GROUP'S OP NAME, exported so an adapter can refuse it as an ATOMIC op
 *  (the core intercepts a group before the adapter ever sees one). */
export const GROUP_OP = 'group';

/** ⛓ THE ADAPTER'S MEMBERS AND THEIR TYPES, as data — `assertAdapter` refuses
 *  from THIS rather than from a hand-written chain, so a seventh member cannot
 *  arrive in the contract and not in the check. */
export const ADAPTER_MEMBERS = Object.freeze({
    name: 'string',
    apply: 'function',
    equal: 'function',
    bounds: 'function',
    readCell: 'function',
    writeOps: 'function',
});

/**
 * ⛓ REFUSE A MISSING OR MIS-TYPED ADAPTER MEMBER **BY NAME**, before anything
 * folds. ⛔ Not a nicety: every other refusal in this file quotes
 * `adapter.name`, so an adapter without one produces refusals that say
 * `undefined` about a substrate the reader is trying to identify.
 */
export function assertAdapter(adapter) {
    if (!adapter || typeof adapter !== 'object') {
        fail(`editCore: an adapter must be an object, got ${JSON.stringify(adapter)}. It is `
            + `the CALLER's — the core registers none and imports none, which is what keeps `
            + 'it substrate-agnostic.');
    }
    for (const [member, type] of Object.entries(ADAPTER_MEMBERS)) {
        // eslint-disable-next-line valid-typeof
        if (typeof adapter[member] !== type) {
            fail(`editCore: adapter member \`${member}\` must be a ${type}, got `
                + `${typeof adapter[member]}. The contract is `
                + `{${Object.keys(ADAPTER_MEMBERS).join(', ')}}.`);
        }
    }
    if (adapter.name === '') {
        fail('editCore: adapter member `name` must be a NON-EMPTY string — every refusal in '
            + 'this file quotes it, and an empty one makes them say nothing about which '
            + 'substrate refused.');
    }
    return adapter;
}

/* ══════════════════════════════════════════════════════════════════════
 * CANONICAL COMPARISON OF CELL DESCRIPTORS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ A DESCRIPTOR AS CANONICAL TEXT — keys SORTED at every depth.
 *
 * ⛔ `JSON.stringify` alone is not an equality on descriptors: `{tile:'a',
 * entity:null}` and `{entity:null, tile:'a'}` are the same cell and different
 * strings, and an adapter that built its descriptor with a spread would produce
 * whichever order its source object happened to have. A flood keyed on that
 * would paint a component that stopped at the first cell whose descriptor was
 * assembled differently — a defect with no visible cause.
 */
export function canonicalJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

/** ⛓ Two cell descriptors name the same cell. */
export const sameCell = (a, b) => canonicalJson(a) === canonicalJson(b);

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE GROUP, AND THE ONE APPLICATION PATH
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ BUILD A GROUP. `label` is what a readout prints; the core never interprets
 * it. ⛔ A group of ZERO ops is refused here rather than folded to a no-op: an
 * empty stroke is a caller defect (a rectangle with no cells, a flood from an
 * out-of-bounds seed), and a silent empty group in a payload is an edit a
 * reader cannot tell from one whose members all did nothing.
 */
export function group(label, ops) {
    if (typeof label !== 'string' || label === '') {
        fail(`editCore: a group needs a non-empty label, got ${JSON.stringify(label)} — it is `
            + 'the one line a readout has for a stroke that swallowed N ops.');
    }
    if (!Array.isArray(ops) || ops.length === 0) {
        fail(`editCore: group ${JSON.stringify(label)} carries ${Array.isArray(ops)
            ? 'no ops' : JSON.stringify(ops)}. An EMPTY group is refused rather than folded `
            + 'to a no-op: it is a caller defect (an empty rectangle, a seed off the grid), '
            + 'and in a payload it is indistinguishable from a stroke whose members all did '
            + 'nothing.');
    }
    return Object.freeze({ op: GROUP_OP, label, ops: Object.freeze([...ops]) });
}

export const isGroup = (op) => !!op && op.op === GROUP_OP;

/**
 * ⛓⛓⛓ **APPLY ONE OP — THE ONE APPLICATION PATH**, and the only place that
 * knows a group from an atomic op. Everything else in this file (the fold, the
 * session, a caller's replay) goes through here, so a defect in the group's
 * atomicity is one defect and not one per caller.
 *
 * @returns {{ok: boolean, op?: object, record?: object, description: string}}
 *   — on success the RESOLVED op (a group's members resolved too) and the new
 *   record; on refusal the adapter's own sentence, and the record the caller
 *   already holds is still the current one.
 */
export function applyOne(adapter, record, op, { depth = 0 } = {}) {
    if (!isGroup(op)) {
        const res = adapter.apply(record, op);
        if (!res || typeof res.ok !== 'boolean') {
            fail(`editCore: ${adapter.name}.apply returned ${JSON.stringify(res)} — the `
                + 'contract is `{ok, op, description, record?}`, and a missing `ok` reads as '
                + 'a refusal to every caller that checks it.');
        }
        return res;
    }
    /**
     * ⛔⛔ NESTED GROUPS ARE REFUSED BY NAME — see the file docblock. This is a
     * REFUSAL (`ok:false`) rather than a throw so that a group built by a
     * caller from a clip that already held one dies where every other bad
     * member dies, with the same sentence shape.
     */
    if (depth > 0) {
        return {
            ok: false,
            description: `editCore: group ${JSON.stringify(op.label)} contains a NESTED group `
                + `(${JSON.stringify(op.ops?.[0]?.label ?? '?')}). A stroke is FLAT: nesting `
                + 'makes "one group is one undo" ambiguous — undo would have to choose '
                + 'between the outer stroke and the inner one — and it puts a tree in a '
                + 'payload whose whole promise is that a person can count the edits in it.',
        };
    }
    if (!Array.isArray(op.ops) || op.ops.length === 0) {
        return {
            ok: false,
            description: `editCore: group ${JSON.stringify(op.label)} carries no ops.`,
        };
    }
    /**
     * ⛓⛓ ALL-OR-NOTHING, and it costs nothing to be honest about it: the walk
     * runs on its own chain of records and the caller's `record` is only
     * replaced once every member has said yes. A group that committed its first
     * three members and then refused would leave a level nobody asked for and
     * an op list that could not reconstruct it.
     */
    let working = record;
    const resolved = [];
    for (let i = 0; i < op.ops.length; i += 1) {
        const res = applyOne(adapter, working, op.ops[i], { depth: depth + 1 });
        if (!res.ok) {
            return {
                ok: false,
                description: `editCore: member #${i + 1} of group ${JSON.stringify(op.label)} `
                    + `(${op.ops.length} ops) was REFUSED, so the WHOLE group is refused and `
                    + `the record is unchanged — ${res.description}`,
            };
        }
        working = res.record;
        resolved.push(res.op ?? op.ops[i]);
    }
    return {
        ok: true,
        op: Object.freeze({ op: GROUP_OP, label: op.label, ops: Object.freeze(resolved) }),
        record: working,
        description: `${op.label} (${resolved.length} op(s))`,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ONE RECONSTRUCTION
 * ══════════════════════════════════════════════════════════════════════ */

const opLabel = (op) => (isGroup(op)
    ? `group ${JSON.stringify(op.label)} of ${op.ops?.length ?? 0}`
    : `${op?.op}${Number.isInteger(op?.x) && Number.isInteger(op?.y) ? ` at (${op.x},${op.y})` : ''}`);

/**
 * ⛓⛓⛓ **BASE + OPS → RECORD** — law (a)'s one reconstruction. The session's
 * `record()`, its UNDO, a payload replay and a page's `?gen=` all land here, so
 * there is one answer to *what does this edit list mean*.
 *
 * ⚠ **A REFUSED OP IS A THROW, NOT A SKIP** — the maze's law, carried whole
 * (`mazeLab.applyEdits`): a fold that silently dropped an edit would report a
 * level difference whose real cause is three lines further up. The message
 * names the INDEX and quotes the adapter's own sentence.
 *
 * ⚠ AND A NO-OP IS DROPPED FROM `applied` **AND REPORTED** (law (b)). Dropped,
 * because an op that moved no bytes is not part of the identity; reported,
 * because a payload whose list is longer than the fold's is a fact its reader
 * wants — `agreementWithPayload` naming `edits` for it is the honest reading,
 * not a false alarm.
 *
 * @returns {{record, applied: object[], dropped: Array<{index, op, description}>}}
 */
export function foldEdits(adapter, base, ops) {
    assertAdapter(adapter);
    let record = base;
    const applied = [];
    const dropped = [];
    (ops ?? []).forEach((op, i) => {
        const res = applyOne(adapter, record, op);
        if (!res.ok) {
            fail(`editCore: op #${i + 1} (${opLabel(op)}) of this ${adapter.name} edit list `
                + `was REFUSED on the fold: ${res.description} ⛔ A fold that SKIPPED it `
                + 'would reconstruct a different level and report the difference somewhere '
                + 'else entirely.');
        }
        if (adapter.equal(record, res.record)) {
            dropped.push(Object.freeze({
                index: i, op: res.op ?? op, description: res.description,
            }));
            return;
        }
        record = res.record;
        applied.push(res.op ?? op);
    });
    return Object.freeze({
        record, applied: Object.freeze(applied), dropped: Object.freeze(dropped),
    });
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SESSION
 * ══════════════════════════════════════════════════════════════════════ */

const CERTIFIED_VALUES = Object.freeze([null, true, false]);

/**
 * ⛓⛓⛓ **AN EDIT SESSION — `baseRecord` + the op list, and nothing else is
 * state.**
 *
 * ⚠ **TWO BASES, AND THEY ARE TWO THINGS.** §7.2 spelled this
 * `createEditSession(adapter, base)`; the core needs both halves and they
 * cannot be one value:
 *
 *   · `baseRecord` — the RECORD the fold starts from. The core reads it (it is
 *     `foldEdits`' first argument) and nothing else.
 *   · `base` — the OPAQUE TAGGED VALUE the payload carries (`{kind, …}`:
 *     Seedling's four are `generate` / `atlas` / `oel` / `set-room`, §3.2).
 *     ⛔ **The core never interprets it** — resolving a tag to a record is the
 *     adapter's business and A1 has no `bases` member, so a session is opened
 *     on a record somebody else already resolved.
 *
 * ⛓ `certified` is the tri-state `labProtocol` already spells: `null` is
 * *nobody has asked*, `false` is *the oracle said no*. ⛔ **EXACTLY ONE `false`
 * SITE** — `setCertified(false)`, from an oracle verdict — and every APPLIED op
 * and every UNDO puts it back to `null`, because an edit does not make the
 * oracle say no, it makes nobody have asked.
 *
 * ⚠ A REFUSED op and a NO-OP leave `certified` ALONE. A refusal is not a
 * modification, and a click that changed nothing is not an edit — dropping a
 * certification for either would be a readout announcing a fact that did not
 * happen (⚖ the maze's §3.8, trap 263).
 */
export function createEditSession(adapter, baseRecord, { base = null, certified = null } = {}) {
    assertAdapter(adapter);
    if (!CERTIFIED_VALUES.includes(certified)) {
        fail(`editCore: certified must be true, false or null — got `
            + `${JSON.stringify(certified)}.`);
    }
    let ops = Object.freeze([]);
    let record = baseRecord;
    let cert = certified;

    const refold = () => {
        const out = foldEdits(adapter, baseRecord, ops);
        record = out.record;
        return out;
    };

    const session = {
        /**
         * ⛓ ONE OP. ⛔ Three outcomes and they are told apart by NAME, because
         * a page prints a different sentence for each:
         *   `{ok:false}`          the adapter refused — nothing moved;
         *   `{ok:true, applied:false}` the record did not change — not an edit;
         *   `{ok:true, applied:true}`  the op list grew by one.
         */
        apply(op) {
            const res = applyOne(adapter, record, op);
            if (!res.ok) {
                return Object.freeze({ ok: false, applied: false, description: res.description });
            }
            if (adapter.equal(record, res.record)) {
                return Object.freeze({
                    ok: true,
                    applied: false,
                    op: res.op ?? op,
                    description: res.description,
                });
            }
            record = res.record;
            ops = Object.freeze([...ops, res.op ?? op]);
            cert = null;
            return Object.freeze({
                ok: true, applied: true, op: res.op ?? op, description: res.description,
            });
        },

        /**
         * ⛓⛓ UNDO IS THE FOLD OVER A SHORTER LIST — law (a). ⛔ Not a stack
         * pop: the record after an undo is the record a session that never had
         * that op would hold, byte for byte, and a stack can only promise that
         * if nothing but `apply` ever wrote the record.
         *
         * ⚠ A GROUP IS ONE ENTRY, so undoing a stroke removes the whole stroke.
         * ⚠ At ZERO ops it returns `false` and changes nothing, so a page can
         * call it unconditionally and a readout cannot claim an undo that did
         * not happen.
         */
        undo() {
            if (ops.length === 0) return false;
            ops = Object.freeze(ops.slice(0, -1));
            refold();
            cert = null;
            return true;
        },

        ops: () => ops,
        record: () => record,
        get certified() { return cert; },

        /** ⛓ THE ONE `false` SITE. An oracle verdict, and nothing else. */
        setCertified(v) {
            if (!CERTIFIED_VALUES.includes(v)) {
                fail(`editCore: setCertified takes true, false or null — got `
                    + `${JSON.stringify(v)}. \`null\` means NOBODY HAS ASKED and \`false\` `
                    + 'means the ORACLE SAID NO; a page that collapsed the two would report '
                    + 'an uncertified level as a refused one.');
            }
            cert = v;
            return cert;
        },

        /** ⛓ IDENTITY, AS DATA. ⛔ `base` verbatim — the core never reads it. */
        payload: () => Object.freeze({ base, edits: ops, certified: cert }),
    };
    return session;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ RECTANGLE COPY / PASTE
 * ══════════════════════════════════════════════════════════════════════ */

const assertBounds = (adapter, record) => {
    const b = adapter.bounds(record);
    if (!b || !Number.isInteger(b.w) || !Number.isInteger(b.h) || b.w <= 0 || b.h <= 0) {
        fail(`editCore: ${adapter.name}.bounds returned ${JSON.stringify(b)} — it must be `
            + '`{w, h}` with positive integers.');
    }
    return b;
};

/**
 * ⛓ A RECTANGLE OF CELL DESCRIPTORS. Row-major: `cells[dy][dx]`.
 *
 * ⛔ AN OUT-OF-BOUNDS RECTANGLE IS REFUSED BY NAME rather than clipped, and
 * that asymmetry with PASTE is deliberate: a copy whose rectangle ran off the
 * grid would silently produce a clip of a size the caller did not ask for, and
 * every paste of it would then be off by the amount that was trimmed. A PASTE
 * clips because the destination is where a person is pointing and the edge is a
 * fact about the destination, not about what they copied.
 */
export function rectCopy(adapter, record, { x, y, w, h }) {
    assertAdapter(adapter);
    const b = assertBounds(adapter, record);
    for (const [n, v] of [['w', w], ['h', h]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`editCore: rectCopy ${n} must be a positive integer, got ${JSON.stringify(v)}.`);
        }
    }
    if (!Number.isInteger(x) || !Number.isInteger(y)
        || x < 0 || y < 0 || x + w > b.w || y + h > b.h) {
        fail(`editCore: rectCopy names ${w}x${h} at (${x},${y}), which runs off the `
            + `${b.w}x${b.h} ${adapter.name} grid. ⛔ It refuses rather than CLIPPING: a clip `
            + 'silently smaller than the rectangle asked for would put every later paste of '
            + 'it off by the amount that was trimmed.');
    }
    const cells = [];
    for (let dy = 0; dy < h; dy += 1) {
        const row = [];
        for (let dx = 0; dx < w; dx += 1) row.push(adapter.readCell(record, x + dx, y + dy));
        cells.push(Object.freeze(row));
    }
    return Object.freeze({ w, h, cells: Object.freeze(cells) });
}

/**
 * ⛓ THE DESCRIPTOR A FILTER LEAVES. ⛔ `tilesOnly` / `entitiesOnly` are
 * expressed on the DESCRIPTOR — the adapter's own shape — and NOT as a second
 * op vocabulary, so a substrate whose cells carry three layers gets three
 * filters for free the day its descriptor does.
 *
 * ⛔⛔ AND A DESCRIPTOR WITHOUT THE FIELD REFUSES BY NAME rather than passing
 * the filter through. "Paste tiles only" onto cells that have no `tile` is a
 * request the substrate cannot mean; ignoring it would paste the ENTITIES too
 * and call it a tiles-only paste (⚠ trap 594's family — a flag you do not
 * implement must be refused, not accepted and dropped).
 */
const filterDescriptor = (adapter, desc, { tilesOnly, entitiesOnly }) => {
    if (!tilesOnly && !entitiesOnly) return desc;
    const field = tilesOnly ? 'tile' : 'entity';
    if (!desc || typeof desc !== 'object' || !Object.prototype.hasOwnProperty.call(desc, field)) {
        fail(`editCore: ${tilesOnly ? 'tilesOnly' : 'entitiesOnly'} was asked of a `
            + `${adapter.name} clip whose cell descriptor is ${JSON.stringify(desc)} — it has `
            + `no \`${field}\` field, so the split does not exist on this substrate. ⛔ `
            + 'Refused rather than ignored: a filter that was silently dropped would paste '
            + 'everything and still be called a filtered paste.');
    }
    return { [field]: desc[field] };
};

/**
 * ⛓⛓ A CLIP → A **GROUP** OF THE ADAPTER'S OWN WRITE OPS, clipped to the
 * destination's bounds.
 *
 * ⚠ `record` IS AN ARGUMENT THOUGH §7.2's signature had none: the bounds are a
 * fact about the record being pasted INTO, and a paste that could not ask for
 * them could only refuse an off-grid destination or write off the end.
 */
export function rectPasteOps(adapter, record, clip, x, y, {
    tilesOnly = false, entitiesOnly = false, label = null,
} = {}) {
    assertAdapter(adapter);
    if (tilesOnly && entitiesOnly) {
        fail('editCore: rectPasteOps was asked for tilesOnly AND entitiesOnly — that is the '
            + 'whole clip with two filters that cancel, and a caller that meant "everything" '
            + 'should ask for neither.');
    }
    if (!clip || !Number.isInteger(clip.w) || !Number.isInteger(clip.h)
        || !Array.isArray(clip.cells)) {
        fail(`editCore: rectPasteOps needs a clip from rectCopy (\`{w, h, cells}\`), got `
            + `${JSON.stringify(clip)}.`);
    }
    const b = assertBounds(adapter, record);
    const ops = [];
    let clipped = 0;
    for (let dy = 0; dy < clip.h; dy += 1) {
        for (let dx = 0; dx < clip.w; dx += 1) {
            const tx = x + dx;
            const ty = y + dy;
            if (tx < 0 || ty < 0 || tx >= b.w || ty >= b.h) { clipped += 1; continue; }
            const desc = filterDescriptor(adapter, clip.cells[dy][dx], { tilesOnly, entitiesOnly });
            const cellOps = adapter.writeOps(desc, tx, ty);
            if (!Array.isArray(cellOps)) {
                fail(`editCore: ${adapter.name}.writeOps returned ${JSON.stringify(cellOps)} `
                    + 'for a cell — it must be an ARRAY of atomic ops (possibly empty).');
            }
            ops.push(...cellOps);
        }
    }
    if (ops.length === 0) {
        fail(`editCore: rectPasteOps of a ${clip.w}x${clip.h} clip at (${x},${y}) produced NO `
            + `ops — every cell fell outside the ${b.w}x${b.h} ${adapter.name} grid `
            + `(${clipped} clipped). ⛔ An empty group is refused (see \`group\`), and a `
            + 'paste that landed entirely off the level is a caller defect, not a stroke '
            + 'whose members all did nothing.');
    }
    const what = tilesOnly ? ' tiles' : (entitiesOnly ? ' entities' : '');
    return group(label ?? `paste${what} ${clip.w}x${clip.h} at (${x},${y})`, ops);
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ FLOOD
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **THE 4-CONNECTED COMPONENT OF CELLS THAT LOOK LIKE THE SEED, REPAINTED**
 * — one group.
 *
 * ⛔ THE WALK IS `gridFlood.reachableFrom` AND NOT A SECOND FLOOD. ⚖ The
 * one-of-everything law this directory exists to keep: a private BFS here would
 * be a fourth spelling of 4-connectivity, and the day one of them grew a
 * diagonal or a bounds fix the editor's fill and the generator's connectivity
 * pre-check would disagree while both claimed to be "the flood".
 *
 * ⚠ 4-NEIGHBOUR, and `gridFlood`'s docblock is where that is argued: neither
 * substrate lets a mover cross a corner diagonally, so a diagonal-only
 * neighbour is a DIFFERENT component and is not painted.
 *
 * ⚠ THE MEMBERSHIP TEST IS THE WHOLE DESCRIPTOR, canonically compared — not
 * just its `tile`. A fill on a floor cell holding an item does not swallow the
 * bare floor beside it, because those two cells do not look alike, and the
 * alternative (comparing one field the core picked) would be the core inventing
 * a substrate's notion of sameness.
 *
 * ⛓ The seed cell itself is always in the component, so a flood is never empty
 * — but its ops may all be no-ops (repainting a component with what it already
 * holds), which the fold drops by law (b) exactly as it drops any other.
 */
export function floodOps(adapter, record, x, y, targetDescriptor, { label = null } = {}) {
    assertAdapter(adapter);
    const b = assertBounds(adapter, record);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= b.w || y >= b.h) {
        fail(`editCore: floodOps seeds at (${x},${y}), which is off the ${b.w}x${b.h} `
            + `${adapter.name} grid.`);
    }
    const seed = canonicalJson(adapter.readCell(record, x, y));
    const component = reachableFrom(
        b.w, b.h,
        (cx, cy) => canonicalJson(adapter.readCell(record, cx, cy)) === seed,
        { x, y },
    );
    const ops = [];
    // ⛓ SORTED by (y, x) so two runs of one flood emit one op order — the same
    // reason `serializeMazeLevel` sorts its overlays. `reachableFrom` returns a
    // Set in BFS order, which is deterministic but is the WALK's order, and a
    // payload a person reads should be in the grid's.
    const keys = [...component].map((k) => k.split(',').map(Number))
        .sort((p, q) => (p[1] - q[1]) || (p[0] - q[0]));
    for (const [cx, cy] of keys) {
        const cellOps = adapter.writeOps(targetDescriptor, cx, cy);
        if (!Array.isArray(cellOps)) {
            fail(`editCore: ${adapter.name}.writeOps returned ${JSON.stringify(cellOps)} for a `
                + 'cell — it must be an ARRAY of atomic ops (possibly empty).');
        }
        ops.push(...cellOps);
    }
    if (ops.length === 0) {
        fail(`editCore: floodOps at (${x},${y}) produced NO ops over a ${keys.length}-cell `
            + `component — ${adapter.name}.writeOps emitted nothing for the target descriptor `
            + `${JSON.stringify(targetDescriptor)}.`);
    }
    return group(label ?? `flood (${x},${y}) — ${keys.length} cell(s)`, ops);
}

/* ══════════════════════════════════════════════════════════════════════
 * THE READOUT
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE ONE LINE A READOUT PRINTS — *"3 edit(s) (1 group of 12)"*.
 *
 * ⛔ The count is of TOP-LEVEL ops, because that is what UNDO is a count of: a
 * page that said "14 edits" for a list holding one stroke would be describing a
 * history with fourteen presses in it, and thirteen of them cannot be undone.
 * The group sizes ride in the parenthesis so the number of writes is visible
 * without being the count.
 */
export function describeOps(ops) {
    const list = ops ?? [];
    const sizes = list.filter(isGroup).map((g) => g.ops?.length ?? 0);
    const head = `${list.length} edit(s)`;
    if (sizes.length === 0) return head;
    const noun = sizes.length === 1 ? 'group' : 'groups';
    return `${head} (${sizes.length} ${noun} of ${sizes.join(', ')})`;
}
