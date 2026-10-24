#!/usr/bin/env node
/**
 * plan-seedling-watcher-witness — ⛓⛓⛓ SEEDLING FIDELITY WATCHER: A SILENT
 * WATCHER ON THE FRONTIER OF A REACH-EXIT IS NOT AN OBSTACLE, AND A SPEAKING
 * ONE IS PASSED BY ITS DIALOGUE.
 *
 * The route survey (`survey-seedling-route.mjs --through=end`) refused steps 95
 * and 101 on L37's `watcher@104,264`: *"Obstacle: proximity-hazard:watcher …
 * No strategy row exists for this obstacle"*. The census priced every watcher's
 * 24 px talk circle as an avoid volume, but this placement's `text` is empty,
 * and `NPC.talk()` runs only `if (p && myText[0].length > 0)`
 * (`NPCs/NPC.as:188`). The game lets the player walk straight through it with no
 * dialogue and no freeze. `levelWorld`'s `watcher` row now lists such a
 * placement as SILENT (`world.silentHazards`) rather than as a volume, and both
 * steps solve.
 *
 * These tapes are the solver's own plans for those two steps, staged exactly as
 * the survey stages them, so the GAME can be recorded against them
 * (`check-seedling-bot-differential --record --only=…`). Each plan is required
 * to cross the census's old avoid square (the volume that refused it), and the
 * lean witness to stand INSIDE the talk circle (`FP.distance <= 24` from the
 * NPC's centre, the ctor half-tile): a game that froze there would show it as a
 * stalled stream, so the recording discriminates the rule.
 *
 *   watcher-l37-reach-l38   route step 95 (L37 → L38): from the L44 arrival the
 *                           walk burns `burnabletree@128,192`, passes the silent
 *                           watcher and leaves by `teleporter@288,0`.
 *   watcher-l37-reach-l44   route step 101 (L37 → L44): from the L38 arrival the
 *                           walk burns the same tree, passes the watcher and
 *                           leaves by `teleporter@0,256`.
 *   watcher-l37-silent-lean THE DISCRIMINATOR. Neither plan enters the 24 px
 *                           circle itself (closest 30.9 / 32.9 px): they crossed
 *                           only the census's 48x48 SQUARE, whose corners lie
 *                           outside it. The watcher stands on solid ground and
 *                           every walkable cell centre is 25.3 px from it, so
 *                           this tape boots above it (entity (112,248), exactly
 *                           24 px: `inRange` is `<=`), leans `down` against the
 *                           wall to 19 px and walks out `left`. A watcher that
 *                           spoke would open its dialogue on the first update
 *                           and freeze the walk (`watcherL114.test`'s claim,
 *                           game-witnessed by `r6-w-talk`).
 *   watcher-l114-silent     THE OTHER SILENT STATE. L114's watcher speaks, but
 *                           with `{114,0}` cleared at boot `Watcher.update` runs
 *                           no `talk()`; the census lists it silent and the
 *                           solver walks from the corridor's top (`spawn`
 *                           (72,56), 25.3 px from it) straight through the
 *                           circle to `teleporter@64,144` (L113).
 *   watcher-l114-talk       THE `talk` VERB (D2). The same boot with the tag
 *                           SET: the circle cuts the two-tile corridor, the
 *                           frontier names `proximity-hazard:watcher`, and the
 *                           solver steps into the circle, pages the dialogue on
 *                           the ceremony cadence until `doneTalking()` writes
 *                           `{114,0}`, and walks out to L113.
 *
 * THE STAGING (the survey's, written out): `r8-solve-11`'s committed block
 * (`solveStaging`), re-pointed at the step's atlas arrival, with the save keys
 * and seam items the route holds by then (`stagedGrantFor`), its timed clears
 * stripped. `--check` re-derives both and compares them to the committed tapes
 * byte for byte, and asserts the model's replay crosses where the plan says.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-watcher-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-watcher-witness.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

/** The staged base every witness boots from (the survey's `staged` boot). */
export const WATCHER_BASE = 'r8-solve-11';

/** `NPC.talkRange` (`NPCs/NPC.as:27`). */
export const TALK_RANGE = 24;

/** The silent watcher the L37 walks pass, and its centre (`NPC.as:47`'s half tile). */
export const L37_WATCHER = Object.freeze({ level: 37, id: 'watcher@104,264', ex: 112, ey: 272 });
/** The extract's one SPEAKING watcher, and its centre. */
export const L114_WATCHER = Object.freeze({ level: 114, id: 'watcher@72,72', ex: 80, ey: 80 });

