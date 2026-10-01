#!/usr/bin/env node
/**
 * plan-seedling-r3-death — ⛓⛓⛓ R3-swim: PLAYER DEATH THE GAME'S WAY, WITNESSED
 * ON THE GAME BEFORE THE MODEL STEP EXISTED.
 *
 * Four deaths, one `Player.die()` (`Player.as:1487-1491`): `dying = true;
 * restartLevel()`, and `Game.restartLevel()` (`Game.as:2008-2011`) is
 * `FP.world = new Game(level, playerPosition.x, playerPosition.y)` — the
 * CURRENT world's ctor args, swapped at the end of the tick.
 *
 *   `r3-pit-death` (D1) — L4 (`Dungeon1/2.oel`, no `<control>` block), boot
 *     (64,32), `noDamage`: `down` ×30, `right` ×8, then still to t 100. The
 *     pit edge fires on t 38 (`pit@80,64`); twenty `fallAlphaSpeed`
 *     subtractions later `checkFallingInPit` reaches alpha 0 with
 *     `Game.fallthroughLevel == -1` and calls `die()` (t 57). Observation 57
 *     is the respawn at the boot's half tile, (72,40).
 *
 *   `r3-drown` (D2) — L47, `r5-swim-drown`'s boot (208,136) WITHOUT the
 *     conch, `noDamage`: `right` ×80 into the sea, then still to t 140. Water
 *     from t 74 (`drownTimer` 10), the latch on t 84, then twenty `drown()`
 *     ticks: `drown()` sets `dying`, and `Player.update`'s `if (!dying)
 *     super.update()` skips the move, so the player does NOT move from t 85
 *     to t 103; the twentieth (`drownTimer` 0) is `die()` (t 104).
 *
 *   `r3-lava` (D2) — L96 (`Dungeon7/11.oel`), boot (32,64) on its own
 *     teleporter, `noDamage` FALSE: `left` ×30 onto the lava, then still to
 *     t 70. The lava arm's `hit(null, 0, null, 0)` on t 9 opens the 20-tick
 *     i-frame (`input()` steers only at `hitsTimer <= 0`) and adds 5 to the
 *     shake; the latch on t 19; `die()` on t 39.
 *
 *   `r3-bobboss-death` (D3) — `swim-u5-bobboss-encounter`'s boot, seam (with
 *     `hits_max` 1), save, rng and clears; `up` ×10 arms the rock, six presses
 *     page form 0's dialogue, then still: the boss's blade kills the player
 *     (t 147 in the model's first reading). `FallRockLarge`'s release frame
 *     wrote `playerPosition = (72,104)`, so the respawn is (80,112), inside the
 *     arena; the rebuilt rock is fallen (`checkPersistence` false) with
 *     `cameraTimer` 0, so its first live frame re-adds `new BobBoss(72,72)` and
 *     the dialogue opens again. `left` from t 160: the dialogue holds the
 *     player.
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE and every tape is emitted BEFORE the model is
 * driven, so this script authored the witnesses while the model still refused
 * all four deaths by name (witness-first, U12 § D1); `--check` re-derives them.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r3-death.mjs           (write)
 *   node scripts/procgen/plan-seedling-r3-death.mjs --check   (compare)
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

const { parseTape, PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
const NO_KEYS = new Set();
const keys = (...k) => new Set(k);
const span = (n, held) => Array.from({ length: n }, () => held);

/** The tape's own header, the fields a run is built from. */
function header(name, boot, { noDamage, noHazards = [], seam = {}, extra = {} }) {
    return {
        game: 'seedling',
        name,
        boot,
        noclip: false,
        noDamage,
        noHazards,
        grants: [],
        persistence: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false },
        seam: structuredClone(seam),
        ...extra,
    };
}

function emitTape(h, perTick, description) {
    const folded = buildTape(perTick, h.boot, h.name,
        { noclip: false, noDamage: h.noDamage, noHazards: h.noHazards, grants: [] });
    const tape = { ...h, tick_count: perTick.length, inputs: folded.inputs, tape_version: 8 };
    const parsed = parseTape({ ...tape, description });
    const json = `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
    const path = join(TAPES, `${h.name}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${h.name} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
}

/** Drive the MODEL with the fixed keys; a refusal is returned, not thrown. */
function driveModel(h, perTick) {
    const run = createLevelRun({
        levelSource, boot: h.boot, noclip: false, noHazards: h.noHazards, noDamage: h.noDamage,
        grants: [], persistence: h.persistence, despawn: [], equips: [], pins: h.pins,
        save: structuredClone(h.save), rng: structuredClone(h.rng),
        seam: structuredClone(h.seam), roles: ROLES,
    });
    const obs = [{ t: 0, x: run.state.x, y: run.state.y, level: run.level }];
    let t = 0;
    try {
        for (const held of perTick) {
            run.advance(held);
            t += 1;
            obs.push({ t, x: run.state.x, y: run.state.y, level: run.level });
        }
    } catch (e) {
        return { run, obs, refused: `t ${t + 1}: ${e.message.split('\n')[0]}` };
    }
    return { run, obs, refused: null };
}

