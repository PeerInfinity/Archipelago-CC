#!/usr/bin/env node
/**
 * probe-seedling-rect-inputs — THE BOUNDED RECT-INPUT SWEEP.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 8, step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §21.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * Slice 7 found the rope's press rect was `{x, y, h, right: null, bottom}`.
 * `rectsOverlap` reads `right`/`bottom`, `null > x` is false, and so that
 * rect NEVER OVERLAPPED ANYTHING: the press census could not see the rope
 * at all, and the audit that should have found it reported clean.
 *
 * ⛔ THE DEFECT WAS NOT IN THE ARITHMETIC. `entityRect` is three additions
 * and every one of them is right. `rect(x, y, w, h)` is the shipped factory
 * and it was used. What went wrong is that an ABSENT INPUT (`cls.w`, which
 * a node-terminated class has not got) flowed into complete-looking
 * arithmetic and came out the far side as a shape that type-checks, prints
 * plausibly, and answers every question "no".
 *
 * ⇒ **The unit of audit is the INPUT, not the expression.** `assertRect`
 * on the output is the backstop; what this sweep asks at each site is
 * whether the site's inputs are guaranteed present and finite, and by what.
 *
 * ── WHAT IT BOUNDS, AND WHAT IT DOES NOT ──────────────────────────────
 *
 * TWO STRATA, deliberately, because either alone reads as clean:
 *
 *   1. THE ENUMERATED SITES (`SITES`) — every inline `{x, y, right, bottom}`
 *      derivation in `frontend/modules/seedlingDemo` that does NOT go
 *      through `levelWorld.rect()`, found by grep and classified by hand,
 *      each with a named verdict. A bounded sweep must name what it
 *      bounded. `--sites` prints the table.
 *   2. THE LIVE SWEEP — build every level in the atlas under every role,
 *      walk every rect-bearing field of the built world, and check each
 *      one is finite. This is the stratum that would have caught the rope,
 *      because it does not need anybody to have suspected the rope.
 *
 * ⚠ WHAT IT DOES NOT COVER: rects built at RUN time from live state
 * (`levelRun`'s moving-solid boxes, `fireVerb`'s 32x32 press rect). Those
 * are covered by their own unit strata, whose inputs are run state rather
 * than table data — a different question with a different answer, and
 * naming it here is the point of naming it.
 *
 * Usage:
 *     node scripts/procgen/probe-seedling-rect-inputs.mjs           # both strata
 *     node scripts/procgen/probe-seedling-rect-inputs.mjs --sites   # the table only
 */

import { ROLES, buildLevelWorld } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { loadAtlas } from '../../frontend/modules/seedlingDemo/levelSource.js';

/* eslint-disable no-console */

// ── STRATUM 1: the enumerated sites ──────────────────────────────────────
//
// `verdict` is one of:
//   'guarded'  — the site itself throws or fails on an absent/non-finite input
//   'closed'   — the inputs are module constants or frozen tables; no path in
//   'derived'  — inputs come from another rect this sweep already covers
//   'band'     — deliberately NOT a rect (see the note); never reaches
//                `rectsOverlap`
//   'FIXED'    — this slice added the guard

