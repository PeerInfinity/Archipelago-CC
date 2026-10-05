/**
 * Noiz2sa substrate — the pure region model (no DOM, no engine import).
 *
 * A region is one SEGMENT of Noiz2sa (⚖ the user, 2026-10-04/05: "Each region will be one segment of one
 * level. Losing a life should restart the region."): a span of scenes from a start {stage, scene} to an end
 * {stage, scene}, both included, which may pass a boss into the next stage. The semantics are COPIED from the
 * game repo's `src/game/segment-run.js` (the submodule `frontend/modules/bulletml-dodge`), not reinvented:
 *
 *  - an attempt starts a game at the span's start (newGame's `startScene`) on the region's seed, centered hitbox;
 *  - a hit ends the attempt, and the region restarts from its start at once (the time already spent stays spent:
 *    in loop mode the host's time drain has already charged it);
 *  - an ordinary scene is over when the next one starts; the boss when it is killed (`clear`) or after BOSS_CAP
 *    frames (3 minutes) without a hit; a boss that is not the end leads into the next stage at scene 0;
 *  - the region is CLEARED when its end scene is over. Score counts from the region's start.
 *
 * Why a copy and not an import: `segment-run.js` imports the engine, and the engine imports `@xmldom/xmldom`,
 * which only the game page maps (an import map). This file must load headless (the registry library and vitest
 * import it), so the run takes the engine as an argument (`createRegionRun(span, engine)`), and the few
 * constants it needs are restated below with the file each comes from. `noiz2saRegion.test.js` holds them.
 *
 * Positions: `stage` as newGame takes it (0–9 the stages 1–10, 10–13 the endless modes); `scene` = g.scene's
 * value while the scene plays (0–8 the ordinary scenes, 9 the boss).
 */

/** noiz2sa-game.js STAGE_NAMES */
export const STAGE_NAMES = Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'ENDLESS', 'HARD', 'EXTREME', 'INSANE']);
/** noiz2sa-game.js STAGE_NUM (the stages with a next stage) */
export const STAGE_NUM = 10;
/** segment-run.js BOSS_SCENE (= noiz2sa-game.js LAST_START_SCENE) */
export const BOSS_SCENE = 9;
/** bot-run.js BOSS_CAP: 3 minutes at the game's 62.5 frames/s */
export const BOSS_CAP = 11250;
/** segment-run.js FPS (16 ms fixed step) */
export const FPS = 62.5;
/** ⚖ the substrate's hitbox, always */
export const HITBOX = 'centered';
/** segment-run.js: the endless modes' stage LCG seed for a game seed */
export const endlessSeedOf = (seed) => 7919 * seed;
/** noiz2sa-game.js STATUS.IN_GAME */
const IN_GAME = 1;

/** "2:5" → {stage: 1, scene: 4}; "3:boss" → {stage: 2, scene: 9} (segment-run.js parsePosition) */
export function parsePosition(s) {
    const m = /^([^:]+):(\d+|boss)$/i.exec(String(s ?? '').trim());
    if (!m) throw new Error(`a position is STAGE:SCENE, e.g. 2:5 or 3:boss (got ${s})`);
    const stage = STAGE_NAMES.findIndex((n) => n.toLowerCase() === m[1].toLowerCase());
    if (stage < 0) throw new Error(`unknown stage "${m[1]}" (have: ${STAGE_NAMES.join(', ')})`);
    const scene = m[2].toLowerCase() === 'boss' ? BOSS_SCENE : Number(m[2]) - 1;
    if (m[2].toLowerCase() !== 'boss' && (scene < 0 || scene >= BOSS_SCENE)) throw new Error(`scene must be 1–${BOSS_SCENE} or boss (got ${m[2]})`);
    return { stage, scene };
}
/** {stage: 1, scene: 4} → "2:5" (segment-run.js showPosition) */
export const showPosition = (p) => `${STAGE_NAMES[p.stage]}:${p.scene === BOSS_SCENE ? 'boss' : p.scene + 1}`;
/** "1:2–1:3", or one position when the span is one scene */
export const showSpan = ({ start, end }) => (start.stage === end.stage && start.scene === end.scene
    ? showPosition(start) : `${showPosition(start)}–${showPosition(end)}`);

const before = (a, b) => a.stage < b.stage || (a.stage === b.stage && a.scene <= b.scene);