const deathsOf = (r) => (r.refused ? [] : r.run.playerDeaths);
const fmtDeaths = (ds) => JSON.stringify(ds.map((d) => `${d.source}@${d.t}`
    + `->(${d.respawn?.x},${d.respawn?.y})`));
const at = (r, t) => r.obs[t] ?? null;
const still = (r, a, b) => {
    for (let t = a; t <= b; t += 1) {
        const o = at(r, t);
        if (!o || o.x !== at(r, a).x || o.y !== at(r, a).y) return false;
    }
    return true;
};

// ── r3-pit-death (D1) ────────────────────────────────────────────────
{
    const h = header('r3-pit-death', Object.freeze({ level: 4, x: 64, y: 32 }), { noDamage: true });
    const perTick = [...span(30, keys('down')), ...span(8, keys('right')), ...span(62, NO_KEYS)];
    const description = '⛓⛓⛓ R3-swim D1 — A PIT IN A ROOM WITH NO CONTROL BLOCK IS A DEATH. L4 '
        + '(`Dungeon1/2.oel`), boot (64,32), `noDamage`: `down` ×30, `right` ×8, then still to '
        + 't 100. The pit edge fires on t 38 (`pit@80,64`); `checkFallingInPit` cuts the input, '
        + 'lerps the player to the tile centre and fades the alpha by 0.05 a tick, and at alpha 0 '
        + '(t 57) `Game.fallthroughLevel` is still -1, so it calls `die()`: `restartLevel()` '
        + 'rebuilds L4 from its own ctor args, the boot. Observation 57 is the respawn at (72,40); '
        + 'there is no transition. `Bot.noDamage` guards `Player.hit`, not `die()`. Fixed keys, '
        + 'emitted while the model refused the pit by name. Authored by '
        + 'scripts/procgen/plan-seedling-r3-death.mjs.';
    emitTape(h, perTick, description);
    const r = driveModel(h, perTick);
    check('the model WALKS the pit death (no refusal)', r.refused === null, r.refused ?? '');
    check('⛓⛓⛓ one death, `pit`, on t 57, respawned at the boot (64,32)',
        fmtDeaths(deathsOf(r)) === '["pit@57->(72,40)"]', fmtDeaths(deathsOf(r)));
    check('⛓ observation 57 is the respawn (72,40) in L4, and no transition',
        at(r, 57)?.x === 72 && at(r, 57)?.y === 40 && at(r, 57)?.level === 4
        && !r.refused && r.run.transitions.length === 0, JSON.stringify(at(r, 57)));
    console.log(`## ${h.name}: ${perTick.length} ticks${r.refused ? ` — REFUSED: ${r.refused.slice(0, 220)}` : ''}`);
}

// ── r3-drown (D2) ────────────────────────────────────────────────────
{
    const h = header('r3-drown', Object.freeze({ level: 47, x: 208, y: 136 }),
        { noDamage: true, noHazards: ['waterfall'] });
    const perTick = [...span(80, keys('right')), ...span(60, NO_KEYS)];
    const description = '⛓⛓⛓ R3-swim D2 — DROWNING, THE GAME\'S WAY. L47, `r5-swim-drown`\'s boot '
        + '(208,136) with NO conch, `noDamage`: `right` ×80 into the sea, then still to t 140. '
        + '`checkDrowning` writes `drownTimer = 10` on the first water tick (t 74) and decrements '
        + 'on every later one; it latches `drowning` on t 84. From t 85 `drown()` runs instead: '
        + 'it spins `v` AND sets `dying`, and `Player.update`\'s `if (!dying) super.update()` then '
        + 'skips friction, input and the move — the player stands still for the whole spiral. The '
        + 'twentieth `drown()` (t 104, `drownTimer` 0) is `die()`; observation 104 is the respawn '
        + 'at (216,144). Fixed keys, emitted while the model refused the drowning by name. '
        + 'Authored by scripts/procgen/plan-seedling-r3-death.mjs.';
    emitTape(h, perTick, description);
    const r = driveModel(h, perTick);
    check('the model WALKS the drowning (no refusal)', r.refused === null, r.refused ?? '');
    check('⛓⛓⛓ one death, `drown`, on t 104, respawned at the boot',
        fmtDeaths(deathsOf(r)) === '["drown@104->(216,144)"]', fmtDeaths(deathsOf(r)));
    check('⛓⛓ the spiral does not move the player: observations 84..103 are one point',
        !r.refused && still(r, 84, 103), JSON.stringify([at(r, 84), at(r, 85), at(r, 103)]));
    console.log(`## ${h.name}: ${perTick.length} ticks${r.refused ? ` — REFUSED: ${r.refused.slice(0, 220)}` : ''}`);
}

