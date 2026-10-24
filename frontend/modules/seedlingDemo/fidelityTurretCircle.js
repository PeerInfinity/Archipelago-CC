/**
 * seedling-fidelity-turretcircle (wave 29) — KILL L40'S ICE TURRET WITH THE PLAIN SWORD, HITLESS, BY CIRCLING IT.
 * ⚖ The user (2026-10-24): *"The way to not get hit is to keep moving while attacking. Keep circling around the
 * turret."* Shared by `scripts/procgen/probe-seedling-turret-circle.mjs` (plays each witness on the game, `--record`)
 * and `fidelityTurretCircle.test.js` (replays the recordings against the model at 0 px).
 *
 * THE GAME (W0):
 *   `IceTurret.update` turns the barrel toward the player by a tenth of the angle left per tick (`angleSpeedDivisor`
 *   10), and only while neither shot animation plays; `startshot` freezes the aim, and its wrap (3 ticks later)
 *   fires three blasts along it, 12 px apart, at 6 px a tick (`IceTurret.as:63-81,153-161`). A blast hits the
 *   player's 4x5 box (`playerBoxAt`) on the first tick the two overlap, so a player who keeps MOVING around the body is
 *   never where a frozen aim points by the time the volley arrives, while a player who STANDS to strike is (the
 *   standing Sword kill is always hit: CORPSEBUMP's 72 hand timings and 101 fork delays). `Player.slash` swings in
 *   the facing the press tick STARTED with and lands on the 32x32 body from anywhere its rect overlaps it within
 *   reach (`Player.as:892-951`), so a swing can ride the movement keys: the press tick holds them too.
 *   `IceTurretBlast.hitables` also holds `"Shield"` (`IceTurretBlast.as:17`), the player's shield ENTITY, whose box
 *   `render` places by the facing (`Player.as:1180-1256`; `bobBossFight.playerShieldRect`) —
 *   `CONTACT_FIDELITY.iceBlastShield` (D1).
 *
 * WITNESSES (each from the L40 pocket boot: `prox-l40-turret-volley`'s committed header, the survey's `r8-solve-11`
 * staging re-pointed at L40 (480,456), inside `iceturret@472,400`'s pocket — the Sword, no Ghost Sword):
 *   `turretcircle-l40-sword-circle` (D1) — no shield: clockwise around the body on the 8 px lanes beside it,
 *     (468|508) x (401|446), swinging on the move whenever the i-frame is out and the player is within 30 px of the
 *     entity point. Three landings, the turret dead, no hit.
 *   `turretcircle-l40-shield-stand` (D1) — with the shield: walk up 12 ticks and STAND facing the turret for 160. The
 *     volleys meet the shield's box (`iceBlastShield` ON: no hit; OFF: three).
 *   `turretcircle-l40-shield-near` (D1) — with the shield, up 14 and stand: one volley meets the shield AND the
 *     player on one tick (t97), and `collideTypesInto` lists both — a hit (ON: one; OFF: three).
 *   `turretcircle-l40-t2-holder-sword` (D3) — the SOLVER's own Sword-only plan for CORPSEBUMP's D3 goal (the pit
 *     behind `wandlock@448,432` {t 2}): the circling kill (`turretCircleKill` ON), the corpse bumped onto its button,
 *     the fade, the pit, L43 — no hit.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const TURRETCIRCLE_WITNESS_DIR = join(HERE, 'fixtures', 'turretcircle-witness');

/** The turret every witness fights. */
export const L40_TURRET = 'iceturret@472,400';

/** D1's model switch (the rest at their defaults). */
export const TURRETCIRCLE_D1_SWITCHES = Object.freeze({ iceBlastShield: true });

/**
 * `turretcircle-l40-sword-circle`'s runs, `[keys, ticks]` from the pocket boot: the clockwise loop with swings on the
 * move (authored by a scratch waypoint follower and frozen here; 140 ticks, the turret dead on t79).
 */
