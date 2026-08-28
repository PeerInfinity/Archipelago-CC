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
 *   apply:    (record, op) => {ok, op, description, record?, value?, reason?},
 *   equal:    (a, b) => boolean,
 *   // ⛓ THE CELL-SPACE TRIO — ALL THREE OR NONE (EDITOR INTEGRATION B-b):
 *   bounds:   (record) => {w, h},
 *   readCell: (record, x, y) => descriptor,
 *   writeOps: (descriptor, x, y) => op[],
 * }
 * ```
 *
 *  · **THE TRIO IS OPTIONAL AS A UNIT.** A substrate whose document is not a
 *    grid of cells — bounce edits platforms in FLOAT pixel space, the APWorld
 *    editor has no canvas — declares `{name, apply, equal}` and nothing else,
 *    and `rectCopy` / `rectPasteOps` / `floodOps` / `descriptorFieldsOf` /
 *    `mountEditorView` then refuse it BY NAME. See `CELL_SPACE_MEMBERS`.
 *
 *  · **`apply`** applies ONE ATOMIC op and returns the RESOLVED op (every
 *    drawn parameter spent — the maze's `setButton index` law, and the same one
 *    a recorded directive follows). `ok: false` is a refusal BY NAME in
 *    `description`; `record` is then unread. ⛓ **`reason` is OPTIONAL and it
 *    is a CLASS, not a sentence** (EDITOR v3 E6a, §33.12 #1): a substrate that
 *    tells its refusal classes apart may name the one this refusal is —
 *    Seedling's `SeedlingSetDeriveRefusal` for "this set cannot be derived as
 *    it stands", say — so a page can BRANCH without parsing `description`. The
 *    core carries it and never invents one: an adapter that gives no `reason`
 *    produces a result with no `reason` key at all, so `'reason' in res` means
 *    the substrate answered rather than that the core guessed. ⛔ On success `record` is the NEW
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
 * ⛓⛓⛓ **THE CELL-SPACE TRIO — ALL THREE OR NONE** (EDITOR INTEGRATION B-b,
 * plan §3.1's widening).
 *
 * `bounds` / `readCell` / `writeOps` are the three members that only mean
 * anything on a substrate whose document is a GRID OF CELLS. Two of the five
 * editors §3.1 measured have no such grid at all: the bounce region editor's
 * platforms live in FLOAT pixel space (`editorView.js` discards a non-integer
 * cell by name) and the APWorld editor edits a `rules.json` with no canvas.
 * Forcing them to declare the trio would mean three members whose whole body
 * is an apology — the shape a reader mistakes for a mechanism.
 *
 * ⛔⛔ **THE TRIO IS ALL-OR-NOTHING, AND A PARTIAL ONE IS A MIS-TYPED ADAPTER
 * RATHER THAN A CELL-LESS ONE.** An adapter with `bounds` and no `readCell`
 * has a size for a space it cannot read, and every caller that branches on
 * "does this substrate have cells" would answer differently depending on which
 * member it happened to ask. `assertAdapter` refuses it BY NAME, in the same
 * sentence shape a missing required member gets, so the existing
 * `it.each(Object.keys(ADAPTER_MEMBERS))` row keeps biting on all six.
 *
 * ⚠ IT IS A LIST OVER `ADAPTER_MEMBERS`, NOT A SECOND TABLE. The types stay
 * in the one map; this names which of its keys travel together. A trio member
 * that vanished from `ADAPTER_MEMBERS` would be a name here with no type, and
 * the assert below says so rather than skipping it.
 */
export const CELL_SPACE_MEMBERS = Object.freeze(['bounds', 'readCell', 'writeOps']);

/**
 * ⛓⛓ **WHICH OF `assertAdapterBehaviour`'s SEVEN LAWS ARE CELL-SPACE LAWS** —
 * as data, because the skip lines and the guard that emits them must not be
 * able to disagree about how many there are.
 *
 * ⛔ THREE, not one. §3.1's widening paragraph says *"runs laws 1–6 and skips
 * 7"*, and the code overturns it: law 1 asks `bounds`, law 6 asks `writeOps`
 * and law 7 asks the pair. What a cell-less adapter CAN be asked is laws 2–5,
 * which are the four a session folds on.
 */
export const CELL_SPACE_LAWS = Object.freeze([
    Object.freeze({ n: 1, member: 'bounds', what: 'positive integer {w, h}' }),
    Object.freeze({ n: 6, member: 'writeOps', what: 'returns an ARRAY of ops' }),
    Object.freeze({ n: 7, member: 'readCell', what: 'readCell → writeOps → readCell at another cell' }),
]);

/**
 * ⛓ **DOES THIS ADAPTER DECLARE A CELL SPACE?** — the one predicate every
 * cell-space caller in this file (and `editorView`'s mount) asks.
 *
 * ⛔ `every`, never `some`: a partial trio is refused by `assertAdapter`, and
 * this predicate must agree with that refusal rather than answer "yes" for an
 * adapter one of whose three members is missing. It is deliberately usable on
 * an object `assertAdapter` has NOT seen, because that is how a caller asks
 * the question before it has an adapter to trust.
 */
export function hasCellSpace(adapter) {
    return CELL_SPACE_MEMBERS.every((m) => typeof adapter?.[m] === 'function');
}

/**
 * ⛓ REFUSE A CELL-SPACE OPERATION ON A CELL-LESS ADAPTER, BY NAME — one
 * sentence naming the adapter, the function and the members it needs.
 */
const requireCellSpace = (adapter, what) => {
    if (!hasCellSpace(adapter)) {
        fail(`editCore: ${adapter.name} declares no cell space — ${what} needs `
            + `${CELL_SPACE_MEMBERS.join('/')}. ⛔ A substrate whose document is not a grid `
            + 'of cells (bounce edits platforms in FLOAT pixel space; the APWorld editor has '
            + 'no canvas at all) declares the trio ABSENT, and every rectangle, paste and '
            + 'flood is meaningless on it — refused here rather than answered with an empty '
            + 'clip a caller would read as "nothing was there".');
    }
};

/**
 * ⛓⛓⛓ **THE OPTIONAL MEMBERS** — present or absent, but never MIS-TYPED.
 *
 * `bases` is §3.2's tagged union, arriving in slice B. ⛔ IT IS OPTIONAL AND NOT
 * REQUIRED, and that is a decision rather than a convenience: the maze's base is
 * a TAG the page already has a record for (`{kind:'maze-lab', …}`), so a maze
 * adapter forced to declare a resolver would declare one that answers *the
 * record you already have* — a member whose whole body is a tautology, which is
 * the shape a reader mistakes for a mechanism. A substrate declares `bases` when
 * a tag can be turned into a record without the page's help, and `resolveBase`
 * refuses BY NAME when it cannot.
 *
 * ⚠ AN OPTIONAL MEMBER THAT IS PRESENT IS CHECKED EXACTLY AS A REQUIRED ONE. A
 * `bases: 'atlas'` (a string, say) would otherwise sail through `assertAdapter`
 * and die inside `resolveBase` with a message about a kind rather than a type.
 */
export const ADAPTER_OPTIONAL_MEMBERS = Object.freeze({
    bases: 'object',
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
    /**
     * ⛓⛓ THE CELL-SPACE TRIO IS ANSWERED FIRST, so that a cell-less adapter is
     * told apart from a mis-typed one BEFORE the per-member walk reaches a trio
     * member and calls its absence a missing required member.
     */
    const declared = CELL_SPACE_MEMBERS.filter((m) => adapter[m] !== undefined);
    const cellSpace = declared.length > 0;
    for (const [member, type] of Object.entries(ADAPTER_MEMBERS)) {
        const inTrio = CELL_SPACE_MEMBERS.includes(member);
        if (inTrio && !cellSpace) continue;
        // eslint-disable-next-line valid-typeof
        if (typeof adapter[member] !== type) {
            fail(`editCore: adapter member \`${member}\` must be a ${type}, got `
                + `${typeof adapter[member]}.${inTrio
                    ? ` ⛔ \`${CELL_SPACE_MEMBERS.join('`/`')}\` are the CELL-SPACE TRIO: an `
                      + `adapter declares ALL THREE or NONE, and this one declares `
                      + `[${declared.join(', ')}]. A PARTIAL trio is a mis-typed adapter `
                      + 'rather than a cell-less one — a size for a space it cannot read — '
                      + 'and every caller that asks "does this substrate have cells" would '
                      + 'answer differently depending on which member it happened to ask.'
                    : ` The contract is {${Object.keys(ADAPTER_MEMBERS)
                        .filter((m) => !CELL_SPACE_MEMBERS.includes(m))
                        .join(', ')}} plus the OPTIONAL cell-space trio `
                      + `{${CELL_SPACE_MEMBERS.join(', ')}} (all three or none).`}`);
        }
    }
    /**
     * ⛔ A TRIO NAME WITH NO TYPE is a defect in this file rather than in the
     * adapter, and it would silently un-check that member — `CELL_SPACE_MEMBERS`
     * is a list OVER `ADAPTER_MEMBERS`, not a second table.
     */
    for (const m of CELL_SPACE_MEMBERS) {
        if (!(m in ADAPTER_MEMBERS)) {
            fail(`editCore: \`${m}\` is named in CELL_SPACE_MEMBERS and carries no type in `
                + 'ADAPTER_MEMBERS — the trio is a LIST over the member table, and a name '
                + 'with no type is a member nothing checks.');
        }
    }
    for (const [member, type] of Object.entries(ADAPTER_OPTIONAL_MEMBERS)) {
        if (adapter[member] === undefined) continue;
        // eslint-disable-next-line valid-typeof
        if (typeof adapter[member] !== type || adapter[member] === null
            || Array.isArray(adapter[member])) {
            fail(`editCore: adapter member \`${member}\` is OPTIONAL, but when it is present `
                + `it must be a plain ${type} — got ${JSON.stringify(adapter[member])}. `
                + 'Absent means "this substrate has none"; mis-typed means a defect that '
                + 'would otherwise surface as a message about a KIND rather than a type.');
        }
    }
    if (adapter.name === '') {
        fail('editCore: adapter member `name` must be a NON-EMPTY string — every refusal in '
            + 'this file quotes it, and an empty one makes them say nothing about which '
            + 'substrate refused.');
    }
    return adapter;
}

