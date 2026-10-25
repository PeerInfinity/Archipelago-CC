/**
 * seedling-fidelity-corpsebump (wave 29) — the bodies a pushable's glide and an ice-turret corpse's slide stop on
 * (`CONTACT_FIDELITY.blockSweepBodies`, D1), and the corpse bumped onto a button as a weigh's holder
 * (`CONTACT_FIDELITY.corpseBumpWeigh`, D2). Shared by `scripts/procgen/probe-seedling-corpse-bump.mjs` (plays each
 * witness on the game, `--record`) and `fidelityCorpseBump.test.js` (replays the recordings against the model at 0 px).
 *
 * THE GAME (D1, W0): `PushableBlock*`'s ctor does `solids.push("Enemy", "Player")` (`PushableBlock.as:28`,
 * `PushableBlockFire.as:31`) on top of `Mobile.solids` (`["Solid","Tree","Rock","Rope","ShieldBoss"]`), and
 * `moveX`/`moveY` stop on the first of those types; `IceTurret.death()` pushes the same two (`IceTurret.as:148`). A
 * `Bob` is `type = "Enemy"` (`Enemy.as:58`), so a Bob in the corridor stops the glide dead.
 *
 * WITNESSES:
 *   `corpsebump-l4-bob-wedge` (D1) — L4 from `r8-solve-4`'s boot: walk down onto the button tile and shove
 *     `pushableblock@32,64` east while `bob@64,64` is still alive and chasing. The game's block stops against the
 *     Bob's 8x8 body; the model OFF glides it through.
 *   `corpsebump-l40-t2-holder` (D3) — L40 from the pocket boot (`l40PocketBootTape`): the SOLVER's whole plan with
 *     `corpseBumpWeigh` ON — kill `iceturret@472,400` hitless (the Ghost Sword), bump its corpse north twice onto
 *     `button@480,384` {t 2}, wait out `wandlock@448,432`'s fade, walk west into the pit (24,27) and on to L43.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CORPSEBUMP_WITNESS_DIR = join(HERE, 'fixtures', 'corpsebump-witness');

/** D1's switch (the rest at their defaults). */
export const CORPSEBUMP_D1_SWITCHES = Object.freeze({ blockSweepBodies: true });

/** The L4 wedge: `[keys, ticks]` runs from `r8-solve-4`'s boot (16,16). */
export const L4_WEDGE_RUNS = Object.freeze([[['down'], 40], [['right'], 40], [[], 60]]);

/** `corpsebump-l4-bob-wedge`'s tape: `r8-solve-4`'s header (boot, save, rng, seam) with `L4_WEDGE_RUNS`. */
export async function l4WedgeTape() {
    const { readFileSync } = await import('node:fs');
    const { buildTape } = await import('./botDriverV1.js');
    const base = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r8-solve-4.json'), 'utf8'));
    const perTick = [];
    for (const [keys, n] of L4_WEDGE_RUNS) for (let i = 0; i < n; i += 1) perTick.push(new Set(keys));
    const folded = buildTape(perTick, base.boot, 'corpsebump-l4-bob-wedge',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...base, name: 'corpsebump-l4-bob-wedge', tick_count: perTick.length, inputs: folded.inputs,
        description: 'seedling-fidelity-corpsebump D1: L4 from r8-solve-4\'s boot — down onto the button tile, shove '
            + 'pushableblock@32,64 east while bob@64,64 is alive; the game stops the glide on the Bob '
            + '(probe-seedling-corpse-bump.mjs)' };
}

/**
 * D2/D3's switches: both CORPSEBUMP keys and FIREPUSH's three (the corpse weigh needs `fireLiveTurretReach`; the other
 * two are ON as the planner's flip will have them).
 */
export const CORPSEBUMP_D2_SWITCHES = Object.freeze({ blockSweepBodies: true, corpseBumpWeigh: true,
    fireLiveTurretReach: true, fireBlockPulseShove: true, pulserPublishLag: true });

/**
 * The L40 pocket boot: `prox-l40-turret-volley`'s committed header (the survey's `r8-solve-11` staging re-pointed at
 * L40 (480,456), inside `iceturret@472,400`'s pocket) with ONE declared change, `seam.items.hasGhostSword` — the AP
 * rule `level_40__r23c29 -> level_40__r32c36` is `Fire AND (Ghost Spear | Sword)`, and only the Ghost Sword's 2-damage
 * blade kills the turret hitless (`killForCorpse`; the Sword's third landing always follows the turret's next shot).
 */
