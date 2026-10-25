// seedling-fidelity-l67bk4 — THE SOLVER'S OWN PLAN for a captured leg, its switch ON, played on the GAME.
// (BEAMLANE's `witness.mjs`, generalised: the leg, the switch env and the goal are arguments.)
// Per arrival clock: the captured request 0 (the 640-unit first ask) staged at that clock is solved with `--env` set; the
// plan's keys are folded into a tape (`buildStagedTape`, the request's own staging) and replayed on the model (`runTape`)
// and on the game (p4g, headless logic-only, a fresh page per tape). Rows: the solve's work ≤ 640; the model ends with
// zero hits (and on `--to=<level>` when given); the game's stream equals the model's (x, y, level per row: 0 px); the
// game's own hit count stays 0 and (`--key=<n>`) its save holds Boss Key n at the end.
// Usage: SEEDLING_PORT=9737 node witness.mjs --capture=<jsonl[.gz]> --id=<leg> --env=SEEDLING_LANE_WEIGH=1
//        [--seams=<abs,..> | --dseams=<-3,0,3>] [--to=<level>] [--key=<n>] [--record=<json>] [--model-only]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const R = new URL('../../../../', import.meta.url).pathname;
const MODULE = R + 'frontend/modules/seedlingDemo/';
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const capture = arg('capture');
const LEG = arg('id');
const TO = arg('to') !== undefined ? Number(arg('to')) : null;
const KEY = arg('key') !== undefined ? Number(arg('key')) : null;
for (const kv of (arg('env') ?? '').split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    process.env[k] = v;
}
const RECORD = arg('record') ?? '';
const MODEL_ONLY = process.argv.includes('--model-only');
const FRESH_SLOTS = !process.argv.includes('--keep-slots');
/**
 * ⛓ THE DELIVERED SET (default ON; `--vanilla-set` turns it off). A fresh page plays the game's own 116 rooms; the
 * sweep's page plays the AP-delivered set, whose randomized locations are `<apitem>`s (L43's Wand, L67's Boss Key 4).
 * The model solved against the request's own records, so the page is handed the same rooms: the vanilla record set
 * (`levelSetExporter.vanillaRecordSet`) with each room's record replaced by the request's, delivered through
 * `botLoadLevels` before the tape (`probe-seedling-f2-apitem.mjs`' order). The replaced rooms are checked to
 * re-assemble to the request's records exactly.
 */
const DELIVER = !process.argv.includes('--vanilla-set');
const host = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;

const { CONTACT_FIDELITY } = await import(MODULE + 'contactFidelity.js');
console.log(`CONTACT: ${Object.keys(CONTACT_FIDELITY).filter((k) => CONTACT_FIDELITY[k]).length} ON; env ${arg('env') ?? ''}`);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(MODULE + 'atlasSource.js');
const { solveAnytime } = await import(MODULE + 'jsRuntimeSolver.js');
const { parseTape, gameVisibleTape } = await import(MODULE + 'tapeFormat.js');
const { buildStagedTape } = await import(MODULE + 'botDriverV1.js');
const { runTape } = await import(MODULE + 'tapeRunner.js');
const { tapeEquips } = await import(MODULE + 'wasmPlayback.js');

