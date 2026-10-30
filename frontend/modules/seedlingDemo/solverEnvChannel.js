/**
 * seedlingDemo/solverEnvChannel — **THE PAGE'S CHANNEL FOR THE SOLVER'S OFF SWITCHES** (⛓⛓ SEEDLING HAMMER-PHASE
 * CPWIT; measurement only).
 *
 * The solver's switches are read from `globalThis.process?.env?.SEEDLING_*` when their module loads (`solverBot.js`'s
 * `CHOOSER_PAIR`, `contactFidelity.js`'s set, …). The page's solve worker has no `process`, so before this channel a
 * switch could be turned on only in a node process, and every hammer switch (OPP, CPAIR, ICEST, LWEIGH) shipped
 * node-witnessed only. This channel sets those SAME env names in the solve worker, for one page load:
 *
 *   page URL   `?seedlingSolverEnv=SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR_SIZE=3` (entries `NAME=VALUE`, `;`
 *              between them; a value may hold commas, e.g. `SEEDLING_CONTACT_FIDELITY=a,b`)
 *   → the page's solve service (`jsRuntimeSolveService`'s default worker, `jsRuntimePage`'s) builds its worker URL
 *     with the CANONICAL spec in the same param (`solveWorkerUrl`);
 *   → the worker's FIRST import (`solverEnvShim.js`) reads it off `self.location` and installs
 *     `globalThis.process = {env}` before any solver module is evaluated, so every `SEEDLING_*` read sees it;
 *   → every answer the worker posts carries `solverEnv` (the canonical spec it installed), and so does its plan.
 *
 * ⛔ It defaults to NOTHING: no param → the worker URL is today's, no shim is installed, no answer is stamped
 * (byte-identical). ⛔ It is per page load and never persisted: a URL param (a probe's or sweep's input), never a
 * setting. ⛔ The WORKER only: the page's main-thread module copies keep their defaults (the game, not the page's
 * model, is the judge of a played plan). ⛔ A key whose module has its own request stamp (`contactFidelity`,
 * `killLockBodies`, `axeDodgeAskPerPreview`, `dashOnlyWindow`, `dashShape`) is overridden by that stamp when the
 * page sends one; at the panel's defaults it sends none.
 *
 * THE ONE TABLE: `SOLVER_ENV_NAMES` is every `SEEDLING_*` name a module in the worker's static import closure reads
 * (`solverEnvChannel.test.js` holds the two equal, so a new switch is one line here and needs no new plumbing). A name
 * outside it refuses BY NAME, on the page side before a worker is built and in the worker itself.
 */

/** The URL param (page and worker URL alike). */
export const SOLVER_ENV_PARAM = 'seedlingSolverEnv';

