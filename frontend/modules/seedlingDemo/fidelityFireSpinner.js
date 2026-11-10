/**
 * ⛓⛓⛓ SEEDLING FIDELITY FIRESPINNER (wave 38) — a Fire press that reaches a SPINNER knocks it back and does no damage.
 *
 * THE AS3 (`vendor/seedling/src`):
 *
 *     Player.fire()      :1014-1044  on sprFire frames 3..6, for i in 0..10: `collideRectInto(hitables[i], 32x32 rect
 *                                    centred on the player, vc)` — `vc` is NOT cleared between passes, so an "Enemy"
 *                                    (hitables[0]) is dispatched 11 times a hit tick — then the radius cut
 *                                    `FP.distanceRects(...) > sprFire.width / 2` and `genericHit(e, "Fire", fireForce
 *                                    0.325, fireDamage 0)`
 *     Player.genericHit  :1065-1077  `if (Game.freezeObjects) return;` then `e is Enemy` → `(e as Enemy).hit(f,
 *                                    new Point(x, y), d, t)` (the IceTurret bump is the one class special case)
 *     Enemy.hit          :141-181    `(hitsTimer <= 0 || hitByDarkStuff) && !Game.freezeObjects && canHit` → `onlyHitBy
 *                                    == ""` → `hitByFire || t != "Fire"` is FALSE for a Spinner (`hitByFire` is
 *                                    `Enemy`'s false, `Spinner` does not set it) → the else arm: `knockback(f, p)` —
 *                                    no `hits +=`, no `hitsTimer =`
 *     Enemy.knockback    :247-255    `a = atan2(y - p.y, x - p.x); v.x += f cos a; v.y += f sin a` (not while `destroy`)
 *     Spinner.as                     overrides none of it (`maxForce` -1, `onlyHitBy` "", `hitByFire` false)
 *
 * So the transcription is `spinner.hitSpinner(s, {t: 'Fire', force: 0.325, from: player})` per dispatch, which has had
 * the Fire branch since R5 slice 13 — and `levelRun.applyFire` never called it (`FIRE_ARM_POLICY.Spinner` says
 * `modelled`; the dispatch had no arm, and the census tested the spinner's `.oel` PLACEMENT, not its body).
 *
 * This module is the D0 game witness's fold (shared by `scripts/procgen/probe-seedling-fire-spinner.mjs`, which plays the
 * tape on the game, and `fidelityFireSpinner.test.js`, which replays the recording against the model at 0 px): the
 * player and every `Spinner` (position, hits, hitsTimer) every tick, L39 only.
 *
 * THE STAGING (`fireSpinnerTape`): the committed `r5-shaft` tape (L39, Fire equipped at t185, three live spinners, the
 * player `noDamage`) cut at t680, plus ONE Fire press at t590 — `spinner@224,112`'s billiard runs through the player's
 * box at t594..t603, so the press's five hit ticks (t594..t598) all reach the BODY while its `.oel` cell (232,120) is
 * ~80 px away. With the key OFF the model ignores the body (no throw, no knockback); a press at t690 instead, where the
 * placement cell is in reach and the body is not, throws (`FIRESPINNER_THROW_PRESS`).
 */
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const FIRESPINNER_WITNESS_DIR = join(HERE, 'fixtures', 'firespinner-witness');
/** D0: one Fire press reaching `spinner@224,112`'s live body (the r5-shaft prefix). */
export const FIRESPINNER_WITNESS = 'firespinner-l39-knock';
export const FIRESPINNER_LEVEL = 39;
/** The press tick of the witness, and the tick the tape ends. */
export const FIRESPINNER_PRESS = 590;
export const FIRESPINNER_END = 680;
/** W0: a press whose census reach is `spinner@224,112`'s PLACEMENT cell while its body is ~80 px off — the OFF throw. */
export const FIRESPINNER_THROW_PRESS = 690;
export const FIRESPINNER_THROW_END = 720;

/** The witness tape: `r5-shaft` cut at `end`, plus one `primary` (Fire, equipped at t185) press at `press`. */
/** A committed tape by name (`fixtures/tapes/<name>.json`), for the roster witnesses (`FIRESPINNER_ROSTER`). */
export function committedTape(name) {
    const raw = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
    return raw.tape ?? raw;
}

/**
 * ⛓ D2: the committed tapes whose Fire press reaches a spinner's BODY (measured over the whole roster with the key ON;
 * all three are L39 block-glide tapes, `r5Shaft.SPINNER_WEDGE`'s), each witnessed on the game as itself.
 */
export const FIRESPINNER_ROSTER = Object.freeze(['r5-press-delay', 'r5-press-glide', 'r5-press-repeat']);

