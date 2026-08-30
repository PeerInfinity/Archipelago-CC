#!/usr/bin/env node
/**
 * probe-seedling-help-frame — WHERE does `r8-solve-10` spend the dead frame
 * the model does not know about?
 *
 * R9 slice 12e‴, item (iii) (kickoff §35.6 and §36). ⚖ Ruling 51's second
 * open item.
 *
 * ── The question, and why a totals measurement cannot answer it ───────
 *
 * `r8-solve-10`'s three cached latches say the GAME spent **192** dead
 * frames under the committed 90-tick walk and **191** under the re-recorded
 * 78-tick one; the MODEL says 191 for both, and its ledger is the same four
 * spans either way — `load 20 + ceremony 150 (pickup phase A, sword) +
 * help 1 + load 20`. Every other chain boundary keeps
 * `gameDead = modelDead + 1` (that +1 is `BOOT_PRESWAP_FRAMES`, and it is
 * what makes the successor-clock formula land on the declared value);
 * `r8-solve-10` is the only row where it is 0, so the cancellation fails and
 * `solve-seedling-r9-campaign --check` reds one clock row.
 *
 * A total says the walks differ by one. It cannot say WHICH span, and every
 * fix that does not name the span is a guess — §35.6 already recorded one
 * refuted hypothesis (the held key at the Help tick) and slice 12e‴ refuted
 * a second (the tape's own X press; `Bot.as:2877-2882`'s dead-frame gate
 * RETURNS before the tape advances, so a tape dispatches nothing at all on
 * a dead frame and `autoAdvance` presses on the first one regardless).
 *
 * ── What this measures ────────────────────────────────────────────────
 *
 * The driver's new `--dead-curve`: one `{tick, dead, level}` row per CHANGE
 * of `(tick, dead_frames)`, polled as fast as the bridge allows. That is the
 * game's own cumulative dead-frame curve as a function of its tick counter —
 * so a span shows up as a flat tick with `dead` climbing, and the extra
 * frame lands in exactly one of them. Diffing the two walks' curves names
 * the span.
 *
 * ⚠ THE TIGHT POLL DOES NOT MOVE WHAT IS COUNTED. `probe-seedling-
 * deadframes` measured the fade count identical across a ~50x frame-rate
 * difference, so the recompiled runtime is frame-clocked; a slower wall
 * clock changes the elapsed seconds and nothing else.
 *
 * ⛓ BOTH TAPES ARE READ, NEITHER IS WRITTEN. The 90-tick walk is the
 * committed fixture; the 78-tick one is read out of the parked series
 * (`r9/re-record-attempt-3`, never pushed) with `git show`. No tape moves.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-help-frame.mjs
 *   node scripts/procgen/probe-seedling-help-frame.mjs --only=old
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gameVisibleTape, heldKeysAt, parseTape }
    from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { takeBoxLockOrExit } from './boxLock.js';

/**
 * ⛓ R9 P3b, ⚖ 54 (7); ⚖ 62 at 12j — **THE BOX LOCK.** This instrument drives
 * the machine (windows), so it takes the box before it starts and refuses BY
 * NAME if another instrument holds it — replacing a hand-relayed "BOX BUSY".
 * A run UNDER a holder (`gates.mjs`, `standing-values`,
 * `rerecord-seedling-campaign`) recognises the holder's token and passes
 * through. `--wait-for-box=<sec>` queues instead of refusing.
 */

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'probe-seedling-help-frame.mjs', kind: 'windows' });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4c';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WIN_WSL = '/mnt/c/playwright';
const WIN_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