/** A span's start and end, checked (segment-run.js checkSpan); → the number of stages it passes through. */
export function checkSpan(start, end) {
    for (const [n, p] of [['start', start], ['end', end]]) {
        if (!p || !Number.isInteger(p.stage) || !Number.isInteger(p.scene) || p.stage < 0 || p.stage >= STAGE_NUM + 4 || p.scene < 0 || p.scene > BOSS_SCENE) {
            throw new Error(`segment ${n} must be {stage: 0–13, scene: 0–${BOSS_SCENE}} (got ${JSON.stringify(p)})`);
        }
    }
    if (!before(start, end)) throw new Error(`segment end ${JSON.stringify(end)} is before its start ${JSON.stringify(start)}`);
    if (start.stage !== end.stage && end.stage >= STAGE_NUM) throw new Error('a segment in an endless mode stays inside it (no next stage)');
    return end.stage - start.stage + 1;
}

/**
 * The region of a payload, checked: `{start, end, seed}` → the same, with the seed an integer ≥ 1.
 * Throws on a malformed one (deserializeWorld refuses the payload with it).
 */
export function regionSpanOf(payload) {
    const { start, end } = payload ?? {};
    checkSpan(start, end);
    const seed = payload.seed ?? 1;
    if (!Number.isInteger(seed) || seed < 1) throw new Error(`noiz2sa region seed must be an integer ≥ 1 (got ${JSON.stringify(seed)})`);
    return { start: { stage: start.stage, scene: start.scene }, end: { stage: end.stage, scene: end.scene }, seed };
}

/** scenes in a stage: 0–8 the ordinary scenes and 9 the boss */
const SCENES_PER_STAGE = BOSS_SCENE + 1;

/** the number of scenes a span plays, its start and end included (a boss counts as one scene): 2:4–2:5 → 2 */
export function sceneCount({ start, end }) {
    checkSpan(start, end);
    return (end.stage - start.stage) * SCENES_PER_STAGE + end.scene - start.scene + 1;
}

/**
 * The position `n` scenes after `pos` (a boss leads into the next stage at scene 0), or the last scene the game
 * can reach from `pos` when that is sooner: the boss of stage 10 (no next stage), or of the endless mode `pos` is in.
 */
export function scenesAfter(pos, n) {
    const idx = pos.scene + n;
    const stage = pos.stage + Math.floor(idx / SCENES_PER_STAGE);
    const lastStage = pos.stage >= STAGE_NUM ? pos.stage : STAGE_NUM - 1;
    if (stage > lastStage) return { stage: lastStage, scene: BOSS_SCENE };
    return { stage, scene: idx % SCENES_PER_STAGE };
}

/**
 * N4c (⚖ 2026-10-05): the default CHECK spans of a region's `count` locations ("we can have the location check launch a
 * longer set of stages, maybe twice as long as the move action"; the correction: each location stores its own span).
 * Each is twice the move span's scenes; the first starts at the move span's start, and each next one starts at the
 * scene after the previous one's end: move 2:4–2:5 → 2:4–2:7, 2:8–3:1, … A span is cut short at the last scene the
 * game reaches (`scenesAfter`), and a start past it is that last scene.
 */
export function defaultCheckSpans(move, count) {
    const len = 2 * sceneCount(move);
    const out = [];
    let start = { ...move.start };
    for (let i = 0; i < count; i++) {
        const end = scenesAfter(start, len - 1);
        out.push({ start, end });
        start = scenesAfter(end, 1);
    }
    return out;
}
/** the first location's default check span (twice the move span's scenes, from its start) */
export const checkSpanOf = (move) => defaultCheckSpans(move, 1)[0];

const spanOf = (s) => ({ start: { stage: s.start.stage, scene: s.start.scene }, end: { stage: s.end.stage, scene: s.end.scene } });

/**
 * A region payload, checked (N4c): `{move: {start, end}, seed, locations: [{id, check: {start, end}}]}`. The payload
 * carries `move` and `locations` (zero or more, each with its own check span). Read the older ways too: a payload without
 * `move` has its move span in the top-level `{start, end}`; one without `locations` has a location per `ap_locations` key
 * (in key order), and a location without a `check` span gets its default one (`defaultCheckSpans`, by its position).
 * Throws on a malformed one.
 */
export function regionSpansOf(payload) {
    const p = payload ?? {};
    const moveIn = p.move ?? { start: p.start, end: p.end };
    const { start, end, seed } = regionSpanOf({ ...moveIn, seed: p.seed });
    const move = { start, end };
    const given = Array.isArray(p.locations) ? p.locations
        : Object.keys(p.ap_locations ?? {}).map((id) => ({ id }));
    const defaults = defaultCheckSpans(move, given.length);
    const locations = given.map((l, i) => {
        if (!l || typeof l.id !== 'string' || !l.id) throw new Error(`noiz2sa location ${i} has no id`);
        if (!l.check) return { id: l.id, check: defaults[i] };
        checkSpan(l.check.start, l.check.end);
        return { id: l.id, check: spanOf(l.check) };
    });
    if (new Set(locations.map((l) => l.id)).size !== locations.length) throw new Error('noiz2sa location ids repeat');
    return { move, seed, locations };
}

