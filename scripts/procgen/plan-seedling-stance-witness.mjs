#!/usr/bin/env node
/**
 * plan-seedling-stance-witness — ⛓⛓⛓ SEEDLING FIDELITY STANCE: THE GAME
 * WITNESSES FOR THE STANCES THE SOLVER USED TO LOOP ON.
 *
 * Authors (and with `--check` re-derives, byte for byte) the committed tapes the
 * slice records on the GAME and the model then reproduces:
 *
 *   stance-l46-chest          route step 91 — L46's `chest@424,40` sits on a HALF
 *                             tile (x 424 = 26.5 tiles), so its stance (432,58) is
 *                             in a 16 px A* tile whose centre the chest covers; the
 *                             walk re-entered its own `chest` order four times. The
 *                             stance walk now takes the 8 px lattice, axis-aligned
 *   stance-l48-chest          route step 93 — the same shape at `chest@152,184`
 *                             (x 152 = 9.5 tiles), stance (160,202)
 *   stance-l48-keylock-open   route step 102 in the OPEN state: the save has
 *                             `{48,1}` cleared (`bosslock@48,144` was opened from its
 *                             own side earlier), so the game does not build the lock
 *                             and the walk from the L53 door goes straight through
 *   stance-l48-keylock-south  the CONTROL: the same lock, flag held, from its OWN side
 *                             (south): the `keylock` stance lands and the lock opens
 *   stance-l48-keylock-north  hand keys, route step 102 in the SHUT state: from the
 *                             L53 door the player walks east and leans DOWN into
 *                             `bosslock@48,144` holding key 3. The key line is the
 *                             row under the lock (`BossLock.update`'s
 *                             `collideLine`, y 161), so nothing opens: the refusal
 *                             the solver now gives (SEALED BEHIND ITSELF) is the
 *                             game's own answer
 *
 * The staging is the survey's (`r8-solve-11`'s committed block re-pointed at the
 * atlas arrival, the route's keys and items), so a solver witness IS the survey
 * step's plan (with its first goal only, so a tape ends in the room it is about).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-stance-witness.mjs           # write the tapes
 *   node scripts/procgen/plan-seedling-stance-witness.mjs --check   # re-derive; exit 1 on drift
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
export const STANCE_BASE = 'r8-solve-11';

const ROUTE_ITEMS = Object.freeze(['hasShield', 'hasFire', 'canSwim', 'hasTorch']);

/** L48's bosslock: the lock, its key line (the row under it) and its saved flag. */
export const L48_LOCK = Object.freeze({ id: 'bosslock@48,144', keyLineY: 161, top: 144, flag: { level: 48, tag: 1 } });

