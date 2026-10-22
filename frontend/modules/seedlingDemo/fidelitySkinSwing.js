/**
 * seedling-fidelity-skinswing — DOES THE GAME LAND THE TWO ART-STANDS' SWINGS? (a WITNESS slice; no model edit).
 *
 * `seedlingEnemySkin.test.js`'s stands `lavarunner-L71` (boot [96,200]) and `bulb-L74` ([80,100]) run the `FIGHT` key
 * tape for 300 ticks. Since the MASKS flip they run with `pixelMaskSightLines` OFF, because with it ON the model's
 * chaser arm asks `Player.slash`'s line of sight (`Player.as:917`) and the stand's swings never land (0 'die' frames).
 * Each stand is played here as a staged tape (the same boot, the sword, the same keys — `fidelitySkinSwing.test.js`
 * checks the staged run equals the stand's `createJsRuntime` boot tick for tick) on a FRESH p4g page by
 * `scripts/procgen/probe-seedling-skin-swing.mjs --record` → `fixtures/skinswing-witness/`, and the model replays it
 * with the key ON and OFF.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ropeStaging } from './fidelityRope.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const SKINSWING_WITNESS_DIR = join(HERE, 'fixtures', 'skinswing-witness');

/** `seedlingEnemySkin.test.js`'s `FIGHT` (copied; `fidelitySkinSwing.test.js` pins the two equal). */
export const FIGHT = Object.freeze(['primary', '', '', '', '', '', '', '', '', 'left', 'left', '', '', '', '', '', '', '', '',
    'right+primary', '', '', '', '', '', '', '', '', '', '', '', 'down+primary', '', '', '', '', '', '', '', 'up', 'up', '', '',
    '']);

/**
 * The two stands (`stand` = the skin test's TAPES row name), and one `resite` CANDIDATE per stand: the nearest 8 px
 * boot where the player is free, the key's ON and OFF arms agree, and FIGHT kills (a model search, then played on the
 * game — js picks the re-site; these are measured offers, not the choice).
 */
export const SKINSWING_WITNESSES = Object.freeze([
    Object.freeze({ name: 'skinswing-l71-lavarunner', stand: 'lavarunner-L71', boot: { level: 71, x: 96, y: 200 }, n: 300 }),
    Object.freeze({ name: 'skinswing-l74-bulb', stand: 'bulb-L74', boot: { level: 74, x: 80, y: 100 }, n: 300 }),
    Object.freeze({ name: 'skinswing-l71-resite', stand: 'lavarunner-L71', boot: { level: 71, x: 80, y: 208 }, n: 300,
        resite: true }),
    Object.freeze({ name: 'skinswing-l74-resite', stand: 'bulb-L74', boot: { level: 74, x: 64, y: 100 }, n: 300, resite: true }),
]);

/** The stand's per-tick held keys (the skin test's `keysOf`). */
export const fightKeys = (n) => Array.from({ length: n }, (_, i) => FIGHT[i % FIGHT.length])
    .map((k) => new Set(k ? k.split('+') : []));

/** The witness's tape. */
export async function skinSwingTape(w) {
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging({ boot: w.boot, items: ['hasSword'], persistence: [] });
    const tape = buildStagedTape({ staging, perTick: fightKeys(w.n), name: w.name });
    return { ...tape, description: `seedling-fidelity-skinswing: ${w.name} (probe-seedling-skin-swing.mjs)` };
}

/** A game `botMobiles` class → the model's chaser tag (`Enemies::LavaRunner` → `lavarunner`). */
export const tagOfClass = (cls) => String(cls).split(/[:.]/).pop().toLowerCase();
const CHASER_TAGS = new Set(['bob', 'jellyfish', 'lavarunner', 'puncher', 'bobsoldier', 'bulb', 'flyer']);

