/**
 * ⛓⛓⛓ SEEDLING FIDELITY L39SHAFT (wave 31) — L39's three-block shaft, the user's solution (⚖ 2026-10-25): *"move the
 * three blocks into the three inner switches, then stand between them and use fire, which means that for a moment the
 * blocks are half on one button and half on another."*
 *
 * THE ROOM (`Dungeon3`'s L39, the atlas records; `r5Shaft.SHAFT_PLAN` is the hand plan R5 recorded as `r5-shaft`):
 *
 *     inner buttons (each opens a cover)         outer buttons (each under a cover; each opens a wandlock)
 *       button@144,128 (9,8) {t 1} → cover@176,144 (11,9) + wandlock@48,160 (3,10)
 *       button@160,144 (10,9) {t 2} → cover@112,144 (7,9)
 *       button@128,144 (8,9) {t 0} → cover@144,112 (9,7)
 *                                                  button@144,112 (9,7) {t 4} → wandlock@144,48 (9,3)
 *                                                  button@176,144 (11,9) {t 5} → wandlock@144,32 (9,2)
 *                                                  button@112,144 (7,9) {t 3} → wandlock@144,64 (9,4)
 *
 *     Button.as:27-39   `activate = tempCheck` every update: a plain button republishes, so only a Solid parked on it
 *                       holds its group (`hitables` holds "Solid"; `PushableBlockFire` is `type = "Solid"`)
 *     Cover.as:37-66    while its group is published the alpha falls 0.1 a tick and the type goes "" at 0; when the
 *                       group drops it resets to "Solid" ONLY if no Solid (and no Player) is inside it
 *     Lock.as:62-101    while published the alpha falls 0.01 a tick and `turnOff()` writes `setPersistence(tag,
 *                       false)`; when the group drops and nothing is inside, `returnToNormal()` writes it back TRUE
 *     Player.fire()     one 32x32 rect centred on the player; `genericHit` pushes EVERY block in it `atan2` AWAY
 *
 * So each outer button sits under a cover that only ANOTHER block's inner button opens, and the only way to hold all
 * three wandlocks at once is the final press: the three blocks on the three inner buttons, the player at (9,9) between
 * them, one Fire press. Block (9,8) goes north onto t4 (cover t0 open: (8,9) is held), block (10,9) east onto t5
 * (cover t1 open: (9,8) is held), block (8,9) west onto t3 (cover t2 open: (10,9) is held). Each block enters its
 * destination cover on the glide's first tick and keeps overlapping the inner button it is LEAVING for another ~22
 * ticks — **the half-on moment**: every block is on two buttons at once, every cover is held by its group AND by the
 * block inside it, and when the inner buttons drop the covers stay open because a Solid is in each (`Cover.as`'s
 * occupancy guard).
 *
 * This module is the D1 game witness's fold (shared by `scripts/procgen/probe-seedling-l39-shaft.mjs`, which plays a
 * tape on the game, and `fidelityL39Shaft.test.js`, which replays the recording against the model at 0 px): the
 * player, every `PushableBlockFire`, every `Spinner` (the room's billiards, which a block's glide collides with:
 * `r5Shaft.SPINNER_WEDGE`) and L39's lock tags in the persistence ledger, every tick. The half-on readout is derived
 * from the BLOCK POSITIONS (`buttonsUnder`), the same function on both sides.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const L39SHAFT_WITNESS_DIR = join(HERE, 'fixtures', 'l39shaft-witness');
/** D1: the user's solution as scripted inputs — `r5-shaft`'s committed tape (`SHAFT_PLAN`, eighteen Fire presses). */
export const L39SHAFT_SCRIPTED_WITNESS = 'l39shaft-scripted';
/** D2: the solver's own plan, the survey's step 66 (`Level 039 - Totem Part 72,40`) with the key ON. */
export const L39SHAFT_SOLVER_WITNESS = 'l39shaft-solver-step66';

export const L39 = 39;

