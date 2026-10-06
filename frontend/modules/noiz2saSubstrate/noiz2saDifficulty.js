/**
 * Noiz2sa substrate — how hard a span of scenes is for the humanlike bot at a skill (bulletml N5). Pure.
 *
 * The data is the game repo's measured segment sweeps (`noiz2saDifficultyData.js`, generated): per scene of stages
 * 1–10 and per aligned three-scene span, at skills 0–80 step 10 and 90, 92, 94, 96, 98, 99, 100, the attempts `n`
 * (one per bot seed, 16), the deathless ones, a clean clear's seconds L and a failed attempt's seconds F. A SKILL is
 * the skill slider: every track at that value (`tracks.js`: equal tracks = the slider).
 *
 *  - The CHANCE `p` of a span at a skill is its deathless share. A span the sweeps measured (one scene, a boss, an
 *    aligned triple such as 2:4–2:6) uses its own measurement; any other span is the PRODUCT of its scenes' chances
 *    (⚖ the brief: "For spans not measured, the product of the per-scene chances"; `modelVersusMeasured` is how far
 *    that product is from the measured triples).
 *  - A measured share is noisy (16 attempts) and not monotone in skill (1:1: 31% at skill 0, 69% at 10, 25% at 20).
 *    Each series is smoothed to be NON-DECREASING in skill (weighted isotonic regression, the pool-adjacent-violators
 *    algorithm, each level weighted by its `n`) and read between the measured skills linearly. Without it "the
 *    hardest span the bot clears with chance ≥ 0.5" would flicker between spans as the predicted skill rises.
 *  - The EXPECTED SECONDS `E` of a span with restart-on-hit — the time a clear costs — is the game repo's
 *    `E = L + F(1 − p)/p` for one cell, and for a product span the same thing scene by scene: an attempt plays scene
 *    i only when it cleared the scenes before it, so an attempt's mean length is Σᵢ (Πⱼ<ᵢ pⱼ)(pᵢLᵢ + (1 − pᵢ)Fᵢ) and
 *    a clear takes 1/Πpᵢ attempts. `p` is floored at `P_FLOOR` (half a success in 16) so a span no bot seed cleared
 *    has a large, finite E instead of an infinite one.
 *  - L of a scene is measured per skill (a boss dies faster at a higher skill), read between skills like p, a skill
 *    with no clean clear taking the nearest one that had one. F is pooled over every skill (weighted by the failed
 *    attempts): it moves little with skill, and many cells have too few failures to say.
 */
import { NOIZ2SA_DIFFICULTY } from './noiz2saDifficultyData.js';
import { showSpan, parsePosition, BOSS_SCENE, STAGE_NUM } from './noiz2saRegion.js';

/** the measured skills, ascending */
export const SKILLS = Object.freeze([...NOIZ2SA_DIFFICULTY.skills]);
/** the chance a span's expected seconds are computed with at least: half a success in the sweeps' 16 attempts */
export const P_FLOOR = 1 / 32;
/** scenes per stage (0–8 ordinary, 9 the boss) and the scenes the table covers: stages 1–10 */
const PER_STAGE = BOSS_SCENE + 1;
export const SCENE_TOTAL = STAGE_NUM * PER_STAGE;

/** a position → its index 0–99 over stages 1–10 (stage-major); an endless-mode position → -1 */
export const sceneIndex = (p) => (p.stage < STAGE_NUM ? p.stage * PER_STAGE + p.scene : -1);
/** index 0–99 → the position */
export const scenePosition = (i) => ({ stage: Math.floor(i / PER_STAGE), scene: i % PER_STAGE });
/** the span of `n` scenes from index `a` */
export const spanAt = (a, n) => ({ start: scenePosition(a), end: scenePosition(a + n - 1) });

/** weighted isotonic regression (non-decreasing), pool-adjacent-violators */
export function isotonic(values, weights) {
    const blocks = [];
    values.forEach((v, i) => {
        blocks.push({ v, w: weights[i], n: 1 });
        while (blocks.length > 1 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
            const b = blocks.pop(); const a = blocks.pop();
            const w = a.w + b.w;
            blocks.push({ v: w > 0 ? (a.v * a.w + b.v * b.w) / w : (a.v + b.v) / 2, w, n: a.n + b.n });
        }
    });
    return blocks.flatMap((b) => Array(b.n).fill(b.v));
}

/** linear interpolation of `ys` (at SKILLS) at `skill`, clamped to the measured range */
function atSkill(ys, skill) {
    const s = Math.min(SKILLS[SKILLS.length - 1], Math.max(SKILLS[0], Number(skill) || 0));
    let i = 0;
    while (i < SKILLS.length - 2 && SKILLS[i + 1] < s) i++;
    const [x0, x1] = [SKILLS[i], SKILLS[i + 1]];
    const t = x1 > x0 ? (s - x0) / (x1 - x0) : 0;
    return ys[i] + (ys[i + 1] - ys[i]) * Math.max(0, Math.min(1, t));
}

