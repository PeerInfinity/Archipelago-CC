/**
 * seedling-fidelity-spearrect — THE SPEAR'S TEST AS THE GAME RUNS IT (`CONTACT_FIDELITY.spearGameTest`): the game
 * witnesses' tapes and the model's readings of them. Shared by `scripts/procgen/probe-seedling-spearrect.mjs` (plays
 * each tape on the game, `--record`) and `fidelitySpearRect.test.js` (replays the recordings against the model, 0 px).
 *
 * `Player.spear()` (`Player.as:954-992`) tests a 32x5 rect from the `int` origin with `Entity.collideRect`'s inclusive
 * edges, with no reach gate and no line test, on T+1, T+3 and T+5. One witness per body class where that rule changes
 * the outcome:
 *
 *   spearrect-l98-jelly-repeat   (a MOVER, a late test) hammer C3's hand-built L98 tape (`c3-d1-l98-spear-west`), two
 *                                thrusts east at t2 and t33 from (76,40): the second thrust's T+3 test hits
 *                                `jellyfish@56,48`, which walked into the rect after the first test — the game reads
 *                                hits 3 and "die" on t39; OFF the model carries one test and reads 1/19
 *   spearrect-l63-jelly-reach    (a MOVER, no reach gate) L63, boot (192,96), a tap up, the thrust UP from (200,102.3) at
 *                                t6: `jellyfish@192,56` is ~32 px up the rect — `spear()` hits it (hits 2, knocked back);
 *                                OFF the model borrowed `slash()`'s 16 px `distanceRectPoint` gate and refused it
 *   spearrect-l40-turret-corner  (a STATIC body at half pixels, both inclusive edges) L40, boot (431,432), a tap right,
 *                                the thrust east from (440.7,440) at t7: the game's rect is x 440..472, y 439.5..444.5;
 *                                `iceturret@472,400` rests a half pixel off its cell on alternate ticks and on t7 its box
 *                                is x 472..504, y 407.5..439.5 — the two touch at a corner, `collideRect` collects it
 *                                (hits 2); the strict float rect (x 440.7..472.7) misses it
 *   spearrect-l63-block-far-edge (a STATIC body, the far edge) L63, boot (72,84), a tap down then a tap right, the thrust
 *                                east from (80,92.8): the game's rect ends at int(80) + 32 = 112, `pushableblockspear@112,96`
 *                                starts at x 112 — collected, and the block slides to (128,96); the strict rect (x < 112
 *                                fails) leaves it where it is
 *   spearrect-l63-block-truncated-y (the other way) boot (73,83), the same taps, the thrust east from (81,91.8): the
 *                                game's rect is y int(92.8) - 1.5 .. + 5 = 90.5..95.5, the block's top is 96 — missed, the
 *                                block stays; the float rect (y 91.3..96.3) reaches it and the old model pushes it
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ropeStaging } from './fidelityRope.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const SPEARRECT_WITNESS_DIR = join(HERE, 'fixtures', 'spearrect-witness');

/** The switches every witness is replayed under: this slice's key (the rest at their defaults). */
export const SPEARRECT_SWITCHES = Object.freeze({ spearGameTest: true });

/** The game classes each witness compares, beside the player. */
export const SPEARRECT_WITNESSES = Object.freeze([
    Object.freeze({ name: 'spearrect-l98-jelly-repeat', killLock: true, classes: ['Jellyfish', 'IceTurret'],
        source: { fixture: join(HERE, 'fixtures', 'iceturret-spear-witness', 'c3-d1-l98-spear-west.json') } }),
    Object.freeze({ name: 'spearrect-l63-jelly-reach', killLock: false, classes: ['Jellyfish'],
        source: { boot: { level: 63, x: 192, y: 96 }, items: ['hasSpear'], keys: ['up', '', '', '', '', 'primary'],
            tail: 30 } }),
    Object.freeze({ name: 'spearrect-l40-turret-corner', killLock: false, classes: ['IceTurret'],
        source: { boot: { level: 40, x: 431, y: 432 }, items: ['hasSpear'], keys: ['right', '', '', '', '', '', 'primary'],
            tail: 30 } }),
    Object.freeze({ name: 'spearrect-l63-block-far-edge', killLock: false, classes: ['PushableBlockSpear'],
        source: { boot: { level: 63, x: 72, y: 84 }, items: ['hasSpear'],
            keys: ['down', '', '', '', '', '', 'right', '', '', '', '', '', 'primary'], tail: 40 } }),
    Object.freeze({ name: 'spearrect-l63-block-truncated-y', killLock: false, classes: ['PushableBlockSpear'],
        source: { boot: { level: 63, x: 73, y: 83 }, items: ['hasSpear'],
            keys: ['down', '', '', '', '', '', 'right', '', '', '', '', '', 'primary'], tail: 40 } }),
]);

