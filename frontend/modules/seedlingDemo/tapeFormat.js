/**
 * seedlingDemo/tapeFormat — the INPUT TAPE contract for the real-game
 * Seedling bot ladder (region-atlas plan Phase 8; brief:
 * `CC/docs/plans/seedling-bot-v1-opus-kickoff.md` §3.1).
 *
 * One schema, TWO consumers: this module (the JS iteration surface) and
 * `Bot.as` compiled into the recompiled Seedling wasm build (the oracle).
 * A differential harness replays the same tape through both and compares
 * observation streams, so anything ambiguous here becomes a divergence
 * there. Every rule below is therefore stated as a loud error, never a
 * silent default — a tape the two sides interpret differently is exactly
 * the bug this format exists to make impossible.
 *
 * ── Why hold-SPANS and not per-tick key states ────────────────────────
 * Seedling reads input three different ways and the tape has to express
 * all three (recon: `Player.as`, `NPCs/NPC.as:191`, `SealController.as:95`):
 *   - movement  → `Input.check`    (held)
 *   - item use  → `Input.pressed`  (down EDGE)
 *   - dialogue  → `Input.released` (full down-then-up)
 * A span `{from, to}` yields a press edge on tick `from` and a release
 * edge on tick `to`, so a length-1 span covers `pressed` AND `released`
 * while a long span covers `check`. `from` inclusive, `to` EXCLUSIVE.
 *
 * ── Tick indexing ─────────────────────────────────────────────────────
 * Tick 0 is the first tick the bot is ARMED (after `botStart`, once the
 * post-boot `blackCover` fade has finished). Ticks advance ONLY on ticks
 * where entities actually update — the AS3 side gates on
 * `blackCover <= 0 && !Game.freezeObjects`, both of which suppress all
 * movement, so a dead frame must not consume tape. NEVER index by
 * wall-clock: `FP.elapsed` appears in zero lines of Seedling game code,
 * so one update call is one fixed physics step and a tick-indexed tape is
 * deterministic for movement.
 *
 * ── Observation streams: RECORD-THEN-ACT ──────────────────────────────
 * The AS3 bot's only hook is the top of `Main.update()`, BEFORE
 * `super.update()` — i.e. before this tick's movement happens. So it
 * records first, then dispatches this tick's key events. That makes
 * observation `t` the state after exactly `t` completed movement ticks:
 * `ticks[0]` is the boot position under no input, and a tape of N ticks
 * yields N+1 observations (0..N). `runTape` here mirrors that exactly.
 * Getting this off by one is the easiest way to make every differential
 * red for a reason that has nothing to do with physics.
 */

/** Schema version. Bumped only on a breaking shape change. */
export const TAPE_VERSION = 1;

/**
 * The ONE canonical key-name → AS3 keycode table, asserted by both
 * consumers. Source of truth: `Player.as:59`
 *   keys = [RIGHT, UP, LEFT, DOWN, X, C, X, V, I]
 * with codes from `net/flashpunk/utils/Key.as`.
 *
 * `primary` and `talk` are BOTH Key.X in the game (keys[4] and keys[6]);
 * the tape exposes the single name `primary` because they are physically
 * the same key — a second name would let two tapes mean the same thing.
 */
export const KEY_CODES = Object.freeze({
    right: 39,       // Key.RIGHT  — keys[0]
    up: 38,          // Key.UP     — keys[1]
    left: 37,        // Key.LEFT   — keys[2]
    down: 40,        // Key.DOWN   — keys[3]
    primary: 88,     // Key.X      — keys[4] (and keys[6], "talk")
    secondary: 67,   // Key.C      — keys[5]
    inventory: 86,   // Key.V      — keys[7]
    inventory2: 73,  // Key.I      — keys[8]
});

/**
 * Keycodes that must NEVER appear in a tape, with the reason. These are
 * not merely "unused" — synthesizing them corrupts a run:
 *   M/R/Esc are read by `Game.update` BEFORE entities (`Game.as:793-801`)
 *   and several branches call `Input.clear()` or rebuild the world
 *   (`:796, 1274-1284`); W opens a URL (`Player.as:1533`).
 * They are absent from KEY_CODES, so this list exists to give the
 * validator a NAMED error instead of a generic "unknown key".
 */
export const FORBIDDEN_KEYS = Object.freeze({
    m: { code: 77, why: 'Game.update reads it before entities and may Input.clear() / rebuild the world' },
    r: { code: 82, why: 'Game.update restart branch rebuilds the world mid-tape' },
    esc: { code: 27, why: 'Game.update menu branch calls Input.clear()' },
    escape: { code: 27, why: 'Game.update menu branch calls Input.clear()' },
    w: { code: 87, why: 'Player.as:1533 opens an external URL' },
});

/** Every legal key name, for error messages and cross-consumer assertion. */
export const KEY_NAMES = Object.freeze(Object.keys(KEY_CODES));

