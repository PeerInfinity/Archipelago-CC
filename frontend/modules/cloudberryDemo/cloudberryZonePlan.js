/**
 * Cloudberry substrate — requirement-targeted levels for sphere growth (P2b).
 *
 * The sphere engine hands a zone substrate its region's specs: exits (side +
 * requirement in AP item names), locations (id, item, requirement) and a seed. A
 * Cloudberry level realises them as NESTED PIECES (runner's `planStripSpecs` shape):
 * piece k is generated with the platform items S_k, S_0 ⊆ S_1 ⊆ … ⊆ S_last, and the
 * generator's reroll search makes every new item of a piece a real gate (⚖ R14).
 *
 *   - A location with requirement R becomes a check coin in a piece whose S_k = R.
 *   - Every FORWARD exit leaves by the end door, after the last piece: it needs
 *     S_last. All exits share that one door (⚖ R5), so their platform requirements
 *     must be EQUAL — a smaller one would be over-required at the door. The veto
 *     (`canHostCloudberryExitGates`) declines unequal gates the way runner declines
 *     incomparable ones.
 *   - The BACK exit (the entrance side) is free: the start door offers the way back
 *     (the payload's `entrySide`, and the side the player came in by).
 *   - Requirement terms the level cannot realise as platforms — Jetpack, foreign items,
 *     counts above 1 — are AUTHORED: `logic_gate` obstacles on the path, and
 *     `gate_rules` the bridge evaluates (the page's exit menu greys a locked exit).
 *   - Jetpack levels: a region whose ENTRY gate holds Jetpack may be generated with the
 *     Jetpack hero (`cloudberryJetpackChance`); everything in it then needs Jetpack,
 *     which every player inside already holds.
 *   - Double Jump levels (P5a), the same way: a region whose ENTRY gate holds Double Jump
 *     may be generated with the Double hero (2 jumps; `cloudberryDoubleJumpChance`).
 *     ONE ability hero per level: when the entry gate holds both, the Jetpack draw comes
 *     first and a Jetpack level is never also a Double Jump level (the Hero Factory's
 *     move is one choice; a combined hero was never measured to replay). Double Jump in
 *     an EXIT gate is a lock, like Jetpack.
 *
 * Pure: no DOM, no fetch, no generator. The plan is turned into a document by
 * `cloudberryGeneration.js`; `emitCloudberryZone` turns plan + generated result into
 * the zone rules the engine assembles.
 *
 * RNG draw order (one `createRng(seed)` stream per region, seeded by the engine's
 * region seed — `(rng.next() * 0x7fffffff) | 0` of the pipeline's stream): (1) the
 * tileset, only when `cloudberryTileset` is 'random'; (2) the hazard kinds, only
 * when hazards are on; (3) the Jetpack draw, only when the entry gate holds Jetpack
 * and the chance is strictly between 0 and 1; (4) the Double Jump draw, only when the
 * entry gate holds Double Jump, the level is not a Jetpack level, and the chance is
 * strictly between 0 and 1; (5) the hero variation (P5b), only when
 * `cloudberryHeroVariation` > 0: one number per physics slider that acts on the level
 * (`CLOUDBERRY_HERO_PHYSICS` order; the Double Jump sliders only on a Double Jump level,
 * the Jetpack sliders only on a Jetpack level). Draws (3)–(5) come last, so a world
 * without these gates and without variation draws exactly what it drew before them.
 * The level's own seed IS the engine's region seed; a retry derives attempt a's seed
 * with `cloudberryAttemptSeed`, and with variation on, attempt a > 0 also REDRAWS the
 * hero from `createRng(<attempt a's seed>)` (draw (5) alone), so an unlucky hero cannot
 * refuse every attempt.
 */

import { createRng } from '../shared/rng.js';
import {
    CLOUDBERRY_ABILITY_ITEMS, CLOUDBERRY_GAME_ITEMS, CLOUDBERRY_ITEMS_BY_AP_NAME, CLOUDBERRY_ITEM_NAMES,
    CLOUDBERRY_LIBRARY_OBSTACLES, PAGE_SIDE,
    buildCloudberryPayload, emitCloudberryPaths, heroDoubleJump, requirementRule, requiredItems,
} from './cloudberryRules.js';
import {
    CLOUDBERRY_HAZARD_UPGRADES, CLOUDBERRY_HERO_PHYSICS, CLOUDBERRY_HERO_VARIATION_MAX, CLOUDBERRY_TILESETS,
    cloudberryRecordedKnobs,
    DEFAULT_CLOUDBERRY_PROCGEN_PARAMS,
} from './cloudberryProcgenParams.js';