const raw = readFileSync(capture);
const cap = (capture.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8').trim().split('\n').map((l) => JSON.parse(l))
    .find((d) => LEG === undefined || String(d.id) === LEG);
const req0 = cap.requests.find((r) => r.i === 0).request;
const at = req0.staging.seam.time;
const seams = arg('seams') ? arg('seams').split(',').map(Number)
    : (arg('dseams') ?? '0').split(',').map((d) => at + Number(d));
let failed = 0;
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed += 1;
};
let DELIVERED = null;
if (DELIVER) {
    const { vanillaRecordSet } = await import(MODULE + 'levelSetExporter.js');
    const { mountedRecordsOf } = await import(MODULE + 'wasmWalkTape.js');
    const readJson = (rel) => JSON.parse(readFileSync(R + rel, 'utf8'));
    const base = vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        readJson('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
    const recs = restoreRequest(req0).source.records;
    const set = { ...base, rooms: base.rooms.map((room) => (recs.has(room.id) ? { ...room, source: { record: recs.get(room.id) } } : room)) };
    const back = mountedRecordsOf(set);
    const level = req0.staging.boot.level;
    if (JSON.stringify(back.get(level)) !== JSON.stringify(recs.get(level))) throw new Error(`the delivered L${level} does not re-assemble to the request's record`);
    DELIVERED = set;
    console.log(`DELIVER: ${set.rooms.length} rooms, ${[...recs.keys()].length} from the request; L${level} re-assembles exactly`);
}
const rows = [];
for (const seam of seams) {
    const { passes, source, ...tape } = restoreRequest(atSeamTime(req0, seam));
    // ⚠ A FRESH GAME PAGE BUILDS ITS SLOTS FROM THE SAVE (`slotsForFreshGame`, item-id order); the sweep's page held them
    // in ACQUISITION order (`inventory_slots`, staging-only — no tape field carries it). So the witness solves with the
    // staged order dropped: the run then derives the order the fresh page will have, and the plan's `equips` name the
    // slots that page holds. Only a slot index moves; the fight and the walk are the same requests.
    if (FRESH_SLOTS) delete tape.staging.inventory_slots;
    const levelSource = levelSourceFromAtlas(source.records);
    const a = solveAnytime({ ...tape, source, levelSource }, { passes });
    check(`seam ${seam}: the 640-unit request solves ON`, a.ok && a.work <= 640, `work ${a.work}`);
    if (!a.ok) continue;
    const perTick = a.plan.solution.map((k) => new Set(k));
    const t = parseTape({ ...buildStagedTape({ staging: { ...tape.staging, equips: tapeEquips(a.plan.equipsAt) }, perTick, name: `l67bk4-${cap.id}-${seam}` }),
        description: `seedling-fidelity-l67bk4: the solver's own plan for leg ${cap.key}, ${arg('env')}, at `
            + `seam.time ${seam}. Authored by CC/docs/cloud-reports/seedling-fidelity-l67bk4-evidence/witness.mjs.` });
    const replay = runTape(t, { levelSource });
    const model = replay.ticks;
    const modelTo = (replay.transitions ?? []).at(-1)?.to_level ?? null;
    const modelHits = (replay.playerHits ?? []).length;
    console.log(`seam ${seam}: work ${a.work}, plan ${perTick.length} t, verbs ${JSON.stringify(a.plan.verbs)}; model rows `
        + `${model.length}, ends L${modelTo}, hits ${modelHits}`);
    check(`seam ${seam}: the plan replays on the model with zero hits${TO !== null ? ` to L${TO}` : ''}`,
        (TO === null || modelTo === TO) && !modelHits);
    rows.push({ seam, work: a.work, planTicks: perTick.length, verbs: a.plan.verbs, modelRows: model.length, modelTo,
        modelHits, tape: t, model });
}
if (!MODEL_ONLY) {
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(R + `frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`)) throw new Error(`${PAGE_NAME} not staged`);
    const PAGE_URL = `${host}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    const { takeBoxLockOrExit } = await import(R + 'scripts/procgen/boxLock.js');
    takeBoxLockOrExit({ name: 'seedling-fidelity-l67bk4-evidence/witness.mjs', kind: 'browser' });
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
            if (DELIVERED) {
                const { planLevelSetChunks } = await import(MODULE + 'levelSetValidator.js');
                const answers = [];
                for (const c of planLevelSetChunks(DELIVERED).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
                if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            }
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
            const gameTo = TO !== null && game.ticks.some((o) => o.level === TO) ? TO : game.ticks.at(-1)?.level ?? null;
            row.game = { rows: game.ticks.length, to: gameTo, levels, firstDiff, error: game.status.error || '',
                gameAt: game.ticks[firstDiff] ?? null, modelAt: model[firstDiff] ?? null };
            console.log(`seam ${row.seam}: game ${game.ticks.length} rows, levels ${JSON.stringify(levels)}, first differing `
                + `row ${firstDiff}`);
            if (process.env.WITNESS_DUMP) {
                const [lo, hi] = process.env.WITNESS_DUMP.split('..').map(Number);
                for (let i = lo; i <= hi; i += 1) console.log(`DUMP ${i} game ${JSON.stringify(game.ticks[i])} model ${JSON.stringify(model[i])}`);
                console.log(`DUMP status ${JSON.stringify(game.status)}`);
            }
            row.game.hits = game.status.hits ?? null;
            row.game.end = { items: game.status.items ?? null, cleared: game.status.persistence_cleared ?? null,
                grants: game.status.grants ?? null, level: game.status.level, x: game.status.x, y: game.status.y };
            console.log(`seam ${row.seam}: game end ${JSON.stringify(row.game.end).slice(0, 600)}`);
            row.game.keys = game.status.save?.keys ?? null;
            console.log(`seam ${row.seam}: game status hits ${JSON.stringify(game.status.hits)}, save.keys `
                + `${JSON.stringify(game.status.save?.keys)}, error '${game.status.error || ''}'`);
            check(`seam ${row.seam}: the GAME plays the solver's plan${TO !== null ? ` to L${TO}` : ''} with no error`,
                (TO === null || gameTo === TO) && !row.game.error);
            check(`seam ${row.seam}: the game took no hit`, !game.status.hits, `hits ${JSON.stringify(game.status.hits)}`);
            if (KEY !== null) {
                check(`seam ${row.seam}: the game's save holds Boss Key ${KEY}`,
                    (game.status.save?.keys ?? []).includes(KEY), JSON.stringify(game.status.save?.keys));
            }
            check(`seam ${row.seam}: the game's stream equals the model's (0 px)`, firstDiff < 0, `first differing row ${firstDiff}`);
        }
    } finally {
        await browser.close();
    }
}
if (RECORD) writeFileSync(RECORD, `${JSON.stringify(rows.map(({ tape, model, ...r }) => r), null, 2)}\n`);
console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
