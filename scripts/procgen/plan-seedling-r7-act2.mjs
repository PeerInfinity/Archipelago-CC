#!/usr/bin/env node
/**
 * plan-seedling-r7-act2 — AUTHOR the first honest segments, from the UNITS
 * and from the GAME's own latch. R7 slice 6c.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.1/§3.2 (the
 * segment and the seam), §15.7 (the ruled segment scope: the minimal valid
 * dependency chain, not the strict AP total order), §16.9 (what slice 6c
 * inherits). Chain data: `frontend/modules/seedlingDemo/playthroughWalk.js`,
 * chain `act2-the-sword`.
 *
 * ── ⛓ WHAT THIS ADDS TO `plan-seedling-r7-ends-meet.mjs` ──────────────
 *
 * That script authors the TOY chain, whose walk is two literal input spans
 * inherited from a frozen R1 fixture. This one authors a chain whose walk is
 * a ROUTE: forty-one spans positioned by A* against live per-visit geometry,
 * including a 200-tick button hold and a 39-tick LEAN on a pushable block.
 * Typing those would be transcribing a measurement, so the chain declares
 * LEGS and this synthesizes them — §3.6's M1 generator, one rung on from the
 * seam.
 *
 * ⛔ AND THE CUTS ARE CHECKED, NOT TAKEN. `playthroughWalk` DECLARES the
 * three transition ticks and the end tick; this refuses to author anything
 * unless the driver's own `transitions` and `tick_count` are exactly those.
 * A route that shifts by one tick under a physics edit is then a named
 * failure rather than a chain that silently re-cuts itself around the change
 * — which is the difference between a committed claim and a snapshot.
 *
 * ── THE CUSTODY CHAIN ─────────────────────────────────────────────────
 *
 * Segment 1 boots the game's own initial state and inherits NOTHING.
 * Every later segment's boot block is its predecessor's LATCH, read out of
 * the running game by `botSeam()` and handed to `segmentBootFromLatch`
 * (which refuses by name anything the tape format cannot express). Nothing
 * about any segment's state is typed anywhere.
 *
 * `--check` IS THE ORACLE: re-running must produce byte-identical tapes, or
 * the committed chain is not reproducible. That can only work because the
 * chain DECLARES its FlashPunk seed — `Engine.as:50` seeds the LCG once per
 * page from one `Math.random()`.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/plan-seedling-r7-act2.mjs            # write
 *   node scripts/procgen/plan-seedling-r7-act2.mjs --check    # verify
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
    existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const TAPES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');
const CHAIN_ID = (process.argv.find((a) => a.startsWith('--chain='))
    ?? '--chain=act2-the-sword').slice('--chain='.length);

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { gameVisibleTape, parseTape, requiredTapeVersion, TAPE_VERSION } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { segmentBootFromLatch, seamLatchFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));
const {
    PLAYTHROUGH_CHAINS, TRUE_INITIAL_BOOT, assertWalkUnits, chainInputsFor, chainSpans,
    walkGroups,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughWalk.js'));
const { synthesizeLegs } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV2.js'));
const { atlasLevelSource } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const chain = PLAYTHROUGH_CHAINS.find((c) => c.id === CHAIN_ID);
if (!chain) throw new Error(`no chain "${CHAIN_ID}"`);
if (!chain.walk.units) {
    throw new Error(`chain "${CHAIN_ID}" carries literal inputs, not units — `
        + 'author it with plan-seedling-r7-ends-meet.mjs');
}
console.log(`## chain ${chain.id} — units: ${JSON.stringify(assertWalkUnits(chain))}`);

/**
 * ⚠ THE SERIALIZED FORM IS WRITTEN FROM A PARSED TAPE, always. `parseTape`
 * normalises (sorts spans, sorts persistence clears, fills empty blocks), so
 * writing the raw object and reading it back would produce a file that
 * differs from what every consumer sees.
 */
function tapeJson(obj, description) {
    const parsed = parseTape(obj);
    return `${JSON.stringify({
        /**
         * ⛔ EACH TAPE AT ITS OWN VERSION, not the newest one. Only the
         * tapes that carry a v9 `at` are v9; the rest stay v8, which is what
         * keeps this chain's first four segments BYTE-IDENTICAL across the
         * bump — and what keeps the GAME (whose loader gates on the version
         * LIST) from refusing a tape for a feature it does not use.
         */
        tape_version: requiredTapeVersion(parsed),
        game: 'seedling',
        name: obj.name,
        description,
        boot: parsed.boot,
        noclip: parsed.noclip,
        noDamage: parsed.noDamage,
        noHazards: parsed.noHazards,
        grants: parsed.grants,
        persistence: parsed.persistence,
        // ⛓ R7 slice 6e: v10's witnessed body removals, beside the clears
        // they are modelled on. Written only when the tape carries any —
        // `requiredTapeVersion` stamps 10 for exactly that reason.
        ...(parsed.despawn.length ? { despawn: parsed.despawn } : {}),
        equips: parsed.equips,
        pins: parsed.pins,
        save: parsed.save,
        rng: parsed.rng,
        seam: parsed.seam,
        tick_count: parsed.tick_count,
        inputs: parsed.inputs,
    }, null, 4)}\n`;
}

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
        check(`${name} is byte-identical to what this planner derives`, have === json,
            have === null ? 'the tape does not exist'
                : have === json ? `${json.length} bytes`
                    : '⛔ DRIFT — the committed tape is not what the legs plus the '
                        + "game's own latch produce today");
        return;
    }
    writeFileSync(path, json);
    console.log(`WROTE ${path} (${json.length} bytes)`);
}

