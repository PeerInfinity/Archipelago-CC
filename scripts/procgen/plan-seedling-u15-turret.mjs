#!/usr/bin/env node
/**
 * plan-seedling-u15-turret — ⛓⛓⛓ U15-swim D1: `Turret` + `TurretSpit`, WITNESSED
 * ON THE GAME.
 *
 * `Enemies/Turret.as` and `Projectiles/TurretSpit.as` (whole). L29 places three,
 * `turret@80,176`, `turret@128,192`, `turret@112,240`; route step 27's walk is
 * the one the game refuted (U14: a spit at t196). These two witnesses stand ONE
 * turret's range alone, at (44,220): 56.9 px from `turret@80,176`'s centre
 * (88,184), 94 and 81 px from the other two, with a clear line to it (the
 * first stance tried, (40,200), put `tree@32,160`'s corner on the line: the
 * prediction showed spit #2 dying on it at t69).
 *
 * ⛓ THE AS3, AS READ (`turret.js` transcribes it):
 *   · `Turret.update`, below its freeze return: within `attackRange` 64
 *     (`var d:int` TRUNCATES) and not mid-shot, turn a tenth of the way toward
 *     the player; `shootTimer` (seeded 0) counts down, and at 0 re-arms 40 and
 *     plays "startshot". Out of range — and on every tick of either shot
 *     animation — `shootTimer = 40`.
 *   · Both shot animations are two frames at rate 10 under `FP.elapsed` 0.0333,
 *     so each wraps on its 7th update; "startshot"'s wrap plays "finishshot" and
 *     adds `TurretSpit(x, y, 3·(cos a, sin a))`, `a = -angle/180·π`.
 *     ⇒ a play at T spawns at T+6, the spit first moves at T+7, the turret idles
 *     at T+14 and plays again at T+54.
 *   · The spit (added after the Player, PREPENDED: it updates first) moves in
 *     1 px sub-steps (`solids = []`), then collides `["Player","Tree","Solid",
 *     "Shield"]` and is removed on any contact; a Player contact is
 *     `hit(null, v.length, Point(x, y))`. `"Shield"` is the player's OWN shield
 *     entity, placed by `Player.render` on the side the player faces.
 *
 * ⛓ THE TWO ARMS. Both boot at (44,220) with route step 27's staging (the L29
 * arrival latch r9-solve-22 measured: the shield, the Red Key) and tap one key
 * at t0 to set the facing, then stand.
 *   `u15-turret-spit`    taps `left`: facing AWAY from the turret (the shield on
 *                        the west side). The t0 play turned only a tenth of the
 *                        way, so spit #1 flies off south-east into cover; spit
 *                        #2 (play t54) is aimed and HITS.
 *   `u15-turret-shield`  taps `right`: facing the turret, the shield box on the
 *                        east side. Spit #2 meets the SHIELD first and is removed
 *                        with no hit: `hits` stays 0.
 *
 * The predictions are printed BEFORE any model step reads them: `turret.js`
 * stepped beside the model's own player, up to the first hit. Once
 * `levelRun` steps the family, `--check` also asserts the run's own spit
 * ledger equals the prediction.
 *
 * Run:  node scripts/procgen/plan-seedling-u15-turret.mjs          # write
 *       node scripts/procgen/plan-seedling-u15-turret.mjs --check  # compare
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { playerShieldRect } = await import(join(MODULE, 'bobBossFight.js'));
const T = await import(join(MODULE, 'turret.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();

/** Route step 27's staging: `r9-solve-22`'s measured L29 arrival latch, verbatim. */
const PERSISTENCE = Object.freeze([
    [0, 1], [2, 0], [3, 0], [5, 0], [8, 0], [8, 1], [10, 0], [11, 0], [12, 5], [12, 10],
    [15, 0], [15, 2], [15, 3], [16, 0], [16, 3], [16, 4], [16, 6], [16, 7], [17, 29], [18, 0],
    [19, 0], [19, 1], [20, 0], [20, 1], [20, 2], [20, 4],
].map(([level, tag]) => Object.freeze({ level, tag, note: '' })));
const ITEMS = Object.freeze({
    hasSword: true, hasGhostSword: false, hasShield: true, hasFire: false,
    hasWand: false, hasFireWand: false, canSwim: false, hasSpear: false,
    hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false, hasFeather: false,
    hasTorch: false,
});
const SEAM = Object.freeze({
    items: ITEMS,
    beam: false,
    rock_set: true,
    hits_max: 3,
    first_use: false,
    extended: false,
    time: 15525,
    primary: 0,
    secondary: 0,
    grass_cut: 507,
    cutscene: [false, false, false, false],
    menu_state: 0,
    music: { set: 'Room', index: 0 },
});
const SAVE = Object.freeze({ totem_parts: [], keys: [0], seal_parts: [0] });
const RNG = Object.freeze({ seed: 1957537603, split: true, cosmetic: 68471068, fp: 584032791 });
const PINS = Object.freeze(['sound', 'dead_frames']);
const fresh = () => ({
    persistence: PERSISTENCE.map((p) => ({ ...p })),
    pins: [...PINS],
    save: { ...SAVE, keys: [...SAVE.keys], seal_parts: [...SAVE.seal_parts] },
    rng: { ...RNG },
    seam: JSON.parse(JSON.stringify(SEAM)),
});