/**
 * ⛓⛓⛓ **§3.2's `base` TAG → A RECORD**, through the adapter's own `bases`.
 *
 * A payload's `base` is `{kind, …}` and the core has carried it OPAQUELY since
 * A1 — deliberately, because interpreting it is substrate knowledge (A1 §9.2
 * departure 1). This is the one place that interpretation happens, and it is
 * still the ADAPTER doing it: the core only routes on `kind` and refuses.
 *
 * ⛔ EVERY REFUSAL NAMES THE KIND **AND** WHAT IS ON OFFER. A tag whose kind the
 * substrate does not resolve is the common case and not an error in the caller —
 * Seedling's `generate` base is resolved by the GENERATE ladder and its
 * `set-room` by a slice that has not landed — so the sentence has to say which
 * of those it is, and the adapter's own resolver is what says it.
 */
export function resolveBase(adapter, tag) {
    assertAdapter(adapter);
    if (!tag || typeof tag !== 'object' || Array.isArray(tag) || typeof tag.kind !== 'string') {
        fail(`editCore: a base tag is \`{kind, …}\`, got ${JSON.stringify(tag)}. It is the `
            + 'payload\'s identity half (§3.2) and the `kind` is what selects a resolver.');
    }
    if (!adapter.bases) {
        fail(`editCore: the ${adapter.name} adapter declares no \`bases\`, so it cannot turn `
            + `the base tag ${JSON.stringify(tag.kind)} into a record. A substrate whose `
            + 'bases are resolved by its PAGE (the maze\'s are) leaves this member absent, '
            + 'and a session is opened on a record somebody else resolved.');
    }
    const resolve = adapter.bases[tag.kind];
    if (typeof resolve !== 'function') {
        fail(`editCore: ${JSON.stringify(tag.kind)} is not a base kind the ${adapter.name} `
            + `adapter resolves — it offers [${Object.keys(adapter.bases).join(', ')}].`);
    }
    const record = resolve(tag);
    if (record === null || typeof record !== 'object') {
        fail(`editCore: the ${adapter.name} adapter's \`${tag.kind}\` resolver returned `
            + `${JSON.stringify(record)} — a base resolver returns a RECORD, and refuses BY `
            + 'NAME when it cannot (it is the only thing that knows why).');
    }
    return record;
}