/**
 * ── ⛓⛓⛓ THE HETEROGENEOUS WALK (R7 slice 6d) ─────────────────────────
 *
 * The walk is a sequence of UNITS and this synthesizes it one GROUP at a
 * time, carrying a CURSOR between them: where the player is, what the world
 * has had cleared, and which tick the group starts on.
 *
 *   a `legs` group   one `synthesizeLegs` call, booted at the cursor,
 *                    planned against the cursor's persistence. Its spans are
 *                    DERIVED; `--check` re-derives them.
 *   a `phases` group its spans are DATA. Nothing is planned; the cursor is
 *                    advanced by the block's own declared `ticks`, position
 *                    and `earns`.
 *
 * ⛔⛔ AND THE PHASES BLOCK'S START IS CHECKED AGAINST THE ROUTE, not
 * assumed. `startsAt` is compared to the preceding group's own final arrival
 * — so a route that shifts by a tile stops the authoring by name instead of
 * splicing a choreography onto a stance it was never measured from.
 *
 * ⚠ THE CURSOR'S PERSISTENCE IS A PLAN-TIME FACT ABOUT A TICK, NEVER A BOOT
 * DECLARATION. A `phases` block's `earns` moves the world the PLANNER sees
 * from the block's end onward, and the tape says the same thing in the only
 * honest way a tape can: a v9 `at`-clear at that same tick (`timedClearsFor`
 * below). What must never happen is the clear landing in a tape's BOOT
 * state — that would be a staged grant and `chainFindings`' custody claim
 * would be false — which is why the entries carry `at` and why
 * `witnessedClearFindings` refuses any `at` no block earns there.
 */
const baseLevelSource = atlasLevelSource();
/**
 * ⛓⛓⛓ R7 slice 6e: THE PLANNER'S WORLD LOSES A BODY WHEN THE RUN'S DOES.
 *
 * A `phases` block's `removes` moves the world the PLANNER sees from the
 * block's end onward, exactly as its `earns` does — and for a body the edit
 * has to be the same one `levelRun` makes, which is a LEVEL RECORD filter
 * and not a census filter (see `levelRun`'s `recordFor`: one body must not
 * be able to be gone for the contact test and present for the route).
 *
 * ⚠ The wrapper is rebuilt per group rather than mutated, so a group planned
 * BEFORE a removal cannot see it — which is the whole content of "the model
 * is told at the block's own end tick".
 */
const idOfEntity = (e) => `${e.type}@${e.x},${e.y}`;
/**
 * ⛓⛓⛓ R7 slice 6f: …AND A SHOVED BLOCK MOVES IN IT.
 *
 * ⛔⛔ THE PLANNER FORGETS PER-VISIT RUNTIME STATE ACROSS A GROUP BOUNDARY,
 * and until L8 that never cost anything. `synthesizeLegs` boots a fresh
 * `createLevelRun` from the LEVEL RECORD, so a block a previous group pushed
 * is back at its `.oel` cell as far as the next group is concerned — and L8
 * has TWO shoves with a `phases` block between them. Measured: the walk back
 * to the button was planned with `pushableblock@112,48` still at (7,3), so
 * A* thought (5,3) — where the block really stands — was FREE, and the drive
 * SHOVED THE BLOCK NORTH out of its own path. The second hold then cleared
 * nothing and the exit leg walked into the live `sandtrap@96,128` and died
 * at t=1025.
 *
 * ⇒ every group is planned against the record its predecessors' shoves have
 * EDITED. Nothing here reaches the tape: a segment is ONE run in the game and
 * one in `tapeRunner`, and both move the block live. It is the planner that
 * forgets, so it is the planner that is told — and told from `plan.shoves`,
 * which is the model's own account of what it just did, never a declaration.
 *
 * ⚠ A `to` of `null` REMOVES (the block died on water, lava or a pit); a
 * `to` MOVES, rewriting the placement — so the edited block's own id changes,
 * which is correct because the id IS the placement (§19.3).
 */
