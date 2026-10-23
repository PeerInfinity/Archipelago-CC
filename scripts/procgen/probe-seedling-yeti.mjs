#!/usr/bin/env node
/**
 * Seedling's YETI, ON THE GAME (fidelity YETI D1; `CONTACT_FIDELITY.yetiTalk`).
 *
 * L58 (DeadBoss.oel) holds `yeti@56,56` (tag 0, five pages, `frames="3"`) and `teleporter@80,16` → L46 (tag 1,
 * shut on a fresh room: `Teleporter.checkDeactivated()`, `tag >= 0 && (!checkPersistence(tag) == invert)`). The
 * door's ONLY writer is the Yeti:
 *
 *     NPCs/Yeti.as:40-50   doneTalking(): super.doneTalking(); if (!createdPortal) { createdPortal = true;
 *                          Game.setPersistence(tag, false); Game.setPersistence(1, false); }
 *     NPCs/NPC.as:250-263  set talking(false) → doneTalking(): the pages exhausted (`:207-214`) OR the circle left
 *                          (`:230-236`)
 *     Teleporter.as:89-94  update(): checkDeactivated() EVERY frame — so the door opens in the SAME visit
 *     NPCs/NPC.as:119-126  check(): a cleared tag removes the NPC — on a new `Game` only (the revisit)
 *
 * Tapes, each on a FRESH page, staged as `watcher-l114-talk` is (`r8-solve-11`'s committed block) re-pointed at the
 * Tentacled Beast's mouth arrival in L58, `new Game(58, 56, 96)` (`levelRun`'s `TENTACLE_MOUTH_TO`), plus `canSwim`
 * (the room is water but for a four-tile island under the Yeti and the door's ledge):
 *   talk      the solver's clear-tag `{58,1}` on `yeti@56,56` (`yetiTalk` ON): a stance in the circle, the ceremony
 *             cadence until `doneTalking()`, settle — then a straight walk onto the door (its tile is a Pit, so the
 *             tape also says which of the door and the pit the game takes on this approach) and 10 ticks in L46
 *   control   the same walk to the stance and the first TWO releases of the cadence (open + one page), then the
 *             tape ends with the dialogue still open: both flags stay set, the door stays shut
 *   revisit   `{58,0}` and `{58,1}` cleared at the boot: no Yeti (walk straight up through its old Solid) and the
 *             door live — onto it and 10 ticks in L46
 *
 * The model replays each tape with `yetiTalk` ON; its stream is compared to the game's tick by tick, and the game's
 * `persistence_cleared` is read for `{58,0}` / `{58,1}`. Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and
 * `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. `--out=<dir>` writes one witness file per tape (the tape, the game's
 * stream, its clears). Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm
 * build, or SKIP. Takes the box lock. Headless LOGIC-ONLY.
 *
 * Run: node scripts/procgen/probe-seedling-yeti.mjs [--host=http://localhost:8000] [--out=<dir>] [--only=talk,…]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { watcherStaging } from './plan-seedling-watcher-witness.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The mouth's arrival (`new Game(58, 56, 96)`), the Yeti, the door. */
export const YETI_BOOT = Object.freeze({ level: 58, x: 56, y: 96 });
export const YETI_ID = 'yeti@56,56';
export const YETI_DOOR = Object.freeze({ x: 80, y: 16, to: 46 });
/** The clear-tag the JS arc / rules-2 will hand the solver (the AP talk event on `level_58__r1c4 -> level_46__r6c24`). */
export const YETI_CLEAR = Object.freeze({ kind: 'clear-tag', tag: { level: 58, tag: 1 }, at: { x: 56, y: 56 },
    obstacle: YETI_ID });
const AFTER_CROSSING = 10;

const M = (p) => import(join(MODULE, p));

/** The staging: `r8-solve-11`'s block at the mouth's arrival, `canSwim`, and `clears` (the revisit's). */
export async function yetiStaging(clears = []) {
    return watcherStaging({ boot: { ...YETI_BOOT }, keys: [], items: ['canSwim'], clears });
}

/** Axis keys toward `to`, one tick: the straight walk the tapes append (no planner: the door is a Pit tile). */
function towards(state, to) {
    const keys = [];
    if (Math.abs(to.x - state.x) > 1) keys.push(to.x > state.x ? 'right' : 'left');
    if (Math.abs(to.y - state.y) > 1) keys.push(to.y > state.y ? 'down' : 'up');
    return keys;
}

