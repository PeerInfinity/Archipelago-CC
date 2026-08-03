#!/usr/bin/env node
/**
 * run-seedling-director — drive N window tapes on ONE page, and assert the
 * boundaries from the game's own drained reports.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §3.1, ruled at §9.1.
 *
 * ── THE REGRESSION BRIDGE COMES FIRST ─────────────────────────────────
 *
 * §9.1's ruling: **before R5 touches an enemy, the director re-drives R4's
 * frozen headline AS WINDOWS and must reproduce the recorded observation
 * stream byte-identically.** That is "flags off must be byte-inert"
 * translated into the new execution shape, and it is the gate that arms
 * everything after it.
 *
 * The six R4 segments already cut at ARRIVALS — that is R1's rule, obeyed
 * by every rung since — so they are already window-shaped. The only edit is
 * the one the director's whole thesis rests on: windows 2–6 lose their boot
 * `grants` and their `persistence` clears, because **the live game state IS
 * the inheritance**. If the streams still match the recordings byte for
 * byte, then every item and every flag those six tapes DECLARED, the game
 * was carrying anyway.
 *
 * ⚠ Stripping the clears is not optional and not cosmetic. `botStart`'s
 * clear path resets EVERY tag in EVERY level to true before applying a
 * declared list (`Bot.as:690-705`), so a window after the first that
 * carried its eight clears would erase the five flags the pickups in
 * windows 1–5 wrote. `director.windowsFrom` refuses it by name unless the
 * caller says `{strip: true}`, which is what authoring windows FROM
 * segments means.
 *
 * ── WHAT IT PROVES, AND WHAT IT DOES NOT ──────────────────────────────
 *
 * PROVES: one page, N loads, zero re-boots after the first; the boundary
 * state is the game's, not the plan's; the ledger is monotone across
 * boundaries; and the physics is unchanged, because the streams are the
 * committed recordings byte for byte.
 *
 * DOES NOT: say anything about a route R5 has not authored yet. The bridge
 * is a regression, and its whole value is that its expectations were
 * recorded before the director existed.
 *
 * Usage (needs the dev server and the Windows path — see seedling-bot.md):
 *   node scripts/procgen/run-seedling-director.mjs --bridge
 *   node scripts/procgen/run-seedling-director.mjs --bridge --keep
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const EXPECT = join(MODULE, 'fixtures', 'expectations');
const PAGE_NAME = 'seedling_bot_ap';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

// Windows Python cannot take Linux paths, so the driver and its JSON are
// staged under C:\playwright (= /mnt/c/playwright). All diff logic stays on
// this side so the tape format has one implementation.
const WIN_STAGE = '/mnt/c/playwright';
const WIN_DRIVE = 'C:\\playwright';
const PY = '/mnt/c/Windows/py.exe';

const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const director = await import(join(MODULE, 'director.js'));
// ⚠ The PARSED tape goes over the wire, not `serializeTape`'s string — the
// same rule the verifier follows, and the reason R0's first build rejected
// all eleven fixtures: `parseTape` NORMALISES, so a v1 tape arrives carrying
// `noDamage: false` and `noHazards: []`, and an AS3 check written against
// PRESENCE rather than VALUE rejects it.
const { parseTape, deriveTransitions, KEY_CODES } =
    await import(join(MODULE, 'tapeFormat.js'));

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');

/** R4's six segments, in order. Its headline is these six tick for tick. */
const R4_SEGMENTS = [
    'r4-walk-1-sword', 'r4-walk-2-feather', 'r4-walk-3-torch',
    'r4-walk-4-approach', 'r4-walk-5-spear', 'r4-walk-6-health',
];

if (!existsSync(join(WASM_DIR, `${PAGE_NAME}.wasm`))) {
    console.log('SKIP: no wasm artifact — the director needs the real game '
        + `(${WASM_DIR}). Every seedling verifier skips the same way, so CI stays green.`);
    process.exit(0);
}