/** The six buttons, by AS3 group: the cell, and the 8x6 hitbox `setHitbox(8, 6, 4, 3)` about the cell centre. */
export const L39_BUTTONS = Object.freeze([
    { id: 'button@144,128', t: 1, tx: 9, ty: 8, ring: 'inner' },
    { id: 'button@160,144', t: 2, tx: 10, ty: 9, ring: 'inner' },
    { id: 'button@128,144', t: 0, tx: 8, ty: 9, ring: 'inner' },
    { id: 'button@144,112', t: 4, tx: 9, ty: 7, ring: 'outer' },
    { id: 'button@176,144', t: 5, tx: 11, ty: 9, ring: 'outer' },
    { id: 'button@112,144', t: 3, tx: 7, ty: 9, ring: 'outer' },
].map((b) => Object.freeze({ ...b, rect: Object.freeze({ x: b.tx * 16 + 4, y: b.ty * 16 + 5, w: 8, h: 6 }) })));

/** L39's lock tags in the persistence ledger: the three shaft wandlocks, and the pocket's `wandlock@48,160` {tag 7}. */
export const L39_LOCK_TAGS = Object.freeze([0, 1, 2, 7]);

const BLOCK = 16;

/** The buttons a 16x16 block at (x, y) overlaps (`Button.update`'s `collideTypesInto`: rect overlap, open edges). */
export function buttonsUnder(x, y) {
    return L39_BUTTONS.filter((b) => x < b.rect.x + b.rect.w && x + BLOCK > b.rect.x
        && y < b.rect.y + b.rect.h && y + BLOCK > b.rect.y).map((b) => b.id);
}

const CLASS = /(^|:)(PushableBlockFire|Spinner)$/;

/** The game poll's fold: the player, every fire block and spinner (`botMobiles`), and L39's lock tags cleared. */
export function l39SampleOf(s, m) {
    const mob = (m.mobiles ?? []).filter((r) => CLASS.test(r.cls));
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y,
        blocks: mob.filter((r) => r.cls.endsWith('PushableBlockFire')).map((r) => ({ x: r.x, y: r.y })),
        // a spinner whose `destroy` is up is dying (the game keeps its body listed through the fade; the model's
        // `spinnerBodies` stops listing it on the tick `destroy` goes up), so both folds drop it on that tick
        spinners: mob.filter((r) => r.cls.endsWith('Spinner') && !r.destroy).map((r) => ({ x: r.x, y: r.y })),
        locks: (s.persistence_cleared ?? []).filter((f) => f.level === L39 && L39_LOCK_TAGS.includes(f.tag))
            .map((f) => f.tag).sort((a, b) => a - b),
    };
}

/** The recording's compact row: `[t, level, x, y, blocks, spinners, locks]` (`x,y` joined by `;`, tags by `,`). */
export function packL39Sample(g) {
    const xy = (l) => l.map((b) => `${b.x},${b.y}`).join(';');
    return [g.t, g.level, g.x, g.y, xy(g.blocks), xy(g.spinners), g.locks.join(',')];
}

/** The inverse of `packL39Sample`. */
export function unpackL39Sample(row) {
    const [t, level, x, y, blocks, spinners, locks] = row;
    const xy = (s) => (s ? s.split(';').map((p) => { const [a, b] = p.split(',').map(Number); return { x: a, y: b }; }) : []);
    return { t, level, x, y, blocks: xy(blocks), spinners: xy(spinners),
        locks: locks === '' ? [] : String(locks).split(',').map(Number) };
}

/**
 * The level source a witness is replayed on: `vanilla` (the atlas records, the game page's own set) or `delivered` (the
 * records with `SEEDLING_SET_PATCHES` applied — the set the playthrough hands the player and the route survey solves on;
 * in L39 it has no `fallrock@144,624`, so the rope's publication drops no rock and freezes nothing).
 */