/** The two witnesses: the survey step, its boot, its grant, its goal, the plan's crossing. */
export const WATCHER_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'watcher-l37-reach-l38',
        step: 95,
        boot: { level: 37, x: 32, y: 288 },
        keys: [0, 1],
        items: ['hasTorch', 'hasShield', 'hasFire'],
        goal: { kind: 'reach-exit', exit: { x: 288, y: 0 } },
        to: 38,
        watcher: L37_WATCHER,
        check: 'square',
        what: 'route step 95 (L37 → L38): from the L44 arrival the solver burns '
            + '`burnabletree@128,192`, walks through the talk circle of the SILENT '
            + '`watcher@104,264` (its `text` is empty, so `NPC.talk()` never runs) and leaves by '
            + '`teleporter@288,0`',
    }),
    Object.freeze({
        name: 'watcher-l37-reach-l44',
        step: 101,
        boot: { level: 37, x: 288, y: 16 },
        keys: [0, 1, 2],
        items: ['hasTorch', 'hasShield', 'hasFire'],
        goal: { kind: 'reach-exit', exit: { x: 0, y: 256 } },
        to: 44,
        watcher: L37_WATCHER,
        check: 'square',
        what: 'route step 101 (L37 → L44): from the L38 arrival the solver burns '
            + '`burnabletree@128,192`, walks through the talk square of the SILENT '
            + '`watcher@104,264` and leaves by `teleporter@0,256`',
    }),
    Object.freeze({
        name: 'watcher-l37-silent-lean',
        step: 95,
        boot: { level: 37, x: 104, y: 240 },
        keys: [0, 1],
        items: ['hasTorch', 'hasShield', 'hasFire'],
        // Hand-authored, not planned: `down` into the wall, `left` out of the
        // circle, then rest. [key, ticks]
        inputs: [['down', 20], ['left', 20], [null, 20]],
        to: 37,
        watcher: L37_WATCHER,
        check: 'lean',
        what: 'THE DISCRIMINATOR: boots 24 px above the SILENT `watcher@104,264` (in range by '
            + '`NPC.talk()`\'s `<=`), leans `down` against the wall to 19 px, walks out `left` and '
            + 'rests. A speaking watcher would open its dialogue on the first update and freeze the '
            + 'walk; this one never talks',
    }),
    Object.freeze({
        name: 'watcher-l114-silent',
        step: null,
        boot: { level: 114, x: 64, y: 48 },
        keys: [],
        items: [],
        clears: [{ level: 114, tag: 0, note: 'the Watcher talked to on an earlier visit '
            + '(`Watcher.doneTalking()` writes it): `Watcher.update` runs no `talk()` while it is '
            + 'cleared' }],
        goal: { kind: 'reach-exit', exit: { x: 64, y: 144 } },
        to: 113,
        watcher: L114_WATCHER,
        check: 'silent-walk',
        what: 'THE OTHER SILENT STATE: L114\'s SPEAKING `watcher@72,72` with `{114,0}` cleared at boot. '
            + 'The census lists it silent (`Watcher.update` gates `talk()` on the tag), and the solver '
            + 'walks from the top of the two-tile corridor straight through the 24 px circle to '
            + '`teleporter@64,144` with no dialogue',
    }),
    Object.freeze({
        name: 'watcher-l114-talk',
        step: null,
        boot: { level: 114, x: 64, y: 48 },
        keys: [],
        items: [],
        goal: { kind: 'reach-exit', exit: { x: 64, y: 144 } },
        to: 113,
        watcher: L114_WATCHER,
        check: 'talk',
        what: 'THE `talk` VERB: L114\'s SPEAKING `watcher@72,72` with its tag SET. Its 24 px circle '
            + 'cuts the two-tile corridor, so the frontier names `proximity-hazard:watcher`; the solver '
            + 'steps from the corridor\'s top into the circle, the dialogue opens on proximity, the '
            + 'solver pages it on the ceremony cadence until `doneTalking()` writes `{114,0}`, and '
            + 'walks out to `teleporter@64,144`',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function watcherStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${WATCHER_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = [...(staging.persistence ?? []).filter((r) => r.at === undefined),
        ...(w.clears ?? [])];
    return staging;
}

/** The solver's plan for one witness, from that staging (or the lean's hand-authored keys). */
export async function watcherPlan(w) {
    if (w.inputs) {
        const staging = await watcherStaging(w);
        const perTick = w.inputs.flatMap(([key, n]) =>
            Array.from({ length: n }, () => new Set(key ? [key] : [])));
        return { staging, solved: { persistence: staging.persistence, out: { perTick, equips: [] } } };
    }
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = await watcherStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [w.goal], name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
    return { staging, solved };
}

/**
 * The census's OLD avoid volume for the watcher: the 48x48 square bounding the
 * circle (`ENTITY_CLASSES.watcher.hazard`), `[88,136) x [248,296)`. A box that
 * overlaps it is a walk the pre-fix planner refused.
 */
export const L37_OLD_SQUARE = Object.freeze({ x: 88, y: 248, right: 136, bottom: 296 });

/**
 * The walk's closest approach to the watcher's centre, as `NPC.talk()` measures
 * it (`FP.distance(x, y, p.x, p.y)`, the player's entity position), and the
 * number of observations inside the talk circle.
 */
export function talkCircleVisit(ticks, watcher = L37_WATCHER) {
    let min = Infinity;
    let inside = 0;
    for (const o of ticks) {
        if (o.level !== watcher.level) continue;
        const d = Math.hypot(o.x - watcher.ex, o.y - watcher.ey);
        if (d < min) min = d;
        if (d <= TALK_RANGE) inside += 1;
    }
    return { min, inside };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    const { rectsOverlap } = await import(join(MODULE, 'levelWorld.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    const textOf = (wt) => levelSource(wt.level).entities
        .find((e) => `${e.type}@${e.x},${e.y}` === wt.id)?.attrs?.text;
    check(`L37 ${L37_WATCHER.id} is placed with an EMPTY text`, textOf(L37_WATCHER) === '',
        JSON.stringify(textOf(L37_WATCHER)));
    check(`L114 ${L114_WATCHER.id} is placed WITH text`, (textOf(L114_WATCHER) ?? '').length > 0,
        `${(textOf(L114_WATCHER) ?? '').length} character(s)`);
    for (const w of WATCHER_WITNESSES) {
        const { staging, solved } = await watcherPlan(w);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY WATCHER — ${w.what}. The survey's staging `
            + `(\`${WATCHER_BASE}\`'s committed block re-pointed at the atlas arrival, keys `
            + `[${w.keys.join(', ')}], items [${w.items.join(', ')}]`
            + `${w.clears ? `, clears ${w.clears.map((c) => `{${c.level},${c.tag}}`).join(' ')}` : ''}). `
            + `${w.inputs ? 'Hand-authored keys' : "The solver's own plan"}: `
            + `${solved.out.perTick.length} t, equips ${JSON.stringify(solved.out.equips)}. `
            + 'Authored by scripts/procgen/plan-seedling-watcher-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const visit = talkCircleVisit(out.ticks, w.watcher);
        if (w.check === 'silent-walk' || w.check === 'talk') {
            const run = createRunForStaging({ ...tape, equips: [] }, levelSource);
            for (let i = 0; i < tape.tick_count; i += 1) {
                run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
            }
            const talks = run.watcherTalks.filter((r) => r.id === w.watcher.id);
            check(`${w.name}: the walk enters ${w.watcher.id}'s talk circle`, visit.inside > 0,
                `closest ${visit.min.toFixed(2)} px, ${visit.inside} observation(s) within ${TALK_RANGE}`);
            if (w.check === 'silent-walk') {
                check(`${w.name}: the run never talks to it`, talks.length === 0
                    && solved.out.records.every((r) => r.strategy !== 'talk'),
                JSON.stringify(talks));
            } else {
                const rec = solved.out.records.filter((r) => r.strategy === 'talk');
                check(`${w.name}: the plan talks to ${w.watcher.id} once, and the run's dialogue `
                    + 'ends DONE (paged), not LEFT', rec.length === 1 && talks.length === 1
                    && talks[0].cause === 'done',
                JSON.stringify({ records: rec.map((r) => [r.openedAt, r.closedAt, r.pages]),
                    talks: talks.map((r) => [r.t, r.cause, r.pages, r.page]) }));
                check(`${w.name}: the run earns {${w.watcher.level},0}`,
                    run.watcherFlags.some((f) => f.level === w.watcher.level && f.tag === 0),
                    JSON.stringify(run.watcherFlags));
            }
        } else if (w.check === 'lean') {
            check(`${w.name}: the walk stands inside ${L37_WATCHER.id}'s talk circle`, visit.inside > 0,
                `closest ${visit.min.toFixed(2)} px, ${visit.inside} observation(s) within ${TALK_RANGE}`);
            // `left` is held on ticks 20..39, so observations 21..40 must all move.
            const [down, left] = w.inputs;
            const window = out.ticks.slice(down[1] + 1, down[1] + left[1] + 1);
            const stalled = window.filter((o) => o.x === out.ticks[o.t - 1].x).map((o) => o.t);
            check(`${w.name}: the walk is never frozen while \`left\` moves it`,
                window.length === left[1] && stalled.length === 0,
                `${window.length - stalled.length}/${window.length} observation(s) moved`
                + `${stalled.length ? `; stalled at ${stalled.join(', ')}` : ''}`);
        } else {
            const sq = L37_OLD_SQUARE;
            const inSquare = out.ticks.filter((o) => o.level === 37
                && rectsOverlap(playerBoxAt(o.x, o.y), sq)).length;
            check(`${w.name}: the walk crosses the census's old square for ${L37_WATCHER.id}`, inSquare > 0,
                `${inSquare} observation(s) overlap it; closest to the centre ${visit.min.toFixed(2)} px `
                + `(the circle is ${TALK_RANGE})`);
        }
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const path = join(TAPES, `${w.name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