function stage(boot) {
    return createLevelRun({
        levelSource, boot, noclip: false, noHazards: [], noDamage: false, grants: [],
        despawn: [], equips: [], ...fresh(),
    });
}

function tapeJson(name, boot, perTick, description) {
    const folded = buildTape(perTick, boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling', name, boot,
        noclip: false, noDamage: false, noHazards: [], grants: [],
        equips: [], ...fresh(),
        tick_count: perTick.length,
        inputs: folded.inputs,
        tape_version: 8,
    };
    const parsed = parseTape({ ...tape, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
}

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${name} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
}

/**
 * The PREDICTION: drive the model's player, and step `turret.js` beside it in
 * the game's order (spits, then turrets, then the player), stopping at the
 * first hit — after it the model's player is a different player depending on
 * whether `levelRun` steps the family, and the prediction is about the AS3.
 */
function predict(boot, perTick) {
    const run = stage(boot);
    const world = run.world;
    const turrets = levelSource(boot.level).entities.filter((e) => e.type === 'turret')
        .map((e) => T.createTurret(e.x, e.y)).reverse();
    let air = [];
    const events = [];
    const flight = new Map();
    for (let t = 0; t < perTick.length; t += 1) {
        const st = run.state;
        const box = playerBoxAt(st.x, st.y);
        const shield = playerShieldRect(st, false);
        for (const s of air) {
            const r = T.stepTurretSpit(s, { playerBox: box, shieldBox: shield,
                blockedAt: (b) => !!world.collidesBlast(b, {}) });
            flight.get(s.id).push([t + 1, s.x, s.y]);
            if (r.removed) {
                events.push({ t: t + 1, what: r.hitPlayer ? 'hit' : r.hitTypes.includes('Shield')
                    ? 'shield' : 'cover', id: s.id, x: s.x, y: s.y });
            }
        }
        air = air.filter((s) => !s.removed);
        for (const tu of turrets) {
            const before = tu.anim;
            T.stepTurret(tu, { player: { x: st.x, y: st.y } });
            if (before !== 'startshot' && tu.anim === 'startshot') {
                events.push({ t: t + 1, what: 'play', id: tu.id, angle: tu.angle });
            }
            if (tu.spawned) {
                air.unshift(tu.spawned);
                flight.set(tu.spawned.id, []);
                events.push({ t: t + 1, what: 'spawn', id: tu.spawned.id,
                    x: tu.spawned.x, y: tu.spawned.y, v: { ...tu.spawned.v } });
            }
        }
        if (events.some((e) => e.what === 'hit')) break;
        run.advance(perTick[t]);
    }
    return { events, flight };
}

function driveModel(boot, perTick) {
    const run = stage(boot);
    const at = [{ t: 0, x: run.state.x, y: run.state.y, hits: 0 }];
    try {
        for (const held of perTick) {
            run.advance(held);
            at.push({ t: run.ticksCompleted, x: run.state.x, y: run.state.y,
                hits: run.playerHits.length });
        }
    } catch (e) {
        return { run, at, refused: e.message.split('\n')[0] };
    }
    return { run, at, refused: null };
}

const show = (e) => `${e.what} t${e.t} ${e.id}${e.angle !== undefined ? ` angle ${e.angle.toFixed(3)}°` : ''}`
    + `${e.v ? ` v (${e.v.x.toFixed(4)}, ${e.v.y.toFixed(4)})` : ''}`
    + `${e.what !== 'play' && e.what !== 'spawn' ? ` at (${e.x.toFixed(3)}, ${e.y.toFixed(3)})` : ''}`;

const BOOT = Object.freeze({ level: 29, x: 36, y: 212 });
const TICKS = 100;
const ARMS = [
    {
        name: 'u15-turret-spit', key: 'left', expect: 'hit',
        description: '⛓⛓⛓ U15-swim D1 — THE TURRET SPIT, WITNESSED. L29 booted with route step 27\'s '
            + 'staging (r9-solve-22\'s measured L29 arrival latch: the shield, the Red Key) at '
            + '(44,220) — 56.9 px from `turret@80,176`\'s centre (88,184), out of the other two\'s '
            + 'range, with a clear line to it. `left` tapped at t0 (the shield faces WEST, away from the turret), then 99 '
            + 'ticks standing. `Turret.update` (`Enemies/Turret.as:45-79`): in range from its first '
            + 'frame with `shootTimer` 0, so it plays "startshot" at t0 having turned only a tenth '
            + 'of the way; the two-frame animations wrap on their 7th update (rate 10 x 0.0333), so '
            + 'each play spawns a `TurretSpit` 6 ticks later and the next play is 54 after. Spit #1 '
            + 'flies off into cover; spit #2 (play t54) is aimed and HITS: `hit(null, v.length, '
            + 'p)`, force 3, `hits` 1. Fixed keys. Authored by '
            + 'scripts/procgen/plan-seedling-u15-turret.mjs.',
    },
    {
        name: 'u15-turret-shield', key: 'right', expect: 'shield',
        description: '⛓⛓⛓ U15-swim D1 — THE SHIELD STOPS A TURRET SPIT. `u15-turret-spit`\'s '
            + 'staging and stance, but `right` tapped at t0: the player faces the turret, and '
            + '`Player.render` places the shield entity (`type = "Shield"`, a `TurretSpit` '
            + 'hitable) as a 3x7 box on the EAST side. Spit #2 meets it before the player box and '
            + 'is removed with no hit — `hits` stays 0. Fixed keys. Authored by '
            + 'scripts/procgen/plan-seedling-u15-turret.mjs.',
    },
];

for (const arm of ARMS) {
    const perTick = Array.from({ length: TICKS }, (_, t) => (t === 0 ? new Set([arm.key]) : new Set()));
    emit(arm.name, tapeJson(arm.name, BOOT, perTick, arm.description));
    const p = predict(BOOT, perTick);
    console.log(`  ${arm.name} — predicted (turret.js beside the model's player, to the first hit):`);
    for (const e of p.events) console.log(`    ${show(e)}`);
    const end = p.events.find((e) => e.what === 'hit' || e.what === 'shield');
    check(`⛓ the AS3 arithmetic: plays at t1 and t55 (observation ticks), spawns 6 later; spit #2 `
        + `ends at the ${arm.expect.toUpperCase()}`,
    p.events.filter((e) => e.what === 'play' && e.id === 'turret@80,176').map((e) => e.t)
        .slice(0, 2).join(',') === '1,55'
        && p.events.filter((e) => e.what === 'spawn').map((e) => e.t).slice(0, 2).join(',') === '7,61'
        && end?.what === arm.expect && end?.id === 'turret@80,176#2',
    `plays ${p.events.filter((e) => e.what === 'play').map((e) => `t${e.t}`).join(' ')}; `
        + `spawns ${p.events.filter((e) => e.what === 'spawn').map((e) => `t${e.t}`).join(' ')}; `
        + `${end ? `${end.what} t${end.t}` : 'NO END'}`);
    const f2 = p.flight.get('turret@80,176#2') ?? [];
    console.log(`    spit #2 per tick: ${f2.map(([t, x, y]) => `t${t} (${x.toFixed(2)},${y.toFixed(2)})`).join(' ')}`);
    const { run, at, refused } = driveModel(BOOT, perTick);
    check(`${arm.name}: the model walks the tape (no refusal)`, refused === null, refused ?? '');
    if (run && typeof run.ledger === 'function' && (() => { try { run.ledger('spitEvents'); return true; } catch { return false; } })()) {
        const ledger = run.ledger('spitEvents').filter((e) => e.t <= (end?.t ?? Infinity));
        const want = p.events.filter((e) => e.what !== 'play');
        const same = ledger.length === want.length && ledger.every((e, i) => e.what === want[i].what
            && e.id === want[i].id && e.t === want[i].t && e.x === want[i].x && e.y === want[i].y);
        check(`${arm.name}: the run's own spit ledger IS the prediction (every spawn and removal, `
            + 'tick and position)', same,
        ledger.map((e) => `${e.what}@t${e.t}`).join(' '));
        const hits = at.at(-1).hits;
        check(`${arm.name}: the model's hits are the arm's (${arm.expect === 'hit' ? 1 : 0})`,
            hits === (arm.expect === 'hit' ? 1 : 0), `hits ${hits}`);
    } else {
        console.log(`    (the run steps no turret yet — the ledger rows wait for the model step)`);
    }
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