export async function l40PocketBootTape() {
    const { readFileSync } = await import('node:fs');
    const base = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'prox-l40-turret-volley.json'), 'utf8'));
    return { ...base, name: 'corpsebump-l40-t2-holder-boot', tick_count: 0, inputs: [],
        seam: { ...base.seam, items: { ...base.seam.items, hasGhostSword: true } } };
}

/** The D3 goal: the pit west of `wandlock@448,432` {t 2} (24,27), whose only corridor from the pocket is that lock. */
export const L40_POCKET_GOAL = Object.freeze({ kind: 'reach-pit', pit: Object.freeze({ tx: 24, ty: 27, x: 384, y: 432 }) });

/** The solver's plan from the end of the prefix (`solveSegment` with the prefix and a fork per try), under `over`. */
export async function l40PocketTail(prefixTape, over = CORPSEBUMP_D2_SWITCHES) {
    const { parseTape, heldKeysAt } = await import('./tapeFormat.js');
    const { createRunForStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { solveSegment } = await import('./solverBot.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(prefixTape));
    const levelSource = atlasLevelSource();
    const staging = stagingFromTape(tape);
    const prefix = [];
    for (let t = 0; t < tape.tick_count; t += 1) prefix.push(new Set(heldKeysAt(tape, t)));
    return withContactFidelity(over, () => {
        const run = createRunForStaging(staging, levelSource);
        for (const k of prefix) run.advance(k);
        try {
            const out = solveSegment({ run, goals: [L40_POCKET_GOAL], name: 'corpsebump-l40-t2-holder',
                boot: staging.boot, prefix, dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
            return { out, refusal: null };
        } catch (e) {
            return { out: null, refusal: e };
        }
    });
}

/** `corpsebump-l40-t2-holder`: the solver's whole plan from the pocket boot (D2 ON), folded onto the boot's header. */
export async function l40HolderTape() {
    const { buildTape } = await import('./botDriverV1.js');
    const bootTape = await l40PocketBootTape();
    const { out, refusal } = await l40PocketTail(bootTape);
    if (!out) throw refusal;
    const folded = buildTape(out.perTick, bootTape.boot, 'corpsebump-l40-t2-holder',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...bootTape, name: 'corpsebump-l40-t2-holder', equips: [...(bootTape.equips ?? []), ...(out.equips ?? [])],
        tick_count: out.perTick.length, inputs: folded.inputs,
        description: 'seedling-fidelity-corpsebump D3: L40 from the pocket boot (prox-l40-turret-volley\'s, with the '
            + 'Ghost Sword) — the SOLVER (corpseBumpWeigh ON): kill iceturret@472,400 hitless, bump its corpse north '
            + 'onto button@480,384 {t 2}, wait out wandlock@448,432\'s fade, walk west into the pit (24,27) '
            + '(probe-seedling-corpse-bump.mjs)' };
}

export const CORPSEBUMP_WITNESSES = Object.freeze({
    'corpsebump-l4-bob-wedge': Object.freeze({ tape: l4WedgeTape, switches: CORPSEBUMP_D1_SWITCHES }),
    'corpsebump-l40-t2-holder': Object.freeze({ tape: l40HolderTape, switches: CORPSEBUMP_D2_SWITCHES,
        checks: (samples) => {
            const onT2 = (g) => (g.bodies ?? []).some((b) => b.cls === 'IceTurret' && b.anim === 'dead' && b.y < 400);
            const first = samples.find(onT2);
            const end = samples.at(-1);
            return [{
                name: 'the game\'s ice-turret corpse comes to rest on button@480,384 {t 2} and stays there while L40 lasts',
                ok: first !== undefined && samples.filter((g) => g.t >= first.t && g.level === 40).every(onT2),
                detail: first ? `on it from t${first.t}` : 'never on it',
            }, {
                name: 'the game\'s player leaves L40 by the pit west of wandlock@448,432 (the t2 lock opened)',
                ok: end?.level === 43, detail: end ? `ends in L${end.level} at (${end.x}, ${end.y})` : 'no sample',
            }];
        } }),
});

const BLOCK_CLASS = /(^|:)(PushableBlockFire|PushableBlockSpear|PushableBlock)$/;
const BODY_CLASS = /(^|:)(Bob|BobSoldier|Puncher|IceTurret)$/;

/** The game poll's fold: the player, every pushable block and every chaser / ice turret (`botStatus` + `botMobiles`). */
export function corpseBumpSampleOf(s, m) {
    const short = (cls) => cls.split(':').at(-1);
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y,
        blocks: (m.mobiles ?? []).filter((r) => BLOCK_CLASS.test(r.cls)).map((r) => ({ cls: short(r.cls), x: r.x, y: r.y })),
        bodies: (m.mobiles ?? []).filter((r) => BODY_CLASS.test(r.cls))
            .map((r) => ({ cls: short(r.cls), x: r.x, y: r.y, ...(r.anim ? { anim: r.anim } : {}) })),
    };
}

/** The recording's compact row: `[t, level, x, y, blocks, bodies]`, each list `cls:x,y` joined by `;`. */
export function packCorpseBumpSample(g) {
    const list = (rows) => (rows ?? []).map((b) => `${b.cls}:${b.x},${b.y}${b.anim === 'dead' ? ':dead' : ''}`).join(';');
    return [g.t, g.level, g.x, g.y, list(g.blocks), list(g.bodies)];
}

/** The inverse of `packCorpseBumpSample`. */
export function unpackCorpseBumpSample(row) {
    const [t, level, x, y, blocks, bodies] = row;
    const list = (s) => (s ? s.split(';').map((b) => {
        const [cls, xy, dead] = b.split(':');
        const [bx, by] = xy.split(',').map(Number);
        return { cls, x: bx, y: by, ...(dead ? { anim: 'dead' } : {}) };
    }) : []);
    return { t, level, x, y, blocks: list(blocks), bodies: list(bodies) };
}

const AS3_OF = Object.freeze({ bob: 'Bob', bobsoldier: 'BobSoldier', puncher: 'Puncher' });

/** The model's samples of a tape, by tape tick, under `over`: the player, the blocks, the chasers and the turrets. */
export async function corpseBumpModelSamples(tapeJson, over) {
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
                const chasers = run ? (run.entities('chasers') ?? new Map()) : new Map();
                const turrets = run ? (run.entities('turrets') ?? new Map()) : new Map();
                samples[o.t] = {
                    x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    blocks: live ? rows.map((p) => ({ cls: p.as3, b: live.get(p.id) }))
                        .filter((p) => p.b && !p.b.removed)
                        .map((p) => ({ cls: p.cls, x: p.b.rect.x, y: p.b.rect.y })) : [],
                    bodies: [
                        ...[...chasers.values()].filter((c) => !c.removed && AS3_OF[c.tag])
                            .map((c) => ({ cls: AS3_OF[c.tag], x: c.x, y: c.y })),
                        ...[...turrets.values()].filter((c) => !c.removed)
                            .map((c) => ({ cls: 'IceTurret', x: c.x, y: c.y, ...(c.dead ? { anim: 'dead' } : {}) })),
                    ],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
    });
    return { samples, error };
}

/**
 * Compare a game witness with the model, every sampled tick: the player and every block exactly; the bodies by class
 * and position (`compareBodies`; a body the game has removed is absent on both sides).
 */
export function compareCorpseBumpWitness(game, model, { compareBodies = true } = {}) {
    const bad = [];
    const key = (b) => `${b.cls}@${b.x},${b.y}${b.anim === 'dead' ? '/dead' : ''}`;
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) { bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`); continue; }
        const gs = (g.blocks ?? []).map(key).sort().join(' ');
        const ms = m.blocks.map(key).sort().join(' ');
        if (gs !== ms) bad.push(`t ${g.t}: blocks game [${gs}] model [${ms}]`);
        if (!compareBodies) continue;
        const gb = (g.bodies ?? []).map(key).sort().join(' ');
        const mb = m.bodies.map(key).sort().join(' ');
        if (gb !== mb) bad.push(`t ${g.t}: bodies game [${gb}] model [${mb}]`);
    }
    return bad;
}