function levelSourceEdited(edits) {
    if (edits.length === 0) return baseLevelSource;
    const byLevel = new Map();
    for (const e of edits) {
        if (!byLevel.has(e.level)) byLevel.set(e.level, []);
        byLevel.get(e.level).push(e);
    }
    return (n) => {
        const rec = baseLevelSource(n);
        const here = byLevel.get(n);
        if (!here) return rec;
        let entities = rec.entities;
        for (const edit of here) {
            const at = entities.findIndex((e) => idOfEntity(e) === edit.id);
            if (at < 0) {
                throw new Error(`level ${n} has no placement named by ${edit.id}`);
            }
            entities = entities.slice();
            if (edit.to) entities[at] = { ...entities[at], x: edit.to.tx * 16, y: edit.to.ty * 16 };
            else entities.splice(at, 1);
        }
        return { ...rec, entities };
    };
}
/** The record edits a plan's own shoves imply, for every group after it. */
const editsOfShoves = (shoves) => shoves.map((s) => ({
    level: s.level, id: s.id, to: s.destroys ? null : { tx: s.to.tx, ty: s.to.ty },
}));
const RELAX = {
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    equips: [],
    pins: [...chain.walk.pins],
    // ⚠ The FULL role set. A walk with collision ON consults every role,
    // and this one drives a mechanic in `combat`'s (the bob it must not
    // touch) as well as in `blocking`'s (the block it must move).
    roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
};
/** ⚠ The A* arrival tolerance the executor itself uses — 1 px. */
const { DEFAULT_TOLERANCE } = await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));
const { createLevelRun } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelRun.js'));

/**
 * ── ⛓⛓⛓ THE MODEL CANNOT AUTHOR A `phases` BLOCK. IT CAN FOLLOW ONE ────
 *
 * ⛔⛔ AND THE FIRST CUT OF THIS SCRIPT DID NOT, WHICH COST A WHOLE
 * RECORDING. It advanced the cursor to the block's DECLARED cell — L5's
 * `(48,48)`, the button — and planned the next group from there. The game
 * really leaves the player at **(56.05, 56.40)**, four tenths of a pixel
 * south of the cell's centre, because an A* arrival is `DEFAULT_TOLERANCE`
 * and not an equality. Four tenths of a pixel is under half a tick of
 * travel, and a crossing is a threshold: the plan predicted the L4 -> L5
 * transition at 62 and the run made it at 61, so the tape ran one tick PAST
 * its own arrival and the segment latched `v = (0, -1.15)` instead of a calm
 * one. The chain went red on the LAST claim of a full record run.
 *
 * ⇒ the cursor is advanced by RUNNING the block's own spans through
 * `createLevelRun` — the same model, the same roles, the same persistence —
 * and reading where the run really ends. The model gets the fight itself
 * wrong (it has no Arrow x Enemy and its bobs never move), and that does not
 * matter here: what it is being asked for is the PLAYER's trajectory under a
 * fixed input list, which it reproduces byte-for-byte (measured: the driven
 * segment and `tapeRunner` agreed on all 816 ticks up to the lock's face).
 *
 * ⚠ `endsAt` is now a CHECK rather than an input, and it is a better one for
 * being both: the block declares the cell it means, the model says where the
 * spans really land, and the driven arm says where the GAME lands. Three
 * statements, one number.
 */
function followPhases(block, boot, persistence, source) {
    const run = createLevelRun({
        levelSource: source,
        boot: { ...boot },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: persistence.map((c) => ({ ...c })),
        equips: [],
        pins: [...chain.walk.pins],
        roles: [...RELAX.roles],
    });
    // The held set per tick, from half-open spans — `tapeFormat`'s own rule,
    // so a span live at the last tick is live here too.
    for (let t = 0; t < block.ticks; t += 1) {
        const held = new Set(block.spans.filter((s) => s.from <= t && t < s.to)
            .map((s) => s.key));
        run.advance(held);
    }
    return { level: run.level, x: run.state.x, y: run.state.y };
}