/** The nine platform items (game names): what a piece can gate on. */
export const CLOUDBERRY_PLATFORM_ITEMS = Object.freeze(CLOUDBERRY_GAME_ITEMS.filter((g) => !CLOUDBERRY_ABILITY_ITEMS.includes(g)));
/** The hero a Double Jump level is generated with (P5a: 2 jumps, replayed 230/230 from inputs on the fixed page). */
export const CLOUDBERRY_DOUBLE_JUMP_HERO = Object.freeze({ move: 'Double', phsx: Object.freeze({ numjumps: 2 }) });
const PLATFORM = new Set(CLOUDBERRY_PLATFORM_ITEMS);

const sortItems = (items) => [...new Set(items)]
    .sort((a, b) => CLOUDBERRY_GAME_ITEMS.indexOf(a) - CLOUDBERRY_GAME_ITEMS.indexOf(b));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const subset = (a, b) => a.every((x) => b.includes(x));

/**
 * Split a requirement (AP item names + counts) into the platform part (game items,
 * count 1: realised by pieces) and the authored part ([{item, count}]).
 */
export function splitCloudberryRequirement(requirement = [], counts = {}) {
    const physics = [];
    const authored = [];
    for (const name of requirement ?? []) {
        const count = counts?.[name] ?? 1;
        const game = CLOUDBERRY_ITEMS_BY_AP_NAME[name];
        if (game && PLATFORM.has(game) && count === 1) physics.push(game);
        else authored.push({ item: name, count });
    }
    return { physics: sortItems(physics), authored };
}

const gateTerms = (gate) => gate.map((t) => (typeof t === 'string' ? { item: t, count: 1 } : t));
const physicsOfGate = (gate) => splitCloudberryRequirement(
    gateTerms(gate).map((t) => t.item),
    Object.fromEntries(gateTerms(gate).map((t) => [t.item, t.count ?? 1]))).physics;

/**
 * The structural veto (`canHostExitGates`): every forward exit of a Cloudberry region
 * leaves by the same end door, so the platform parts of its exit gates must be EQUAL
 * (authored terms — Jetpack, foreign items, counts — impose no geometry).
 */
export function canHostCloudberryExitGates(existingGates, newGate) {
    const mine = physicsOfGate(newGate);
    return existingGates.every((g) => sameSet(physicsOfGate(g), mine));
}

/** The grower's hint when no host can take a wave's gate. */
export function cloudberryGateHostingHint() {
    return 'For Cloudberry worlds note that every forward exit of a level leaves by its end door, '
        + 'so a Cloudberry region can only host exit gates with the SAME platform items (Jetpack and '
        + 'items of other games ride as locks and do not count) — a wave needing different platform '
        + 'gates needs more regions: raise "Max items/region" or lower the sphere count.';
}

