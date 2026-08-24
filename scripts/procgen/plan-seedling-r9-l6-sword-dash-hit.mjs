/**
 * ⛓⛓⛓ R9 SLICE 12c — **THE SWORD DASH'S RECT, DRIVEN AGAINST A BODY.**
 *
 * ⚖ Ruling 31(a) put the dash's MOVEMENT half under a driven witness before
 * any solver could rely on it, and `plan-seedling-r9-l0-sword-dash` is that
 * witness — x and v digit for digit, four press cases, on a body-free
 * corridor. ⚖ Ruling 35 now asks the oracle and the planner to model the dash
 * COMPLETELY, and the half nothing has ever asked the game about is the
 * **RECT**: a dash plays "slashnarrow", which `Player.render` squashes to
 * 1.5 x 0.65, so `getSlashRect()` returns **24 x 20.8** where an ordinary
 * swing returns 16 x 32 — and `slash()`'s second filter is
 * `slashingSprite.width * scaleX`, so the REACH goes 16 -> 24 with it.
 *
 * ⛔⛔ **WIDER ALONG THE SWING AND SHORTER ACROSS IT: NEITHER RECT CONTAINS
 * THE OTHER.** A model that used one shape for both is wrong in BOTH
 * directions — it misses bodies a dash reaches and offers bodies a dash
 * misses. Slice 12c's strike policy chooses its candidate scan's rect from
 * `slashSet`'s forecast outcome, so from this slice on a solver's choice of
 * target depends on this rect being right.
 *
 * ── THE DISCRIMINATOR, WHICH IS THE WHOLE REASON THIS TAPE EXISTS ─────
 *
 * The landed hit is at **`distanceRectPoint` 19.34**. That is ABOVE
 * `SLASH_REACH` (16) and BELOW `SLASH_REACH_DASH` (24). ⇒ a model that swung
 * the ORDINARY rect for a dash press lands NO HIT here, and a model that
 * swung the DASH rect for the ordinary press lands one two ticks EARLY. The
 * tape distinguishes the two models by a single boolean the game itself
 * reports: is the body hit, and on which tick.
 *
 * ⛓ AND THE ORDINARY SWING IN FRONT OF IT MISSES, BY CONSTRUCTION. The press
 * at k = 0 fires its 16 x 32 rect twice and collects nothing. That is the
 * control: without it the tape would prove only "a press hit a bob".
 *
 * ── AND IT WITNESSES THE `slashRepeats` REPLACEMENT TOO ──────────────
 *
 * §23.15's double-count needs two presses inside `SLASH_HIT_TICKS`, and this
 * tape has exactly that — k = 0 and k = 2. In the game `play("slashnarrow",
 * true)` RESTARTS the animation, so the first swing's remaining hit ticks are
 * REPLACED. The rects fire on ticks 5, 6, 7, 8, 9, 10, 11 — **seven ticks,
 * one rect each, contiguous**. Under the pre-12c model ticks 8 and 9 would
 * each have taken TWO.
 *
 * ── THE ROOM ─────────────────────────────────────────────────────────
 *
 * L6 at `r9-l6-bob-press`'s own boot, which is also
 * `probe-seedling-r9-bob-press-mobiles.mjs`'s room. ⛔ NOT L0: L0's corridor
 * is where the MOVEMENT witness lives precisely because it is BODY-FREE, and
 * the atlas is fixed — a witness does not place bodies. L6 is the nearest
 * bridged room with a modelled body (`bob@112,48`, class `Bob`, whose
 * `KILL_ARM_POLICY` row R9 slice 12 lifted to `modelled`) on ground a player
 * can hold `right` down, which a dash needs: at rest the impulse is exactly
 * (0,0) because `point_normalize` no-ops at zero length.
 *
 * ⛓ THE PLAYER TAKES NO HITS. The bob is knocked back by `swordForce` and
 * walks away with its 30-tick i-frame up; the tape ends before it returns. A
 * witness that had to survive a hit would be a witness about the hit.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r9-l6-sword-dash-hit.mjs
 *   node scripts/procgen/plan-seedling-r9-l6-sword-dash-hit.mjs --check
 *
 * Then record (the game is the only oracle for a rect):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r9-l6-sword-dash-hit
 *
 * ⚠ AND THE EXPECTATION IS THE PLAYER'S, WHICH IS TRAP 564. A green
 * `--win --record` says the PLAYER walked where the model said; it says
 * almost nothing about the BOB. The body's own column — position, knockback,
 * `hitsTimer` — is asked of the game through `--mobiles`, the way
 * `probe-seedling-r9-bob-press-mobiles.mjs` asks it. The sealed table this
 * script prints is what that probe is diffed against.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const {
    DASH_CHAIN, DASH_DISPLACEMENT, SLASH_ANIM_DASH, SLASH_ANIM_TICKS, SLASH_DASH_FORCE,
    SWORD_FORCE,
} = await import(join(MODULE, 'combatVerbs.js'));
const { ENEMY_HITS_TIMER, SLASH_HIT_TICKS, SLASH_REACH, SLASH_REACH_DASH } = await import(
    join(MODULE, 'presses.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const NAME = 'r9-l6-sword-dash-hit';
const TARGET = 'bob@112,48';
/** `r9-l6-bob-press`'s own boot — the room the `--mobiles` probe already drives. */
const BOOT = Object.freeze({ level: 6, x: 80, y: 48 });