const arg = (n, d) => {
    const f = process.argv.find((a) => a.startsWith(`--${n}=`));
    return f === undefined ? d : f.slice(n.length + 3);
};
const ONLY = arg('only', '');
/**
 * ⛓⛓⛓ R9 SLICE RR, ⚖ 17 — **`--write-oracle`: THE ORACLE ENTRY IS EMITTED,
 * NOT TRANSCRIBED.** `r8-solve-10-help-frame-oracle.json` was hand-written
 * from two runs of this probe, and its `walks` are keyed on the tape's
 * `tick_count` because the three consumers refuse BY NAME when the committed
 * tape is a length the game has never been driven at. That refusal fired for
 * real at ⚖ 64's re-record — the walk went 78 → 83 and nine rows went red
 * saying *"the game oracle [90,78] has never been driven at that length"*,
 * which is the correct behaviour and an owed GPU row. Transcribing the answer
 * by hand a third time would be the same trap a third time, so the probe
 * writes it: drive the COMMITTED walk, derive the entry, refuse if the span
 * shape is not the four this room has.
 */
const WRITE_ORACLE = process.argv.includes('--write-oracle');
const ORACLE_PATH = join(REPO,
    'frontend/modules/seedlingDemo/fixtures/r8-solve-10-help-frame-oracle.json');

const TAPE_PATH = 'frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-10.json';
const BRANCH = 'r9/re-record-attempt-3';

/**
 * ⛔ `gameVisibleTape` IS applied, and the first run of this probe is why it
 * has to be. Driving the committed bytes raw got
 * `botLoadTape: tape_version must be 1..8, got 11` — the roster's tapes are
 * v11 and the GAME has never seen a v11 field. The projection is not "a
 * different tape": it is exactly the bytes every producer hands the browser,
 * so it is the only thing whose dead-frame ledger the question is about.
 */
const WALKS = [
    /**
     * ⛓ R9 slice RR: the label is DERIVED. It used to read "the COMMITTED
     * 90-tick walk — the game spent 192", and by ⚖ 64's re-record the
     * committed walk was 83 and the game spent 190 — a sentence printed by an
     * instrument that had gone false about its own subject.
     */
    { label: 'old',
        get why() {
            return 'the COMMITTED walk — '
                + `${JSON.parse(readFileSync(join(REPO, TAPE_PATH), 'utf8')).tick_count} ticks`;
        },
        bytes: () => JSON.stringify(gameVisibleTape(
            JSON.parse(readFileSync(join(REPO, TAPE_PATH), 'utf8')))) },
    { label: 'new', why: `the re-recorded 78-tick walk from ${BRANCH} — the game spent 191`,
        bytes: () => JSON.stringify(gameVisibleTape(JSON.parse(
            execFileSync('git', ['show', `${BRANCH}:${TAPE_PATH}`],
                { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })))) },
];