const WALK_INPUTS = [];
const gotCuts = [];
/** `{block, from, to}` per `phases` unit — the windows the GAME is asked about. */
const PHASE_BLOCKS = [];
let cursorBoot = { ...TRUE_INITIAL_BOOT };
let cursorTick = 0;
const cleared = [];
/** ⛓ R7 slice 6e: the bodies removed SO FAR, the `cleared` list's twin. */
const removed = [];
/** ⛓ R7 slice 6f: the record edits the shoves so far have made — see above. */
const shoved = [];
const worldEdits = () => [...removed, ...shoved];
console.log('');
for (const group of walkGroups(chain)) {
    if (group.kind === 'legs') {
        const plan = synthesizeLegs(group.legs, {
            levelSource: levelSourceEdited(worldEdits()),
            boot: { ...cursorBoot },
            name: chain.headline,
            relax: { ...RELAX, persistence: cleared.map((c) => ({ ...c })) },
        });
        console.log(`   legs ${group.legs.map((l) => `L${l.level}`).join('->')}: `
            + `${plan.tape.tick_count} ticks from t=${cursorTick}, `
            + `${plan.tape.inputs.length} spans, transitions `
            + `[${plan.transitions.map((t) => t.t + cursorTick).join(' ')}]`);
        for (const s of plan.shoves) {
            // ⚠ `to` is NULL for a shove that DESTROYS its block (water, lava
            // or a pit): the destination cell is where it died, not where it
            // rests. Printing `s.to.tx` there is a crash in the log line of
            // the very run that proves the sink works.
            console.log(`      shove ${s.id} ${s.dir}: contact t+${s.contactTick}, lean `
                + `${s.leanTicks}, (${s.from.tx},${s.from.ty}) -> `
                + `${s.to ? `(${s.to.tx},${s.to.ty})` : 'DESTROYED'}`);
        }
        for (const h of plan.holds) {
            console.log(`      hold ${h.presser.tag}@${h.presser.x},${h.presser.y} `
                + `t=${h.presser.t}: ${h.ticks} ticks, traps [${h.traps.join(' ')}], `
                + `${h.volleys} volleys`);
        }
        WALK_INPUTS.push(...plan.tape.inputs.map(
            (s) => ({ key: s.key, from: s.from + cursorTick, to: s.to + cursorTick })));
        gotCuts.push(...plan.transitions.map((t) => t.t + cursorTick));
        cursorTick += plan.tape.tick_count;
        // ⛔ The cursor's next boot is where the RUN ENDED, in boot form (the
        // `Game` ctor adds a half-tile to both axes). ⚠ `plan.final`, NOT
        // `plan.arrivals[last]`: the latter is the last TARGET the walk was
        // aimed at, which for a group ending in a crossing is a stance two
        // rooms back — the first cut of this read it and reported the L4 hold
        // stance as the L5 arrival.
        cursorBoot = {
            level: plan.final.level, x: plan.final.x - 8, y: plan.final.y - 8,
        };
        // ⛓ …and the world the NEXT group plans against carries this
        // group's shoves. See `levelSourceEdited`.
        shoved.push(...editsOfShoves(plan.shoves));
    } else {
        const p = group.block;
        check(`⛔ the phases block "${p.id}" sits where it says it sits in the walk`,
            p.startsAtTick === cursorTick,
            `the route reaches it at t=${cursorTick}, it declares ${p.startsAtTick} — and `
            + 'the witnessed-clear law turns that number back into the tick a tape\'s '
            + '`at` must carry, so a stale one un-witnesses a real clear');
        check(`⛔ the phases block "${p.id}" starts where the route left the player`,
            cursorBoot.level === p.startsAt.level && cursorBoot.x === p.startsAt.x
                && cursorBoot.y === p.startsAt.y,
            `route left the player at ${JSON.stringify(cursorBoot)}, the block was `
            + `measured from ${JSON.stringify(p.startsAt)} — a choreography spliced onto `
            + 'a different stance is a fight nobody drove');
        console.log(`   phases ${p.id}: ${p.steps.map((s) => `${s.label} ${s.ticks}`)
            .join(' + ')} = ${p.ticks} ticks from t=${cursorTick}, ${p.spans.length} spans`);
        console.log(`      earns [${(p.earns ?? []).map((e) => `${e.level},${e.tag}`)
            .join(' ') || 'nothing'}]; removes [${(p.removes ?? []).map((r) => r.id)
            .join(' ') || 'nothing'}]; the game is asked for `
            + `[${p.outcome.cleared.join(' ')}] at t=${cursorTick + p.ticks}`);
        WALK_INPUTS.push(...p.spans.map(
            (s) => ({ key: s.key, from: s.from + cursorTick, to: s.to + cursorTick })));
        PHASE_BLOCKS.push({ block: p, from: cursorTick, to: cursorTick + p.ticks });
        cursorTick += p.ticks;
        // ⚠ THE FOLLOW USES THE WORLD THE BLOCK STARTED IN, not the one it
        // ends in: its own removals land at its END tick, so a follow that
        // pre-applied them would walk a room the block never walked.
        const landed = followPhases(p, cursorBoot, cleared, levelSourceEdited(worldEdits()));
        check(`⛔ the phases block "${p.id}" lands where it says it lands, within `
            + `${DEFAULT_TOLERANCE} px (the MODEL following its spans)`,
        landed.level === p.endsAt.level
            && Math.abs(landed.x - (p.endsAt.x + 8)) <= DEFAULT_TOLERANCE
            && Math.abs(landed.y - (p.endsAt.y + 8)) <= DEFAULT_TOLERANCE,
        `the model's follow ends at (${landed.x}, ${landed.y}) in level ${landed.level}, `
            + `the block declares (${p.endsAt.x + 8},${p.endsAt.y + 8}) in level `
            + `${p.endsAt.level}`);
        // ⚠ THE CURSOR TAKES THE FOLLOW, NOT THE DECLARATION. See
        // `followPhases`: the declaration is a cell and the run is 0.4 px
        // from its centre, which is under half a tick of travel and enough
        // to move a crossing by one tick.
        cursorBoot = { level: landed.level, x: landed.x - 8, y: landed.y - 8 };
        for (const e of p.earns ?? []) cleared.push({ ...e });
        for (const r of p.removes ?? []) removed.push({ ...r });
    }
}
console.log(`\n   TOTAL ${cursorTick} ticks, ${WALK_INPUTS.length} spans, `
    + `transitions [${gotCuts.join(' ')}]`);