export async function l39LevelSource(set = 'vanilla') {
    const { atlasLevelSource } = await import('./levelSource.js');
    if (set === 'vanilla') return atlasLevelSource();
    if (set !== 'delivered') throw new Error(`l39LevelSource: unknown set ${JSON.stringify(set)} (vanilla | delivered)`);
    const { readFileSync } = await import('node:fs');
    const { levelSourceFromAtlas } = await import('./atlasSource.js');
    const { patchedMapDocument } = await import('./seedlingSetPatches.js');
    return levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(
        join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'))));
}

/** The model's samples of a tape, by tape tick, under `over` (contact-fidelity keys): the same fold as the game's. */
export async function l39ModelSamples(tapeJson, over = {}, { set = 'vanilla' } = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const levelSource = await l39LevelSource(set);
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let error = null;
    const declared = new Set((tape.persistence ?? []).filter((p) => p.level === L39 && L39_LOCK_TAGS.includes(p.tag))
        .map((p) => p.tag));
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                const inL39 = run && run.level === L39;
                const rows = inL39 ? (run.world.pushables ?? []) : [];
                const live = inL39 ? run.entities('pushables') : null;
                const locks = new Set(declared);
                for (const w of (run ? run.lockWrites : [])) {
                    if (w.flag.level !== L39 || !L39_LOCK_TAGS.includes(w.flag.tag)) continue;
                    if (w.value) locks.delete(w.flag.tag); else locks.add(w.flag.tag);
                }
                samples[o.t] = {
                    t: o.t, x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    blocks: live ? rows.filter((p) => p.as3 === 'PushableBlockFire').map((p) => live.get(p.id))
                        .filter((b) => b && !b.removed).map((b) => ({ x: b.rect.x, y: b.rect.y })) : [],
                    spinners: inL39 ? run.entities('spinnerBodies').filter((b) => !b.destroy)
                        .map((b) => ({ x: b.x, y: b.y })) : [],
                    locks: [...locks].sort((a, b) => a - b),
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
    });
    return { samples, error };
}

const key = (b) => `${b.x},${b.y}`;

/**
 * Compare a game witness with the model on every sampled tick: the player, the level, and in L39 every fire block,
 * every spinner and the lock tags. `lockLag` is the ledger's read offset in ticks (the game's poll reads the
 * persistence array after the tick that wrote it), measured rather than assumed: the caller passes the one it found.
 */
export function compareL39Witness(game, model, { lockLag = 0 } = {}) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (g.level !== L39 || m.level !== L39) continue;
        for (const part of ['blocks', 'spinners']) {
            const gs = g[part].map(key).sort().join(' ');
            const ms = m[part].map(key).sort().join(' ');
            if (gs !== ms) bad.push(`t ${g.t}: ${part} game [${gs}] model [${ms}]`);
        }
        const ml = model[g.t - lockLag]?.locks ?? m.locks;
        if (g.locks.join(',') !== ml.join(',')) bad.push(`t ${g.t}: locks game [${g.locks}] model [${ml}]`);
    }
    return bad;
}

/**
 * ⛓ THE HALF-ON READOUT: the ticks on which some block overlaps TWO buttons, each block's button set on those ticks,
 * and the first tick every outer button is under a block. Derived from block positions alone (`buttonsUnder`), so the
 * game's and the model's are the same function of their own samples.
 */
export function halfOnReadout(samples) {
    const twoOn = [];
    let allOuter = null;
    const outer = L39_BUTTONS.filter((b) => b.ring === 'outer').map((b) => b.id);
    for (const s of samples) {
        if (!s || s.level !== L39) continue;
        const under = s.blocks.map((b) => buttonsUnder(b.x, b.y));
        if (under.some((u) => u.length >= 2)) twoOn.push({ t: s.t, under });
        if (allOuter === null && outer.every((id) => under.some((u) => u.includes(id)))) allOuter = s.t;
    }
    return {
        twoOn,
        first: twoOn[0]?.t ?? null,
        last: twoOn.at(-1)?.t ?? null,
        /** the ticks on which ALL THREE blocks are each on two buttons */
        allThreeTwoOn: twoOn.filter((r) => r.under.filter((u) => u.length >= 2).length === 3).map((r) => r.t),
        allOuter,
    };
}

/** The first tick each lock tag enters the cleared set, and (tag 7) leaves it again. */
export function lockTimeline(samples) {
    const out = {};
    let prev = new Set();
    for (const s of samples) {
        if (!s) continue;
        const now = new Set(s.locks);
        for (const t of now) if (!prev.has(t)) (out[t] ??= []).push({ cleared: s.t });
        for (const t of prev) if (!now.has(t)) (out[t] ??= []).push({ restored: s.t });
        prev = now;
    }
    return out;
}