/** Attempt a's level seed (attempt 0 = the region seed). Non-negative int32. */
export function cloudberryAttemptSeed(seed, attempt) {
    if (!attempt) return seed;
    let h = (seed ^ Math.imul(attempt, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return (h ^ (h >>> 16)) & 0x7fffffff;
}

/**
 * The request of attempt `attempt`: the seed changes; with a plan whose hero varies
 * (`plan.heroDraw`, P5b), attempt a > 0 also redraws the hero from the attempt's seed.
 */
export function cloudberryAttemptArgs(args, attempt, plan = null) {
    if (!attempt) return args;
    const seed = cloudberryAttemptSeed(args.seed, attempt);
    if (!plan?.heroDraw) return { ...args, seed };
    const { kind, base, variation } = plan.heroDraw;
    return withHero({ ...args, seed }, cloudberryHeroCustom(kind, drawCloudberryHero(kind, base, variation, createRng(seed))));
}

const knob = (params, key) => params?.[key] ?? DEFAULT_CLOUDBERRY_PROCGEN_PARAMS[key];

// ---------------------------------------------------------------------------------------------------------------
// P5b — the hero's physics

/** The Hero Factory's 16 sliders in the engine's `CustomData` order (the document's `level.heroPhsx` "ph:a,b,…;"), with the game's defaults. */
export const CLOUDBERRY_HERO_PHSX_ORDER = Object.freeze([
    ['gravity', 1], ['accel', 1], ['maxspeed', 1], ['maxfall', 1], ['jumplength', 1], ['jumplength2', 1],
    ['jumpaccel', 1], ['jumpaccel2', 1], ['jetpackaccel', 1], ['jetpackfuel', 1], ['numjumps', 2],
    ['size', 1], ['size2', 2.08], ['gravity2', 1], ['phaseperiod', 1], ['friction', 1],
]);

const actsOn = (h, kind) => h.levels === 'all' || h.levels === kind;

/** A level's hero kind: 'jetpack' | 'double' | 'plain'. */
export const cloudberryHeroKind = (jetpack, doubleJump) => (jetpack ? 'jetpack' : doubleJump ? 'double' : 'plain');

/** The world's hero values {phsx name: value}, each checked against its ruled range (a named error otherwise). */
export function cloudberryHeroBase(params, what = 'cloudberry') {
    const base = {};
    for (const h of CLOUDBERRY_HERO_PHYSICS) {
        const v = Number(knob(params, h.key));
        if (!Number.isFinite(v) || v < h.min || v > h.max || (h.integer && !Number.isInteger(v))) {
            throw new Error(`${what}: ${h.key} = ${knob(params, h.key)} is outside ${h.min}–${h.max}`
                + `${h.integer ? ' (a whole number)' : ''} (the P5b ruled range)`);
        }
        base[h.phsx] = v;
    }
    return base;
}

/**
 * Draw (5): each slider that acts on a `kind` level moves from the world's value toward a
 * random point of its range by `variation` (0..1), one `rng.next()` per slider in
 * CLOUDBERRY_HERO_PHYSICS order, rounded to 3 decimals (whole numbers for numjumps).
 * `variation` 0 draws nothing and returns the base.
 */
export function drawCloudberryHero(kind, base, variation, rng) {
    const out = { ...base };
    if (!(variation > 0)) return out;
    for (const h of CLOUDBERRY_HERO_PHYSICS) {
        if (!actsOn(h, kind)) continue;
        const target = h.min + rng.next() * (h.max - h.min);
        let v = base[h.phsx] + variation * (target - base[h.phsx]);
        v = h.integer ? Math.round(v) : Math.round(v * 1000) / 1000;
        out[h.phsx] = Math.min(h.max, Math.max(h.min, v));
    }
    return out;
}

/**
 * The request's `heroCustom` for a `kind` level with hero `values`, or null (the plain
 * default hero: no heroCustom, today's bytes). The ability levels keep their P1a/P5a
 * hero first (`{move:'Jetpack', phsx:{jetpackfuel}}`, `{move:'Double', phsx:{numjumps}}`)
 * so a default world's requests are unchanged; every other slider that acts on the level
 * is added only when it differs from the game's default.
 */
export function cloudberryHeroCustom(kind, values) {
    const phsx = {};
    if (kind === 'jetpack') phsx.jetpackfuel = values.jetpackfuel;
    if (kind === 'double') phsx.numjumps = values.numjumps;
    for (const h of CLOUDBERRY_HERO_PHYSICS) {
        if (!actsOn(h, kind) || h.phsx in phsx) continue;
        if (values[h.phsx] !== h.def) phsx[h.phsx] = values[h.phsx];
    }
    if (kind === 'jetpack') return { move: 'Jetpack', phsx };
    if (kind === 'double') return { move: CLOUDBERRY_DOUBLE_JUMP_HERO.move, phsx };
    return Object.keys(phsx).length ? { phsx } : null;
}

/** `args` with heroCustom set (null removes it), keeping every other key's place. */
function withHero(args, heroCustom) {
    const out = {};
    let placed = false;
    for (const [k, v] of Object.entries(args)) {
        if (k === 'heroCustom') {
            if (heroCustom) out.heroCustom = heroCustom;
            placed = true;
        } else {
            if (k === 'trace' && !placed && heroCustom) { out.heroCustom = heroCustom; placed = true; }
            out[k] = v;
        }
    }
    if (!placed && heroCustom) out.heroCustom = heroCustom;
    return out;
}

/** The engine's `level.heroPhsx` text for a request's heroCustom (test stand-ins write what the game writes). */
export function cloudberryHeroPhsxText(heroCustom) {
    const want = heroCustom?.phsx ?? {};
    return `ph:${CLOUDBERRY_HERO_PHSX_ORDER.map(([name, def]) => want[name] ?? def).join(',')};`;
}

/**
 * Check a document's hero against the request's `heroCustom` (P5b): the engine's
 * `level.heroPhsx` must hold every slider the request named (the rest at the game's
 * default) and nothing may have been clamped; no heroCustom ⇒ the document has no
 * custom physics. Returns null when it matches, else the reason.
 */
export function cloudberryHeroMismatch(doc, heroCustom) {
    const text = doc?.level?.heroPhsx;
    if (!heroCustom) return typeof text === 'string' ? `custom hero physics ${text}, planned the default hero` : null;
    if (typeof text !== 'string') return `the default hero, planned custom physics ${JSON.stringify(heroCustom.phsx ?? {})}`;
    const vals = text.replace(/^ph:/, '').replace(/;$/, '').split(',').map(Number);
    if (vals.length !== CLOUDBERRY_HERO_PHSX_ORDER.length || vals.some((v) => !Number.isFinite(v))) {
        return `unreadable hero physics '${text}'`;
    }
    const clamped = doc.level.heroPhsxClamped ?? [];
    if (clamped.length) return `hero physics clamped by the game (${clamped.join(', ')})`;
    const want = heroCustom.phsx ?? {};
    for (let i = 0; i < vals.length; i++) {
        const [name, def] = CLOUDBERRY_HERO_PHSX_ORDER[i];
        const w = want[name] ?? def;
        if (Math.abs(vals[i] - w) > 1e-4 * Math.max(1, Math.abs(w))) return `hero ${name} ${vals[i]}, planned ${w}`;
    }
    return null;
}

/**
 * Plan a level for the engine's zone specs.
 *
 * @param {object} specs  { region_id, exitSpecs: [{side, requirement, counts}],
 *   locationSpecs: [{id, item, requirement, counts}], seed, cloudberry: regionParams }
 * @param {object} [ctx]  the engine's zone context: { entrance: {side, requirement, counts} | null }
 * @returns {{ region_id, args, needs, pieceSets, locations, exits, key }}
 *   args = the ck-level/2 request (no reroll); needs = what a document must offer
 *   (check coins per piece, a start door); locations = [{id, item, piece, authored}];
 *   exits = [{side, back, authored}].
 */
export function planCloudberryLevel(specs, ctx = {}) {
    const { region_id, exitSpecs = [], locationSpecs = [], seed = 1 } = specs;
    const params = specs.cloudberry ?? {};
    const what = `cloudberry zone '${region_id}'`;
    const entrance = ctx.entrance ?? null;
    const backSide = entrance?.side ?? null;

    const seen = new Set();
    const exits = exitSpecs.map((s) => {
        if (!PAGE_SIDE[s.side]) throw new Error(`${what}: exit side '${s.side}' is not a grid side`);
        if (seen.has(s.side)) throw new Error(`${what}: duplicate exit side '${s.side}'`);
        seen.add(s.side);
        const { physics, authored } = splitCloudberryRequirement(s.requirement, s.counts);
        const back = s.side === backSide;
        // ⛓ P5d (⚖ Robert 2026-11-05, "lock as fallback") — the way back is the start
        //   door, which has no pieces: a back exit that still needs platform items (a
        //   caller could not show every player inside holds them) is an AUTHORED lock
        //   on that door, like Jetpack in an exit gate (R15): the page greys it until
        //   the player holds them. Free (sphere growth's, and a recovered entry gate's
        //   back exit) stays free.
        if (back && physics.length) {
            return { side: s.side, back, physics: [], lockedBack: true,
                authored: [...authored, ...physics.map((g) => ({ item: CLOUDBERRY_ITEM_NAMES[g], count: 1 }))] };
        }
        return { side: s.side, back, physics, authored };
    });
    const forward = exits.filter((e) => !e.back);
    const E = forward.length ? forward[0].physics : null;
    for (const e of forward) {
        if (!sameSet(e.physics, E)) {
            throw new Error(`${what}: forward exits need different platform items `
                + `(${forward.map((x) => `${x.side}: [${x.physics.join(', ')}]`).join('; ')}) — every exit leaves `
                + 'by the end door, so their platform requirements must be equal (canHostExitGates declines this)');
        }
    }

    const locs = locationSpecs.map((s) => {
        const { physics, authored } = splitCloudberryRequirement(s.requirement, s.counts);
        return { id: s.id, item: s.item ?? null, physics, authored };
    });
    // The requirement chain ∅ ⊆ R1 ⊆ … ⊆ S_last.
    const sets = [];
    for (const r of [...locs.map((l) => l.physics), ...(E ? [E] : [])]) {
        if (!sets.some((x) => sameSet(x, r))) sets.push(r);
    }
    sets.sort((a, b) => a.length - b.length);
    for (let i = 1; i < sets.length; i++) {
        if (!subset(sets[i - 1], sets[i])) {
            throw new Error(`${what}: requirements [${sets[i - 1].join(', ')}] and [${sets[i].join(', ')}] are `
                + 'incomparable — a level realises its requirements as one nested chain of pieces');
        }
    }
    if (E && sets.length && !sameSet(sets[sets.length - 1], E)) {
        throw new Error(`${what}: a location needs more than the exits ([${sets[sets.length - 1].join(', ')}] ⊄ `
            + `[${E.join(', ')}]) — the end door comes after every piece`);
    }
    if (sets.length === 0) sets.push([]);

    const perPiece = Math.max(1, knob(params, 'cloudberryChecksPerPiece') | 0);
    const pieceSets = [];
    const pieceChecks = [];
    const locations = [];
    for (const R of sets) {
        const mine = locs.filter((l) => sameSet(l.physics, R));
        const n = Math.max(1, Math.ceil(mine.length / perPiece));
        for (let j = 0; j < n; j++) {
            const k = pieceSets.length;
            const group = mine.slice(j * perPiece, (j + 1) * perPiece);
            pieceSets.push(R);
            pieceChecks.push(group.length);
            for (const l of group) locations.push({ id: l.id, item: l.item, piece: k, authored: l.authored });
        }
    }
    // Pad to the minimum with item-free pieces at the start (they hold no checks).
    const minPieces = Math.max(1, knob(params, 'cloudberryMinPieces') | 0);
    while (pieceSets.length < minPieces) {
        pieceSets.unshift([]);
        pieceChecks.unshift(0);
        for (const l of locations) l.piece += 1;
    }

    const rng = createRng(seed);
    let tileset = knob(params, 'cloudberryTileset');
    if (tileset === 'random') tileset = CLOUDBERRY_TILESETS[Math.floor(rng.next() * CLOUDBERRY_TILESETS.length)];
    else if (!CLOUDBERRY_TILESETS.includes(tileset)) throw new Error(`${what}: unknown tileset '${tileset}'`);
    const hazards = {};
    if (knob(params, 'cloudberryHazards') === true) {
        const pool = [...CLOUDBERRY_HAZARD_UPGRADES];
        const kinds = Math.min(pool.length, Math.max(1, knob(params, 'cloudberryHazardKinds') | 0));
        const level = Math.min(10, Math.max(0, Number(knob(params, 'cloudberryHazardLevel'))));
        for (let i = 0; i < kinds; i++) hazards[pool.splice(Math.floor(rng.next() * pool.length), 1)[0]] = level;
    }
    const entryTerms = entrance ? splitCloudberryRequirement(entrance.requirement, entrance.counts).authored : [];
    let jetpack = false;
    if (entryTerms.some((t) => t.item === 'Jetpack')) {
        const chance = Number(knob(params, 'cloudberryJetpackChance'));
        jetpack = chance >= 1 ? true : chance <= 0 ? false : rng.next() < chance;
    }
    let doubleJump = false;
    if (!jetpack && entryTerms.some((t) => t.item === 'Double Jump')) {
        const chance = Number(knob(params, 'cloudberryDoubleJumpChance'));
        doubleJump = chance >= 1 ? true : chance <= 0 ? false : rng.next() < chance;
    }

    // (5) The hero (P5b): the world's values, varied per region when the knob is on.
    const heroKind = cloudberryHeroKind(jetpack, doubleJump);
    const heroBase = cloudberryHeroBase(params, what);
    const variation = Number(knob(params, 'cloudberryHeroVariation'));
    if (!Number.isFinite(variation) || variation < 0 || variation > CLOUDBERRY_HERO_VARIATION_MAX) {
        throw new Error(`${what}: cloudberryHeroVariation = ${knob(params, 'cloudberryHeroVariation')} is outside 0–${CLOUDBERRY_HERO_VARIATION_MAX}`);
    }
    const heroCustom = cloudberryHeroCustom(heroKind, drawCloudberryHero(heroKind, heroBase, variation, rng));
    const heroDraw = variation > 0 ? { kind: heroKind, base: heroBase, variation } : null;

    const jump = Math.min(10, Math.max(0, Number(knob(params, 'cloudberryJumpLevel'))));
    const pieces = pieceSets.map((S, k) => {
        const prev = k > 0 ? pieceSets[k - 1] : [];
        const upgrades = {};
        for (const it of S) upgrades[it] = prev.includes(it) ? 3 : 5;
        Object.assign(upgrades, hazards);
        if (jump > 0) upgrades.Jump = jump;
        return { upgrades };
    });
    const args = {
        seed,
        difficulty: Number(knob(params, 'cloudberryDifficulty')),
        tileset,
        pieceLength: knob(params, 'cloudberryPieceLength') | 0,
        pieces,
        ...(heroCustom ? { heroCustom } : {}),
        trace: false,
        settings: false,
    };
    const needs = { checks: pieceChecks, startDoor: backSide !== null };
    const retries = Math.max(0, knob(params, 'cloudberryRetries') | 0);
    return {
        region_id, args, needs, retries, pieceSets, locations, exits, jetpack,
        // ⛓ P5d — what the payload records beside the request (`params.knobs`).
        knobs: cloudberryRecordedKnobs(params),
        ...(doubleJump ? { doubleJump: true } : {}),
        ...(heroDraw ? { heroDraw } : {}),
        key: cloudberryLevelKey(args, needs, heroDraw),
    };
}

function canonical(v) {
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    if (v && typeof v === 'object') {
        return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
    }
    return JSON.stringify(v);
}

/**
 * The cache key of a level: the request + what its document must offer (canonical JSON),
 * + the hero draw when the hero varies (a retry's redraw depends on it, P5b).
 */
export function cloudberryLevelKey(args, needs, heroDraw = null) {
    return canonical(heroDraw ? { args, needs, heroDraw } : { args, needs });
}

/**
 * Read a generated document against a plan's needs. Returns
 *   { ok: true, facts: {pieceItems, jetpack, doubleJump?}, checks: [[coin id, …] per piece], startDoor }
 * or { ok: false, reason }.
 * Check coins (⚖ R19) are spread through each piece by witness tick among the coins
 * the computer collects there (one → the middle one).
 */
export function readCloudberryDocument(doc, plan, args = plan.args) {
    if (doc?.error) return { ok: false, reason: String(doc.error) };
    const pieces = (doc?.seedPieces ?? []).filter((p) => p.kind === 'piece').sort((a, b) => a.piece - b.piece);
    if (pieces.length !== plan.pieceSets.length) {
        return { ok: false, reason: `${pieces.length} pieces, planned ${plan.pieceSets.length}` };
    }
    const pieceItems = [];
    let union = [];
    for (let k = 0; k < pieces.length; k++) {
        const items = sortItems((pieces[k].items ?? []).filter((it) => it !== 'NormalBlock'));
        for (const it of items) {
            if (!CLOUDBERRY_GAME_ITEMS.includes(it)) return { ok: false, reason: `piece ${k} has unknown item '${it}'` };
        }
        union = sortItems([...union, ...items]);
        if (!sameSet(union, plan.pieceSets[k])) {
            return { ok: false, reason: `piece ${k} realised [${union.join(', ')}], planned [${plan.pieceSets[k].join(', ')}]` };
        }
        pieceItems.push(items);
    }
    const jetpack = doc.level?.heroAbility?.JetPack === true;
    if (jetpack !== plan.jetpack) return { ok: false, reason: `Jetpack hero ${jetpack}, planned ${plan.jetpack}` };
    const doubleJump = heroDoubleJump(doc);
    if (doubleJump !== !!plan.doubleJump) {
        return { ok: false, reason: `Double hero ${doubleJump} (NumJumps ${doc.level?.heroAbility?.NumJumps}), planned ${!!plan.doubleJump}` };
    }
    // P5b: the hero's physics are the request's (the page regenerates the same request; a mismatch is refused by name).
    const heroWrong = cloudberryHeroMismatch(doc, args?.heroCustom ?? null);
    if (heroWrong) return { ok: false, reason: `CloudberryHeroMismatch: ${heroWrong}` };
    const startDoor = Array.isArray(doc.goal?.startDoor);
    if (plan.needs.startDoor && !startDoor) return { ok: false, reason: 'no start door (the way back needs one)' };
    const witnessed = (doc.coins?.list ?? []).filter((c) => c.witness);
    const checks = [];
    for (let k = 0; k < pieces.length; k++) {
        const want = plan.needs.checks[k];
        const list = witnessed.filter((c) => c.piece === k)
            .sort((a, b) => a.witness.tick - b.witness.tick || a.id - b.id);
        if (list.length < want) return { ok: false, reason: `piece ${k} has ${list.length} witnessed coin(s), needs ${want}` };
        const chosen = [];
        for (let i = 0; i < want; i++) chosen.push(list[Math.floor(((i + 0.5) * list.length) / want)].id);
        checks.push(chosen);
    }
    return { ok: true, facts: { pieceItems, jetpack, ...(doubleJump ? { doubleJump: true } : {}) }, checks, startDoor };
}

/**
 * The zone rules for a plan and its generated result
 * ({ generate, docSha256, facts, checks }): what generateZoneForSpecs returns.
 * Check names are the engine's location ids (the page's `checks` keys).
 */
export function emitCloudberryZone(plan, result) {
    const { region_id } = plan;
    const facts = {
        pieceItems: result.facts.pieceItems, jetpack: result.facts.jetpack,
        ...(result.facts.doubleJump ? { doubleJump: true } : {}),
    };
    const obstacleDefs = {};
    const gateRules = { portals: {}, pickups: {} };
    const take = ({ paths, authoredDefs }) => {
        Object.assign(obstacleDefs, authoredDefs);
        return paths;
    };
    const referenced = new Set();
    const used = new Map();
    const checks = [];
    const locations = plan.locations.map((l) => {
        const idx = used.get(l.piece) ?? 0;
        used.set(l.piece, idx + 1);
        const coin = result.checks[l.piece]?.[idx];
        if (coin === undefined) throw new Error(`cloudberry zone '${region_id}': no check coin for '${l.id}' in piece ${l.piece}`);
        checks.push({ name: l.id, coin, piece: l.piece });
        if (l.authored.length) gateRules.pickups[l.id] = requirementRule([], l.authored);
        const paths = take(emitCloudberryPaths(requiredItems(facts, l.piece), l.authored));
        for (const o of paths[0].obstacles) referenced.add(o);
        return { id: l.id, item: l.item, paths, position: null };
    });
    const last = requiredItems(facts, facts.pieceItems.length - 1);
    const exitPaths = {};
    for (const e of plan.exits) {
        if (e.authored.length) gateRules.portals[PAGE_SIDE[e.side]] = requirementRule([], e.authored);
        const paths = take(emitCloudberryPaths(e.back ? [] : last, e.authored));
        for (const o of paths[0].obstacles) referenced.add(o);
        exitPaths[e.side] = paths;
    }
    for (const id of [...referenced].sort()) {
        if (CLOUDBERRY_LIBRARY_OBSTACLES[id]) obstacleDefs[id] = CLOUDBERRY_LIBRARY_OBSTACLES[id];
    }
    return { locations, exitPaths, obstacleDefs, gateRules, checks };
}

/** The payload of an emitted zone (`buildCloudberryPayload` with the zone's checks). */
export function cloudberryZonePayload(plan, result, zone) {
    return buildCloudberryPayload(plan.region_id, {
        generate: result.generate, docSha256: result.docSha256, checks: zone.checks, gateRules: zone.gateRules,
        doubleJump: result.facts?.doubleJump === true, knobs: plan.knobs,
    });
}