/**
 * ⛔ EVERY DECLARED CUT IS A TRANSITION, IN ORDER — and the transitions that
 * are NOT cuts are named rather than ignored.
 *
 * The last cut is a transition and not the end of the tape, because
 * `synthesizeLegs` refuses an exit on its terminal leg: a legs group always
 * ends one arrival past its last exit. What changed at slice 6d is that a
 * SEGMENT may now cross more than one boundary — segment 5 steps out to L4
 * and back — so equality between the two lists was a claim that held only
 * while every segment happened to be one room long. The subsequence check
 * keeps the real property (a cut is a place the game really arrived, and the
 * cuts come in the declared order) and the extras are printed, so a route
 * that grew a room says so instead of passing quietly.
 */
{
    const want = [...chain.cuts, chain.endsAt];
    let i = 0;
    const extra = [];
    for (const t of gotCuts) {
        if (t === want[i]) { i += 1; continue; }
        extra.push(t);
    }
    check("⛔ the chain's DECLARED cuts are transitions the route really makes, in order",
        i === want.length,
        `driver [${gotCuts.join(' ')}] vs declared [${want.join(' ')}]`
        + (extra.length ? `; ${extra.length} non-cut transition(s) INSIDE segments `
            + `[${extra.join(' ')}]` : '')
        + ' — a chain whose cuts are taken from whatever the planner produced cannot '
        + 'notice a route that moved');
}
check('⛔ the route ends exactly where the chain says it ends',
    cursorTick === chain.endsAt,
    `tick_count ${cursorTick}, endsAt ${chain.endsAt}`);
if (failures > 0) {
    console.log('\nrefusing to author from a route that is not the declared one');
    process.exit(1);
}

/**
 * ⛔⛔ THE LATCH COMES OFF REAL-GPU WINDOWS CHROME, AND THAT IS A PRICE
 * RATHER THAN A PREFERENCE.
 *
 * `plan-seedling-r7-ends-meet.mjs` drives its two segments through WSL's own
 * Chromium, because the toy chain is 109 ticks and SwiftShader can afford
 * them. This chain is 822, and the first cut of this script measured what
 * that costs: **segment 1 alone (183 ticks) had not finished driving after
 * eleven minutes**, which projects past twenty for the three drives the
 * authoring needs. The same tape on the Windows channel replays at ~28 fps.
 *
 * So the authoring uses the SAME dumb driver the differential's `--win`
 * channel and every R7 probe use — `seedling-bot-replay-win.py`, which
 * already drains `botSeam()` and hands the whole envelope back. The driver
 * stays dumb; every decision stays here.
 *
 * ⚠ The latch is a GAME READING either way, so the channel cannot change
 * what is authored — only how long it takes to read it. If it ever did, the
 * `--check` re-run on the other channel would say so by name.
 */
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