/** One game poll (`botStatus` + `botMobiles`), folded to a sample. */
export function skinSwingSampleOf(s, m) {
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null, slash: s.slash ?? null,
        chasers: (m.mobiles ?? []).filter((r) => r.enemy && CHASER_TAGS.has(tagOfClass(r.cls))).map((r) => ({
            tag: tagOfClass(r.cls), x: r.x, y: r.y, hits: r.enemy.hits, hitsTimer: r.enemy.hits_timer, anim: r.anim,
            destroy: r.destroy })),
    };
}

/**
 * The model's samples of a tape under `over` (`pixelMaskSightLines` ON or OFF): per tick the player and every chaser
 * (`hits`, `hitsTimer`, `dying`), plus the run's `chaserPressHits`. A model error (e.g. the OFF arm's undeclared L71
 * kill lock) ends the samples and is returned.
 */
export async function skinSwingModelSamples(tapeJson, over) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const samples = [];
    let pressHits = [];
    let error = null;
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(tapeJson)),
            { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            for (let r = st.next(); !r.done; r = st.next()) {
                const o = r.value.observation;
                samples[o.t] = { t: o.t, x: o.x, y: o.y, level: run.level, hits: run.damage.hits,
                    chasers: run.chasers.map((c) => ({ id: c.id, x: c.x, y: c.y, hits: c.hits, hitsTimer: c.hitsTimer,
                        dying: c.dying === true, destroy: c.destroy === true })) };
            }
        } catch (e) {
            error = e.message;
        }
        pressHits = run ? run.chaserPressHits : [];
    });
    return { samples, pressHits, error };
}

/** The ticks each side's bodies TOOK a hit (hits rose) — `[{t, key, hits}]`, keyed by the boot placement. */
export function hitEvents(samples, keyOf) {
    const out = [];
    const last = new Map();
    for (const s of samples) {
        if (!s) continue;
        s.chasers.forEach((c, i) => {
            const k = keyOf(c, i, s);
            const was = last.get(k) ?? 0;
            if (c.hits > was) out.push({ t: s.t, key: k, hits: c.hits });
            last.set(k, c.hits);
        });
    }
    return out;
}

/**
 * Compare a game witness with a model arm, every sampled tick: the player (x, y, level, hits); per chaser tag the
 * count, and each body's position and `hits` (the game rows joined to the model's by the cheapest pairing). `[]` = 0 px.
 */
export function compareSkinSwing(game, model) {
    const bad = [];
    const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)])
        .map((p) => [x, ...p])));
    const pair = (gs, ms) => {
        if (gs.length > 6) return ms;
        let best = null;
        let cost = Infinity;
        for (const p of perms(ms)) {
            const c = gs.reduce((sum, g, i) => sum + Math.hypot(g.x - p[i].x, g.y - p[i].y), 0);
            if (c < cost) { cost = c; best = p; }
        }
        return best ?? [];
    };
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) { bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`); continue; }
        if (m.hits !== g.hits) bad.push(`t ${g.t}: player hits game ${g.hits} model ${m.hits}`);
        const tags = [...new Set([...g.chasers.map((c) => c.tag), ...m.chasers.map((c) => c.id.split('@')[0])])];
        for (const tag of tags) {
            const gc = g.chasers.filter((c) => c.tag === tag);
            const mc = m.chasers.filter((c) => c.id.startsWith(`${tag}@`));
            if (gc.length !== mc.length) { bad.push(`t ${g.t}: game has ${gc.length} ${tag}(s), the model ${mc.length}`); continue; }
            const pc = pair(gc, mc);
            gc.forEach((c, i) => {
                const b = pc[i];
                if (c.x !== b.x || c.y !== b.y) bad.push(`t ${g.t} ${b.id}: game (${c.x}, ${c.y}) model (${b.x}, ${b.y})`);
                if (c.hits !== b.hits) bad.push(`t ${g.t} ${b.id}: hits game ${c.hits} model ${b.hits}`);
            });
        }
    }
    return bad;
}