export function fireSpinnerTape({ press = FIRESPINNER_PRESS, end = FIRESPINNER_END,
    name = FIRESPINNER_WITNESS } = {}) {
    const raw = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r5-shaft.json'), 'utf8'));
    const base = raw.tape ?? raw;
    const inputs = base.inputs.filter((i) => i.from < end).map((i) => ({ ...i, to: Math.min(i.to, end) }));
    if (press !== null) inputs.push({ key: 'primary', from: press, to: press + 1 });
    inputs.sort((a, b) => a.from - b.from || a.key.localeCompare(b.key));
    return {
        ...base,
        name,
        description: `⛓ FIRESPINNER: r5-shaft's first ${end} ticks plus one Fire press at t${press} — `
            + 'the flame reaches spinner@224,112\'s live body (Enemy.hit\'s fire arm: knockback, no damage).',
        tick_count: end,
        inputs,
    };
}

/**
 * The game poll's fold: the player, every live spinner (`botMobiles`, with `hits` and `hits_timer`) and every
 * `PushableBlockFire` (a spinner body is in a fire block's sweep, `r5Shaft.SPINNER_WEDGE`, so a knocked spinner can move
 * a block).
 */
export function fireSpinnerSampleOf(s, m) {
    const mob = (m.mobiles ?? []).filter((r) => /(^|:)Spinner$/.test(r.cls) && !r.destroy);
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y,
        spinners: mob.map((r) => ({ x: r.x, y: r.y, hits: r.enemy?.hits ?? null, ht: r.enemy?.hits_timer ?? null,
            vx: r.vx, vy: r.vy })),
        blocks: (m.mobiles ?? []).filter((r) => /(^|:)PushableBlockFire$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y })),
    };
}

/** The recording's compact row: `[t, level, x, y, spinners, blocks]`, spinners `x,y,hits,ht,vx,vy` joined by `;`. */
export function packFireSpinnerSample(g) {
    const sp = g.spinners.map((b) => [b.x, b.y, b.hits, b.ht, b.vx ?? '', b.vy ?? ''].join(',')).join(';');
    return [g.t, g.level, g.x, g.y, sp, (g.blocks ?? []).map((b) => `${b.x},${b.y}`).join(';')];
}

/** The inverse of `packFireSpinnerSample`. */
export function unpackFireSpinnerSample(row) {
    const [t, level, x, y, sp, bl = ''] = row;
    const num = (v) => (v === '' ? null : Number(v));
    const spinners = sp ? sp.split(';').map((p) => {
        const [a, b, h, ht, vx, vy] = p.split(',');
        return { x: Number(a), y: Number(b), hits: num(h), ht: num(ht), vx: num(vx), vy: num(vy) };
    }) : [];
    const blocks = bl ? bl.split(';').map((p) => { const [a, b] = p.split(',').map(Number); return { x: a, y: b }; }) : [];
    return { t, level, x, y, spinners, blocks };
}

/**
 * The model's samples of a tape, by tape tick, under `over` (contact-fidelity keys), plus the run's Fire press ledger.
 * `error` is the message a run threw (the OFF arm's throw is a RESULT here, not a crash).
 */
export async function fireSpinnerModelSamples(tapeJson, over = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const levelSource = await atlasLevelSource();
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let error = null;
    let firePresses = [];
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                const here = run && run.level === FIRESPINNER_LEVEL;
                samples[o.t] = {
                    t: o.t, x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    spinners: here ? run.entities('spinnerBodies').filter((b) => !b.destroy)
                        .map((b) => ({ x: b.x, y: b.y, hits: b.hits, ht: b.hitsTimer })) : [],
                    blocks: here ? fireBlocksOf(run) : [],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        firePresses = run ? run.presses.filter((p) => p.weapon === 'fire') : [];
    });
    return { samples, error, firePresses };
}

/** The run's live `PushableBlockFire` boxes (the fold's `blocks`, `fidelityL39Shaft`'s reading). */
function fireBlocksOf(run) {
    const live = run.entities('pushables');
    return (run.world.pushables ?? []).filter((p) => p.as3 === 'PushableBlockFire').map((p) => live.get(p.id))
        .filter((b) => b && !b.removed).map((b) => ({ x: b.rect.x, y: b.rect.y }));
}

const key = (b) => `${b.x},${b.y},${b.hits},${b.ht}`;

/**
 * Compare a game witness with the model on every sampled tick: the player, the level, and in L39 every live spinner's
 * position, `hits` and `hitsTimer` (as a set: `botMobiles` carries no id).
 */
export function compareFireSpinnerWitness(game, model) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (g.level !== FIRESPINNER_LEVEL || m.level !== FIRESPINNER_LEVEL) continue;
        const gs = g.spinners.map(key).sort().join(' ');
        const ms = m.spinners.map(key).sort().join(' ');
        if (gs !== ms) bad.push(`t ${g.t}: spinners game [${gs}] model [${ms}]`);
        const xy = (l) => (l ?? []).map((b) => `${b.x},${b.y}`).sort().join(' ');
        if (xy(g.blocks) !== xy(m.blocks)) bad.push(`t ${g.t}: blocks game [${xy(g.blocks)}] model [${xy(m.blocks)}]`);
    }
    return bad;
}
