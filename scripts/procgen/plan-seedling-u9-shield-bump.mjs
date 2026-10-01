#!/usr/bin/env node
/**
 * plan-seedling-u9-shield-bump — ⛓⛓⛓ U9-swim: `Player.shieldBump`'s DRIVEN WITNESSES.
 *
 * `Player.shieldBump` (`Player.as:1697-1712`) shoves every `Enemy` the shield's
 * box touches while the player MOVES: `if (shieldObj && v.length > 0)`, then
 * `knockback(shieldForce = 5, new Point(x, y))` on each (a HIT instead under
 * the dark shield). U5 found it on L32's boss; U9 models it for every stepped
 * body (`levelRun.shieldBumpNow`). No committed tape can see it: the thirteen
 * that ever hold the shield never stand in a room with a stepped body while
 * they do (U9 W0's probe). So these tapes retire `noDamage` on purpose, grant
 * the shield through the seam, and are recorded on the GAME
 * (`check-seedling-bot-differential --record --only=<name>`); the model must
 * agree per tick.
 *
 *   u9-shield-bob-shove     L4, three tiles north of `bob@64,64`, walking DOWN
 *                           into it with the shield facing down: the bob is
 *                           thrown back by `shieldForce` each tick the 7x7 box
 *                           touches it, piles its velocity against the south
 *                           wall, and the contact that follows knocks the
 *                           player north.
 *   u9-shield-puncher       L12, two tiles west of `puncher@416,256`, walking
 *                           EAST into it: the shield touches the puncher and
 *                           it does NOT move — `Puncher.knockback` is an empty
 *                           override (`Puncher.as:167-170`).
 *   u9-shield-bob-standing  L4, diagonal to `bob@64,64`, STANDING: the bob sits
 *                           on the down-facing shield box for many ticks and is
 *                           never shoved (`v.length > 0` is false), until its
 *                           body reaches the player's and the contact lands —
 *                           and on THAT tick it is shoved: the contact wrote
 *                           the knockback into `v` before `Player.update`, and
 *                           the box is still the previous render's down box.
 *
 * The stances are CHOSEN, not derived — a witness is not a solve.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-u9-shield-bump.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-u9-shield-bump.mjs --check    # exit 1 on drift
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
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { chaserBoxAt } = await import(join(MODULE, 'chasers.js'));
const { playerShieldRect } = await import(join(MODULE, 'bobBossFight.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
const ITEMS = Object.freeze({ hasShield: true });
const NO_KEYS = new Set();

function stage(boot) {
    return createLevelRun({
        levelSource,
        boot,
        noclip: false,
        noHazards: [],
        // ⚠ FALSE — under `noDamage` the run steps no chaser (the header).
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null,
        seam: { items: { ...ITEMS } },
        roles: ROLES,
    });
}

function tapeJson(name, boot, perTick, description) {
    const folded = buildTape(perTick, boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling',
        name,
        boot,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false },
        seam: { items: { ...ITEMS } },
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

/** Drive `run` with `heldAt(i)` for `n` ticks; returns the per-tick held sets. */
function drive(run, n, heldAt) {
    const perTick = [];
    for (let i = 0; i < n; i += 1) {
        const held = heldAt(i);
        perTick.push(held);
        run.advance(held);
    }
    return perTick;
}

const overlaps = (a, b) => a.x + a.w > b.x && a.y + a.h > b.y && a.x < b.x + b.w && a.y < b.y + b.h;

// ── u9-shield-bob-shove ──────────────────────────────────────────────
{
    const NAME = 'u9-shield-bob-shove';
    /** L4 (`Dungeon1/2.oel`): spawn (72,40), tile (4,2); the bob's ctor puts it at (72,72). */
    const BOOT = Object.freeze({ level: 4, x: 64, y: 32 });
    const DOWN = new Set(['down']);
    const run = stage(BOOT);
    const perTick = drive(run, 60, (i) => (i < 40 ? DOWN : NO_KEYS));
    const rows = run.ledger('shieldBumps');
    const shoves = rows.filter((r) => r.shoved && r.id === 'bob@64,64');
    check('⛓⛓⛓ the moving shield SHOVES `bob@64,64` — at least one row, every one on the bob',
        shoves.length > 0 && rows.every((r) => r.shoved && r.id === 'bob@64,64'),
        JSON.stringify(shoves.map((r) => r.t)));
    check('⛓ the first shove is a +5 throw away from the player (|dv| ≈ 5, south)',
        shoves.length > 0 && shoves[0].v.y > 4,
        JSON.stringify(shoves[0]?.v ?? null));
    const hits = run.playerHits;
    check('the player is alive at the end', run.playerDeaths.length === 0,
        JSON.stringify(hits.map((h) => ({ t: h.t, source: h.source }))));
    const description = '⛓⛓⛓ U9-swim D2(a) — THE SHIELD SHOVES A BOB. L4, spawn (72,40), three '
        + 'tiles north of `bob@64,64` (ctor (72,72)), the SHIELD granted through the seam and '
        + '`noDamage` FALSE (no committed tape holds the shield in a room with a stepped body). '
        + 'The player walks DOWN for 40 ticks with the 7x7 shield box below it, then stands for '
        + '20. The model predicts `Player.shieldBump` — `knockback(shieldForce 5, playerPoint)` '
        + `on the bob each tick the box touches it while the player moves — at t ${shoves.map((r) => r.t).join(', ')}, `
        + 'the bob\'s velocity piling up against the south wall (`Mobile.moveY` stops the sweep '
        + `and keeps \`v\`), and the contact${hits.length ? ` at t ${hits.map((h) => h.t).join(', ')}` : ''} `
        + 'knocking the player north. Authored by scripts/procgen/plan-seedling-u9-shield-bump.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, perTick, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, shoves at t ${shoves.map((r) => r.t).join(', ')}, `
        + `hits ${JSON.stringify(hits.map((h) => h.t))}`);
}