// ── r3-lava (D2) ─────────────────────────────────────────────────────
{
    const h = header('r3-lava', Object.freeze({ level: 96, x: 32, y: 64 }), { noDamage: false });
    const perTick = [...span(30, keys('left')), ...span(40, NO_KEYS)];
    const description = '⛓⛓⛓ R3-swim D2 — LAVA WITHOUT THE DARK SUIT. L96 (`Dungeon7/11.oel`), '
        + 'boot (32,64) on its own teleporter, `noDamage` FALSE: `left` ×30 onto the lava, then still '
        + 'to t 70. On the first lava tick (t 9) `checkDrowning`\'s lava arm calls '
        + '`hit(null, 0, null, 0)` ABOVE `super.update()`: no damage and no knockback, but '
        + '`hitsTimer = 20` (so `input()` stops steering on that very tick) and `Game.shake += 5`. '
        + 'The latch on t 19, the still spiral t 20..38, `die()` on t 39; observation 39 is the '
        + 'respawn at (40,72). Fixed keys, emitted while the model refused the lava death by name '
        + 'and modelled no lava hit. Authored by scripts/procgen/plan-seedling-r3-death.mjs.';
    emitTape(h, perTick, description);
    const r = driveModel(h, perTick);
    check('the model WALKS the lava death (no refusal)', r.refused === null, r.refused ?? '');
    const lava = r.refused ? [] : r.run.playerHits.filter((x) => x.source === 'lava');
    check('⛓⛓ one lava hit, t 9: no damage, the i-frame and the shake',
        lava.length === 1 && lava[0].t === 9 && lava[0].hits === 0 && lava[0].shake === 5,
        JSON.stringify(lava.map((x) => `${x.t}:${x.hits}:${x.shake}`)));
    check('⛓⛓⛓ one death, `lava`, on t 39, respawned at the boot',
        fmtDeaths(deathsOf(r)) === '["lava@39->(40,72)"]', fmtDeaths(deathsOf(r)));
    console.log(`## ${h.name}: ${perTick.length} ticks${r.refused ? ` — REFUSED: ${r.refused.slice(0, 220)}` : ''}`);
}

// ── r3-bobboss-death (D3) ────────────────────────────────────────────
{
    const U5 = loadTape('swim-u5-bobboss-encounter');
    const seam = structuredClone(U5.seam);
    seam.hits_max = 1;
    const h = header('r3-bobboss-death', U5.boot, {
        noDamage: false, seam,
        extra: {
            persistence: structuredClone(U5.persistence),
            pins: [...U5.pins],
            save: structuredClone(U5.save),
            rng: structuredClone(U5.rng),
        },
    });
    const PAGES = new Set([19, 28, 37, 46, 55, 64]);
    const perTick = Array.from({ length: 210 }, (_, t) => {
        if (t < 10) return keys('up');
        if (PAGES.has(t)) return keys('primary');
        if (t >= 160 && t < 200) return keys('left');
        return NO_KEYS;
    });
    const description = '⛓⛓⛓ R3-swim D3 — A DEATH INSIDE THE BOBBOSS FIGHT REBOOTS THE FIGHT. '
        + '`swim-u5-bobboss-encounter`\'s boot, seam (`hits_max` 1), save, rng and clears; `up` ×10 '
        + 'arms the rock, six presses page form 0\'s dialogue, then still: the boss\'s blade kills '
        + 'the player. `FallRockLarge`\'s release frame wrote `playerPosition = (72,104)`, so '
        + '`restartLevel()` respawns at (80,112) inside the arena; the rebuilt rock is FALLEN '
        + '(`checkPersistence(tag)` false: Solid, `cameraTimer` 0), so its first live frame '
        + 're-adds `new BobBoss(72,72)` and the dialogue opens again. `left` from t 160 to 200: '
        + 'the dialogue holds the player. Fixed keys, emitted while the model refused the death by '
        + 'name. Authored by scripts/procgen/plan-seedling-r3-death.mjs.';
    emitTape(h, perTick, description);
    const r = driveModel(h, perTick);
    check('the model WALKS the BobBoss death (no refusal)', r.refused === null, r.refused ?? '');
    const ds = deathsOf(r);
    check('⛓⛓⛓ one death, `bobBoss`, respawned at the rock\'s playerPosition (72,104)',
        ds.length === 1 && ds[0].source === 'bobBoss' && ds[0].respawn?.x === 80
        && ds[0].respawn?.y === 112, fmtDeaths(ds));
    const ev = r.refused ? [] : r.run.ledger('bobBossEvents').filter((e) => ds[0] && e.t >= ds[0].t);
    check('⛓⛓ the rebuilt fight: the boss re-added (form 0) and its dialogue open again',
        ev.some((e) => e.what === 'boss-added' && e.form === 0)
        && ev.some((e) => e.what === 'dialogue-open' && e.form === 0),
        JSON.stringify(ev.slice(0, 6).map((e) => `${e.t}:${e.what}`)));
    console.log(`## ${h.name}: ${perTick.length} ticks${r.refused ? ` — REFUSED: ${r.refused.slice(0, 220)}` : ''}`);
}

if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nALL PASS');