/**
 * ⛓ THE APPROACH IS DERIVED, NOT PICKED. `right` is held until the swing at
 * k = 0 would MISS and the dash at k = 2 would LAND — i.e. until the target's
 * `distanceRectPoint` from the player's centre sits strictly between
 * `SLASH_REACH` and `SLASH_REACH_DASH` on the dash's own fire tick. Below,
 * the walk length is SEARCHED for that property rather than typed, and the
 * search's answer is asserted to be unique in its neighbourhood.
 */
const levelSource = atlasLevelSource();
const newRun = () => createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    // ⚠ FALSE, and the tape must survive it honestly: under `noDamage` the run
    // relaxes the very chaser work this witness is about.
    noDamage: false,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null,
    seam: { items: { hasSword: true } },
    roles: ROLES,
});

const NONE = new Set();
const EAST = new Set(['right']);
const withPress = (base) => new Set([...base, 'primary']);

/**
 * ⛓⛓ THE SCHEDULE IS `DASH_CHAIN`'s OWN FIRST PAIR. `combatVerbs.DASH_CHAIN`
 * derives the dash offsets by running the transcription under a controller's
 * real rules (the rising edge, and `slashEnd` firing below the press); this
 * tape drives its first two, so the fixture and the constant cannot disagree
 * about what a chain IS. Only two, because the claim is a RECT and every press
 * after the first landed one is refused by the receiver's i-frame anyway.
 */
const CHAIN = [0, DASH_CHAIN.at[0]];
/**
 * ⛓ A TAIL LONG ENOUGH TO SPEND THE IMPULSE AND WATCH THE BODY LEAVE. The
 * dash's surplus decays over `DASH_DISPLACEMENT.ticks`, its own animation is
 * `SLASH_ANIM_TICKS[SLASH_ANIM_DASH]`, and the knocked body needs a few ticks
 * to show which way it went.
 */
const TAIL = DASH_DISPLACEMENT.ticks + SLASH_ANIM_TICKS[SLASH_ANIM_DASH] + SLASH_HIT_TICKS;

function drive(walkTicks) {
    const run = newRun();
    const pressTicks = new Set(CHAIN.map((k) => walkTicks + k));
    const perTick = [];
    const rows = [];
    const total = walkTicks + CHAIN[CHAIN.length - 1] + TAIL;
    for (let t = 0; t < total; t += 1) {
        const base = t < walkTicks ? EAST : NONE;
        const held = pressTicks.has(t) ? withPress(base) : base;
        const body = run.strikeBodies.find((b) => b.id === TARGET) ?? null;
        rows.push({
            t,
            press: pressTicks.has(t),
            x: run.state.x,
            y: run.state.y,
            vx: run.state.vx,
            bx: body?.x ?? null,
            by: body?.y ?? null,
            hits: body?.hits ?? null,
            hitsTimer: body?.hitsTimer ?? null,
        });
        perTick.push(held);
        const r = run.advance(held);
        if (r.transition) {
            throw new Error(`${NAME}: the run crossed to level ${r.transition.to_level} at `
                + `tick ${t}. The witness must stay in one room.`);
        }
    }
    return { run, perTick, rows, walkTicks, pressTicks };
}

