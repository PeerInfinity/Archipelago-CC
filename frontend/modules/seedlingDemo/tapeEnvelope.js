/**
 * seedlingDemo/tapeEnvelope — the GAME-NEUTRAL half of a tape, read for any
 * game id (engine prep B1 D2; the contract is
 * `docs/json/developer/procgen/tape-envelope.md` § 1).
 *
 * ⛔ THIS IS NOT A SECOND `parseTape`. `tapeFormat.parseTape` is Seedling's
 * parser: it knows the key vocabulary, the version ladder and every field's
 * version gate, and it refuses any `game` other than `"seedling"`. This
 * module validates only what the envelope makes COMMON to every game — the
 * span shape, the half-open order, integer ticks, a non-empty game id, and a
 * profile's shape when one is declared — and hands the game-specific rest to
 * that game's own reader. A key name, an overlap rule or a boot key beyond
 * `x`/`y` is the game's business, not the envelope's.
 *
 * ── The half-open rule, the envelope's one definition ─────────────────
 * A span `{key, from, to}` holds `key` during tick `t` iff `from <= t < to`
 * (Seedling's `heldKeysAt`). `inclusiveToHalfOpen` is the bridge from Robot
 * Wants Kitty's engine CSV, whose spans are inclusive at BOTH ends.
 *
 * Dependency-free and browser-usable, like `tapeFormat`.
 */

class EnvelopeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EnvelopeError';
    }
}

function fail(message) {
    throw new EnvelopeError(message);
}

/** The fields `readEnvelope` returns, in order. */
export const ENVELOPE_FIELDS = Object.freeze(
    ['game', 'tape_version', 'profile', 'boot', 'rng', 'tick_count', 'inputs']);

/** A profile's `md5`: 32 LOWERCASE hex digits, the form `md5sum` prints. */
export const PROFILE_MD5_RE = /^[0-9a-f]{32}$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function requireInt(value, what) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        fail(`${what} must be an integer, got ${JSON.stringify(value)}`);
    }
    return value;
}

/**
 * Validate a `profile` block's SHAPE: `{id: non-empty string, md5: 32 hex}`,
 * nothing else. Shared with `tapeFormat`'s v13 field so the two readers
 * cannot disagree about what a profile is.
 *
 * @param {*} profile  the declared block
 * @param {(msg: string) => never} [refuse]  the caller's error constructor
 * @returns {{id: string, md5: string}} a fresh frozen copy
 */
export function validateProfile(profile, refuse = fail) {
    if (!isObject(profile)) {
        refuse(`profile must be an object { id, md5 }, got ${JSON.stringify(profile)}`);
    }
    for (const k of Object.keys(profile)) {
        if (k !== 'id' && k !== 'md5') {
            refuse(`profile.${k} is not a profile field; a profile is exactly { id, md5 }`);
        }
    }
    if (typeof profile.id !== 'string' || profile.id.length === 0) {
        refuse(`profile.id must be a non-empty string, got ${JSON.stringify(profile.id)}`);
    }
    if (typeof profile.md5 !== 'string' || !PROFILE_MD5_RE.test(profile.md5)) {
        refuse('profile.md5 must be 32 lowercase hex digits (an md5 over the profile\'s '
            + `own dump), got ${JSON.stringify(profile.md5)}`);
    }
    return Object.freeze({ id: profile.id, md5: profile.md5 });
}

/**
 * Read the envelope of a tape of ANY game.
 *
 * @param {string|object} input  the tape, as JSON text or a plain object
 * @returns {{game: string, tape_version: number, profile: ({id, md5}|null),
 *            boot: object, rng: (object|null), tick_count: number,
 *            inputs: Array<{key: string, from: number, to: number}>}}
 *   frozen; `inputs` keeps the file's order, `boot` and `rng` are shallow
 *   copies carrying the game's own keys.
 */
