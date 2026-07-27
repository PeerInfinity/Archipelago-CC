// compactJson — a deterministic "inline what fits" JSON serializer for the
// hand-maintained procgen documents (region atlases first; the Seedling map
// extract uses it too).
//
// Why: `JSON.stringify(doc, null, 2)` explodes every [x, y] tile pair to one
// number per line, which makes an atlas unreadable and its diffs useless —
// atlases/README.md used to document a "don't use --restamp, paste the hash by
// hand" workaround because of exactly that. This writer keeps any value whose
// single-line form fits the width budget on one line (tile pairs, `bounds`,
// short rule trees) and expands only what doesn't.
//
// Properties the callers rely on:
//   - Deterministic: same parsed document -> same bytes (key order is the
//     document's own insertion order, which JSON.parse preserves).
//   - Idempotent: re-serializing a document this wrote returns identical bytes.
//   - Content-preserving: JSON.parse(compactStringify(d)) deep-equals d, so the
//     atlas content hash (computed over the PARSED document) never moves.
//
// Headless-safe: no imports, no node: builtins — this module is in the bundled
// browser graph and is also used by scripts/procgen CLIs.

/** Default single-line width budget, including the leading indent. */
export const DEFAULT_MAX_INLINE = 100;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// JSON drops object entries whose value is undefined (or a function) and
// encodes such array elements as null. Mirror that so a round trip through
// JSON.parse(compactStringify(x)) matches JSON.parse(JSON.stringify(x)).
const isDroppable = (v) => v === undefined || typeof v === 'function' || typeof v === 'symbol';

function entriesOf(obj) {
    return Object.keys(obj)
        .filter((k) => !isDroppable(obj[k]))
        .map((k) => [k, obj[k]]);
}

/**
 * Single-line rendering of any JSON value. Arrays pack tight (`[39,40]` — a
 * tile list is data, not prose); objects breathe (`{ "x": 0, "y": 32 }`).
 */
export function inlineJson(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value === undefined ? null : value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => inlineJson(isDroppable(v) ? null : v)).join(',')}]`;
    }
    const entries = entriesOf(value);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inlineJson(v)}`).join(', ')} }`;
}

// A list whose entries are objects always breaks one-per-line, even when it
// would fit: `regions`, `exits`, `locations` and friends are records, and a
// record per line is what makes an atlas diff readable. Lists of tiles or
// numbers have no such structure and inline freely.
const holdsRecords = (arr) => arr.some((v) => isPlainObject(v));

// The rule has to be transitive, or a small enough ANCESTOR would inline the
// record list its child forbade. A value may go on one line only when nothing
// inside it is a record list.
function mayInline(value) {
    if (value === null || typeof value !== 'object') return true;
    if (Array.isArray(value)) return !holdsRecords(value) && value.every(mayInline);
    return entriesOf(value).every(([, v]) => mayInline(v));
}

function render(value, depth, opts) {
    const { indent, maxInline } = opts;
    const pad = ' '.repeat(depth * indent);
    const padInner = ' '.repeat((depth + 1) * indent);

    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value === undefined ? null : value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (mayInline(value)) {
            const line = inlineJson(value);
            if (pad.length + line.length <= maxInline) return line;
        }
        const parts = value.map((v) => padInner + render(isDroppable(v) ? null : v, depth + 1, opts));
        return `[\n${parts.join(',\n')}\n${pad}]`;
    }

    const entries = entriesOf(value);
    if (entries.length === 0) return '{}';
    if (mayInline(value)) {
        const line = inlineJson(value);
        if (pad.length + line.length <= maxInline) return line;
    }
    const parts = entries.map(([k, v]) => `${padInner}${JSON.stringify(k)}: ${render(v, depth + 1, opts)}`);
    return `{\n${parts.join(',\n')}\n${pad}}`;
}

/**
 * Serialize `value` compactly. Returns the document text WITHOUT a trailing
 * newline — callers that write files add their own (see compactJsonFile).
 *
 * @param {*} value
 * @param {{ indent?: number, maxInline?: number }} [options]
 *   indent    — spaces per nesting level (default 2)
 *   maxInline — width budget for a single line, indent included (default 100)
 */
export function compactStringify(value, options = {}) {
    const opts = {
        indent: Number.isInteger(options.indent) && options.indent >= 0 ? options.indent : 2,
        maxInline: Number.isInteger(options.maxInline) && options.maxInline > 0
            ? options.maxInline
            : DEFAULT_MAX_INLINE,
    };
    return render(value, 0, opts);
}

/** compactStringify plus the trailing newline every committed file here has. */
export function compactJsonFile(value, options = {}) {
    return `${compactStringify(value, options)}\n`;
}