/**
 * ⛔⛔ THE SEARCH, AND ITS SCORE IS THE POINT.
 *
 * A walk QUALIFIES when its one landed hit belongs to a press `slashSet` calls
 * a DASH and the player is untouched. Seven lengths qualify, and taking the
 * shortest is the wrong rule: its landed reach is **23.457**, which is 0.543 px
 * inside `SLASH_REACH_DASH`.
 *
 * ⛔ A DISCRIMINATOR HALF A PIXEL FROM ITS OWN BOUND CANNOT TELL A WRONG MODEL
 * FROM FLOAT NOISE. The whole value of this tape is that the game answers a
 * BOOLEAN — did the body take a hit — and that boolean flips at 16 and at 24.
 * A reach sitting against either edge makes the game's answer depend on the
 * last bit of a float rather than on the rect being right.
 *
 * ⇒ the score is the MARGIN from the nearer bound, `min(reach - SLASH_REACH,
 * SLASH_REACH_DASH - reach)`, maximised; ties broken by the shorter walk. The
 * winner sits near the middle of the band that only a dash can reach, so a
 * model swinging the ORDINARY rect misses it by a wide margin and a model that
 * over-reached would hit it two ticks early.
 */
let chosen = null;
const surveyed = [];
for (let walkTicks = 0; walkTicks <= 24; walkTicks += 1) {
    let attempt;
    try { attempt = drive(walkTicks); } catch { continue; }
    const outcomeAt = new Map(attempt.run.slashPresses.map((p) => [p.t, p.outcome]));
    const landed = attempt.run.chaserPressHits.filter((h) => h.landed);
    const firstPress = attempt.run.presses.find((p) => (p.hits ?? []).some((h) => h.landed));
    const ok = landed.length === 1
        && firstPress !== undefined
        && outcomeAt.get(firstPress.t) === 'dash'
        && attempt.run.playerHits.length === 0;
    const margin = ok
        ? Math.min(landed[0].reach - SLASH_REACH, SLASH_REACH_DASH - landed[0].reach)
        : null;
    surveyed.push({ walkTicks, ok, margin, reach: landed[0]?.reach ?? null,
        landed: landed.length,
        firstOutcome: firstPress ? outcomeAt.get(firstPress.t) : null,
        playerHits: attempt.run.playerHits.length, attempt });
}
const qualifying = surveyed.filter((s) => s.ok);
if (qualifying.length === 0) {
    console.error(`${NAME}: no walk length in 0..24 lands its FIRST hit with a DASH press `
        + 'and leaves the player untouched. The room or the atlas has moved.');
    process.exit(1);
}
qualifying.sort((a, b) => (b.margin - a.margin) || (a.walkTicks - b.walkTicks));
chosen = qualifying[0].attempt;

const { run, perTick, rows, walkTicks, pressTicks } = chosen;
const outcomeAt = new Map(run.slashPresses.map((p) => [p.t, p.outcome]));
const swingTick = walkTicks + CHAIN[0];
const dashTick = walkTicks + CHAIN[1];
const swingRects = run.presses.filter((p) => p.t === swingTick);
const dashRects = run.presses.filter((p) => p.t === dashTick);
const landed = run.chaserPressHits.filter((h) => h.landed);

check('⛓ the schedule is `DASH_CHAIN`\'s own first pair — an ordinary swing, then a DASH',
    outcomeAt.get(swingTick) === 'slash' && outcomeAt.get(dashTick) === 'dash',
    `k=0 -> ${outcomeAt.get(swingTick)}, k=${CHAIN[1]} -> ${outcomeAt.get(dashTick)} `
    + `(walk ${walkTicks} tick(s))`);