/** Drive `run` toward the door's centre until it crosses, then `AFTER_CROSSING` idle ticks. Appends to `perTick`. */
function walkOntoDoor(run, perTick, max = 400) {
    const centre = { x: YETI_DOOR.x + 8, y: YETI_DOOR.y + 8 };
    for (let i = 0; i < max; i += 1) {
        const held = new Set(towards(run.state, centre));
        perTick.push(held);
        if (run.advance(held).transition) {
            for (let k = 0; k < AFTER_CROSSING; k += 1) { perTick.push(new Set()); run.advance(new Set()); }
            return true;
        }
    }
    return false;
}

/**
 * The three tapes, each `{staging, perTick}`, derived from the model with `yetiTalk` ON (the solver's clear-tag for
 * `talk`; its stance walk + two cadence ticks for `control`; a straight walk for `revisit`). Exported for the unit rows.
 */
export async function yetiTapes() {
    const { createRunForStaging } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { solveSegment } = await M('solverBot.js');
    const { withContactFidelity } = await M('contactFidelity.js');
    const levelSource = atlasLevelSource();
    return withContactFidelity({ yetiTalk: true }, async () => {
        const out = {};
        // ── talk: the solver's clear-tag, then onto the door ─────────────
        {
            const staging = await yetiStaging();
            const solved = solveSegment({ run: createRunForStaging(staging, levelSource), goals: [YETI_CLEAR],
                name: 'yeti-l58-talk', boot: staging.boot });
            const run = createRunForStaging(staging, levelSource);
            const perTick = solved.perTick.map((h) => new Set(h));
            for (const h of perTick) run.advance(h);
            if (!walkOntoDoor(run, perTick)) throw new Error('yeti talk: the walk never crossed the door');
            out.talk = { staging, perTick, records: solved.records };
        }
        // ── control: the talk tape up to the open and ONE page more, then still: the dialogue stays open ──
        {
            const staging = await yetiStaging();
            const run = createRunForStaging(staging, levelSource);
            const perTick = [];
            const opened = () => (run.ledger('yetiEvents') ?? []).some((r) => r.what === 'yeti-open');
            let pagedAfterOpen = 0;
            let prev = new Set();
            for (const h of out.talk.perTick) {
                if (opened() && prev.has('primary') && !h.has('primary')) pagedAfterOpen += 1;
                if (pagedAfterOpen >= 1 && !h.has('primary')) break;
                const held = new Set(h);
                perTick.push(held);
                run.advance(held);
                prev = held;
            }
            for (let i = 0; i < 20; i += 1) { perTick.push(new Set()); run.advance(new Set()); }
            if ((run.ledger('yetiEvents') ?? []).some((r) => r.what === 'yeti-close')) {
                throw new Error('yeti control: the dialogue closed — the control must end with it open');
            }
            out.control = { staging, perTick };
        }
        // ── shut: no talk — the talk tape's walk to the stance, then the same straight walk onto the (shut) door ──
        {
            const staging = await yetiStaging();
            const run = createRunForStaging(staging, levelSource);
            const perTick = [];
            for (const h of out.talk.perTick) {
                if (h.has('primary')) break;
                const held = new Set(h);
                perTick.push(held);
                run.advance(held);
            }
            const centre = { x: YETI_DOOR.x + 8, y: YETI_DOOR.y + 8 };
            let left = null;
            for (let i = 0; i < 400 && left === null; i += 1) {
                const held = new Set(towards(run.state, centre));
                perTick.push(held);
                const r = run.advance(held);
                if (r.transition) left = r.transition;
                else if (Math.abs(run.state.x - centre.x) <= 1 && Math.abs(run.state.y - centre.y) <= 1) break;
            }
            for (let k = 0; k < 60; k += 1) { perTick.push(new Set()); run.advance(new Set()); }
            out.shut = { staging, perTick };
        }
        // ── revisit: both flags cleared at the boot ──────────────────────
        {
            const staging = await yetiStaging([{ level: 58, tag: 0 }, { level: 58, tag: 1 }]);
            const run = createRunForStaging(staging, levelSource);
            const perTick = [];
            // Straight up through the Yeti's old Solid ((59,58)-(69,70)) to y 40, then onto the door.
            for (let i = 0; i < 200 && run.state.y > 40; i += 1) { const h = new Set(['up']); perTick.push(h); run.advance(h); }
            if (!walkOntoDoor(run, perTick)) throw new Error('yeti revisit: the walk never crossed the door');
            out.revisit = { staging, perTick };
        }
        return out;
    });
}