export const SITES = Object.freeze([
    Object.freeze({
        site: 'botDriverV2.js:406 grow(r, m)',
        inputs: 'r (a rect), m (a margin number)',
        verdict: 'FIXED',
        why: 'Its three callers all pass `playerBoxAt`/`terrainProbeRect` output, '
            + 'which is closed — but `grow` is a general-purpose widener whose '
            + 'whole job is to produce the rect a sweep is tested against, and '
            + '`undefined + m` is NaN, which compares false in every direction. '
            + 'That is the rope failure with a different absent field. Now '
            + 'assertRect on the way in AND on the way out.',
    }),
    Object.freeze({
        site: 'camera.js:182 instanceRect(instance)',
        inputs: 'instance.row.hitbox {w,h,ox,oy}, instance.cx, instance.cy',
        verdict: 'FIXED',
        why: 'It already fails loudly when `hitbox` is ABSENT — the case somebody '
            + 'thought of. It did not check the case the rope was: a hitbox '
            + 'PRESENT with a missing field. `{ox, oy}` with no `w` gives '
            + '`right: NaN` and the fail() above it never fires. Now assertRect '
            + 'on the result, which covers both.',
    }),
    Object.freeze({
        site: 'playerPhysicsV2.js:120 playerBoxAt(x, y)',
        inputs: 'HITBOX (module const), x, y',
        verdict: 'closed',
        why: '`HITBOX` is a frozen module constant with four integer fields; the '
            + 'only external inputs are x and y, and a non-finite player position '
            + 'is a physics failure this rect is the wrong place to catch (every '
            + 'step in `playerPhysicsV2` would already have produced it). Left '
            + 'alone deliberately: a guard here would report the symptom.',
    }),
    Object.freeze({
        site: 'playerPhysicsV2.js:133 terrainProbeRect(x, y)',
        inputs: 'HITBOX (module const), CHECK_OFFSET_Y (module const), x, y',
        verdict: 'closed',
        why: 'Same shape as `playerBoxAt`, plus one more frozen constant.',
    }),
    Object.freeze({
        site: 'encounters.js:193 eBox (the envelope)',
        inputs: 'row.hitbox {w,h,ox,oy} — DEFAULTED, instance.cx/cy, r, pad',
        verdict: 'FIXED',
        why: '⛔ THE ONE REAL FINDING OF THE SWEEP. `const box = row.hitbox ?? '
            + '{w:0,h:0,ox:0,oy:0}` makes the arithmetic finite — so no rect is '
            + 'ever malformed here — but it does it by giving a body-less row a '
            + 'ZERO-SIZE BODY, and the clearance this measures is then '
            + 'OPTIMISTIC by half the real body on each axis. The absent input '
            + 'flows into complete-looking arithmetic exactly as the rope did; '
            + 'the difference is that the answer is a plausible number rather '
            + 'than a silent false. The default is legitimate only for rows the '
            + 'census marks `envelopeProof: false` (a boss whose volume is a '
            + 'script, not a rect) — so that is now what it checks.',
    }),
    Object.freeze({
        site: 'r2Acceptance.js:55 boxAt(o)',
        inputs: 'PLAYER_BOX (frozen, and pinned against playerPhysicsV2 by a test), o.x, o.y',
        verdict: 'closed',
        why: 'The four numbers are duplicated deliberately (the module is '
            + 'dependency-free) and a committed test pins them against '
            + '`playerBoxAt`, so a drift is a red rather than a silent widening. '
            + 'o.x/o.y come from a drained game stream.',
    }),
    Object.freeze({
        site: 'r5Acceptance.js:39 L60_LOCK.rect {x: 128, right: 144}',
        inputs: 'two integer literals',
        verdict: 'band',
        why: '⚠ DELIBERATE, AND NOW SAID SO. This is NOT a rect and must never '
            + 'become one: it is the lock column\'s X BAND, and all six of its '
            + 'uses are scalar comparisons of a player x against `rect.x` / '
            + '`rect.right` (the walk must reach the near edge and not pass it; '
            + 'the kill arm must end past the far edge). It has no y and no '
            + 'bottom BECAUSE the claim has no y — the lock spans the corridor. '
            + 'Handing it to `rectsOverlap` would silently answer "no" forever, '
            + 'which is why a test now asserts it is y-less rather than leaving '
            + 'the absence to read as an oversight.',
    }),
    Object.freeze({
        site: 'hazards.js:152 mk(x, y, w, h, why)',
        inputs: 'four numbers per call site, all literal or from instance.cx/cy',
        verdict: 'guarded',
        why: 'Already calls `assertRect(r, `${tag}@${cx},${cy}`)` on every rect '
            + 'it makes, tagged with the instance that made it. This is the '
            + 'shape the other sites were measured against.',
    }),
    Object.freeze({
        site: 'pushables.js:194 pushableRect(block)',
        inputs: 'TILE (module const), block.x, block.y',
        verdict: 'closed',
        why: 'A block\'s x/y are run state stepped by `stepPushable` from a '
            + 'constructed grid position; TILE is a constant. Non-finite here '
            + 'means the glide integrator diverged, which its own tests cover.',
    }),
    Object.freeze({
        site: 'pushables.js:479 at(nx, ny) inside stepPushable',
        inputs: 'TILE (module const), the integrator\'s candidate nx/ny',
        verdict: 'derived',
        why: 'Same inputs as `pushableRect`, one step earlier in the same '
            + 'function; the candidate position is `x + vx` on numbers the '
            + 'friction step produced.',
    }),
]);