/**
 * ⛓⛓⛓ **THE ADAPTER'S BEHAVIOUR, ASKED OF IT** — A1 §9.8's residue, closed.
 *
 * `assertAdapter` checks SHAPE. This checks the five things every caller in this
 * file silently assumes, against the adapter's own record and its own op, and
 * refuses BY NAME with the law that failed. ⛔ It is a SHIPPING function rather
 * than a test helper because an adapter author outside this repo has the same
 * five assumptions to satisfy, and a law that only exists inside somebody's
 * `.test.js` is a law the next adapter learns by breaking.
 *
 * @param {object} adapter
 * @param {object} o
 * @param {object} o.record   a record of this substrate
 * @param {object} o.op       an atomic op that CHANGES that record
 * @param {object} o.refused  an atomic op that substrate REFUSES
 * @param {{x:number,y:number}} [o.cell]  a cell to read/write (default 0,0)
 * @param {{x:number,y:number}} [o.other] a DIFFERENT cell (see law 5)
 * @param {(line: string) => void} [o.say] REQUIRED for a CELL-LESS adapter — see below
 */
/**
 * ⛓⛓⛓ **AND FOR A CELL-LESS ADAPTER, THE SKIPPED LAWS ARE SAID OUT LOUD**
 * (EDITOR INTEGRATION B-b).
 *
 * ⛔⛔ **THE BRIEF SAID "laws 1–6, skip 7" AND THE CODE SAYS OTHERWISE.** Three
 * of the seven are cell-space laws, not one: law 1 IS `bounds`, law 6 IS
 * `writeOps`, law 7 is the `readCell`→`writeOps`→`readCell` round trip. An
 * adapter that declares no trio can be asked laws **2, 3, 4 and 5** — `apply`
 * answers the contract, `apply` does not mutate, `equal` is an equality, a
 * refusal carries a sentence — and those four are the ones a session actually
 * folds on.
 *
 * ⛔ AND A SKIP IS NOT A PASS. `assertAdapterBehaviour` returns `true`, and a
 * row reading `expect(assertAdapterBehaviour(bounce, …)).toBe(true)` would
 * otherwise be a green claim about seven laws of which three were never asked
 * (trap 806's family). So a cell-less adapter REFUSES BY NAME unless the caller
 * passes `say`, and each skipped law is named through it. There is no way to
 * get a silent green out of this function.
 */