/** Every `SEEDLING_*` env name the solve worker's modules read (sorted). */
export const SOLVER_ENV_NAMES = Object.freeze([
    'SEEDLING_AP_REPORT_BOSSES', 'SEEDLING_ARRIVAL_BUTTON_ARM', 'SEEDLING_ARROW_LANE_CROSSING',
    'SEEDLING_AXE_DODGE_ASK_PER_PREVIEW', 'SEEDLING_AXE_GATE_TRANSIT', 'SEEDLING_AXE_PRICED_CROSSING',
    'SEEDLING_AXE_TIMING_RUNG', 'SEEDLING_BAIT_ALIGN_SAFE_MEMO', 'SEEDLING_BAIT_COMPONENT_MEMO',
    'SEEDLING_BAIT_FORECAST', 'SEEDLING_BAIT_PARKED_TAIL', 'SEEDLING_BEAMTOWER_BEAM_HIT', 'SEEDLING_BEAMTOWER_DRIFT',
    'SEEDLING_BEAM_LANE_WALK', 'SEEDLING_BLOCK_SWEEP_BODIES', 'SEEDLING_BOMB_BLAST_BODY',
    'SEEDLING_BUTTON_FALL_RELEASE_STEP', 'SEEDLING_CEREMONY_SHOVE', 'SEEDLING_CHASER_ORBIT_KILL',
    'SEEDLING_CHASER_SPINNER_WALLS', 'SEEDLING_CHEST_PROBE_LINE_END', 'SEEDLING_CHEST_SEAL_REMOVAL',
    'SEEDLING_CHOOSER_HIT_SOURCES', 'SEEDLING_CHOOSER_HIT_SOURCES_MODE', 'SEEDLING_CHOOSER_PAIR',
    'SEEDLING_CHOOSER_PAIR_SIZE', 'SEEDLING_COLLECT_SPAN_AIM', 'SEEDLING_CONTACT_FIDELITY',
    'SEEDLING_CORPSE_BUMP_WEIGH', 'SEEDLING_CORRIDOR_BODY_PRICING', 'SEEDLING_COVERED_GOAL_REFUSAL',
    'SEEDLING_COVER_HELD_FADE', 'SEEDLING_COVER_WEIGH_REFINE', 'SEEDLING_CRUSHER_BAIT',
    'SEEDLING_CRUSHER_BAIT_PRESS_GOAL', 'SEEDLING_DASH_KEEP_PARTIAL', 'SEEDLING_DASH_LEG_PRECHECK',
    'SEEDLING_DASH_NO_SWING_PREFIX', 'SEEDLING_DASH_ONLY_WINDOW', 'SEEDLING_DASH_SPINNER_FORECAST', 'SEEDLING_DASH_STAND_WHOLE',
    'SEEDLING_DRILL_KILL_FIRST', 'SEEDLING_DRILL_MIXED_ROOMS', 'SEEDLING_DRILL_TIMED_PASS',
    'SEEDLING_DRILL_TIMED_PASS_EXIT', 'SEEDLING_ENCLOSED_PIT_CORNER', 'SEEDLING_ENCOUNTER_SWING_IN_FLIGHT',
    'SEEDLING_ESCAPE_CROSS_PASS_CACHE', 'SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY', 'SEEDLING_FALLROCK_POSTFALL',
    'SEEDLING_FINE_FRONTIER_FLOOD', 'SEEDLING_FINE_FRONTIER_HIDDEN_DOOR', 'SEEDLING_FINE_SWING_STANCE',
    'SEEDLING_FINE_WAND_STANCE', 'SEEDLING_FIRE_BLOCK_PULSE_SHOVE', 'SEEDLING_FIRE_BLOCK_ROUTE',
    'SEEDLING_FIRE_LIVE_TURRET_REACH', 'SEEDLING_FLYER_LIVE', 'SEEDLING_FORCED_HITS',
    'SEEDLING_FORCED_HIT_WITNESS_FIRST', 'SEEDLING_FORECAST_CORPSE_FADE', 'SEEDLING_FORECAST_SPEED_BY_TERRAIN',
    'SEEDLING_GHOSTMOTION', 'SEEDLING_GHOSTSWORD', 'SEEDLING_GHOST_KILL_RUNG', 'SEEDLING_GHOST_SEARCH_BUCKETS',
    'SEEDLING_GHOST_SPINNER_PRESS', 'SEEDLING_GUARD_APPROACH_STANCE', 'SEEDLING_HAMMER_APPROACH',
    'SEEDLING_HAMMER_ESCAPE', 'SEEDLING_HAMMER_FIGHT', 'SEEDLING_HAMMER_FIGHT_FALLBACK',
    'SEEDLING_HAMMER_FIGHT_FALLBACK_MODE', 'SEEDLING_HOLD_WAIT_PRICED', 'SEEDLING_ICETURRET_STATIC_KILL',
    'SEEDLING_ICETURRET_STATIC_KILL_MODE', 'SEEDLING_ICE_BLAST_SHIELD', 'SEEDLING_ICE_TURRET_DEATH_ANIM',
    'SEEDLING_ICE_TURRET_SPEAR_ARM', 'SEEDLING_IGNEOUS_DEAD_FRAMES', 'SEEDLING_IGNEOUS_LAVA',
    'SEEDLING_IN_ROOM_POLE_THRUST', 'SEEDLING_KEYLOCK_WAIT_PRICED', 'SEEDLING_KILLLOCK_BODIES',
    'SEEDLING_KILL_STANCE_AS_FORECAST', 'SEEDLING_KILL_STANCE_TARGET_RESCAN', 'SEEDLING_KING_OF_FIRE_FIGHT',
    'SEEDLING_L39_SHAFT_PRESS', 'SEEDLING_LANE_WEIGH', 'SEEDLING_LAPSE_NARROW_RETRY', 'SEEDLING_LATCH_WEIGH_FIRST',
    'SEEDLING_LAVA_CHAIN_PLAYER_HIT', 'SEEDLING_LIGHTS_BOSS_FIGHT', 'SEEDLING_LIGHTS_DEBUG',
    'SEEDLING_LIGHTS_SORTIE_PORTFOLIO', 'SEEDLING_LOCK_RECLOSE_LAG', 'SEEDLING_MOVING_WAIT',
    'SEEDLING_NON_CHASER_REMOVAL_BLOCKS', 'SEEDLING_OPPORTUNISTIC_STRIKE', 'SEEDLING_ORBIT_FREE_AIM',
    'SEEDLING_PARTIAL_DODGE_REPROBE', 'SEEDLING_PHASE_DODGE_ARRIVAL_STALL', 'SEEDLING_PICKUP_REMOVED_NEXT',
    'SEEDLING_PIT_TELEPORTER_CROSSING', 'SEEDLING_PIXEL_MASK_SIGHT_LINES', 'SEEDLING_PRESS_KILL_BOMBS',
    'SEEDLING_PRESS_KILL_CHASERS', 'SEEDLING_PRESS_KILL_COST', 'SEEDLING_PRESS_KILL_DONE_ON_WALK',
    'SEEDLING_PRESS_KILL_REBOOT_GUARD', 'SEEDLING_PRESS_KILL_SHAKE_GUARD', 'SEEDLING_PULSER_PUBLISH_LAG',
    'SEEDLING_PUNCH_GATE_TIMED', 'SEEDLING_PUSH_SPEAR_DIRECTION', 'SEEDLING_REFUGE_ETA_CUT',
    'SEEDLING_REMOVED_BODY_BLOCKS', 'SEEDLING_ROPE_CUT_ANY_WEAPON', 'SEEDLING_ROPE_CUT_VERB',
    'SEEDLING_SEAL_DOOR_APPROACH', 'SEEDLING_SECONDARY_USE', 'SEEDLING_SHAKE_BAND_MOOT', 'SEEDLING_SHAKE_EXACT_SPLIT',
    'SEEDLING_SPEAR_BRIDGE_VERB', 'SEEDLING_SPEAR_GAME_TEST', 'SEEDLING_SPINNER_LOCK_LAG',
    'SEEDLING_SPINNER_POINT_EXACT', 'SEEDLING_SPINNER_SWING_LOS', 'SEEDLING_SPINNING_AXE_PLAYER_HIT',
    'SEEDLING_STANCE_REENTRY_NEXT_DOOR', 'SEEDLING_STANCE_ROCKS', 'SEEDLING_STATIC_SWORD_ARM',
    'SEEDLING_STATUE_TALK_RANGE', 'SEEDLING_STRATEGY_BOUND_DISTINCT', 'SEEDLING_STRIKE_ETA_FLOOR',
    'SEEDLING_STRIKE_IFRAME_LAPSE', 'SEEDLING_STRIKE_SCAN_COST', 'SEEDLING_STRING_PULL_FAST',
    'SEEDLING_SWORD_GATE_TIMED', 'SEEDLING_TENTACLE_BEAST_FIGHT', 'SEEDLING_TENTACLE_HITLESS_FIRST',
    'SEEDLING_TOTEM_BOSS_FIGHT', 'SEEDLING_TURRET_CIRCLE_KILL', 'SEEDLING_UNBILLED_DAMAGE_GATE',
    'SEEDLING_WALKER_BEAM_TOWERS', 'SEEDLING_WAND_SHOT_CHASER_BODIES', 'SEEDLING_WAND_VERB',
    'SEEDLING_WATCHER_TALK_VERB', 'SEEDLING_WAYPOINT_SLIDE', 'SEEDLING_WEIGH_HYPOTHESIS_CHAIN',
    'SEEDLING_WHIRLPOOL_DROWN', 'SEEDLING_YETI_TALK',
]);