// ── u9-shield-puncher ────────────────────────────────────────────────
{
    const NAME = 'u9-shield-puncher';
    /** L12, U7's punch-witness boot: two tiles west of `puncher@416,256`. */
    const BOOT = Object.freeze({ level: 12, x: 384, y: 256 });
    const EAST = new Set(['right']);
    const run = stage(BOOT);
    const perTick = drive(run, 60, (i) => (i < 40 ? EAST : NO_KEYS));
    const rows = run.ledger('shieldBumps');
    check('⛓⛓⛓ the shield TOUCHES the puncher and shoves NOTHING — the empty `knockback` override',
        rows.length > 0 && rows.every((r) => !r.shoved && r.why === 'empty knockback override'),
        JSON.stringify(rows.map((r) => ({ t: r.t, why: r.why }))));
    const hits = run.playerHits;
    check('the player is alive at the end', run.playerDeaths.length === 0,
        JSON.stringify(hits.map((h) => ({ t: h.t, source: h.source }))));
    const description = '⛓⛓⛓ U9-swim D2(b) — THE SHIELD MEETS A PUNCHER, AND THE PUNCHER DOES NOT '
        + 'MOVE. U7\'s L12 boot (two tiles west of `puncher@416,256`), the SHIELD granted through '
        + 'the seam and `noDamage` FALSE. The player walks EAST for 40 ticks with the 3x7 side '
        + 'box ahead of it, then stands for 20. The model predicts the box touches the puncher at '
        + `t ${rows.map((r) => r.t).join(', ')} and `
        + '`Puncher.knockback` — an EMPTY override (`Puncher.as:167-170`) — moves nothing; the '
        + `contact and the punch follow${hits.length ? ` (t ${hits.map((h) => `${h.t} ${h.source}`).join(', ')})` : ''}. `
        + 'A model that shoved it would throw it 5 px/tick east. Authored by '
        + 'scripts/procgen/plan-seedling-u9-shield-bump.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, perTick, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, touches at t ${rows.map((r) => r.t).join(', ')}, `
        + `hits ${JSON.stringify(hits.map((h) => `${h.t}:${h.source}`))}`);
}

// ── u9-shield-bob-standing ───────────────────────────────────────────
{
    const NAME = 'u9-shield-bob-standing';
    /** L4: spawn (56,56), tile (3,3), diagonal to the bob at (72,72). */
    const BOOT = Object.freeze({ level: 4, x: 48, y: 48 });
    const run = stage(BOOT);
    // Count the ticks the bob sits on the shield box while the player stands —
    // the window a gate-less model would shove in. Read BEFORE each tick: the
    // bump reads the box the previous frame's render placed.
    let standingTouches = 0;
    let firstStandingTouch = null;
    const perTick = drive(run, 100, (i) => {
        const s = run.state;
        const r = playerShieldRect(s, false);
        const b = run.chasers.find((c) => c.id === 'bob@64,64');
        if (r && b && Math.hypot(s.vx, s.vy) === 0
                && overlaps(r, chaserBoxAt(b.tag, b.x, b.y))) {
            standingTouches += 1;
            if (firstStandingTouch === null) firstStandingTouch = i + 1;
        }
        return NO_KEYS;
    });
    const rows = run.ledger('shieldBumps');
    const hits = run.playerHits;
    const contact = hits[0]?.t ?? null;
    check('⛓⛓⛓ a STANDING shield bumps nothing — no row before the contact, and the one row is ON it',
        contact !== null && rows.length === 1 && rows[0].t === contact && rows[0].shoved,
        JSON.stringify(rows.map((r) => ({ t: r.t, v: r.v }))));
    check('⛓ and the case is not vacuous: the bob sits on the box while the player stands',
        standingTouches > 0, `${standingTouches} tick(s), the first at t ${firstStandingTouch}`);
    check('⛓ the contact lands (the body reaches the player\'s own box)', hits.length > 0,
        JSON.stringify(hits.map((h) => ({ t: h.t, source: h.source }))));
    check('the player is alive at the end', run.playerDeaths.length === 0, '');
    const description = '⛓⛓⛓ U9-swim D2(c) — A STANDING SHIELD BUMPS NOTHING. L4, spawn (56,56), '
        + 'diagonal to `bob@64,64` (ctor (72,72)), the SHIELD granted through the seam and '
        + '`noDamage` FALSE, no keys for 100 ticks. `Player.shieldBump` is gated on '
        + '`v.length > 0`: the bob chases onto the down-facing 7x7 shield box and sits on it for '
        + `${standingTouches} tick(s) from t ${firstStandingTouch} without a shove, until its body `
        + `reaches the player's and the contact lands (t ${hits.map((h) => h.t).join(', ')}). On that `
        + 'tick the bob IS shoved: `hitPlayer` wrote the knockback into the player\'s `v` earlier in '
        + 'the frame, so `v.length > 0` holds, and the box is still where the previous frame\'s '
        + `render left it, facing down (t ${rows.map((r) => r.t).join(', ')}). A model without the gate `
        + 'would shove the bob off the box from the first touch and the contact would not land '
        + 'where it does. Authored by scripts/procgen/plan-seedling-u9-shield-bump.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, perTick, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, ${standingTouches} standing touches from t `
        + `${firstStandingTouch}, hits ${JSON.stringify(hits.map((h) => h.t))}`);
}

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