/** The witnesses: the survey step, its boot, its grant, its goals (or hand keys), the check. */
export const STANCE_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'stance-l46-chest',
        step: 91,
        boot: { level: 46, x: 240, y: 448 },
        keys: [0, 1, 2],
        items: ROUTE_ITEMS,
        goals: [{ kind: 'collect-placement', placement: { x: 424, y: 40 } }],
        to: 46,
        check: { chest: 'chest@424,40' },
        what: 'route step 91 (L46): from the L45 arrival the solver walks to `chest@424,40`, a chest '
            + 'on a HALF tile whose stance (432,58) no 16 px node reaches, on the 8 px lattice and one '
            + 'axis at a time, and opens and collects it',
    }),
    Object.freeze({
        name: 'stance-l48-chest',
        step: 93,
        boot: { level: 48, x: 112, y: 288 },
        keys: [0, 1, 2],
        items: ROUTE_ITEMS,
        goals: [{ kind: 'collect-placement', placement: { x: 152, y: 184 } }],
        to: 48,
        check: { chest: 'chest@152,184' },
        what: 'route step 93 (L48): from the L47 arrival (south) the solver walks to `chest@152,184` '
            + '(x 152 = 9.5 tiles, stance (160,202)) on the 8 px lattice, axis-aligned, and opens and '
            + 'collects it',
    }),
    Object.freeze({
        name: 'stance-l48-keylock-open',
        step: 102,
        boot: { level: 48, x: 16, y: 112 },
        keys: [0, 1, 2, 3],
        items: ROUTE_ITEMS,
        clears: [L48_LOCK.flag],
        goals: [{ kind: 'reach-exit', exit: { x: 112, y: 304 } }],
        to: 47,
        check: { lockAbsent: L48_LOCK.id },
        what: 'route step 102 (L48 → L47) in the OPEN state: the save has {48,1} cleared, so '
            + '`BossLock.check()` removes `bosslock@48,144` on build and the walk from the west (L53) door '
            + 'passes its cell to `teleporter@112,304` (L47)',
    }),
    Object.freeze({
        name: 'stance-l48-keylock-south',
        step: null,
        boot: { level: 48, x: 112, y: 288 },
        keys: [0, 1, 2, 3],
        items: ROUTE_ITEMS,
        goals: [{ kind: 'reach-exit', exit: { x: 0, y: 112 } }],
        to: 53,
        check: { keylockSouth: L48_LOCK },
        what: 'the CONTROL for the shut state: the same `bosslock@48,144`, flag held, approached from '
            + 'its OWN side (the L47 door south of it, route step 93\'s arrival). The solver\'s `keylock` '
            + 'stance lands on the key line (y 161), the lock opens (`keyTimer` 60, then the fade) and the '
            + 'walk goes north through its cell to the west door (L53)',
    }),
    Object.freeze({
        name: 'stance-l48-keylock-north',
        step: 102,
        boot: { level: 48, x: 16, y: 112 },
        keys: [0, 1, 2, 3],
        items: ROUTE_ITEMS,
        // Hand-authored: east along the north pocket to the lock's column, then lean
        // DOWN into the lock (holding key 3) for 140 ticks — longer than the 60-tick
        // `keyTimer` plus the 20-tick fade, so an opened lock would let the held key
        // carry the box through (the lean discriminates). [key, ticks]
        inputs: [['right', 44], [null, 12], ['down', 140], [null, 4]],
        to: 48,
        check: { sealedNorth: L48_LOCK },
        what: 'route step 102 (L48) in the SHUT state: from the west (L53) door the player walks east and '
            + 'leans DOWN into `bosslock@48,144` holding key 3 for 140 ticks. `BossLock.update` opens only on a '
            + 'player box on the row under the lock (y 161), so the lean pins the box against the '
            + 'lock\'s TOP and nothing opens (no `keyTimer`, no fade): from this side the lock is '
            + 'sealed while its flag holds',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function stanceStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${STANCE_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = [
        ...(staging.persistence ?? []).filter((r) => r.at === undefined),
        ...(w.clears ?? []).map((c) => ({ level: c.level, tag: c.tag,
            note: `stance: the open state — L${c.level}'s lock was opened from its own side earlier` })),
    ];
    return staging;
}

/** The solver's plan for one witness, from that staging (or the hand-authored keys). */
export async function stancePlan(w) {
    const staging = await stanceStaging(w);
    if (w.inputs) {
        const perTick = w.inputs.flatMap(([key, n]) =>
            Array.from({ length: n }, () => new Set(key ? [key] : [])));
        return { staging, solved: { persistence: staging.persistence, out: { perTick, equips: [], records: [] } } };
    }
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const levelSource = atlasLevelSource();
    const solved = await twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
    return { staging, solved };
}

/** The run, advanced through a tape's own keys; `each` sees the run after every tick. */
async function replayRun(tape, levelSource, each = null) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const run = createRunForStaging({ ...tape, equips: tape.equips ?? [] }, levelSource);
    for (let i = 0; i < tape.tick_count; i += 1) {
        run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
        if (each) each(run, i);
    }
    return run;
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of STANCE_WITNESSES) {
        const { staging, solved } = await stancePlan(w);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY STANCE — ${w.what}. The survey's staging `
            + `(\`${STANCE_BASE}\`'s committed block re-pointed at L${w.boot.level} `
            + `(${w.boot.x},${w.boot.y}), keys [${w.keys.join(', ')}], items [${w.items.join(', ')}]`
            + `${w.clears ? `, cleared ${w.clears.map((c) => `{${c.level},${c.tag}}`).join(' ')}` : ''}). `
            + `${w.inputs ? 'Hand-authored keys' : "The solver's own plan"}: `
            + `${solved.out.perTick.length} t, equips ${JSON.stringify(solved.out.equips)}. `
            + 'Authored by scripts/procgen/plan-seedling-stance-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it ${w.to === w.boot.level ? 'inside' : 'into'} L${w.to}`,
            last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const verbs = (solved.out.records ?? []).map((r) => r.strategy).filter(Boolean);
        let maxY = -Infinity;
        let lastL48 = null;
        let everOpen = false;
        const run = await replayRun(tape, levelSource, (r) => {
            if (r.level !== 48) return;
            maxY = Math.max(maxY, r.state.y);
            lastL48 = { x: r.state.x, y: r.state.y };
            if (r.entities('openActivators').has(L48_LOCK.id)) everOpen = true;
        });
        if (w.check.chest) {
            check(`${w.name}: the plan opens the chest once (one \`chest\` record)`,
                verbs.filter((v) => v === 'chest').length === 1, JSON.stringify(verbs));
            check(`${w.name}: ${w.check.chest} opened`,
                run.ledger('chestOpens').some((c) => c.id === w.check.chest),
                JSON.stringify(run.ledger('chestOpens').map((c) => [c.id, c.t])));
        } else if (w.check.lockAbsent) {
            const { buildLevelWorld } = await import(join(MODULE, 'levelWorld.js'));
            const built48 = buildLevelWorld(levelSource(48), { cleared: [L48_LOCK.flag.tag] });
            check(`${w.name}: with {48,1} cleared the build has no ${w.check.lockAbsent}`,
                !built48.activators.some((a) => a.id === w.check.lockAbsent),
                JSON.stringify(built48.activators.map((a) => a.id)));
            check(`${w.name}: the walk passes south of the lock's row (y > ${L48_LOCK.keyLineY}) in L48`,
                maxY > L48_LOCK.keyLineY, `max y in L48 ${maxY}`);
        } else if (w.check.keylockSouth) {
            const lock = w.check.keylockSouth;
            check(`${w.name}: the plan applies \`keylock\` to ${lock.id}`,
                (solved.out.records ?? []).some((r) => r.strategy === 'keylock' && r.target === lock.id),
                JSON.stringify(verbs));
            check(`${w.name}: ${lock.id} opened in the replay`, everOpen, 'openActivators held it');
        } else if (w.check.sealedNorth) {
            const lock = w.check.sealedNorth;
            check(`${w.name}: ${lock.id} never opened (no key-line touch from the north)`, !everOpen,
                'openActivators never held it');
            check(`${w.name}: the lean pins the box above the lock (y < ${lock.top})`,
                maxY < lock.top && maxY > lock.top - 8, `max y ${maxY}`);
            const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
            const box = playerBoxAt(lastL48.x, lastL48.y);
            check(`${w.name}: the box rests over the lock's columns (x 48..64), flush on its top`,
                box.x < 64 && box.right > 48 && Math.abs(box.bottom - lock.top) < 1,
                JSON.stringify({ at: lastL48, box }));
            check(`${w.name}: the run holds key 3 (the lock's own)`, run.progress('keys')?.has(3),
                JSON.stringify([...(run.progress('keys') ?? [])]));
        }
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const path = join(TAPES, `${w.name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else if (!process.argv.includes('--dry')) {
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