const KNOWN = new Set(SOLVER_ENV_NAMES);

/**
 * A spec (`NAME=VALUE;…`) → a frozen `{NAME: VALUE}`, or null when the spec is empty. Throws BY NAME on an unknown
 * name, a repeated name, an entry without `=`, or an empty value. `what` names the input in the message.
 */
export function parseSolverEnv(spec, what = SOLVER_ENV_PARAM) {
    const s = String(spec ?? '').trim();
    if (!s) return null;
    const env = {};
    for (const raw of s.split(';')) {
        const entry = raw.trim();
        if (!entry) continue;
        const eq = entry.indexOf('=');
        if (eq <= 0) throw new Error(`${what}: "${entry}" is not NAME=VALUE`);
        const name = entry.slice(0, eq).trim();
        const value = entry.slice(eq + 1).trim();
        if (!KNOWN.has(name)) throw new Error(`${what}: unknown switch "${name}" (not a SEEDLING_* name the solve worker reads; see SOLVER_ENV_NAMES)`);
        if (Object.hasOwn(env, name)) throw new Error(`${what}: switch "${name}" is named twice`);
        if (!value || /[\s;]/.test(value)) throw new Error(`${what}: switch "${name}" has no usable value (${JSON.stringify(value)})`);
        env[name] = value;
    }
    return Object.keys(env).length ? Object.freeze(env) : null;
}