function latchOf(label, tapeObj, { mobiles = false } = {}) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    writeFileSync(join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py'),
        readFileSync(WIN_DRIVER));
    const outWsl = join(WIN_SCRATCH_WSL, `stream-${label}.json`);
    writeFileSync(join(WIN_SCRATCH_WSL, `tape-${label}.json`),
        JSON.stringify(gameVisibleTape(parseTape(tapeObj))));
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const t0 = Date.now();
    let out;
    try {
        out = execFileSync(WIN_PY, [
            '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tape', `${WIN_SCRATCH_DOS}\\tape-${label}.json`,
            '--out', `${WIN_SCRATCH_DOS}\\stream-${label}.json`,
            ...(mobiles ? ['--mobiles'] : []),
            '--deadline-sec', String(Math.ceil(tapeObj.tick_count * 1.5) + 120),
        ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${e.message}${said ? `\n${said}` : ''}`);
    }
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) throw new Error(`windows driver wrote no stream for ${label}`);
    const got = JSON.parse(readFileSync(outWsl, 'utf8'));
    console.log(`    drove ${label}: ${got.stream.ticks.length} observations, `
        + `${got.status.dead_frames} dead, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (!got.seam) throw new Error(`${label}: the driver returned no seam block`);
    return {
        seam: got.seam, ticks: got.stream.ticks, status: got.status, mobiles: got.mobiles,
    };
}

const clearedIn = (st) => (st.persistence_cleared || [])
    .map((r) => `${r.level ?? r.l},${r.tag ?? r.t}`);

/**
 * ⛔⛔ THE SILENT-DEATH DETECTOR, carried over from
 * `probe-seedling-r7-l5-arrows.mjs` because the same fight is being driven.
 *
 * A death is a world reconstruction at `Main.playerPositionX/Y`, so the tell
 * is a tick that JUMPS to the boot tile WITHOUT a level change — and
 * `status.hits` cannot see it, because the counter reads the NEW Player.
 * A phases block whose player died would report a lock that never opened as
 * "the mechanism did not fire" (trap 142).
 */
function respawnJumps(ticks, boot) {
    const bx = boot.x + 8;
    const by = boot.y + 8;
    const jumps = [];
    for (let i = 1; i < ticks.length; i += 1) {
        const a = ticks[i - 1];
        const b = ticks[i];
        if (b.level !== a.level) continue;
        if (b.x === bx && b.y === by && (Math.abs(a.x - bx) > 8 || Math.abs(a.y - by) > 8)) {
            jumps.push(b.t);
        }
    }
    return jumps;
}

/**
 * ⛓⛓⛓ THE WITNESSED MID-RUN CLEARS A TAPE MUST CARRY (v9), derived from the
 * blocks rather than typed: one entry per `earns`, at the block's own END
 * tick, expressed in the tape's own tick frame.
 *
 * ⚠ `from`/`to` is the tape's window in walk ticks, so a clear a tape does
 * not contain is not written to it — the headline gets all of them at
 * absolute ticks, and each segment gets the ones its own window covers.
 */
function timedClearsFor(from, to) {
    const out = [];
    for (const { block, to: end } of PHASE_BLOCKS) {
        for (const e of block.earns ?? []) {
            if (end < from || end > to) continue;
            out.push({
                level: e.level,
                tag: e.tag,
                at: end - from,
                note: `${block.id}: the GAME's own clear, witnessed at this tick by a `
                    + `truncated arm (${block.provenance.probe})`,
            });
        }
    }
    return out;
}

/**
 * ⛓ R7 slice 6e: the v10 removals a tape must carry, derived from the blocks
 * exactly as `timedClearsFor` derives the clears — one entry per `removes`,
 * at the block's own END tick, in the tape's own tick frame.
 */
function timedDespawnsFor(from, to) {
    const out = [];
    for (const { block, to: end } of PHASE_BLOCKS) {
        for (const r of block.removes ?? []) {
            if (end < from || end > to) continue;
            out.push({
                level: r.level,
                id: r.id,
                at: end - from,
                note: `${block.id}: the GAME removed this body itself, witnessed at this `
                    + `tick by a truncated arm (${block.provenance.probe})`,
            });
        }
    }
    return out;
}

{
    const spans = chainSpans(chain);
    const base = {
        game: 'seedling',
        tape_version: TAPE_VERSION,   // the parse ceiling; `tapeJson` stamps the real one
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...chain.walk.pins],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 0, split: false, cosmetic: 0, fp: chain.walk.fpSeed },
        seam: null,
    };

    // ── the headline: the whole walk, one run ──────────────────────────
    emit(chain.headline, tapeJson({
        ...base,
        name: chain.headline,
        boot: { ...TRUE_INITIAL_BOOT },
        persistence: timedClearsFor(0, chain.endsAt),
        despawn: timedDespawnsFor(0, chain.endsAt),
        tick_count: chain.endsAt,
        inputs: chainInputsFor(WALK_INPUTS, 0, chain.endsAt),
    }, `⛓ THE HEADLINE of chain "${chain.id}" — the game's own opening in ONE run, so `
        + `the ${chain.segments.length} segments have something to be tick-for-tick `
        + 'IDENTICAL to. From `new Game(0, 80, 128)` with an empty save, no grants, no '
        + 'persistence clears and collision ON, through L2, L3, L4, L5 and L6 to the '
        + 'L7 arrival. L4 is the room slice 6b could not plan: its column 2 is walled at '
        + 'every row but the cell `pushableblock@32,64` stands in, so the walk holds '
        + '`button@16,64` until the two arrowtraps kill `bob@64,64` (measured: hits '
        + '0->1->2->3, gone by t~158 of that segment) and then LEANS the block from '
        + '(2,4) to (4,4). Then L5: the arrow-bait fight opens `lock@48,112 {5,0}` with '
        + 'NO WEAPON and the walk crosses the cell the lock was standing on. Then L6: '
        + 'the room has no crossing at all while its two bobs stand in the two detour '
        + 'cells, and the ROOM removes one — a stance in row 1 column 3 sends '
        + '`bob@112,48` across the water to drown while `sandtrap@64,16` walls the '
        + 'other off — and the walk weaves row 2 / row 3 / row 2 to the stairs. '
        + '`pins: ["dead_frames"]` makes `save.time` '
        + 'update-determined; `rng.fp` is declared because FlashPunk seeds its LCG once '
        + 'per PAGE. Authored by scripts/procgen/plan-seedling-r7-act2.mjs.'));

    // ── segment 1: the true initial state, no inheritance ──────────────
    const seg1Name = chain.segments[0];
    const seg1Obj = {
        ...base,
        name: seg1Name,
        boot: { ...TRUE_INITIAL_BOOT },
        persistence: timedClearsFor(spans[0].from, spans[0].to),
        despawn: timedDespawnsFor(spans[0].from, spans[0].to),
        tick_count: spans[0].to,
        inputs: chainInputsFor(WALK_INPUTS, spans[0].from, spans[0].to),
    };
    emit(seg1Name, tapeJson(seg1Obj,
        `⛓ SEGMENT 1 of chain "${chain.id}" — the CUSTODY BASE CASE, and the first `
        + 'segment of the honest playthrough. Boots the game\'s own initial state '
        + '(`Main.as:50-51`: `new Game(0, 80, 128)`, empty save) and inherits NOTHING: '
        + 'no grants, no persistence clears, no save presentation, no seam block. Runs '
        + `L0's opening to stairsdown@256,272 and ends at t=${spans[0].to}, the L2 `
        + 'ARRIVAL. Its latch is what authors segment 2.'));

    // ── every later segment: authored FROM the predecessor's latch ─────
    let prev = seg1Obj;
    const segObjs = [seg1Obj];
    for (let i = 1; i < chain.segments.length; i += 1) {
        const driven = latchOf(chain.segments[i - 1], prev);
        const calm = seamLatchFindings(driven.seam, { requireCalm: true });
        const notCalm = calm.filter((r) => !r.ok);
        check(`${chain.segments[i - 1]} ends at a CALM ARRIVAL`, notCalm.length === 0,
            notCalm.length === 0
                ? `${calm.length - 1} signature rows latched at tick `
                    + `${driven.seam.seam['latch.tick']}`
                : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
        if (notCalm.length) {
            throw new Error('refusing to author a segment from a latch that is not a '
                + 'calm arrival — the boot could not reproduce it');
        }
        const blocks = segmentBootFromLatch(driven.seam);
        const name = chain.segments[i];
        const obj = {
            ...base,
            ...blocks,
            name,
            /**
             * ⛔ THE LATCH'S BOOT CLEARS FIRST, THE WITNESSED ONES AFTER — a
             * plain overwrite here would DROP whatever the predecessor had
             * already earned, which is the custody chain's whole content.
             */
            persistence: [
                ...(blocks.persistence ?? []),
                ...timedClearsFor(spans[i].from, spans[i].to),
            ],
            despawn: timedDespawnsFor(spans[i].from, spans[i].to),
            tick_count: spans[i].to - spans[i].from,
            inputs: chainInputsFor(WALK_INPUTS, spans[i].from, spans[i].to),
        };
        emit(name, tapeJson(obj,
            `⛓ SEGMENT ${i + 1} of chain "${chain.id}" — EVERY FIELD OF ITS BOOT STATE `
            + `IS ${chain.segments[i - 1]}'s LATCH, read out of the game and handed to `
            + '`segmentBootFromLatch`. Nothing here is typed: the save arrays, the '
            + 'persistence clear set, the three RNG streams, the day/night phase and '
            + 'the music no-repeat pair are all numbers only the game can produce. '
            + 'That is what makes the seam a MEASURED equality rather than a claim — '
            + '`boot(N+1) == latch(N)` over the whole SEAM_SIGNATURE, checked by '
            + '`playthroughAcceptance` on every sweep. Authored by '
            + 'scripts/procgen/plan-seedling-r7-act2.mjs.'));
        prev = obj;
        segObjs.push(obj);
    }

    /**
     * ⛔⛔ AND THE LAST SEGMENT IS DRIVEN TOO, for its CALM ARRIVAL alone.
     *
     * Nothing needs its latch — there is no successor to author — so the
     * first cut of this loop stopped at N-1 and the last segment's arrival
     * went unchecked until the sweep. Slice 6d paid for that: a chain whose
     * final segment ran ONE TICK past its arrival recorded six tapes, and the
     * only thing that said so was `chainFindings` at the end of a full
     * `--record` run. A calm arrival is cheap to ask for here.
     */
    {
        const last = chain.segments[chain.segments.length - 1];
        const driven = latchOf(last, prev);
        const calm = seamLatchFindings(driven.seam, { requireCalm: true });
        const notCalm = calm.filter((r) => !r.ok);
        check(`${last} ends at a CALM ARRIVAL`, notCalm.length === 0,
            notCalm.length === 0
                ? `${calm.length - 1} signature rows latched at tick `
                    + `${driven.seam.seam['latch.tick']}`
                : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
    }

    /**
     * ── ⛓⛓⛓ THE PHASES BLOCKS' OUTCOME, ASKED OF THE GAME AT BLOCK END ──
     *
     * One extra drive per `phases` unit: the containing segment's own tape,
     * TRUNCATED at the block's last tick, with `--mobiles` on. What it buys
     * over reading the same fields at the end of the segment is a whole leg:
     * a lock that opened during the CROSSING rather than during the FIGHT
     * would satisfy an end-of-segment check and would mean the choreography
     * did nothing.
     *
     * ⚠ IT IS THE SAME TAPE, not a rebuild. The boot block, the RNG streams,
     * the save arrays and the input spans are the segment's; only
     * `tick_count` moves. A truncation that re-derived its inputs could
     * differ from the segment in a way this would never see.
     */
    for (const { block, from, to } of PHASE_BLOCKS) {
        const idx = spans.findIndex((s) => from >= s.from && to <= s.to);
        if (idx < 0) {
            throw new Error(`phases "${block.id}" spans ticks ${from}..${to}, which no `
                + 'single segment contains — a block split across a seam has no one '
                + 'window to ask the game about');
        }
        const host = segObjs[idx];
        const label = `${chain.segments[idx]}-${block.id}`;
        const cut = to - spans[idx].from;
        /**
         * ⛔ A SPAN THAT STRADDLES THE CUT IS A REFUSAL, NOT A CLIP. Spans
         * are half-open, so one that STARTS at the cut is entirely outside
         * the window and drops with no consequence — but one live ACROSS it
         * would be released by the truncation, and the arm would then be
         * driving a different last tick than the segment does.
         */
        for (const s of host.inputs) {
            if (s.from < cut && s.to > cut) {
                throw new Error(`phases "${block.id}": the ${s.key} span [${s.from},`
                    + `${s.to}) is live across the block's last tick (${cut}); the `
                    + 'truncated arm would release a key the segment holds');
            }
        }
        /**
         * ⛔⛔ AND THE TRUNCATION HAS TO CLIP THE TIMED FIELDS TOO — the gap
         * a SECOND `phases` block in one segment found.
         *
         * A v9 `at`-clear and a v10 `despawn` are stamped with the tick they
         * land on, and `parseTape` refuses one outside `[0, tick_count]` (it
         * is right to: "a clear that lands after the last tick never
         * happens"). L8's segment carries TWO blocks, so the arm truncated
         * at the FIRST block's end was handed the SECOND block's clear at
         * t=932 in a 380-tick tape and the whole authoring died there. Every
         * other segment in the arc has carried at most one.
         *
         * ⚠ `at === cut` is KEPT: that is the block's own end tick, which is
         * exactly the thing this arm exists to ask the game about. Boot
         * clears (no `at`) are kept unconditionally — they are the state the
         * tape starts in.
         */
        const inWindow = (e) => e.at === undefined || e.at <= cut;
        const arm = latchOf(label, {
            ...host,
            name: label,
            tick_count: cut,
            persistence: (host.persistence ?? []).filter(inWindow),
            despawn: (host.despawn ?? []).filter(inWindow),
            inputs: chainInputsFor(host.inputs, 0, cut),
        }, { mobiles: true });
        const end = arm.ticks[arm.ticks.length - 1];
        /**
         * ⛔ THE OUTCOME'S BODY CLASS IS DECLARED, and R7 slice 6f is why.
         * `outcome.enemies` is "how many are LEFT" and the game's readout is
         * a list of every mobile — so the COUNT is meaningless without the
         * class it counts. L5 and L6 count `Bob`s in rooms that also hold
         * sandtraps; L8's blocks count `SandTrap`s in a room with no Bob at
         * all. Defaulting to `Bob` keeps the two committed blocks' meaning
         * exactly, and a block that means something else must say so.
         */
        const cls = block.outcome.enemyClass ?? 'Bob';
        const bobs = (arm.mobiles?.[arm.mobiles.length - 1]?.mobiles ?? [])
            .filter((m) => new RegExp(cls).test(m.cls || m.type || ''));

        // ⛔ FIRST, AND EVERYTHING ELSE IS VACUOUS WITHOUT IT.
        const jumps = respawnJumps(arm.ticks, host.boot);
        check(`⛔ phases "${block.id}": the player never died inside the block`,
            jumps.length === 0,
            jumps.length === 0
                ? `${arm.ticks.length} observations, no jump to the boot tile`
                : `respawn-shaped jump(s) at t=[${jumps.join(' ')}] — every other finding `
                    + 'about this block is VACUOUS until this is green');

        const got = clearedIn(arm.status);
        const want = [...block.outcome.cleared];
        check(`⛓⛓⛓ phases "${block.id}": the GAME cleared [${want.join(' ')}] by tick `
            + `${cut} of ${chain.segments[idx]}`,
        want.every((w) => got.includes(w)),
        `persistence_cleared [${got.join(' ') || 'nothing'}] — this is the block's whole `
            + 'claim, and it is the game\'s own readout rather than a fight the model '
            + 'predicted');
        check(`⛓ phases "${block.id}": ${block.outcome.enemies} ${cls} body/bodies left`,
            bobs.length === block.outcome.enemies,
            `${bobs.length} ${cls}(s) in the last mobile sample`
            + (bobs.length ? `: ${bobs.map((b) => `(${Math.round(b.x)},${Math.round(b.y)})`)
                .join(' ')}` : ''));
        check(`⛔ phases "${block.id}": it ends where it says it ends, within `
            + `${DEFAULT_TOLERANCE} px`,
        Boolean(end) && end.level === block.endsAt.level
            && Math.abs(end.x - (block.endsAt.x + 8)) <= DEFAULT_TOLERANCE
            && Math.abs(end.y - (block.endsAt.y + 8)) <= DEFAULT_TOLERANCE,
        `the game left the player at ${JSON.stringify(end)}, the block declares `
            + `(${block.endsAt.x + 8},${block.endsAt.y + 8}) in level ${block.endsAt.level}`
            + ' — and the NEXT leg is planned from that declaration, so a drift here is '
            + 'a route planned from a stance the run never had');
    }
}

console.log(`\n${failures === 0
    ? (CHECK ? 'CHECK CLEAN — the committed chain is what the game produces today'
        : 'WROTE the chain; record it with `--record --only=<names>`')
    : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