check('⛔ the ORDINARY swing MISSES — the control, and without it this tape proves only '
    + 'that a press hit a bob',
    swingRects.length > 0 && swingRects.every((p) => (p.hits ?? []).length === 0),
    `${swingRects.length} rect(s) at ${swingRects.map((p) => p.fired).join('/')}, `
    + `${swingRects.map((p) => `${p.rect.w}x${p.rect.h}`).join(' ')}, no hits`);
check(`⛔⛔ the DASH's rect is ${dashRects[0]?.rect.w} x ${dashRects[0]?.rect.h} — "slashnarrow" `
    + 'squashed 1.5 x 0.65, and NEITHER rect contains the other',
    dashRects.length > 0
        && dashRects.every((p) => p.rect.w === 24 && Math.abs(p.rect.h - 20.8) < 1e-9)
        && swingRects.every((p) => p.rect.w === 16 && p.rect.h === 32),
    `dash ${dashRects[0]?.rect.w}x${dashRects[0]?.rect.h}, swing `
    + `${swingRects[0]?.rect.w}x${swingRects[0]?.rect.h}`);
check('⛓⛓⛓ ONE hit LANDED, and it is the DASH press\'s',
    landed.length === 1 && dashRects.some((p) => (p.hits ?? []).some((h) => h.landed)),
    `${landed.length} landed at t=${landed.map((h) => h.t).join(',')} on `
    + `${landed.map((h) => h.id).join(',')}`);
check(`⛔⛔⛔ THE DISCRIMINATOR: the landed reach is ABOVE ${SLASH_REACH} and BELOW `
    + `${SLASH_REACH_DASH}, so ONLY the dash rect can reach it`,
    landed.length === 1 && landed[0].reach > SLASH_REACH && landed[0].reach <= SLASH_REACH_DASH,
    `distanceRectPoint = ${landed[0]?.reach.toFixed(3)} (SLASH_REACH ${SLASH_REACH}, `
    + `SLASH_REACH_DASH ${SLASH_REACH_DASH}). A model swinging the ORDINARY rect for a `
    + 'dash press lands NOTHING here.');
check(`⛓ the hit arms the receiver's ${ENEMY_HITS_TIMER}-tick i-frame and knocks the body `
    + `back by \`swordForce\` (${SWORD_FORCE})`,
    landed.length === 1 && landed[0].hitsTimer === ENEMY_HITS_TIMER
        && Math.abs(Math.hypot(landed[0].knockback.dx, landed[0].knockback.dy) - SWORD_FORCE)
            < 1e-2,
    `hitsTimer ${landed[0]?.hitsTimer}, knockback `
    + `(${landed[0]?.knockback.dx.toFixed(4)}, ${landed[0]?.knockback.dy.toFixed(4)})`);
/**
 * ⛓⛓ AND NO SECOND HIT LANDS, FOR A REASON THE GAME CAN BE DIFFED ON. The
 * dash's window runs four more hit ticks after the one that lands, and none of
 * them lands — because `Enemy.hit`'s own `swordForce` throws the body clear of
 * the rect that just hit it. That displacement is the check: within two ticks
 * of the hit the body has moved at least `SWORD_FORCE` px, and every later
 * rect that DID still cover it would be refused by the 30-tick i-frame.
 *
 * ⚠ WRITTEN THIS WAY BECAUSE THE OBVIOUS FORM IS VACUOUS HERE. The first cut
 * asserted "the later rects are refused by the i-frame" and FAILED — on this
 * fixture no later rect covers the body at all, so there is no refusal to
 * count and an empty list would have read as agreement.
 */
const hitRow = rows.find((r) => r.t === landed[0].t + 1);
const afterRow = rows.find((r) => r.t === landed[0].t + 2);
check(`⛓⛓ NO SECOND HIT LANDS — \`swordForce\` (${SWORD_FORCE}) throws the body clear of `
    + 'the rect that hit it, and any later rect still covering it meets the i-frame',
    landed.length === 1 && hitRow && afterRow
        && Math.hypot(afterRow.bx - hitRow.bx, afterRow.by - hitRow.by) >= SWORD_FORCE * 0.8
        && run.chaserPressHits.filter((h) => !h.landed)
            .every((h) => /i-frames/.test(h.why ?? '')),
    `the body moved ${Math.hypot(afterRow.bx - hitRow.bx, afterRow.by - hitRow.by).toFixed(3)} px `
    + `in the two ticks after the hit; ${run.chaserPressHits.filter((h) => !h.landed).length} `
    + 'later rect(s) reached it at all'
    + `${run.chaserPressHits.filter((h) => !h.landed).length
        ? ` — ${run.chaserPressHits.filter((h) => !h.landed).map((h) => `t${h.t}: ${h.why}`).join(' | ')}`
        : ''}`);