export function assertAdapterBehaviour(adapter, {
    record, op, refused, cell, other, say = null,
} = {}) {
    assertAdapter(adapter);
    const law = (n, what) => fail(`editCore: the ${adapter.name} adapter fails contract law `
        + `${n} — ${what}`);
    const cells = hasCellSpace(adapter);
    if (!cells && typeof say !== 'function') {
        fail(`editCore: the ${adapter.name} adapter declares no cell space, so contract laws `
            + `${CELL_SPACE_LAWS.map((l) => l.n).join(', ')} CANNOT be asked of it — pass `
            + '`say` (a function) to receive one line per SKIPPED law. ⛔ Returning `true` '
            + 'without it would make a row asserting that return a green claim about seven '
            + 'laws of which three were never asked.');
    }
    if (!cells) {
        for (const { n, member, what } of CELL_SPACE_LAWS) {
            say(`editCore: the ${adapter.name} adapter declares no cell space — contract law `
                + `${n} (\`${member}\`: ${what}) SKIPPED.`);
        }
    }
    const b = cells ? adapter.bounds(record) : null;
    if (cells && (!b || !Number.isInteger(b.w) || !Number.isInteger(b.h)
        || b.w <= 0 || b.h <= 0)) {
        law(1, `\`bounds\` returned ${JSON.stringify(b)}; it must be {w, h} of positive `
            + 'integers, because every clip, paste and flood is expressed over them.');
    }
    const before = canonicalJson(record);
    const res = adapter.apply(record, op);
    if (!res || typeof res.ok !== 'boolean') {
        law(2, `\`apply\` returned ${JSON.stringify(res)}; the contract is `
            + '`{ok, op, description, record?}`.');
    }
    if (!res.ok) law(2, `the sample op was REFUSED (${res.description}); law 2 needs an op `
        + 'that CHANGES the record, or it tests nothing.');
    if (canonicalJson(record) !== before) {
        law(3, '`apply` MUTATED the record it was handed. The fold walks its own chain and '
            + 'the caller\'s record must survive a refusal untouched.');
    }
    if (!adapter.equal(record, record)) law(4, '`equal` says a record differs from ITSELF.');
    if (adapter.equal(record, res.record)) {
        law(4, '`equal` says the record is unchanged after an op that changed it — the '
            + 'fold\'s "a no-op is not an edit" rule reads this, so an over-eager `equal` '
            + 'silently drops real edits from the identity.');
    }
    const bad = adapter.apply(record, refused);
    if (!bad || bad.ok !== false || typeof bad.description !== 'string' || bad.description === '') {
        law(5, `a REFUSED op returned ${JSON.stringify(bad)}; a refusal is `
            + '`{ok:false, description}` with a sentence a person reads — the fold quotes it.');
    }
    if (!cells) return true;
    const at = cell ?? { x: 0, y: 0 };
    const away = other ?? { x: b.w - 1, y: b.h - 1 };
    const desc = adapter.readCell(record, at.x, at.y);
    const ops = adapter.writeOps(desc, at.x, at.y);
    if (!Array.isArray(ops)) law(6, '`writeOps` must return an ARRAY of atomic ops.');
    /**
     * ⛓ **LAW 7 — `readCell` → `writeOps` → `readCell` AT A DIFFERENT CELL.**
     *
     * ⚠ §9.3's lesson, and the reason the cell moves: a fixed point on the cell
     * the descriptor came FROM distinguishes nothing — a `writeOps` that
     * returned `[]` would pass it. Writing the descriptor somewhere else and
     * reading it back is what asks whether the pair is actually an inverse.
     */
    const moved = foldEdits(adapter, record, [group('contract law 7',
        adapter.writeOps(desc, away.x, away.y))]);
    if (canonicalJson(adapter.readCell(moved.record, away.x, away.y)) !== canonicalJson(desc)) {
        law(7, `\`writeOps\` of the descriptor at (${at.x},${at.y}) did not reproduce it at `
            + `(${away.x},${away.y}) — read back `
            + `${canonicalJson(adapter.readCell(moved.record, away.x, away.y))}, wanted `
            + `${canonicalJson(desc)}. The pair is what every paste and flood is built on.`);
    }
    return true;
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
                + 'contract is `{ok, op, description, record?, reason?}`, and a missing `ok` reads as '
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
                // ⛓ THE MEMBER'S `reason`, because the group's refusal IS the
                //   member's — the group adds no class of its own, and a page
                //   that branches on the class should see the same one it would
                //   have seen had the member been applied alone.
                ...(res.reason ? { reason: res.reason } : {}),
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
 * ⛓ **AND EVERY APPLIED OP'S OWN SENTENCE RIDES IN `steps`** (slice A2). The
 * adapter answers *what did this op do* once, on the fold, and a page that
 * wanted the line for a readout otherwise had to walk `applyOne` a SECOND time
 * over the same list — two walkers over one application path, which is the
 * shape this file exists to prevent. `applied` is still the op list and
 * nothing about it moved; `steps` is the same ops with `{index, op,
 * description}`, `index` being the position in the list that was HANDED in.
 *
 * @returns {{record, applied: object[], steps: Array<{index, op, description}>,
 *   dropped: Array<{index, op, description}>}}
 */
export function foldEdits(adapter, base, ops) {
    assertAdapter(adapter);
    let record = base;
    const applied = [];
    const steps = [];
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
        steps.push(Object.freeze({
            index: i, op: res.op ?? op, description: res.description,
        }));
    });
    return Object.freeze({
        record,
        applied: Object.freeze(applied),
        steps: Object.freeze(steps),
        dropped: Object.freeze(dropped),
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
                // ⛓ EDITOR v3 E6a — the substrate's refusal CLASS survives the
                //   session (§33.12 #1). It died here: a page could see WHAT was
                //   refused and never WHICH KIND of refusal it was, so branching
                //   meant matching `description` text.
                return Object.freeze({
                    ok: false,
                    applied: false,
                    description: res.description,
                    ...(res.reason ? { reason: res.reason } : {}),
                });
            }
            if (adapter.equal(record, res.record)) {
                return Object.freeze({
                    ok: true,
                    applied: false,
                    op: res.op ?? op,
                    description: res.description,
                    ...(res.value === undefined ? {} : { value: res.value }),
                });
            }
            record = res.record;
            ops = Object.freeze([...ops, res.op ?? op]);
            cert = null;
            return Object.freeze({
                ok: true,
                applied: true,
                op: res.op ?? op,
                description: res.description,
                /**
                 * ⛓⛓⛓ **THE ADAPTER'S `value`, FORWARDED** — trap 857, closed
                 * (EDITOR INTEGRATION B-b). `applyOne` returns the adapter's
                 * result verbatim, so `value` survived one layer and DIED
                 * here: this arm rebuilt its answer field by field and left it
                 * out. An adapter whose `add-…` op answers the node it created
                 * therefore had to record it in a side slot and have its own
                 * session drain it one line later (B-a's `takeLastValue`),
                 * which is a mechanism for a field the core already had in
                 * hand.
                 *
                 * ⚠ IT RIDES ON BOTH `ok` ARMS AND ON NEITHER REFUSAL. A
                 * refused op produced nothing to name; a NO-OP did run and may
                 * name the node it found, and dropping it there would make the
                 * field's presence depend on whether the op happened to move
                 * bytes.
                 *
                 * ⚠ A GROUP CARRIES NONE: `applyOne` builds a group's own
                 * result from its members and names no single node, which is
                 * right — a stroke of twelve ops has no one value.
                 */
                ...(res.value === undefined ? {} : { value: res.value }),
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
    requireCellSpace(adapter, 'rectCopy');
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
/**
 * ⛓⛓ THE TWO BOOLEAN FILTERS, AS WHAT THEY ALWAYS WERE — a name for a
 * descriptor FIELD. Slice B, additive: Seedling's cells carry two tile LAYERS
 * plus entities, so its filter vocabulary is three-way and the maze's is
 * two-way, and the difference is a fact about the DESCRIPTOR rather than
 * something the core should hold an enum of.
 *
 * ⇒ `only: '<field>'` is the general form and the booleans are aliases into it.
 * That is what this file's own docblock already promised — *"a substrate whose
 * cells carry three layers gets three filters for free the day its descriptor
 * does"* — and A2 §10.9 named making good on it as slice B's decision.
 */
export const FILTER_ALIASES = Object.freeze({
    tilesOnly: 'tile',
    entitiesOnly: 'entity',
});

/**
 * ⛓⛓⛓ **THE DESCRIPTOR'S FIELDS, DERIVED FROM THE DESCRIPTOR** — EDITOR v3
 * slice C2, and it closes §12.10's *"the last typed roster in this panel"*.
 *
 * `only:` names a descriptor FIELD (slice B generalised the maze's two
 * booleans into it), so the set a page may OFFER is exactly the set the
 * adapter's own `readCell` presents — and until now every page spelled that
 * set out by hand. ⛔ A typed list of three is a claim about a substrate the
 * substrate is already making, and the day a fourth field arrives the page
 * offers three filters for a four-field cell with nothing saying so.
 *
 * ⚠ **IT ASKS ONE CELL, AND THAT IS ONLY SOUND BECAUSE A DESCRIPTOR'S FIELD
 * SET IS FIXED.** Slice B's bound 2 is exactly this promise on the Seedling
 * side — *"`cliff` IS ALWAYS A FIELD, even in a room with no cliffsides
 * layer"* — and it was made so a filter could not come and go with the room.
 * An adapter whose cells carried different fields in different places would
 * break `filterFieldOf`'s own refusal long before it broke this.
 */
export function descriptorFieldsOf(adapter, record, { tx = 0, ty = 0 } = {}) {
    assertAdapter(adapter);
    requireCellSpace(adapter, 'descriptorFieldsOf');
    const desc = adapter.readCell(record, tx, ty);
    if (!desc || typeof desc !== 'object' || Array.isArray(desc)) {
        fail(`editCore: \`${adapter.name}\`'s readCell answered `
            + `${JSON.stringify(desc)} at (${tx},${ty}) — a cell DESCRIPTOR is a plain `
            + 'object whose keys are the fields a filter may keep, and a page that offered '
            + 'filters derived from this would offer none at all.');
    }
    return Object.freeze(Object.keys(desc));
}

/** The descriptor field a filter option names, or `null` for "no filter". */
export function filterFieldOf({ tilesOnly = false, entitiesOnly = false, only = null } = {}) {
    const asked = [
        ...Object.entries(FILTER_ALIASES).filter(([k]) => ({ tilesOnly, entitiesOnly })[k]),
        ...(only === null ? [] : [['only', only]]),
    ];
    if (asked.length > 1) {
        fail(`editCore: a paste was asked for ${asked.length} filters at once `
            + `(${asked.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}). A filter `
            + 'keeps ONE descriptor field; two filters that cancel are not a filter, and a '
            + 'caller that meant '
            + '"everything" should ask for neither.');
    }
    if (asked.length === 0) return null;
    const field = asked[0][1];
    if (typeof field !== 'string' || field === '') {
        fail(`editCore: \`only\` names the descriptor FIELD to keep, got `
            + `${JSON.stringify(field)}.`);
    }
    return field;
}

const filterDescriptor = (adapter, desc, options) => {
    const field = filterFieldOf(options);
    if (field === null) return desc;
    if (!desc || typeof desc !== 'object' || !Object.prototype.hasOwnProperty.call(desc, field)) {
        fail(`editCore: a filter keeping \`${field}\` was asked of a `
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
    tilesOnly = false, entitiesOnly = false, only = null, label = null,
} = {}) {
    assertAdapter(adapter);
    requireCellSpace(adapter, 'rectPasteOps');
    const field = filterFieldOf({ tilesOnly, entitiesOnly, only });
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
            const desc = filterDescriptor(adapter, clip.cells[dy][dx],
                { tilesOnly, entitiesOnly, only });
            const cellOps = adapter.writeOps(desc, tx, ty);
            if (!Array.isArray(cellOps)) {
                fail(`editCore: ${adapter.name}.writeOps returned ${JSON.stringify(cellOps)} `
                    + 'for a cell — it must be an ARRAY of atomic ops (possibly empty).');
            }
            ops.push(...cellOps);
        }
    }
    if (ops.length === 0) {
        /**
         * ⛔ **THE TWO REASONS AN EMPTY PASTE HAPPENS ARE DIFFERENT DEFECTS, AND
         * THE FIRST SPELLING NAMED ONLY ONE OF THEM.** Slice B found it: a
         * three-way `only` filter over a clip whose cells all lack that field
         * produces zero ops with ZERO cells clipped, and the message said *every
         * cell fell outside the grid* — a true sentence about the wrong subject.
         * A person reading it would go looking at their coordinates.
         */
        const cells = clip.w * clip.h;
        fail(`editCore: rectPasteOps of a ${clip.w}x${clip.h} clip at (${x},${y}) produced NO `
            + 'ops. '
            + (clipped === cells
                ? `Every one of its ${cells} cells fell outside the ${b.w}x${b.h} `
                    + `${adapter.name} grid — a paste that landed entirely off the level is a `
                    + 'caller defect.'
                : `${cells - clipped} of its ${cells} cells landed on the ${b.w}x${b.h} `
                    + `${adapter.name} grid and NONE of them had anything to write`
                    + `${field === null ? '' : ` under the \`${field}\` filter`} — the `
                    + 'descriptors are empty of that field, so the filter has nothing to '
                    + 'paste.')
            + ' ⛔ An empty group is refused (see `group`).');
    }
    // ⛓ THE LABEL NAMES THE FIELD, not the option — so a three-way substrate's
    // third filter reads as itself instead of as "paste" with nothing to say.
    const what = field === null ? '' : ` ${field}`;
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
    requireCellSpace(adapter, 'floodOps');
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