function drive(walk) {
    mkdirSync(WIN_WSL, { recursive: true });
    writeFileSync(join(WIN_WSL, 'seedling-bot-replay-win.py'), readFileSync(WIN_DRIVER));
    const tapeWsl = join(WIN_WSL, `help-frame-tape-${walk.label}.json`);
    const outWsl = join(WIN_WSL, `help-frame-${walk.label}.json`);
    writeFileSync(tapeWsl, walk.bytes());
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const t0 = Date.now();
    const out = execFileSync(WIN_PY, [
        '-3.12', `${WIN_DOS}\\seedling-bot-replay-win.py`,
        '--url', PAGE_URL,
        '--tape', `${WIN_DOS}\\help-frame-tape-${walk.label}.json`,
        '--out', `${WIN_DOS}\\help-frame-${walk.label}.json`,
        '--dead-curve',
        '--deadline-sec', '600',
    ], { cwd: WIN_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) throw new Error(`${walk.label}: the driver wrote no stream`);
    const got = JSON.parse(readFileSync(outWsl, 'utf8'));
    console.log(`    drove ${walk.label}: ${got.stream.ticks.length} observation(s), `
        + `${got.status.dead_frames} dead, ${got.dead_curve?.length ?? 0} curve row(s), `
        + `${((Date.now() - t0) / 1000).toFixed(0)}s`);
    return got;
}

/**
 * The SPANS, derived from the curve: a run of rows at the same `tick` with
 * `dead` climbing. The model's four spans are named by their own ledger, so
 * a span here is reported by its tick and its size and matched by hand.
 */
function spansOf(curve) {
    const out = [];
    let cur = null;
    for (const r of curve) {
        if (cur && r.tick === cur.tick) { cur.to = r.dead; cur.level = r.level; continue; }
        if (cur && cur.to > cur.from) out.push(cur);
        cur = { tick: r.tick, from: r.dead, to: r.dead, level: r.level };
    }
    if (cur && cur.to > cur.from) out.push(cur);
    return out.map((s) => ({ tick: s.tick, level: s.level, frames: s.to - s.from,
        deadAfter: s.to }));
}

const results = {};
for (const w of WALKS) {
    if (ONLY && w.label !== ONLY) continue;
    console.log(`\n── ${w.label}: ${w.why}`);
    results[w.label] = drive(w);
}

console.log('\n══ THE CURVES ══');
for (const [label, got] of Object.entries(results)) {
    const curve = got.dead_curve ?? [];
    const spans = spansOf(curve);
    console.log(`\n${label}: ticks ${got.status.tick}/${got.status.tick_count}, `
        + `dead_frames ${got.status.dead_frames}`);
    console.log(`  spans (tick, level, frames, cumulative):`);
    for (const s of spans) {
        console.log(`    t=${String(s.tick).padStart(4)} L${String(s.level).padStart(3)} `
            + `${String(s.frames).padStart(4)} frames  (dead -> ${s.deadAfter})`);
    }
    const summed = spans.reduce((a, s) => a + s.frames, 0);
    console.log(`  spans sum to ${summed} of ${got.status.dead_frames} `
        + `(the rest is before the first observation — the boot fade)`);
}

if (results.old && results.new) {
    const a = spansOf(results.old.dead_curve ?? []);
    const b = spansOf(results.new.dead_curve ?? []);
    console.log('\n══ THE DIFF ══');
    console.log(`  old total ${results.old.status.dead_frames} · `
        + `new total ${results.new.status.dead_frames} · `
        + `delta ${results.old.status.dead_frames - results.new.status.dead_frames}`);
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const p = a[i];
        const q = b[i];
        const same = p && q && p.frames === q.frames;
        console.log(`  span ${i}: old ${p ? `t=${p.tick} L${p.level} ${p.frames}f`
            : '(none)'}  |  new ${q ? `t=${q.tick} L${q.level} ${q.frames}f` : '(none)'}`
            + `${same ? '' : '   ⛔ DIFFERS'}`);
    }
}


/* ══════════════════════════════════════════════════════════════════════
 * ⚖ 17 — `--write-oracle`: THE ENTRY THIS PROBE'S OWN CONSUMERS READ
 * ══════════════════════════════════════════════════════════════════════ */
/**
 * ⛔ THE SPAN SHAPE IS THE REFUSAL. This room's dead-frame ledger is four
 * spans — a level-10 load, the sword's pickup ceremony, the Help, and a
 * level-11 load — and the HELP is the one that is neither a 20-frame load nor
 * the longest. A walk whose curve does not have exactly that shape is not a
 * walk this oracle can describe, and the probe says so rather than guessing
 * which span is which. ⛓ The Help's TICKS are the curve rows that climbed
 * inside that span, which is what the three consumers index by.
 *
 * ⛔⛔ AND `modelOwes` IS WRITTEN ONLY BESIDE A MEASURED GAME TOTAL. On its
 * own it would be a FIXED POINT — the model's number checked against the
 * model — so the entry carries the GAME's `dead_frames` from the same drive
 * and the DIFFERENCE between them, which is the quantity §35.6 and slice
 * 12e‴ spent two sessions on (every other boundary keeps game = model + 1;
 * `r8-solve-10` is the one where it is 0). A reader can see which side each
 * number came from, and the equality of two totals whose SPAN SHAPES differ
 * is the content rather than a coincidence.
 */