/** The witness's tape: the fixture's own, or a scripted one (the spear selected at t0, one key set per tick). */
export async function spearRectTape(w) {
    if (w.source.fixture) {
        const t = JSON.parse(readFileSync(w.source.fixture, 'utf8')).tape;
        return { ...t, name: w.name, description: `seedling-fidelity-spearrect: ${w.name} — replays ${t.name} (${t.description})` };
    }
    const { buildStagedTape } = await import('./botDriverV1.js');
    const { inventorySlotsFor, INVENTORY_ITEM_IDS } = await import('./tapeFormat.js');
    const base = await ropeStaging({ boot: w.source.boot, items: w.source.items, persistence: [] });
    const slot = inventorySlotsFor(base.seam.items).indexOf(INVENTORY_ITEM_IDS.spear);
    if (slot < 0) throw new Error(`fidelitySpearRect: ${w.name}'s staging holds no spear slot`);
    const staging = { ...base, equips: [{ t: 0, slot }] };
    const perTick = [...w.source.keys.map((k) => new Set(k ? [k] : [])),
        ...Array.from({ length: w.source.tail }, () => new Set())];
    const tape = buildStagedTape({ staging, perTick, name: w.name });
    return { ...tape, description: `seedling-fidelity-spearrect: ${w.name} (probe-seedling-spearrect.mjs)` };
}

/** The class of a model body id. */
const CLASS_OF = { jellyfish: 'Jellyfish', iceturret: 'IceTurret', pushableblockspear: 'PushableBlockSpear' };
export const spearRectClassOf = (id) => CLASS_OF[id.split('@')[0]] ?? null;

/**
 * The model's readings of a tape under `over` (default `SPEARRECT_SWITCHES`): per observation tick the player and the
 * bodies — chasers and turrets (`killLockWitness.modelBodies`) and the pushable blocks (x, y). `killLock` replays under
 * KILLLOCK's switches too (the jellyfish are live only there). A run that throws stops there and says why.
 */
export async function spearRectModel(tapeJson, { over = SPEARRECT_SWITCHES, killLock = false } = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { KILLLOCK_ALL_ON, modelBodies } = await import('./killLockWitness.js');
    const { withKillLockBodies } = await import('./killLockBodies.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const ticks = [];
    const bodies = [];
    let presses = [];
    let error = null;
    const body = () => withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                ticks.push({ t: o.t, level: o.level, x: o.x, y: o.y, hits: run ? run.damage.hits : 0 });
                const b = run ? modelBodies(run) : {};
                for (const [id, p] of (run?.entities('pushables') ?? new Map())) {
                    if (!p.removed) b[id] = { x: p.rect.x, y: p.rect.y };
                }
                bodies[o.t] = b;
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        presses = run ? run.presses.filter((p) => p.weapon === 'spear') : [];
    });
    if (killLock) withKillLockBodies(KILLLOCK_ALL_ON, body); else body();
    return { ticks, bodies, presses, error };
}

/** A game body row folded to what the model reports for its class. */
function gameFacts(cls, r) {
    if (cls === 'PushableBlockSpear') return `${r.x},${r.y}`;
    if (cls === 'Jellyfish') return `${r.hits}/${r.hitsTimer}@${r.x},${r.y}`;
    return `${r.hits}/${r.hitsTimer}`;
}
function modelFacts(cls, r) {
    if (cls === 'PushableBlockSpear') return `${r.x},${r.y}`;
    if (cls === 'Jellyfish') return `${r.hits}/${r.hitsTimer}@${r.x},${r.y}`;
    return `${r.hits}/${r.hitsTimer}`;
}

/**
 * Compare a recording with the model: the player stream (level, x, y) observation for observation, and per sampled
 * tick each compared class's facts (a multiset: jellyfish/turret `hits/hitsTimer`, a block's `x,y`).
 * `{player: [...], bodies: [{t, cls, game, model}], compared}`; empty lists = the model reproduces the game.
 */
export function compareSpearRectWitness(game, model, classes) {
    const player = [];
    const g = game.ticks;
    if (g.length !== model.ticks.length) player.push(`the game has ${g.length} observation(s), the model ${model.ticks.length}`);
    g.forEach((o, i) => {
        const m = model.ticks[i];
        if (!m || o.level !== m.level || o.x !== m.x || o.y !== m.y) {
            player.push(`obs ${i}: game (${o.level}: ${o.x}, ${o.y}) model ${m ? `(${m.level}: ${m.x}, ${m.y})` : '—'}`);
        }
    });
    const bodies = [];
    let compared = 0;
    for (const s of game.samples) {
        const mb = model.bodies[s.t];
        if (!mb) continue;
        for (const cls of classes) {
            const gf = s.rows.filter((r) => r.cls === cls).map((r) => gameFacts(cls, r)).sort();
            const mf = Object.entries(mb).filter(([id]) => spearRectClassOf(id) === cls).map(([, r]) => modelFacts(cls, r)).sort();
            if (gf.length === 0 && mf.length === 0) continue;
            compared += 1;
            if (JSON.stringify(gf) !== JSON.stringify(mf)) bodies.push({ t: s.t, cls, game: gf, model: mf });
        }
    }
    return { player, bodies, compared };
}