export const L40_CIRCLE_RUNS = Object.freeze([
    [['left', 'up'], 12], [['left', 'up', 'primary'], 1], [['left', 'up'], 2], [['left'], 1], [['left', 'up'], 1],
    [['up'], 2], [['right', 'up'], 2], [['up'], 3], [['left', 'up'], 1], [['up'], 19], [['up', 'primary'], 1],
    [['up'], 7], [['right', 'up'], 1], [['right'], 1], [['right', 'down'], 2], [['right'], 6], [['right', 'up'], 1],
    [['right'], 4], [['right', 'down'], 1], [['right'], 6], [['right', 'up'], 1], [['right'], 1],
    [['right', 'primary'], 1], [['right'], 2], [['right', 'down'], 1], [['right'], 5], [['right', 'down'], 1],
    [['down'], 1], [['left', 'down'], 2], [['down'], 3], [['right', 'down'], 1], [['down'], 28], [['left'], 2],
    [['left', 'up'], 2], [['left'], 3], [['left', 'down'], 1], [['left'], 11],
].map(([k, n]) => Object.freeze([Object.freeze(k), n])));

/** `turretcircle-l40-shield-stand`'s runs: up 12 (to y 447.6, facing the turret), then stand 160. */
export const L40_SHIELD_STAND_RUNS = Object.freeze([[Object.freeze(['up']), 12], [Object.freeze([]), 160]]);
/**
 * `turretcircle-l40-shield-near`'s runs: up 14 (to y 443.5), then stand 160. Two of the three volleys meet the shield
 * first; one (t97) meets the shield and the player on the same tick, and `collideTypesInto` lists both: a hit.
 */
export const L40_SHIELD_NEAR_RUNS = Object.freeze([[Object.freeze(['up']), 14], [Object.freeze([]), 160]]);

/** The pocket boot's header (`prox-l40-turret-volley`'s) with `items` merged into its seam, and no inputs. */
export async function l40PocketBoot(items = {}, name = 'turretcircle-l40-pocket-boot') {
    const { readFileSync } = await import('node:fs');
    const base = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'prox-l40-turret-volley.json'), 'utf8'));
    return { ...base, name, tick_count: 0, inputs: [], seam: { ...base.seam, items: { ...base.seam.items, ...items } } };
}