if (WRITE_ORACLE) {
    const got = results.old;
    if (!got) throw new Error('⛔ --write-oracle needs the COMMITTED walk — drop --only=new');
    const tape = parseTape(JSON.parse(readFileSync(join(REPO, TAPE_PATH), 'utf8')));
    const curve = got.dead_curve ?? [];
    const spans = spansOf(curve);
    const loads = spans.filter((x) => x.frames === 20);
    const longest = spans.reduce((a, b) => (b.frames > a.frames ? b : a), spans[0]);
    const rest = spans.filter((x) => x.frames !== 20 && x !== longest);
    if (spans.length !== 4 || loads.length !== 2 || rest.length !== 1) {
        throw new Error('⛔ REFUSED: this walk\'s curve is '
            + `${spans.map((x) => `t=${x.tick}/${x.frames}f`).join(' ')} — the oracle `
            + 'describes a FOUR-span room (two 20-frame loads, the ceremony, the Help) '
            + 'and this probe will not guess which span is the Help.');
    }
    const help = rest[0];
    /**
     * ⛔ `spansOf` RETURNS `{tick, level, frames, deadAfter}` — it MAPS away the
     * `from`/`to` it builds with, and my first cut read `help.from`, got
     * `undefined`, compared every climb against it and wrote an EMPTY
     * `helpDeadTicks` without complaining. The bound is rebuilt from what the
     * span DOES carry, and the guard below is the part that mattered: a
     * derivation that produced nothing where the span says N frames is
     * REFUSED, because an empty list is exactly what the three consumers
     * would read as "this walk dismisses its own Help" — a true-sounding
     * answer from a broken read.
     */
    const helpFrom = help.deadAfter - help.frames;
    const helpDeadTicks = [];
    for (let i = 1; i < curve.length; i += 1) {
        if (curve[i].dead > curve[i - 1].dead && curve[i].tick === help.tick
            && curve[i].dead > helpFrom && curve[i].dead <= help.deadAfter) {
            helpDeadTicks.push(curve[i].tick + (curve[i].dead - helpFrom - 1));
        }
    }
    if (helpDeadTicks.length !== help.frames) {
        throw new Error(`⛔ REFUSED: the Help span at t=${help.tick} is ${help.frames} `
            + `frame(s) and the curve yielded ${helpDeadTicks.length} tick(s) `
            + `[${helpDeadTicks}] — the derivation and the span disagree, and an empty or `
            + 'short list would read to the consumers as a Help this walk dismissed itself.');
    }
    const { runTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeRunner.js'));
    const { atlasLevelSource } = await import(
        join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));
    const model = runTape(tape, { levelSource: atlasLevelSource() });
    const oracle = JSON.parse(readFileSync(ORACLE_PATH, 'utf8'));
    const key = `t${tape.tick_count}`;
    oracle.walks[key] = {
        which: `the COMMITTED ${tape.tick_count}-tick walk, driven by `
            + 'probe-seedling-help-frame.mjs --only=old --write-oracle',
        tick_count: tape.tick_count,
        dead_frames: got.status.dead_frames,
        modelOwes: model.deadFramesOwed,
        gameMinusModel: got.status.dead_frames - model.deadFramesOwed,
        heldAtHelpTick: [...heldKeysAt(tape, helpDeadTicks[0])],
        helpDeadTicks,
        held: Object.fromEntries(helpDeadTicks.map((t) => [String(t), [...heldKeysAt(tape, t)]])),
        curve,
    };
    writeFileSync(ORACLE_PATH, `${JSON.stringify(oracle, null, 1)}\n`);
    console.log(`\n══ ORACLE ══\n  wrote walks.${key}: tick_count ${tape.tick_count}, `
        + `game ${got.status.dead_frames}, model ${model.deadFramesOwed}, `
        + `game-model ${got.status.dead_frames - model.deadFramesOwed}, `
        + `helpDeadTicks [${helpDeadTicks}], held ${JSON.stringify(
            [...heldKeysAt(tape, helpDeadTicks[0])])}\n  ${ORACLE_PATH}`);
}
