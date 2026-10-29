#!/usr/bin/env node
/**
 * plan-seedling-lightpole-witness — ⛓⛓⛓ SEEDLING FIDELITY LIGHTPOLE (wave 34): AN IN-ROOM POLE IS LIT FROM ITS OWN ROOM.
 *
 * The rules place an in-room `LightPole`'s light as a `clear-tag` event on the pole itself (no presser), and the solver
 * had no verb (*"no strategy row exists for solid:lightpole"*). `inRoomPoleThrust` (OFF by default) adds `pole`: ONE
 * "Spear" hit — the Spear's thrust, or, once the Ghost Sword has fused the Sword and Spear slots, the ghost swing —
 * from a stance whose rect lies on the pole's bob-invariant core (`resolvePoleThrustStrategy` / `execPoleThrust`).
 *
 * L101's `lightpole@144,64` (tag 0) is the edge that needs the geometry: from the r4c2 side no tile is next to the
 * pole, and the press goes THROUGH the wall [8,4] from [7,4] with the player flush against the wall above (the rules-4
 * witness: "player pressed up, y 66"). The tapes are the solver's own plans with the switch ON, staged as the route
 * survey stages step 226 (its boot view: `r8-solve-11`'s committed block re-pointed at L101@288,240, the route's save
 * keys and seam items), and each ends when the run's pole is `activate` and its write has landed:
 *
 *   lightpole-l101-ghost   the survey's own bag (the Ghost Sword held — no Spear slot): the ghost swing, facing N from
 *                          [7,4], its 48 px-wide rect across the wall corner.
 *   lightpole-l101-spear   the same staging with `hasGhostSword` false (the Spear's own slot): the thrust, facing E.
 *
 * The game recordings are `check-seedling-bot-differential --record --only=lightpole-l101-ghost,lightpole-l101-spear`
 * (p4g, the default build).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-lightpole-witness.mjs --from-view=<survey step-226 boot view>   # write the tapes
 *   node scripts/procgen/plan-seedling-lightpole-witness.mjs --check     # re-derive from the committed tapes; exit 1 on drift
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

/** The switches the witnesses are planned under (every other switch at its default). */
export const LIGHTPOLE_FIDELITY = Object.freeze({ inRoomPoleThrust: true });

const POLE = 'lightpole@144,64';
const GOAL = Object.freeze({ kind: 'clear-tag', tag: { level: 101, tag: 0 }, at: { x: 144, y: 64 }, obstacle: POLE });

/** The witnesses: the bag edit (on the view's seam items), the arm the plan must use, what each shows. */
export const LIGHTPOLE_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'lightpole-l101-ghost',
        items: Object.freeze({}),
        weapon: 'ghostsword',
        flush: false,
        what: 'L101 from the survey\'s step-226 arrival (288,240) with the route\'s bag (the Ghost Sword fused the Sword '
            + 'and Spear slots): the walk to [7,4] and ONE ghost swing facing N, whose 48 px-wide rect reaches across the '
            + 'wall corner [8,3]/[8,4] to `lightpole@144,64` — the pole activate, {101,0} written',
    }),
    Object.freeze({
        name: 'lightpole-l101-spear',
        items: Object.freeze({ hasGhostSword: false }),
        weapon: 'spear',
        flush: true,
        what: 'L101 from the survey\'s step-226 arrival (288,240), the route\'s bag WITHOUT the Ghost Sword (the Spear\'s '
            + 'own slot): the walk to [7,4], flush against the wall above, and ONE Spear thrust facing E through the wall '
            + '[8,4] at `lightpole@144,64` — the pole activate, {101,0} written',
    }),
]);

/** The witness's staging: the view's, the bag edited, no equips (the survey staged none). */
export function lightpoleStaging(w, staging) {
    const s = { ...staging, equips: [] };
    s.seam = { ...s.seam, items: { ...s.seam.items, ...w.items } };
    return s;
}

/** The witness's plan from a staging (`solveSegment`, the switch ON, the survey's dash mode). */
export async function lightpolePlan(w, staging) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const { DEFAULT_DASH_MODE } = await import('./dashMode.js');
    return withContactFidelity(LIGHTPOLE_FIDELITY, () => {
        const run = createRunForStaging(staging, atlasLevelSource());
        return solveSegment({ run, goals: [{ ...GOAL }], name: w.name, boot: staging.boot, dashMode: DEFAULT_DASH_MODE });
    });
}