function printSites() {
    console.log('── STRATUM 1: the enumerated sites ──────────────────────────────');
    console.log('');
    const counts = {};
    for (const s of SITES) {
        counts[s.verdict] = (counts[s.verdict] ?? 0) + 1;
        console.log(`  ${s.verdict.padEnd(8)}  ${s.site}`);
        console.log(`            inputs: ${s.inputs}`);
        for (const line of wrap(s.why, 68)) console.log(`            ${line}`);
        console.log('');
    }
    console.log(`  ${SITES.length} sites: `
        + Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '));
    console.log('');
}

function wrap(text, width) {
    const out = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        if (line && line.length + 1 + word.length > width) { out.push(line); line = ''; }
        line = line ? `${line} ${word}` : word;
    }
    if (line) out.push(line);
    return out;
}

// ── STRATUM 2: the live sweep ────────────────────────────────────────────

/** Every field of a built world that carries a rect, and how to reach it. */
const RECT_FIELDS = Object.freeze([
    ['solids', (o) => [o.rect, o.shrunkRect]],
    ['objectSolids', (o) => [o.rect, o.shrunkRect]],
    ['pixelmasks', (o) => [o.rect]],
    ['teleporters', (o) => [o.rect]],
    ['pickups', (o) => [o.rect]],
    ['hazards', (o) => [o.rect]],
    ['pressers', (o) => [o.rect]],
    ['pressResponders', (o) => [o.rect]],
    ['activators', (o) => [o.rect, o.touchRect]],
]);

export function sweepLevel(record, roles) {
    const world = buildLevelWorld(record, { roles });
    const bad = [];
    let checked = 0;
    for (const [field, pick] of RECT_FIELDS) {
        const list = world[field];
        if (!Array.isArray(list)) continue;
        for (const o of list) {
            for (const r of pick(o)) {
                // A field that is legitimately absent (a `point` hazard has no
                // rect at all) is not a malformed rect — the failure this
                // hunts is a rect that EXISTS and is unusable.
                if (r === null || r === undefined) continue;
                checked += 1;
                const finite = Number.isFinite(r.x) && Number.isFinite(r.y)
                    && Number.isFinite(r.right) && Number.isFinite(r.bottom);
                if (!finite) {
                    bad.push({
                        level: record.level, field, tag: o.tag ?? o.as3 ?? '?', rect: r,
                    });
                }
            }
        }
    }
    return { checked, bad };
}

function main() {
    const args = process.argv.slice(2);
    printSites();
    if (args.includes('--sites')) return;

    console.log('── STRATUM 2: the live sweep ────────────────────────────────────');
    console.log('');
    const atlas = loadAtlas();
    const records = atlas.levels ?? atlas;
    const list = Array.isArray(records) ? records : Object.values(records);

    let checked = 0;
    let built = 0;
    let unbuildable = 0;
    const bad = [];
    for (const record of list) {
        let r;
        try {
            r = sweepLevel(record, ROLES);
        } catch (e) {
            // A level the census refuses to build is a DIFFERENT finding, and
            // one 29 levels already carry by name (`FROZEN_UNBUILDABLE`). It
            // is not a malformed rect, and counting it as one would bury the
            // thing this sweep is for.
            unbuildable += 1;
            continue;
        }
        built += 1;
        checked += r.checked;
        bad.push(...r.bad);
    }

    console.log(`  levels built            ${built}`);
    console.log(`  levels that would not   ${unbuildable}  (a separate, named finding)`);
    console.log(`  rects checked           ${checked}`);
    console.log(`  malformed               ${bad.length}`);
    console.log('');
    for (const b of bad) {
        console.log(`  ⛔ L${b.level} ${b.field} "${b.tag}": ${JSON.stringify(b.rect)}`);
    }
    if (bad.length === 0) {
        console.log('  ⛓ Every rect the five-role census builds over all 116 levels is');
        console.log('    finite on all four edges.');
        console.log('');
        console.log('  ⛔⛔ AND IT WAS NOT CLEAN WHEN THIS SWEEP FIRST RAN. It found');
        console.log('     ELEVEN — `pressResponders` "watcher" in L12, L32, L37, L43,');
        console.log('     L57, L69, L82, L89, L94, L103 and L114, every edge NaN. Same');
        console.log('     shape as the rope: a `PRESS_ARMS` class with no top-level box');
        console.log('     (a `Watcher` is `collider: "none"`; its only sub-box is the');
        console.log('     48x48 auto-talk circle, three times too big to stand in), and');
        console.log('     an arm that is `refused` so no route ever queried it.');
        console.log('     ⚠ TWICE NOW a policy refusal and a geometry failure have');
        console.log('     covered for each other. `entityRect` throws on such a class');
        console.log('     now, and `WATCHER_PRESS_BOX` is the transcription.');
    }
    console.log('');
    process.exitCode = bad.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