class TapeFormatError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TapeFormatError';
    }
}

function fail(message) {
    throw new TapeFormatError(message);
}

function requireInt(value, what) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        fail(`${what} must be an integer, got ${JSON.stringify(value)}`);
    }
    return value;
}

function requireFiniteNumber(value, what) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`${what} must be a finite number, got ${JSON.stringify(value)}`);
    }
    return value;
}

/**
 * Parse + validate + normalize a tape. Accepts a JSON string or a plain
 * object; returns a NEW frozen tape with spans sorted (by `from`, then
 * `key`) so two tapes that mean the same thing serialize the same way.
 *
 * Throws TapeFormatError on anything ambiguous. There are no defaults for
 * required fields on purpose: a tape missing `noclip` must not silently
 * become a collision run, because the JS side and the game would then be
 * running different experiments and the differential would blame physics.
 */
export function parseTape(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            fail(`tape is not valid JSON: ${e.message}`);
        }
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        fail(`tape must be an object, got ${Array.isArray(raw) ? 'array' : typeof raw}`);
    }

    if (raw.tape_version !== TAPE_VERSION) {
        fail(`tape_version must be ${TAPE_VERSION}, got ${JSON.stringify(raw.tape_version)}`);
    }
    if (raw.game !== 'seedling') {
        fail(`game must be "seedling", got ${JSON.stringify(raw.game)}`);
    }
    if (typeof raw.noclip !== 'boolean') {
        fail('noclip must be a boolean (no default — it selects which physics '
            + `both consumers run), got ${JSON.stringify(raw.noclip)}`);
    }

    const boot = raw.boot;
    if (boot === null || typeof boot !== 'object' || Array.isArray(boot)) {
        fail('boot must be an object { level, x, y }');
    }
    requireInt(boot.level, 'boot.level');
    requireFiniteNumber(boot.x, 'boot.x');
    requireFiniteNumber(boot.y, 'boot.y');

    if (!Array.isArray(raw.inputs)) {
        fail(`inputs must be an array, got ${typeof raw.inputs}`);
    }

    const inputs = raw.inputs.map((span, i) => {
        const where = `inputs[${i}]`;
        if (span === null || typeof span !== 'object' || Array.isArray(span)) {
            fail(`${where} must be an object { key, from, to }`);
        }
        const { key } = span;
        if (typeof key !== 'string') {
            fail(`${where}.key must be a string, got ${JSON.stringify(key)}`);
        }
        if (!Object.prototype.hasOwnProperty.call(KEY_CODES, key)) {
            const forbidden = FORBIDDEN_KEYS[key.toLowerCase()];
            if (forbidden) {
                fail(`${where}.key "${key}" (keycode ${forbidden.code}) is FORBIDDEN and `
                    + `must never be synthesized: ${forbidden.why}`);
            }
            fail(`${where}.key "${key}" is not a known key name; legal names are `
                + `${KEY_NAMES.join(', ')}`);
        }
        requireInt(span.from, `${where}.from`);
        requireInt(span.to, `${where}.to`);
        if (span.from < 0) fail(`${where}.from must be >= 0, got ${span.from}`);
        if (span.to <= span.from) {
            fail(`${where}.to (${span.to}) must be > from (${span.from}) — `
                + 'spans are [from, to) and a zero-length span would produce '
                + 'neither a press nor a release edge');
        }
        return { key, from: span.from, to: span.to };
    });

    inputs.sort((a, b) => (a.from - b.from) || (a.to - b.to) || a.key.localeCompare(b.key));

    // Overlapping spans for the SAME key are rejected: FlashPunk's
    // `_key[code]` guard makes a second KEY_DOWN a no-op and the first
    // KEY_UP clears the whole hold, so two overlapping spans on one key
    // do NOT mean what an author would assume. Make them say it once.
    for (let i = 1; i < inputs.length; i++) {
        for (let j = 0; j < i; j++) {
            if (inputs[i].key !== inputs[j].key) continue;
            if (inputs[i].from < inputs[j].to) {
                fail(`inputs contain overlapping spans for key "${inputs[i].key}": `
                    + `[${inputs[j].from},${inputs[j].to}) and `
                    + `[${inputs[i].from},${inputs[i].to}). Merge them — overlapping `
                    + 'holds do not compose (the first release clears the key).');
            }
        }
    }

    const tickCount = requireInt(
        raw.tick_count ?? inputs.reduce((max, s) => Math.max(max, s.to), 0),
        'tick_count',
    );
    if (tickCount < 0) fail(`tick_count must be >= 0, got ${tickCount}`);
    for (const span of inputs) {
        if (span.to > tickCount) {
            fail(`inputs span [${span.from},${span.to}) for "${span.key}" runs past `
                + `tick_count (${tickCount}) — the bot would disarm mid-hold`);
        }
    }

    return Object.freeze({
        tape_version: TAPE_VERSION,
        game: 'seedling',
        boot: Object.freeze({ level: boot.level, x: boot.x, y: boot.y }),
        noclip: raw.noclip,
        tick_count: tickCount,
        inputs: Object.freeze(inputs.map((s) => Object.freeze(s))),
        ...(raw.name ? { name: String(raw.name) } : {}),
        ...(raw.description ? { description: String(raw.description) } : {}),
    });
}