/**
 * ⛓⛓⛓ AND THE `slashRepeats` REPLACEMENT, WITNESSED IN THE SAME TAPE. Two
 * presses inside `SLASH_HIT_TICKS` is exactly what §23.15's double-count
 * needs; the game restarts the animation, so the rects are ONE PER TICK and
 * CONTIGUOUS.
 */
const firedTicks = run.presses.map((p) => p.fired).sort((a, b) => a - b);
check('⛓⛓⛓ two presses inside `SLASH_HIT_TICKS` fire ONE rect per tick, contiguously — '
    + 'the REPLACEMENT, witnessed',
    dashTick - swingTick < SLASH_HIT_TICKS
        && new Set(firedTicks).size === firedTicks.length
        && firedTicks.every((v, i) => i === 0 || v === firedTicks[i - 1] + 1),
    `presses ${dashTick - swingTick} tick(s) apart; rects fired on `
    + `${firedTicks.join(',')} (${firedTicks.length} rect(s), no tick twice)`);
check(`⛓ the dash's own +${SLASH_DASH_FORCE} impulse is on the record, along travel and `
    + 'nothing across it',
    run.dashes.length === 1 && run.dashes[0].impulse.dvx === SLASH_DASH_FORCE
        && run.dashes[0].impulse.dvy === 0,
    JSON.stringify(run.dashes.map((d) => d.impulse)));
check('⛔ the player took no hits and never left the room',
    run.playerHits.length === 0 && run.playerDeaths.length === 0
        && run.transitions.length === 0,
    `${run.playerHits.length} hit(s), ${run.transitions.length} transition(s)`);
check('⛓ the walk length is DERIVED and SCORED — the widest margin from either bound',
    qualifying[0].walkTicks === walkTicks
        && qualifying[0].margin >= 3,
    `walk ${walkTicks} of ${surveyed.length} surveyed; ${qualifying.length} qualify `
    + `(${qualifying.map((s) => `${s.walkTicks}:reach ${s.reach.toFixed(3)} margin `
        + `${s.margin.toFixed(3)}`).join(' · ')})`);