/** A witness tape, as the game and `runTape` read it. */
export async function yetiTape(name, { staging, perTick }) {
    const { buildStagedTape } = await M('botDriverV1.js');
    const { parseTape, PIN_NAMES } = await M('tapeFormat.js');
    const built = buildStagedTape({ staging, perTick, name: `yeti-l58-${name}` });
    return parseTape({ ...built, pins: [...PIN_NAMES],
        description: `probe-seedling-yeti: ${name} (fidelity YETI D1; \`CONTACT_FIDELITY.yetiTalk\` ON for the model)` });
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const OUT = arg('out', null);
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { mountedRecordsOf } = await M('wasmWalkTape.js');
    const { levelSourceFromAtlas } = await M('atlasSource.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { runTape } = await M('tapeRunner.js');
    const { withContactFidelity } = await M('contactFidelity.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    const levelSource = levelSourceFromAtlas(mountedRecordsOf(set));
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);
    const tapes = await yetiTapes();

    takeBoxLockOrExit({ name: 'probe-seedling-yeti.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const call = (page, n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const json = async (page, n, a) => { const r = await call(page, n, a); return r === null ? null : JSON.parse(r); };
    const waitFor = async (page, what, fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(250);
        }
    };
    const logs = [];
    const run = async (tape) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            await assertLogicOnlyChannel(page);
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = await json(page, 'botLevelSet');
            if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 10 * 60 * 1000);
            const drained = await json(page, 'botDrain');
            return { status, mounted, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    const drift = (a, b) => {
        let max = 0;
        let first = null;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const d = !a[i] || !b[i] || a[i].level !== b[i].level ? Infinity
                : Math.max(Math.abs(a[i].x - b[i].x), Math.abs(a[i].y - b[i].y));
            if (d > 1e-9 && first === null) first = { t: (a[i] ?? b[i]).t, game: b[i] ?? null, model: a[i] ?? null };
            if (d > max) max = d;
        }
        return { max: Number.isFinite(max) ? max : 'level-or-length', first };
    };
    const rows = [];
    try {
        const only = arg('only', null)?.split(',');
        for (const [name, t] of Object.entries(tapes)) {
            if (only && !only.includes(name)) continue;
            const tape = await yetiTape(name, t);
            const g = await run(tape);
            const mOut = withContactFidelity({ yetiTalk: true }, () => runTape(tape, { levelSource }));
            const m = mOut.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level }));
            const cleared = (g.status.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`)
                .filter((k) => k.startsWith('58:'));
            const crossedAt = (ticks) => ticks.find((o) => o.level === YETI_DOOR.to)?.t ?? null;
            const row = {
                tape: name, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
                game: { cleared58: cleared, crossedAt: crossedAt(g.ticks), final: g.ticks.at(-1) ?? null },
                model: { yetiFlags: mOut.yetiFlags, yetiEvents: mOut.yetiEvents, crossedAt: crossedAt(m),
                    ...drift(m, g.ticks) },
            };
            rows.push({ row, tape, game: g.ticks });
            console.log(`ROW ${JSON.stringify(row)}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id,
                `${g.ticks.length} obs, ${g.mounted?.active}`);
            if (name === 'talk') {
                check('talk: the game cleared BOTH {58,0} and {58,1}', cleared.includes('58:0') && cleared.includes('58:1'),
                    JSON.stringify(cleared));
                check('talk: the game crosses the tag-1 door to L46 in the SAME visit', row.game.crossedAt !== null,
                    `crossed at t${row.game.crossedAt}`);
            } else if (name === 'shut') {
                check('shut: untalked, the game kept {58,0} and {58,1}', cleared.length === 0, JSON.stringify(cleared));
                check('shut: untalked, the game does NOT cross the tag-1 door to L46', row.game.crossedAt === null,
                    `final ${JSON.stringify(row.game.final)}`);
            } else if (name === 'control') {
                check('control: with the dialogue still open, the game kept {58,0} and {58,1}', cleared.length === 0,
                    JSON.stringify(cleared));
            } else {
                check('revisit: with both flags cleared at the boot, the game walks through the Yeti\'s cell and '
                    + 'crosses the door', row.game.crossedAt !== null, `crossed at t${row.game.crossedAt}`);
            }
            check(`${name}: the model (yetiTalk ON) reproduces the game at 0 px`, row.model.max === 0,
                JSON.stringify({ max: row.model.max, first: row.model.first }));
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    if (OUT) {
        mkdirSync(OUT, { recursive: true });
        for (const r of rows) {
            writeFileSync(join(OUT, `yeti-l58-${r.row.tape}.json`),
                `${JSON.stringify({ ...r.row, tape: r.tape, gameTicks: r.game }, null, 1)}\n`);
        }
        console.log(`wrote ${rows.length} witness file(s) to ${OUT}`);
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