/**
 * The set of key names held during tick `t`. Both consumers must agree
 * bit for bit; this is the single definition.
 */
export function heldKeysAt(tape, t) {
    const held = new Set();
    for (const span of tape.inputs) {
        if (t >= span.from && t < span.to) held.add(span.key);
    }
    return held;
}

/**
 * The keyboard EDGES the AS3 bot must dispatch at the top of tick `t`:
 * a DOWN for every span starting here, an UP for every span ending here.
 * Returned as keycodes because that is what `KeyboardEvent` carries.
 *
 * Kept here rather than in the AS3 so the two sides cannot drift: a JS
 * test can assert the exact edge schedule a tape implies, and `Bot.as`
 * is a transcription of this rule.
 */
export function keyEdgesAt(tape, t) {
    const down = [];
    const up = [];
    for (const span of tape.inputs) {
        if (span.from === t) down.push(KEY_CODES[span.key]);
        if (span.to === t) up.push(KEY_CODES[span.key]);
    }
    down.sort((a, b) => a - b);
    up.sort((a, b) => a - b);
    return { down, up };
}

/** Serialize a tape to canonical JSON (stable key order, 2-space indent). */
export function serializeTape(tape) {
    const t = parseTape(tape);
    const ordered = {
        tape_version: t.tape_version,
        game: t.game,
        ...(t.name ? { name: t.name } : {}),
        ...(t.description ? { description: t.description } : {}),
        boot: { level: t.boot.level, x: t.boot.x, y: t.boot.y },
        noclip: t.noclip,
        tick_count: t.tick_count,
        inputs: t.inputs.map((s) => ({ key: s.key, from: s.from, to: s.to })),
    };
    return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * Validate an observation stream's SHAPE (not its values). The
 * `transitions` array is empty at the v1 rung and exists now so the
 * format does not churn when v2 starts crossing levels.
 */
export function parseObservationStream(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            fail(`observation stream is not valid JSON: ${e.message}`);
        }
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        fail('observation stream must be an object { ticks, transitions }');
    }
    if (!Array.isArray(raw.ticks)) fail('observation stream .ticks must be an array');
    if (!Array.isArray(raw.transitions)) {
        fail('observation stream .transitions must be an array (empty at the v1 rung)');
    }
    raw.ticks.forEach((o, i) => {
        const where = `ticks[${i}]`;
        if (o === null || typeof o !== 'object') fail(`${where} must be an object`);
        requireInt(o.t, `${where}.t`);
        requireFiniteNumber(o.x, `${where}.x`);
        requireFiniteNumber(o.y, `${where}.y`);
        requireInt(o.level, `${where}.level`);
        if (o.t !== i) fail(`${where}.t must equal its index (${i}), got ${o.t} — `
            + 'observations are dense and in order on both sides');
    });
    return {
        ticks: raw.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })),
        transitions: raw.transitions.slice(),
    };
}

/** Serialize an observation stream to canonical JSON. */
export function serializeObservationStream(stream) {
    const s = parseObservationStream(stream);
    return `${JSON.stringify(s, null, 2)}\n`;
}

/**
 * Compare two observation streams for EXACT equality and return a
 * human-readable diff (null when identical).
 *
 * Exactness is deliberate and load-bearing: AS3 `Number` is an IEEE-754
 * double, JS numbers are doubles, and the recompiled C runtime uses
 * doubles too, so a mismatch is a transcription DEFECT to investigate,
 * not a tolerance to configure. If a genuine representation mismatch is
 * ever proven, document the evidence in the brief before bounding it.
 */
export function diffObservationStreams(expected, actual) {
    const e = parseObservationStream(expected);
    const a = parseObservationStream(actual);
    if (e.ticks.length !== a.ticks.length) {
        return `tick count differs: expected ${e.ticks.length}, got ${a.ticks.length}`;
    }
    for (let i = 0; i < e.ticks.length; i++) {
        const et = e.ticks[i];
        const at = a.ticks[i];
        if (et.x !== at.x || et.y !== at.y || et.level !== at.level) {
            return `tick ${i} differs: expected `
                + `(x=${et.x}, y=${et.y}, level=${et.level}), got `
                + `(x=${at.x}, y=${at.y}, level=${at.level})`
                + ` [dx=${at.x - et.x}, dy=${at.y - et.y}]`;
        }
    }
    if (e.transitions.length !== a.transitions.length) {
        return `transition count differs: expected ${e.transitions.length}, `
            + `got ${a.transitions.length}`;
    }
    return null;
}

export { TapeFormatError };