async function runsTape(name, runs, items, description) {
    const { buildTape } = await import('./botDriverV1.js');
    const base = await l40PocketBoot(items, name);
    const perTick = [];
    for (const [keys, n] of runs) for (let i = 0; i < n; i += 1) perTick.push(new Set(keys));
    const folded = buildTape(perTick, base.boot, name, { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...base, name, tick_count: perTick.length, inputs: folded.inputs, description };
}

/** `turretcircle-l40-sword-circle`: the pocket boot (the Sword, no shield) with `L40_CIRCLE_RUNS`. */
export function l40CircleTape() {
    return runsTape('turretcircle-l40-sword-circle', L40_CIRCLE_RUNS, {},
        'seedling-fidelity-turretcircle D1: L40 from the pocket boot (Sword only, no shield) — circle '
        + 'iceturret@472,400 clockwise on the lanes beside it, swinging on the move; three landings, no hit '
        + '(probe-seedling-turret-circle.mjs)');
}

/** `turretcircle-l40-shield-stand`: the pocket boot with the shield, `L40_SHIELD_STAND_RUNS`. */
export function l40ShieldStandTape() {
    return runsTape('turretcircle-l40-shield-stand', L40_SHIELD_STAND_RUNS, { hasShield: true },
        'seedling-fidelity-turretcircle D1: L40 from the pocket boot WITH the shield — walk up 12 and stand facing '
        + 'iceturret@472,400 for 160 ticks; the volleys meet the shield\'s box (probe-seedling-turret-circle.mjs)');
}

/** `turretcircle-l40-shield-near`: the pocket boot with the shield, `L40_SHIELD_NEAR_RUNS`. */
export function l40ShieldNearTape() {
    return runsTape('turretcircle-l40-shield-near', L40_SHIELD_NEAR_RUNS, { hasShield: true },
        'seedling-fidelity-turretcircle D1: L40 from the pocket boot WITH the shield — walk up 14 and stand facing '
        + 'iceturret@472,400 for 160 ticks; one volley meets the shield and the player on one tick and hits '
        + '(probe-seedling-turret-circle.mjs)');
}

/**
 * D3's switches: CORPSEBUMP's D2 set (its two keys and FIREPUSH's three) with `turretCircleKill` ON — the corpse
 * weigh's kill with the Sword alone rides the loop — and `iceTurretDeathAnim` ON (the death stops the shot: measured
 * on this witness, t70).
 */
export const TURRETCIRCLE_D3_SWITCHES = Object.freeze({ blockSweepBodies: true, corpseBumpWeigh: true,
    fireLiveTurretReach: true, fireBlockPulseShove: true, pulserPublishLag: true, turretCircleKill: true,
    iceTurretDeathAnim: true });

/**
 * `turretcircle-l40-t2-holder-sword`: the SOLVER's whole plan from the pocket boot with the Sword alone — CORPSEBUMP's
 * D3 goal (`fidelityCorpseBump.L40_POCKET_GOAL`, the pit west of `wandlock@448,432` {t 2}) without its declared Ghost
 * Sword: the circling kill, the corpse bumped onto `button@480,384`, the fade, the pit — folded onto the boot's header.
 */
export async function l40SwordHolderTape() {
    const { buildTape } = await import('./botDriverV1.js');
    const { l40PocketTail } = await import('./fidelityCorpseBump.js');
    const bootTape = await l40PocketBoot({}, 'turretcircle-l40-t2-holder-sword');
    const { out, refusal } = await l40PocketTail(bootTape, TURRETCIRCLE_D3_SWITCHES);
    if (!out) throw refusal;
    const folded = buildTape(out.perTick, bootTape.boot, 'turretcircle-l40-t2-holder-sword',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...bootTape, equips: [...(bootTape.equips ?? []), ...(out.equips ?? [])],
        tick_count: out.perTick.length, inputs: folded.inputs,
        description: 'seedling-fidelity-turretcircle D3: L40 from the pocket boot (prox-l40-turret-volley\'s: the Sword, '
            + 'no Ghost Sword, no shield) — the SOLVER (turretCircleKill + corpseBumpWeigh ON): kill iceturret@472,400 '
            + 'by circling it, bump its corpse onto button@480,384 {t 2}, wait out wandlock@448,432\'s fade, walk west '
            + 'into the pit (24,27) (probe-seedling-turret-circle.mjs)' };
}

const noHits = (samples) => samples.every((g) => g.hits === 0);
const deadFrom = (samples) => samples.find((g) => g.turret?.dead)?.t ?? null;

export const TURRETCIRCLE_WITNESSES = Object.freeze({
    'turretcircle-l40-sword-circle': Object.freeze({ tape: l40CircleTape, switches: TURRETCIRCLE_D1_SWITCHES,
        checks: (samples) => [
            { name: 'the game\'s turret dies', ok: deadFrom(samples) !== null, detail: `dead from t${deadFrom(samples)}` },
            { name: 'the game\'s player is never hit', ok: noHits(samples),
                detail: `hits at the end ${samples.at(-1)?.hits}` },
        ] }),
    'turretcircle-l40-shield-stand': Object.freeze({ tape: l40ShieldStandTape, switches: TURRETCIRCLE_D1_SWITCHES,
        checks: (samples) => [
            { name: 'the game\'s shield stops every volley (the player is never hit)', ok: noHits(samples),
                detail: `hits at the end ${samples.at(-1)?.hits}` },
        ] }),
    'turretcircle-l40-shield-near': Object.freeze({ tape: l40ShieldNearTape, switches: TURRETCIRCLE_D1_SWITCHES,
        checks: (samples) => [
            { name: 'the game\'s player is hit exactly once (t97: the shield and the player on one tick)',
                ok: samples.at(-1)?.hits === 1 && samples.find((g) => g.hits === 1)?.t === 97,
                detail: `first hit t${samples.find((g) => g.hits > 0)?.t}, hits at the end ${samples.at(-1)?.hits}` },
        ] }),
    'turretcircle-l40-t2-holder-sword': Object.freeze({ tape: l40SwordHolderTape, switches: TURRETCIRCLE_D3_SWITCHES,
        checks: (samples) => {
            const onT2 = (g) => g.level === 40 && g.turret?.dead && g.turret.y < 400;
            const first = samples.find(onT2);
            const end = samples.at(-1);
            return [
                { name: 'the game\'s player is never hit', ok: noHits(samples), detail: `hits at the end ${end?.hits}` },
                { name: 'the game\'s corpse comes to rest on button@480,384 {t 2} and stays while L40 lasts',
                    ok: first !== undefined && samples.filter((g) => g.t >= first.t && g.level === 40).every(onT2),
                    detail: first ? `on it from t${first.t}` : 'never on it' },
                { name: 'the game\'s player leaves L40 by the pit west of wandlock@448,432 (the t2 lock opened)',
                    ok: end?.level === 43, detail: end ? `ends in L${end.level} at (${end.x}, ${end.y})` : 'no sample' },
            ];
        } }),
});

const TURRET_CLASS = /(^|:)IceTurret$/;
const BLAST_CLASS = /(^|:)IceTurretBlast$/;
/** The window blasts are compared in: the model prunes a blast that can reach nothing; the game flies it on. */
const BLAST_WINDOW = Object.freeze({ x: 488 - 96, y: 424 - 96, right: 488 + 96, bottom: 424 + 96 });
const inWindow = (b) => b.x >= BLAST_WINDOW.x && b.x <= BLAST_WINDOW.right && b.y >= BLAST_WINDOW.y
    && b.y <= BLAST_WINDOW.bottom;
const blastKey = (b) => `${b.x},${b.y}`;

/** The game poll's fold: the player (hits, frozen timer), the turret, and the blasts in the window. */
export function turretCircleSampleOf(s, m) {
    const rows = m.mobiles ?? [];
    const t = rows.find((r) => TURRET_CLASS.test(r.cls)) ?? null;
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits, frozen: s.frozen_timer,
        turret: t ? { x: t.x, y: t.y, dead: t.anim === 'dead' } : null,
        blasts: rows.filter((r) => BLAST_CLASS.test(r.cls)).filter(inWindow).map(blastKey).sort(),
    };
}