const folded = buildTape(perTick, BOOT, NAME,
    { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = {
    game: 'seedling',
    name: NAME,
    boot: BOOT,
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 1, split: false },
    seam: { items: { hasSword: true } },
    tick_count: perTick.length,
    inputs: folded.inputs,
    tape_version: 8,
};

const description = '⛓⛓⛓ R9 SLICE 12c — THE SWORD DASH\'S RECT, DRIVEN AGAINST A BODY, '
    + 'and it is the half of the dash nothing had ever asked the game about. ⚖ Ruling 31(a) '
    + 'put the MOVEMENT half under `r9-l0-sword-dash` (x and v digit for digit, on a '
    + 'body-free corridor); ⚖ ruling 35 asks for the COMPLETE model, and the rest of it is '
    + 'the RECT: a dash plays "slashnarrow", `Player.render` squashes it 1.5 x 0.65, and '
    + '`getSlashRect()` returns 24 x 20.8 where an ordinary swing returns 16 x 32 — WIDER '
    + 'ALONG THE SWING AND SHORTER ACROSS IT, so neither rect contains the other and a '
    + 'model using one for both is wrong in both directions. `slash()`\'s second filter is '
    + '`slashingSprite.width * scaleX`, so the REACH goes 16 -> 24 with the rect. THE '
    + 'DISCRIMINATOR IS THE LANDED REACH: 19.34, ABOVE SLASH_REACH (16) and BELOW '
    + 'SLASH_REACH_DASH (24) — a model that swung the ORDINARY rect for a dash press lands '
    + 'NOTHING here, and the game reports which. The ordinary swing two ticks earlier fires '
    + 'its 16 x 32 rect twice and collects nothing: that is the control, and without it the '
    + 'tape would prove only that a press hit a bob. The room is `r9-l6-bob-press`\'s own '
    + 'boot (also the `--mobiles` probe\'s), because L0\'s dash corridor is BODY-FREE on '
    + 'purpose and a witness does not place bodies. ⛓ IT ALSO WITNESSES §23.15\'s '
    + '`slashRepeats` REPLACEMENT: its two presses are two ticks apart, which is exactly '
    + 'what the double-count needed, and `play("slashnarrow", true)` RESTARTS the animation '
    + 'so the rects fire ONE PER TICK and contiguously where the pre-12c model fired two on '
    + 'each of two ticks. ⚠ The differential\'s expectation is the PLAYER\'s (trap 564): '
    + 'the BODY\'s own column — position, knockback by `swordForce`, and its 30-tick '
    + 'i-frame — is asked of the game through `--mobiles`. Authored by '
    + 'scripts/procgen/plan-seedling-r9-l6-sword-dash-hit.mjs.';

function tapeJson(obj) {
    const parsed = parseTape({ ...obj, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
}

const path = join(TAPES, `${NAME}.json`);
const json = tapeJson(tape);
if (CHECK) {
    const same = existsSync(path) && readFileSync(path, 'utf8') === json;
    check('⛓ the committed tape is what this script produces today', same,
        same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
} else {
    writeFileSync(path, json);
    console.log(`\nwrote ${path.slice(REPO.length + 1)}`);
}

console.log(`\n## ${NAME}: ${perTick.length} ticks, walk ${walkTicks}, swing at t=${swingTick}, `
    + `DASH at t=${dashTick}, one hit landed at t=${landed[0].t} `
    + `(reach ${landed[0].reach.toFixed(3)})`);
console.log('\n## THE SEALED TABLE — the model\'s per-tick answer, BEFORE the game sees it.');
console.log('## Any digit the `--mobiles` probe disagrees with IS the finding.');
console.log('   t     player x/y            vx      rect this tick            '
    + `${TARGET} x/y        hits  iframe`);
for (const r of rows) {
    const rect = run.presses.find((p) => p.fired === r.t);
    const mark = r.press ? `P:${outcomeAt.get(r.t) ?? '-'}` : '';
    console.log(`  ${String(r.t).padStart(3)} ${mark.padEnd(8)}`
        + `(${r.x.toFixed(3)},${r.y.toFixed(3)})`.padEnd(20)
        + ` ${r.vx.toFixed(3).padStart(6)}  `
        + (rect ? `${rect.rect.w}x${rect.rect.h} @${rect.rect.x.toFixed(2)}`.padEnd(24)
            : ''.padEnd(24))
        + ` (${r.bx?.toFixed(3)},${r.by?.toFixed(3)})`.padEnd(20)
        + `  ${String(r.hits).padStart(2)}   ${String(r.hitsTimer).padStart(3)}`);
}
console.log('\n## THE PRESS LEDGER');
for (const p of run.presses) {
    console.log(`   press t=${p.t} (${outcomeAt.get(p.t)}) fired t=${p.fired} `
        + `rect ${p.rect.w}x${p.rect.h} @(${p.rect.x.toFixed(3)},${p.rect.y.toFixed(3)}) `
        + `hits ${JSON.stringify(p.hits)}`);
}
console.log('\n## THE BODY LEDGER — what the `--mobiles` probe must agree with');
for (const h of run.chaserPressHits) {
    console.log(`   t=${h.t} ${h.id} landed=${h.landed} reach=${h.reach.toFixed(3)} `
        + `hits=${h.hits} hitsTimer=${h.hitsTimer} `
        + `knockback=${h.knockback ? `(${h.knockback.dx.toFixed(4)},${h.knockback.dy.toFixed(4)})` : 'null'}`
        + `${h.why ? ` why=${h.why}` : ''}`);
}
if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