/** `{NAME: VALUE}` → the canonical spec (names sorted), or null when empty. */
export function formatSolverEnv(env) {
    const names = Object.keys(env ?? {}).sort();
    return names.length ? names.map((n) => `${n}=${env[n]}`).join(';') : null;
}

/** Any spec → its canonical form (validated), or null when empty. */
export function canonicalSolverEnv(spec, what) {
    return formatSolverEnv(parseSolverEnv(spec, what));
}

/** A URL query string (`location.search`) → the canonical spec it carries, or null (no param, or an empty one). */
export function solverEnvFromSearch(search) {
    let value = null;
    try { value = new URLSearchParams(search ?? '').get(SOLVER_ENV_PARAM); } catch { value = null; }
    return canonicalSolverEnv(value, `?${SOLVER_ENV_PARAM}`);
}

/**
 * The solve worker's URL for a page whose query is `search`: `base` itself (the SAME URL object) when the page sets
 * no switch, else a copy carrying the spec in `SOLVER_ENV_PARAM` — canonical when it parses, and AS GIVEN when it does
 * not, so the worker refuses every solve naming the bad switch (`solverEnvShim.js`) rather than this page throwing
 * out of a worker factory.
 */
export function solveWorkerUrl(base, search) {
    let raw = null;
    try { raw = new URLSearchParams(search ?? '').get(SOLVER_ENV_PARAM); } catch { raw = null; }
    if (raw === null || !raw.trim()) return base;
    let spec;
    try { spec = canonicalSolverEnv(raw); } catch { spec = raw; }
    if (spec === null) return base;
    const url = new URL(base.href ?? String(base));
    url.searchParams.set(SOLVER_ENV_PARAM, spec);
    return url;
}

/**
 * Install `spec` into `scope`'s `process.env` (the worker's global; a node row passes its own): each named switch is
 * set, nothing else is touched. Where `scope` has no `process`, a bare `{env}` is made. Returns the canonical spec, or
 * null (nothing installed, `scope` untouched).
 */
export function installSolverEnv(spec, scope = globalThis) {
    const env = parseSolverEnv(spec);
    if (env === null) return null;
    if (!scope.process) scope.process = { env: {} };
    if (!scope.process.env) scope.process.env = {};
    Object.assign(scope.process.env, env);
    return formatSolverEnv(env);
}

/** Stamp an answer (and its plan) with the spec the worker installed; at the defaults (`spec` null) the answer as is. */
export function stampSolverEnv(answer, spec) {
    if (spec === null || !answer || typeof answer !== 'object') return answer;
    answer.solverEnv = spec;
    if (answer.ok && answer.plan && typeof answer.plan === 'object') answer.plan.solverEnv = spec;
    return answer;
}