/**
 * One region being played, frame by frame. `engine` = {newGame, stepGame} from the game's noiz2sa-game.js;
 * `patterns` its loaded patterns. The run never ends by itself: after a hit it restarts the region, and after
 * the clear it stops stepping (`cleared` stays true; `step` is then a no-op until `restart()`).
 *
 * `step(inputByte)` → what happened this frame: {hit, restarted, cleared, stageChanged, events}.
 */
export function createRegionRun({ start, end, seed = 1 }, { engine, patterns }) {
    checkSpan(start, end);
    const gameOptions = (pos) => ({ seed, endlessSeed: endlessSeedOf(seed), hitbox: HITBOX, startScene: pos.scene });
    const run = {
        start, end, seed,
        g: null, pos: null,
        attempt: 0,          // 1 for the first attempt
        attemptFrames: 0,    // frames of this attempt (all its games)
        totalFrames: 0,      // frames of every attempt since the region was entered
        scoreBefore: 0,      // the score of this attempt's earlier games (a boss into the next stage)
        bossStart: null,
        cleared: false,
        clearFrames: null,   // the clearing attempt's frames
        hits: 0,
        get score() { return run.scoreBefore + (run.g ? run.g.score : 0); },
    };
    function newGameAt(pos) {
        run.pos = { ...pos };
        run.g = engine.newGame(patterns, pos.stage, gameOptions(pos));
        run.bossStart = null;
    }
    function startAttempt() {
        run.attempt++;
        run.attemptFrames = 0;
        run.scoreBefore = 0;
        newGameAt(start);
    }
    /** start over: a fresh first attempt (a new visit) */
    run.restart = () => {
        run.attempt = 0; run.totalFrames = 0; run.hits = 0; run.cleared = false; run.clearFrames = null;
        startAttempt();
    };
    run.step = (inp) => {
        const out = { hit: false, restarted: false, cleared: false, stageChanged: false, events: [] };
        if (run.cleared) return out;
        const g = run.g;
        if (g.status !== IN_GAME) throw new Error(`noiz2sa region: the game left play (status ${g.status}) at frame ${g.frame}`);
        const last = run.pos.stage === end.stage;
        let next = false;
        out.events = engine.stepGame(g, inp);
        run.attemptFrames++; run.totalFrames++;
        for (const e of out.events) {
            if (e[0] === 'hit') out.hit = true;
            else if (e[0] === 'clear') next = true; // the boss killed (stages 1–10)
        }
        if (out.hit) {
            // ⚖ a hit restarts the region from its start, at once
            run.hits++;
            startAttempt();
            out.restarted = true;
            return out;
        }
        if (g.scene === BOSS_SCENE && run.bossStart === null) run.bossStart = g.frame;
        if (run.bossStart !== null && g.frame - run.bossStart >= BOSS_CAP) next = true; // 3 minutes of the boss, no hit
        if (g.scene > (last ? end.scene : BOSS_SCENE)) next = true; // the end scene is over (endless: the boss killed)
        if (!next) return out;
        if (last) {
            run.cleared = true;
            run.clearFrames = run.attemptFrames;
            out.cleared = true;
            return out;
        }
        // a boss that is not the end: the next stage at its scene 0, the score carried on
        run.scoreBefore += g.score;
        newGameAt({ stage: run.pos.stage + 1, scene: 0 });
        out.stageChanged = true;
        return out;
    };
    startAttempt();
    return run;
}

/** Run-length code for an input tape (bytes 0–63): "16x1002" = byte 16 for 1002 frames; runs joined by ",". */
export function encodeInputs(bytes) {
    const runs = [];
    for (let i = 0; i < bytes.length;) {
        let j = i;
        while (j < bytes.length && bytes[j] === bytes[i]) j++;
        runs.push(j - i === 1 ? `${bytes[i]}` : `${bytes[i]}x${j - i}`);
        i = j;
    }
    return runs.join(',');
}
export function decodeInputs(s) {
    const out = [];
    for (const r of String(s ?? '').split(',').filter(Boolean)) {
        const [b, n = '1'] = r.split('x');
        const byte = Number(b), count = Number(n);
        if (!Number.isInteger(byte) || byte < 0 || byte > 63 || !Number.isInteger(count) || count < 1) {
            throw new Error(`bad input run "${r}"`);
        }
        for (let k = 0; k < count; k++) out.push(byte);
    }
    return out;
}