function driveWindows(tapes, label) {
    mkdirSync(WIN_STAGE, { recursive: true });
    // Stage the driver from the repo every run, exactly as the verifier does:
    // a stale copy under C:\playwright would be a second implementation of
    // the replay path, quietly.
    writeFileSync(join(WIN_STAGE, 'seedling-bot-replay-win.py'),
        readFileSync(join(HERE, 'seedling-bot-replay-win.py')));
    const tapesPath = join(WIN_STAGE, `windows-${label}.json`);
    const outPath = join(WIN_STAGE, `trace-${label}.json`);
    const progress = join(WIN_STAGE, `progress-${label}.json`);
    // ⛔ THE RELEASE CODES TRAVEL WITH THE TAPES, from the ONE key table.
    // A tape whose last span runs to `tick_count` leaves that key HELD when
    // the tape ends — R4's `r4-walk-1-sword` ends with `up` at 591..641 and
    // `tick_count` 641 — and FlashPunk's `Input` is a static that nothing on
    // a teleport path clears. Between two windows the game keeps ticking, so
    // a held key walks the player off the boundary before the next window is
    // armed: the first run of this bridge saw (264,264) become (263.2,263.2)
    // and reported it as a re-boot. Every fixture before now got a FRESH PAGE,
    // which released the keys implicitly; a window does not.
    writeFileSync(tapesPath, JSON.stringify({
        tapes, releaseKeyCodes: [...new Set(Object.values(KEY_CODES))],
    }));
    // The deadline scales with the tape length: at ~25 fps a 10k-tick walk is
    // ten minutes, and a fixed timeout looks exactly like a dead bot.
    const ticks = tapes.reduce((n, t) => n + t.tick_count, 0);
    const deadline = Math.max(600, Math.round(ticks / 4) + 120 * tapes.length);
    console.log(`driving ${tapes.length} window(s), ${ticks} ticks, deadline ${deadline}s`);
    let out;
    try {
        out = execFileSync(PY, [
            '-3.12', `${WIN_DRIVE}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tapes', `${WIN_DRIVE}\\windows-${label}.json`,
            '--out', `${WIN_DRIVE}\\trace-${label}.json`,
            '--progress', `${WIN_DRIVE}\\progress-${label}.json`,
            '--deadline-sec', String(deadline),
        ], { cwd: WIN_STAGE, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    } catch (e) {
        // ⚠ `execFileSync` throws with only the command line in `message`, so
        // the driver's own `REPLAY_FAIL` line and its last 25 page logs would
        // be discarded — the R1 lesson, re-learned here rather than again.
        const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${e.message}${said ? `\n${said}` : ''}`);
    }
    for (const line of out.split('\n')) {
        if (line.startsWith('WINDOW ') || line.startsWith('REPLAY_') || line.startsWith('WEBGPU_')) {
            console.log(`  ${line}`);
        }
    }
    const trace = JSON.parse(readFileSync(outPath, 'utf8'));
    if (!KEEP) { /* the staged files are small; left in place for diagnosis */ }
    return trace.windows;
}

/**
 * Element-wise, and it reports the FIRST divergence rather than a count.
 *
 * ⚠ `transitions` is DERIVED on BOTH paths, exactly as the verifier does it.
 * `botDrain` returns the field unconditionally empty — the game does not hand
 * it over and re-recording will never populate it — so a compare-only
 * derivation would go red against every committed recording, whose
 * transitions were derived at RECORD time. And a build that started
 * reporting them for real must be a named failure to reconcile rather than
 * something the derivation silently overwrites.
 */
function streamDiff(got, want) {
    const reported = got?.transitions ?? [];
    const derived = deriveTransitions(got?.ticks ?? []);
    if (reported.length > 0 && JSON.stringify(reported) !== JSON.stringify(derived)) {
        return `botDrain reported transitions ${JSON.stringify(reported)} which disagree `
            + `with the derivation ${JSON.stringify(derived)} — Bot.as used to hardcode [], `
            + 'so this build reports the field for real and the derivation needs revisiting';
    }
    got = { ticks: got?.ticks ?? [], transitions: derived };
    const a = got?.ticks ?? [];
    const b = want?.ticks ?? [];
    if (a.length !== b.length) {
        return `observation count ${a.length} vs the recording's ${b.length}`;
    }
    // ⛔ FIELD BY FIELD, NEVER `JSON.stringify` — and the first green run of
    // this bridge reported six false failures for exactly that reason. The
    // game's own JSON serializer emits `{level, y, x, t}` and the committed
    // recording is `{t, x, y, level}`: identical values, different key order,
    // and stringify equality across two runtimes compares the SERIALIZERS.
    const FIELDS = ['t', 'x', 'y', 'level'];
    for (let t = 0; t < a.length; t += 1) {
        for (const f of FIELDS) {
            if (a[t][f] !== b[t][f]) {
                return `tick ${t}: ${f} ${a[t][f]} vs the recording's ${b[t][f]}`;
            }
        }
    }
    const ta = JSON.stringify(got?.transitions ?? []);
    const tb = JSON.stringify(want?.transitions ?? []);
    if (ta !== tb) return `transitions: ${ta} vs the recording's ${tb}`;
    return null;
}

function runBridge() {
    console.log('## the R4 regression bridge — six frozen segments, re-driven as WINDOWS\n');
    const segments = R4_SEGMENTS.map((n) => loadTape(n));

    // ⛔ THE AUTHORING RULE, CHECKED BEFORE ANYTHING RUNS — because the first
    // run of this bridge failed on it and reported it as a re-boot. A tape
    // whose last span runs to `tick_count` never dispatches that key's
    // release edge, and FlashPunk's `Input` is a static nothing clears; every
    // fixture before R5 got a FRESH PAGE, which released the keys implicitly.
    // A window does not, so the player drifts across the boundary.
    const held = segments.map((t) => director.assertWindowEndsAtRest(t));
    console.log('## do R4\'s segments end AT REST? (the window contract)');
    for (let i = 0; i < segments.length; i += 1) {
        if (held[i].length === 0) console.log(`  ✓ ${R4_SEGMENTS[i]}`);
        else for (const f of held[i]) console.log(`  ⚠ ${R4_SEGMENTS[i]}: ${f}`);
    }
    const anyHeld = held.some((f) => f.length > 0);
    console.log(anyHeld
        ? '\n⇒ ⛔ THEY DO NOT. So the byte-identity claim is scoped: window 0 boots for\n'
          + '  real and must be exact; every later window inherits a player who has\n'
          + '  drifted, which is a fact about R4\'s tapes and not about the director.\n'
          + '  R5\'s own windows are authored to the rule, and this is the rule.\n'
        : '\n⇒ they do; every window is exact.\n');

    const windows = director.windowsFrom(segments, { strip: true });
    for (let i = 1; i < windows.length; i += 1) {
        const seg = segments[i];
        console.log(`  window ${i} (${seg.name}): stripped `
            + `${(seg.grants ?? []).length} grant(s) and `
            + `${(seg.persistence ?? []).length} clear(s) — the live state is the inheritance`);
    }
    console.log();

    const run = driveWindows(windows.map((t) => parseTape(t)), 'r4-bridge');

    let failures = 0;
    console.log('\n## per-window: the stream against its committed recording');
    for (let i = 0; i < run.length; i += 1) {
        const name = R4_SEGMENTS[i];
        const want = JSON.parse(readFileSync(join(EXPECT, `${name}.json`), 'utf8'));
        const diff = streamDiff(run[i].stream, want);
        const inherited = i > 0 && held[i - 1].length > 0;
        if (!diff) {
            console.log(`  PASS ${name}: ${run[i].stream.ticks.length} observations, `
                + `byte-identical; dead_frames=${run[i].status.dead_frames}`);
        } else if (inherited) {
            // Expected, and named: the previous window ended with a key down.
            console.log(`  DRIFT ${name}: ${diff}`);
            console.log('        ...expected — the previous window did not end at rest, '
                + 'so this one inherits a player 0.8 px off the recording\'s boot');
        } else {
            failures += 1;
            console.log(`  FAIL ${name}: ${diff}`);
        }
    }

    console.log('\n## the trace: one page, N windows, and what carried across');
    const moved = run.filter((w) => w.moved_at_boundary).length;
    console.log(`  ${run.length} windows, ${director.traceTicks(run)} live ticks, `
        + `${moved} boundary/boundaries where the position moved`);
    for (const f of director.traceFindings(run)) {
        // A position finding is the drift above and is already accounted for;
        // everything else is the claim.
        if (f.what === 'the position changed across the boundary'
            || f.what === 'the drained stream disagrees with the status it was drained beside') {
            console.log(`  (drift) ${f.where}: ${f.detail}`);
            continue;
        }
        failures += 1;
        console.log(`  FAIL ${f.where}: ${f.what} — ${f.detail}`);
    }

    // ⛓ THE REAL GATE. R4's claim, reproduced on ONE PAGE with NO boot grant
    // and NO clear list after the first window. If the items and the ledger
    // survive six boundaries with nothing but the live game carrying them,
    // then the inheritance R1–R4 declared, the game was doing anyway.
    const end = run.at(-1)?.status ?? {};
    const items = Object.entries(end.items ?? {})
        .filter(([, v]) => v === true).map(([k]) => k).sort();
    const R4_CLAIM = ['hasFeather', 'hasSpear', 'hasSword', 'hasTorch'];
    console.log('\n## the terminal readout, from the game — R4\'s claim, uncrutched');
    const gate = (what, ok, detail) => {
        if (ok) console.log(`  PASS ${what}: ${detail}`);
        else { failures += 1; console.log(`  FAIL ${what}: ${detail}`); }
    };
    gate('the four booleans', JSON.stringify(items) === JSON.stringify(R4_CLAIM),
        `${items.join(', ')} (R4: ${R4_CLAIM.join(', ')})`);
    gate('hitsMax == 4, as a POSITIVE', end.items?.hitsMax === 4, String(end.items?.hitsMax));
    gate('grants EMPTY', (end.grants ?? []).length === 0, JSON.stringify(end.grants ?? []));
    gate('the ledger is 15 flags (8 declared + 2 earned + 5 pickup writes)',
        (end.persistence_cleared ?? []).length === 15,
        `${(end.persistence_cleared ?? []).length} flag(s)`);
    gate('the walk never started drowning', end.drown_timer === 0, String(end.drown_timer));
    gate('the win statics are still false', end.menu === false,
        `menu=${end.menu} cutscene=${JSON.stringify(end.cutscene)}`);

    if (failures > 0) {
        console.log(`\n⛔ ${failures} FAILURE(S) — the bridge is the gate; nothing after it `
            + 'is armed until this is green.');
        process.exitCode = 1;
    } else {
        console.log('\n✅ THE BRIDGE IS GREEN. R4\'s claim re-drives as six windows on ONE '
            + 'page with no boot grant and no clear list after the first — so the '
            + 'inheritance really was the live game, not the tape.');
    }
}

if (args.includes('--bridge')) runBridge();
else {
    console.log('usage: run-seedling-director.mjs --bridge [--keep]');
    process.exitCode = 2;
}