async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape, solveStaging, stagingFromTape, createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));

    const CHECK = process.argv.includes('--check');
    const FROM = process.argv.find((a) => a.startsWith('--from-view='))?.slice('--from-view='.length) ?? null;
    if (!CHECK && !FROM) {
        console.error('plan-seedling-lightpole-witness: --from-view=<survey step-226 boot view> (write) or --check');
        process.exit(2);
    }
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of LIGHTPOLE_WITNESSES) {
        const path = join(TAPES, `${w.name}.json`);
        // ⛓ The staging: the survey's boot view (its bag edited) on a write; the committed tape's own header on a check.
        const source = CHECK ? readFileSync(path, 'utf8') : readFileSync(FROM, 'utf8');
        const parsed = parseTape(JSON.parse(source));
        const base = solveStaging(stagingFromTape({ ...parsed, inputs: [], tick_count: 0 }));
        const staging = CHECK ? { ...base, equips: [] } : lightpoleStaging(w, base);
        check(`${w.name}: the staging boots at L101 (288,240)`,
            staging.boot.level === 101 && staging.boot.x === 288 && staging.boot.y === 240, JSON.stringify(staging.boot));
        const out = await lightpolePlan(w, staging);
        const rec = out.records.find((r) => r.goal === 'clear-tag');
        check(`${w.name}: the plan's clear-tag is the pole verb with the ${w.weapon}`,
            rec?.arm === 'verb' && rec?.strategy === 'pole' && rec?.weapon === w.weapon, JSON.stringify(rec));
        // ⛓ The verb re-selects the old slot as its last act, at `perTick.length` — past a tape's last input, where the
        // game applies it and the mirror does not (measured: the first spear record read `Main.primary` game 0 vs 3).
        // One idle tick puts that trailing equip inside the tape; it is the witness's, not the plan's.
        const trailing = (out.equips ?? []).some((e) => (e.t ?? e.tick) >= out.perTick.length);
        const perTick = trailing ? [...out.perTick, new Set()] : out.perTick;
        const built = buildStagedTape({
            staging: { ...staging, equips: [...(staging.equips ?? []), ...(out.equips ?? [])] },
            perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY LIGHTPOLE — ${w.what}. The survey's step-226 staging. The solver's own `
            + `plan with ${Object.keys(LIGHTPOLE_FIDELITY).join(' + ')} ON: ${out.perTick.length} t${trailing ? ' + 1 idle (the trailing equip)' : ''}, equips `
            + `${JSON.stringify(out.equips)}. Authored by scripts/procgen/plan-seedling-lightpole-witness.mjs.`;
        const tape = parseTape({ ...built, description });
        const ran = runTape(tape, { levelSource });
        const last = ran.ticks.at(-1);
        check(`${w.name}: the model replays it in L101`, last?.level === 101,
            `${ran.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        // The mechanism, read off a replay run: one press, the pole activate from [7,4], the write, no hit.
        const run = createRunForStaging({ ...staging, equips: tape.equips ?? staging.equips }, levelSource);
        let litAt = null;
        let litFrom = null;
        let presses = 0;
        for (let t = 0; t < perTick.length; t += 1) {
            if (perTick[t].has('primary') && t >= rec.from) presses += 1;
            run.advance(perTick[t]);
            const p = run.lightPolesNow.find((q) => q.id === POLE);
            if (litAt === null && p?.activate) {
                litAt = run.ticksCompleted;
                litFrom = { x: run.state.x, y: run.state.y };
            }
        }
        check(`${w.name}: ${POLE} turns activate while the player stands in [7,4]${w.flush ? ' flush against the wall above' : ''}`,
            litAt !== null && Math.floor(litFrom.x / 16) === 7 && Math.floor(litFrom.y / 16) === 4
                && (!w.flush || litFrom.y < 68),
            `activate t${litAt} at ${JSON.stringify(litFrom)}`);
        check(`${w.name}: ONE press in the verb`, presses === 1, `${presses} primary tick(s) from t${rec?.from}`);
        check(`${w.name}: {101,0} on the ledger`, run.ledger('earnedClears')
            .some((c) => c.level === 101 && c.tag === 0 && c.by === 'lightpole'));
        check(`${w.name}: no hit`, run.playerHits.length === 0, `${run.playerHits.length} hit(s)`);
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run with --from-view');
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