/** one measured series (rows [n, deathless, L, F] per skill) → {p (smoothed), raw, L per skill, F, n} */
function seriesOf(rows) {
    const raw = rows.map(([n, d]) => (n > 0 ? d / n : 0));
    const p = isotonic(raw, rows.map(([n]) => n));
    const L = rows.map((r) => r[2]);
    const known = L.map((v, i) => (v === null ? null : i)).filter((i) => i !== null);
    const Lfull = L.map((v, i) => {
        if (v !== null) return v;
        let best = known[0];
        for (const k of known) if (Math.abs(SKILLS[k] - SKILLS[i]) < Math.abs(SKILLS[best] - SKILLS[i])) best = k;
        return L[best];
    });
    let fw = 0; let fs = 0;
    for (const [n, d, , f] of rows) if (f !== null && n - d > 0) { fw += n - d; fs += f * (n - d); }
    const meanL = Lfull.reduce((a, b) => a + b, 0) / Lfull.length;
    return { p, raw, L: Lfull, F: fw > 0 ? fs / fw : meanL / 2, n: rows.map(([n]) => n) };
}

const SCENES = Array.from({ length: SCENE_TOTAL }, (_, i) => {
    const key = showSpan({ start: scenePosition(i), end: scenePosition(i) });
    const rows = NOIZ2SA_DIFFICULTY.scenes[key];
    if (!rows) throw new Error(`noiz2saDifficulty: no measurement for scene ${key}`);
    return seriesOf(rows);
});
const MEASURED = new Map(Object.entries(NOIZ2SA_DIFFICULTY.triples).map(([k, rows]) => [k, seriesOf(rows)]));

/** a span → [first, last] scene index; throws outside stages 1–10 (the sweeps measured nothing else) */
function bounds(span) {
    const a = sceneIndex(span.start); const b = sceneIndex(span.end);
    if (a < 0 || b < 0 || b < a) throw new Error(`noiz2sa pricing: ${showSpan(span)} is not a span of stages 1–10`);
    return [a, b];
}

/** a scene's smoothed chance at a skill */
export const sceneChance = (i, skill) => atSkill(SCENES[i].p, skill);

/** the model's view of a span at a skill: {p, seconds, measured} (`measured`: the span's own measurement was used) */
export function spanDifficulty(span, skill) {
    const [a, b] = bounds(span);
    const own = a === b ? SCENES[a] : MEASURED.get(showSpan(span));
    if (own) {
        const p = atSkill(own.p, skill);
        const pf = Math.max(P_FLOOR, p);
        const L = atSkill(own.L, skill);
        return { p, seconds: L + own.F * (1 - pf) / pf, measured: true };
    }
    let reach = 1; let attempt = 0;
    for (let i = a; i <= b; i++) {
        const s = SCENES[i];
        const p = atSkill(s.p, skill);
        attempt += reach * (p * atSkill(s.L, skill) + (1 - p) * s.F);
        reach *= p;
    }
    return { p: reach, seconds: attempt / Math.max(P_FLOOR, reach), measured: false };
}
export const spanChance = (span, skill) => spanDifficulty(span, skill).p;
export const spanSeconds = (span, skill) => spanDifficulty(span, skill).seconds;

/** the number of scenes a span of stages 1–10 plays */
export const spanLength = (span) => { const [a, b] = bounds(span); return b - a + 1; };

/**
 * ⚖ The move span of a region with `n` scenes at a predicted skill (the user: "a scene that the current stats have a
 * 50% chance of winning, erring on the side of a higher chance of winning"): of every span of `n` scenes in stages
 * 1–10, the one whose chance is the LOWEST that is still ≥ `target` — the hardest the bot clears deathless at least
 * half the time, which is the same span as the one closest to 0.5 from above. Ties: the earliest. When no span
 * reaches `target` (a low skill and a long span), the easiest one (the highest chance), earliest on a tie.
 * → {span, p, seconds, reached}
 */
export function pickSpan(n, skill, { target = 0.5 } = {}) {
    const len = Math.max(1, Math.min(SCENE_TOTAL, Math.round(n)));
    let above = null; let best = null;
    for (let a = 0; a + len <= SCENE_TOTAL; a++) {
        const span = spanAt(a, len);
        const d = spanDifficulty(span, skill);
        if (d.p >= target && (!above || d.p < above.p)) above = { span, ...d };
        if (!best || d.p > best.p) best = { span, ...d };
    }
    const pick = above ?? best;
    return { span: pick.span, p: pick.p, seconds: pick.seconds, reached: !!above };
}

/** "10:7–10:boss" (an en dash or a hyphen between) or one position "3:boss" → a span of stages 1–10; throws */
export function parseSpan(text) {
    const parts = String(text ?? '').trim().split(/\s*[–-]\s*(?=\d)/);
    if (parts.length < 1 || parts.length > 2 || !parts[0]) throw new Error(`a span is STAGE:SCENE–STAGE:SCENE, e.g. 10:7–10:boss (got ${text})`);
    const start = parsePosition(parts[0]);
    const end = parts.length === 2 ? parsePosition(parts[1]) : { ...start };
    bounds({ start, end });
    return { start, end };
}

/**
 * The product model against the measured three-scene spans: one row per triple × measured skill —
 * {span, skill, n, measured (the raw deathless share), model (the product of the scenes' smoothed chances),
 * modelRaw (the product of their raw shares)}.
 */
export function modelVersusMeasured() {
    const out = [];
    for (const [key, own] of MEASURED) {
        const span = parseSpan(key);
        const [a, b] = bounds(span);
        SKILLS.forEach((skill, k) => {
            let model = 1; let modelRaw = 1;
            for (let i = a; i <= b; i++) { model *= SCENES[i].p[k]; modelRaw *= SCENES[i].raw[k]; }
            out.push({ span: key, skill, n: own.n[k], measured: own.raw[k], model, modelRaw });
        });
    }
    return out;
}
