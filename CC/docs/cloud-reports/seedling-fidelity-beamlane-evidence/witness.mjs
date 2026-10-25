// seedling-fidelity-beamlane D2 — THE SOLVER'S OWN PLAN for leg 785 (L107), `beamLaneWalk` ON, played on the GAME.
// Per arrival clock: the captured request 0 (the 640-unit first ask) staged at that clock is solved ON; the plan's keys
// are folded into a tape (`buildStagedTape`, the request's own staging) and replayed on the model (`runTape`) and on the
// game (p4g, headless logic-only, a fresh page per tape). Rows: the solve's work ≤ 640; the model reaches L102 with zero
// hits; the game reaches L102; the game's stream equals the model's (x, y, level per row: 0 px).
// Usage: SEEDLING_PORT=9733 node witness.mjs [--seams=a,b,..] [--capture=<jsonl.gz>] [--record=<json>] [--model-only]
// The game half is `scripts/procgen/probe-seedling-l107-lane.mjs`'s loop (js `seedling-js-l107-investigate`), verbatim.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const R = new URL('../../../../', import.meta.url).pathname;
const MODULE = R + 'frontend/modules/seedlingDemo/';
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const seams = (arg('seams') ?? '5564,5580,5594,5599,5605,5612,5622,5640,5643,5652,5656').split(',').map(Number);
const capture = arg('capture') ?? (MODULE + 'fixtures/beamlane-witness/cap785.jsonl.gz');
const RECORD = arg('record') ?? '';
const MODEL_ONLY = process.argv.includes('--model-only');
const host = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;

process.env.SEEDLING_BEAM_LANE_WALK = '1';
const { CONTACT_FIDELITY } = await import(MODULE + 'contactFidelity.js');
if (CONTACT_FIDELITY.beamLaneWalk !== true) throw new Error('beamLaneWalk is not ON');
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(MODULE + 'atlasSource.js');
const { solveAnytime } = await import(MODULE + 'jsRuntimeSolver.js');
const { parseTape, gameVisibleTape } = await import(MODULE + 'tapeFormat.js');
const { buildStagedTape } = await import(MODULE + 'botDriverV1.js');
const { runTape } = await import(MODULE + 'tapeRunner.js');

const raw = readFileSync(capture);
const cap = JSON.parse((capture.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8').trim().split('\n')[0]);
let failed = 0;
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed += 1;
};
const rows = [];
for (const seam of seams) {
    const { passes, source, ...tape } = restoreRequest(atSeamTime(cap.requests.find((r) => r.i === 0).request, seam));
    const levelSource = levelSourceFromAtlas(source.records);
    const a = solveAnytime({ ...tape, source, levelSource }, { passes });
    check(`seam ${seam}: the 640-unit request solves ON`, a.ok && a.work <= 640, `work ${a.work}`);
    if (!a.ok) continue;
    const perTick = a.plan.solution.map((k) => new Set(k));
    const t = parseTape({ ...buildStagedTape({ staging: tape.staging, perTick, name: `beamlane-785-${seam}` }),
        description: `seedling-fidelity-beamlane D2: the solver's own plan for leg 785 (L107), beamLaneWalk ON, at `
            + `seam.time ${seam}. Authored by CC/docs/cloud-reports/seedling-fidelity-beamlane-evidence/witness.mjs.` });
    const replay = runTape(t, { levelSource });
    const model = replay.ticks;
    const modelTo = (replay.transitions ?? []).at(-1)?.to_level ?? null;
    const modelHits = (replay.playerHits ?? []).length;
    console.log(`seam ${seam}: work ${a.work}, plan ${perTick.length} t, verbs ${JSON.stringify(a.plan.verbs)}; model rows `
        + `${model.length}, ends L${modelTo}, hits ${modelHits}`);
    check(`seam ${seam}: the plan replays to L102 on the model with zero hits`, modelTo === 102 && !modelHits);
    rows.push({ seam, work: a.work, planTicks: perTick.length, verbs: a.plan.verbs, modelRows: model.length, modelTo,
        modelHits, tape: t, model });
}
if (!MODEL_ONLY) {
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(R + `frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`)) throw new Error(`${PAGE_NAME} not staged`);
    const PAGE_URL = `${host}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    const { takeBoxLockOrExit } = await import(R + 'scripts/procgen/boxLock.js');
    takeBoxLockOrExit({ name: 'seedling-fidelity-beamlane-evidence/witness.mjs', kind: 'browser' });
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import(R + 'scripts/procgen/headlessChromium.js');
    const { assertLogicOnlyChannel } = await import(R + 'scripts/procgen/seedlingChannel.js');
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let proved = false;
    const call = (page, name, x) => page.evaluate(([n, v]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[n] !== 'function') return null;
        return v === undefined ? g[n]() : g[n](v);
    }, [name, x]);
    const json = async (page, name, x) => JSON.parse(await call(page, name, x));
    const waitFor = async (page, what, fn, ms = 300000) => {
        const t0 = Date.now();
        for (;;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(200);
        }
    };
    const play = async (tape) => {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)));
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            const started = await call(page, 'botStart');
            if (started !== 'ok') throw new Error(`botStart: ${started}`);
            const ticks = [];
            const status = await waitFor(page, 'the latch', async () => {
                ticks.push(...(await json(page, 'botDrain')).ticks);
                const st = await json(page, 'botStatus');
                return st.finished ? st : null;
            });
            ticks.push(...(await json(page, 'botDrain')).ticks);
            return { status, ticks };
        } finally {
            await page.close();
        }
    };
    try {
        for (const row of rows) {
            const game = await play(row.tape);
            const { model } = row;
            const firstDiff = game.ticks.findIndex((o, i) => model[i]
                && (o.level !== model[i].level || o.x !== model[i].x || o.y !== model[i].y));
            const levels = [...new Set(game.ticks.map((o) => o.level))];
            const gameTo = game.ticks.some((o) => o.level === 102) ? 102 : game.ticks.at(-1)?.level ?? null;
            row.game = { rows: game.ticks.length, to: gameTo, levels, firstDiff, error: game.status.error || '',
                gameAt: game.ticks[firstDiff] ?? null, modelAt: model[firstDiff] ?? null };
            console.log(`seam ${row.seam}: game ${game.ticks.length} rows, levels ${JSON.stringify(levels)}, first differing `
                + `row ${firstDiff}`);
            check(`seam ${row.seam}: the GAME reaches L102 on the solver's plan`, gameTo === 102 && !row.game.error);
            check(`seam ${row.seam}: the game's stream equals the model's (0 px)`, firstDiff < 0, `first differing row ${firstDiff}`);
        }
    } finally {
        await browser.close();
    }
}
if (RECORD) writeFileSync(RECORD, `${JSON.stringify(rows.map(({ tape, model, ...r }) => r), null, 2)}\n`);
console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
