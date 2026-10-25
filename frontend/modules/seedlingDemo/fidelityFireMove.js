/**
 * ⛓⛓⛓ SEEDLING FIDELITY FIREMOVE (wave 29) — the solver moves a `PushableBlockFire` by FIRE presses
 * (`solverBot.deriveBlockRoute`'s fire arm) and a fire block parked on a button dwells (`deriveWeigh`), behind
 * `CONTACT_FIDELITY.fireBlockRoute` (OFF).
 *
 * Two witnesses:
 *   · L41 (`firemove-l41-part3`): the route survey's step 94 (`Level 041 - Totem Part 240,144`), SOLVED with the key
 *     ON — the crusher baited onto the cover's button, then the solver's own six Fire presses park
 *     `pushableblockfire@112,144` on `button@176,176` {t 1} and the part is collected through `wandlock@240,96`. The
 *     tape is the survey's own walk view (`.cache/seedling-survey/through-end/views/step-94-walk.json`), played on the
 *     game (p4g, headless, logic-only) and compared with the model at 0 px: the player and every pushable block, every
 *     tick (`probe-seedling-fire-move.mjs`). ⚠ The crusher is not compared: `botMobiles` does not list it (`Crusher
 *     extends Activators`, not a `Mobile`); its park is witnessed through the cover it holds open (the first press).
 *   · L40: the solver's own route for the t5 holder, from the state after `r5-l40-part5`'s t2 wait
 *     (`firePushPrefixTape(0, { route: false })`), equals FIREPUSH's scripted `FIREPUSH_ROUTE` press for press — the
 *     35 presses the FIREPUSH witness recorded on the game at 0 px. Its EXECUTION refuses at `runFire`'s unmodelled-enemy
 *     arm (L40's Bob, BobSoldier, Puncher, BombPusher and IceTurret are not in the block sweep) — CORPSEBUMP's row.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const FIREMOVE_WITNESS_DIR = join(HERE, 'fixtures', 'firemove-witness');
export const FIREMOVE_L41_WITNESS = 'firemove-l41-part3';

/**
 * The switches the witnesses are planned and replayed under: this slice's key and FIREPUSH's three (the brief: measure
 * with them ON wherever the region meets them), the rest at their defaults.
 */
export const FIREMOVE_SWITCHES = Object.freeze({ fireBlockRoute: true, fireBlockPulseShove: true,
    fireLiveTurretReach: true, pulserPublishLag: true });

/** L41's holder: the block, its spawn tile, the button tile (`r5Totem.L41_PART3`). */
export const FIREMOVE_L41 = Object.freeze({ level: 41, block: 'pushableblockfire@112,144',
    from: Object.freeze({ tx: 7, ty: 9 }), onto: Object.freeze({ tx: 11, ty: 11 }) });

/** L40's t5 holder: the contact the solver's walk carries there (the dead turret's census volume). */
export const FIREMOVE_L40 = Object.freeze({ level: 40, block: 'pushableblockfire@480,480',
    onto: Object.freeze({ tx: 48, ty: 25 }), contacts: Object.freeze(['proximity-hazard:iceturret@472,400']) });

const BODY_CLASS = /(^|:)(PushableBlockFire|PushableBlock)$/;

/** The game poll's fold: the player and every pushable block (`botStatus` + `botMobiles`). */
export function fireMoveSampleOf(s, m) {
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y,
        bodies: (m.mobiles ?? []).filter((r) => BODY_CLASS.test(r.cls))
            .map((r) => ({ cls: r.cls.split(':').at(-1), x: r.x, y: r.y })),
    };
}

const CODE = Object.freeze({ PushableBlockFire: 'F', PushableBlock: 'P' });
const CLS = Object.freeze(Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k])));

/** The recording's compact row: `[t, level, x, y, bodies]` — `bodies` is `code:x,y` joined by `;`. */
export function packFireMoveSample(g) {
    return [g.t, g.level, g.x, g.y, (g.bodies ?? []).map((b) => `${CODE[b.cls] ?? b.cls}:${b.x},${b.y}`).join(';')];
}

/** The inverse of `packFireMoveSample`. */
export function unpackFireMoveSample(row) {
    const [t, level, x, y, bodies] = row;
    return {
        t, level, x, y,
        bodies: bodies ? bodies.split(';').map((b) => {
            const [c, xy] = b.split(':');
            const [bx, by] = xy.split(',').map(Number);
            return { cls: CLS[c] ?? c, x: bx, y: by };
        }) : [],
    };
}

/** The model's samples of a tape, by tape tick, under `over`: the player and every live block. */
export async function fireMoveModelSamples(tapeJson, over = FIREMOVE_SWITCHES) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let error = null;
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                const rows = run ? (run.world.pushables ?? []) : [];
                const live = run ? run.entities('pushables') : null;
                samples[o.t] = {
                    x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    bodies: live ? rows.map((p) => ({ cls: p.as3, b: live.get(p.id) }))
                        .filter((p) => p.b && !p.b.removed)
                        .map((p) => ({ cls: p.cls, x: p.b.rect.x, y: p.b.rect.y })) : [],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
    });
    return { samples, error };
}

/** Compare a game witness with the model, every sampled tick of `level`: the player, and each body by position. */
export function compareFireMoveWitness(game, model, level) {
    const bad = [];
    const key = (b) => `${b.cls}@${b.x},${b.y}`;
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (g.level !== level || m.level !== level) continue;
        const gs = (g.bodies ?? []).map(key).sort();
        const ms = m.bodies.map(key).sort();
        if (gs.join(' ') !== ms.join(' ')) bad.push(`t ${g.t}: bodies game [${gs.join(' ')}] model [${ms.join(' ')}]`);
    }
    return bad;
}