export function readEnvelope(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            fail(`tape is not valid JSON: ${e.message}`);
        }
    }
    if (!isObject(raw)) {
        fail(`tape must be an object, got ${Array.isArray(raw) ? 'array' : typeof raw}`);
    }

    if (typeof raw.game !== 'string' || raw.game.length === 0) {
        fail(`game must be a non-empty string naming the game, got ${JSON.stringify(raw.game)}`);
    }
    requireInt(raw.tape_version, 'tape_version');
    if (raw.tape_version < 1) {
        fail(`tape_version must be >= 1, got ${raw.tape_version}`);
    }

    const profile = raw.profile === undefined || raw.profile === null
        ? null : validateProfile(raw.profile);

    if (!isObject(raw.boot)) {
        fail(`boot must be an object with x and y, got ${JSON.stringify(raw.boot)}`);
    }
    for (const axis of ['x', 'y']) {
        const v = raw.boot[axis];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            fail(`boot.${axis} must be a finite number, got ${JSON.stringify(v)}`);
        }
    }

    if (raw.rng !== undefined && raw.rng !== null && !isObject(raw.rng)) {
        fail(`rng must be an object when declared, got ${JSON.stringify(raw.rng)}`);
    }
    const rng = isObject(raw.rng) ? Object.freeze({ ...raw.rng }) : null;

    if (!Array.isArray(raw.inputs)) {
        fail(`inputs must be an array of { key, from, to }, got ${JSON.stringify(raw.inputs)}`);
    }
    const inputs = raw.inputs.map((span, i) => {
        const where = `inputs[${i}]`;
        if (!isObject(span)) fail(`${where} must be an object { key, from, to }`);
        if (typeof span.key !== 'string' || span.key.length === 0) {
            fail(`${where}.key must be a non-empty string, got ${JSON.stringify(span.key)}`);
        }
        requireInt(span.from, `${where}.from`);
        requireInt(span.to, `${where}.to`);
        if (span.from < 0) fail(`${where}.from must be >= 0, got ${span.from}`);
        if (span.to <= span.from) {
            fail(`${where}.to (${span.to}) must be > from (${span.from}) — spans are `
                + 'HALF-OPEN [from, to), so a zero-length span holds no tick and '
                + 'produces neither a press nor a release');
        }
        return Object.freeze({ key: span.key, from: span.from, to: span.to });
    });

    // The same fallback `parseTape` uses: absent means "the longest span".
    const tickCount = raw.tick_count === undefined || raw.tick_count === null
        ? inputs.reduce((max, s) => Math.max(max, s.to), 0)
        : requireInt(raw.tick_count, 'tick_count');
    if (tickCount < 0) fail(`tick_count must be >= 0, got ${tickCount}`);
    for (const s of inputs) {
        if (s.to > tickCount) {
            fail(`inputs span [${s.from},${s.to}) for "${s.key}" runs past tick_count `
                + `(${tickCount})`);
        }
    }

    return Object.freeze({
        game: raw.game,
        tape_version: raw.tape_version,
        profile,
        boot: Object.freeze({ ...raw.boot }),
        rng,
        tick_count: tickCount,
        inputs: Object.freeze(inputs),
    });
}

/**
 * An INCLUSIVE span `[a, b]` (Robot Wants Kitty's engine CSV: the button is
 * held on every tick a..b) as the envelope's half-open `{from: a, to: b + 1}`.
 * `a == b` — a one-tick press — is the one-tick span `{from: a, to: a + 1}`.
 *
 * @param {[number, number]} pair
 * @returns {{from: number, to: number}}
 */
export function inclusiveToHalfOpen(pair) {
    if (!Array.isArray(pair) || pair.length !== 2) {
        fail(`an inclusive span is a pair [from, to], got ${JSON.stringify(pair)}`);
    }
    const [a, b] = pair;
    requireInt(a, 'inclusive span from');
    requireInt(b, 'inclusive span to');
    if (a < 0) fail(`inclusive span from must be >= 0, got ${a}`);
    if (b < a) {
        fail(`inclusive span [${a}, ${b}] ends before it starts; inclusive at both ends `
            + 'means the shortest span is [t, t], one tick');
    }
    return { from: a, to: b + 1 };
}

/**
 * The reverse bridge: a half-open `{from, to}` as the inclusive `[from, to - 1]`.
 *
 * @param {{from: number, to: number}} span
 * @returns {[number, number]}
 */
export function halfOpenToInclusive(span) {
    if (!isObject(span)) fail(`a half-open span is { from, to }, got ${JSON.stringify(span)}`);
    requireInt(span.from, 'span.from');
    requireInt(span.to, 'span.to');
    if (span.from < 0 || span.to <= span.from) {
        fail(`span [${span.from}, ${span.to}) is not a half-open span with from >= 0 and to > from`);
    }
    return [span.from, span.to - 1];
}

export { EnvelopeError };