/** The recording's compact row: `[t, level, x, y, hits, frozen, turret "x,y[:dead]", blasts "x,y;…"]`. */
export function packTurretCircleSample(g) {
    return [g.t, g.level, g.x, g.y, g.hits, g.frozen,
        g.turret ? `${g.turret.x},${g.turret.y}${g.turret.dead ? ':dead' : ''}` : '', g.blasts.join(';')];
}

/** The inverse of `packTurretCircleSample`. */
export function unpackTurretCircleSample(row) {
    const [t, level, x, y, hits, frozen, turret, blasts] = row;
    let tu = null;
    if (turret) {
        const [xy, dead] = turret.split(':');
        const [tx, ty] = xy.split(',').map(Number);
        tu = { x: tx, y: ty, dead: dead === 'dead' };
    }
    return { t, level, x, y, hits, frozen, turret: tu, blasts: blasts ? blasts.split(';') : [] };
}

/** The model's samples of a tape, by tape tick, under `over`. */
export async function turretCircleModelSamples(tapeJson, over) {
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
                const tu = run ? (run.entities('turrets') ?? new Map()).get(L40_TURRET) : null;
                samples[o.t] = {
                    x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    hits: run ? run.damage.hits : 0, frozen: run ? run.frozenTimer : 0,
                    turret: tu && !tu.removed ? { x: tu.x, y: tu.y, dead: !!tu.dead } : null,
                    blasts: run ? run.blastsInFlight.filter(inWindow).map(blastKey).sort() : [],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
    });
    return { samples, error };
}

/** Compare a game witness with the model, every sampled tick: the player, its hits and freeze, the turret, the blasts. */
export function compareTurretCircleWitness(game, model) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) { bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`); continue; }
        if (m.hits !== g.hits) bad.push(`t ${g.t}: player hits game ${g.hits} model ${m.hits}`);
        if (m.frozen !== g.frozen) bad.push(`t ${g.t}: frozen game ${g.frozen} model ${m.frozen}`);
        const tk = (u) => (u ? `${u.x},${u.y}${u.dead ? ':dead' : ''}` : '-');
        if (tk(m.turret) !== tk(g.turret)) bad.push(`t ${g.t}: turret game ${tk(g.turret)} model ${tk(m.turret)}`);
        if (m.blasts.join(' ') !== g.blasts.join(' ')) {
            bad.push(`t ${g.t}: blasts game [${g.blasts.join(' ')}] model [${m.blasts.join(' ')}]`);
        }
    }
    return bad;
}
