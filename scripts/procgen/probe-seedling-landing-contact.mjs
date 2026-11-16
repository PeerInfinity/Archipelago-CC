#!/usr/bin/env node
/**
 * Seedling LANDING CONTACT, THE GAME'S WAY (rules `rules-landing-contact-census`). Every landing the
 * `seedling_playthrough` rules put a player on (each sub-region exit's `resolveArrivalSpawn`, the enumeration
 * `probe-seedling-lethal-landings.mjs` uses) is screened on the model for a hostile body whose contact box the
 * player's box overlaps, or comes within one tick's reach of, at its spawn (`seedlingLandingContact.js`, the pure
 * half: the bodies and their boxes come from the delivered map document and `combat.ENEMY_CLASSES`, never typed).
 * Every screen hit — and every `--near` control row, a mover whose box gap is under `--near` px — is then booted on
 * the wasm game exactly as a door does it, `new Game(level, x, y)` (the tape's `boot`), on the DELIVERED set
 * (`levelSetExporter.vanillaRecordSet`'s own default, mounted by `botLoadLevels`), with no items:
 *   idle, and each held direction (up/down/left/right), for `--ticks`.
 * Between inputs that end in the landing's level the page is PRIMED (2 ticks booted in another level): the game's hit
 * count survives a re-boot into the same level and resets only on a level change, so without it an input inherits the
 * previous one's hits.
 * Per input the row records: the first hit's tick (`seedlingHitTicks` clock: tick + hits_timer − 20 + 1, read off
 * `botStatus` before the level changes; the game resets `hits` on a level change), whether the player LEFT the
 * level and when (a knockback through the arrival door is an ejection), and restart episodes (`dead_frames`).
 * ⚖ An ARRIVAL HIT = every input takes a hit, or is thrown out of the level, before it can do anything else; a
 * landing where some input stays hit-free is escapable and is reported, not flagged.
 * `botStatus` does not name the attacker, so each input also runs on the physics MODEL (the same boot, the delivered
 * map, `fidelityArrival.arrivalStaging`): its first hit's tick and SOURCE ride beside the game's verdict (`model`), so a
 * terrain hit (lava, water, a spike) is told apart from a body's.
 *
 * The CHASE tier rides along: a homer faster than the player, awake at the boot (`seedlingLandingContact.js`). Its rows
 * are booted the same way; one where no input stays clear (each is hit, dies in what it walks into, or leaves) is
 * printed as a `FINDING:` row (`hasNoCleanInput`).
 *
 * Checks: every screen hit (contact at the boot) that some edge of the rules arrives through (`arrivedFrom`) is a FAIL
 * when the game hits it on every input — a door the rules price free that cannot be entered hit-free. A screen hit
 * nothing arrives through (a pit's own spawn) is a ROW, never a FAIL; a chase-tier arrival hit is a FINDING, never a
 * FAIL (each is a level-data or rules question for the user, and a probe that stays red until it is decided gates
 * nothing).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}` measurement rows, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build
 * (`flashPanel/wasm`), or this SKIPs (exit 0). Takes the box lock. Headless LOGIC-ONLY (the channel is proved per
 * page and printed as `CHANNEL: headless logic-only`).
 *
 * `--also=<level>:<x>:<y>,…` boots named landings too (a landing the screen clears, witnessed anyway: a fixed row's
 * control). A page that crashes is retried once on a fresh page; a second failure is a FAIL row, never a verdict.
 *
 * Run: node scripts/procgen/probe-seedling-landing-contact.mjs [--host=http://localhost:8000]
 *      [--only=<level>,<level>] [--also=<level>:<x>:<y>,…] [--ticks=180] [--near=0] [--screen-only]
 *      [--out=<file.json>] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { landingContactCensus } from './seedlingLandingContact.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
/** The preset, by its rules file. */
export const RULES_FILE = 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** The inputs a landing is booted under: idle, then each held direction. */
export const INPUTS = Object.freeze([null, 'up', 'down', 'left', 'right']);
/** `Player.hitsTimerMax` (`seedlingHitTicks.HITS_TIMER_MAX`). */
const HITS_TIMER_MAX = 20;

/**
 * One input's verdict from its polled `botStatus` reads (`[{tick, level, hits, hits_timer, dead_frames}]`) and the
 * boot level: `{firstHit, left, restarts, verdict}`. Pure, so the unit test pins it.
 */
export function inputVerdict(reads, bootLevel) {
    let firstHit = null;
    let left = null;
    let restarts = 0;
    let inEpisode = false;
    let prev = null;
    // ⛔ a read before tick 1 may still be the PREVIOUS tape's status (the page is reused across a landing's inputs),
    //    and so may the hit COUNTER past it: a count already standing at the first live read with its timer run out
    //    (`hits_timer` 0 before tick 20) cannot be a hit of this tape — a hit in its first 20 ticks still has a timer —
    //    so it is the baseline, and only a rise above it is a hit.
    const live = reads.filter((x) => x.tick >= 1);
    const first = live[0];
    const stale = first && (first.hits ?? 0) > 0 && !(first.hits_timer > 0) && first.tick < HITS_TIMER_MAX ? first.hits : 0;
    for (const r of live) {
        if (left === null && r.level !== bootLevel) left = { level: r.level, tick: r.tick };
        if (left === null && firstHit === null && (r.hits ?? 0) > stale) {
            firstHit = Math.max(1, Number.isFinite(r.hits_timer) && r.hits_timer > 0
                ? r.tick + r.hits_timer - HITS_TIMER_MAX + 1 : r.tick);
        }
        if (prev) {
            const up = r.dead_frames > prev.dead_frames && r.tick > 2 && r.level === bootLevel;
            if (up && !inEpisode) restarts += 1;
            inEpisode = up || (inEpisode && r.tick === prev.tick);
        }
        prev = r;
    }
    const verdict = firstHit !== null ? `hit@${firstHit}${left ? `,left->L${left.level}@${left.tick}` : ''}`
        : left ? `left->L${left.level}@${left.tick}` : restarts > 0 ? 'dies' : 'clear';
    return { firstHit, left, restarts, verdict, staleHits: stale };
}

/** ⚖ An arrival hit: every input is hit (a hit-free ejection back out of the level counts as no entry either). */
export const isArrivalHit = (verdicts) => verdicts.length > 0
    && verdicts.every((v) => v.firstHit !== null || v.left !== null) && verdicts.some((v) => v.firstHit !== null);

/**
 * No CLEAN input: every input is hit, dies (a restart: the lava or water the held direction walks into), or leaves —
 * and at least one is hit. Wider than `isArrivalHit` (a death is not a hit, but it is not an entry either): the
 * chase tier's FINDING rule. It says no STRAIGHT-LINE input enters hit-free; a steered route may still, which is a
 * route witness's question, not this probe's.
 */
export const hasNoCleanInput = (verdicts) => verdicts.length > 0
    && verdicts.every((v) => v.firstHit !== null || v.left !== null || v.restarts > 0) && verdicts.some((v) => v.firstHit !== null);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '180'));
    const NEAR = Number(arg('near', '0'));
    const ONLY = arg('only', '') ? arg('only', '').split(',').map(Number) : null;
    const OUT = arg('out', null);
    const SCREEN_ONLY = process.argv.includes('--screen-only');
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const { patchedMapDocument } = await M('seedlingSetPatches.js');
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const DELIVERED = patchedMapDocument(MAP);
    const rules = readJson(RULES_FILE);

    const census = landingContactCensus(rules, DELIVERED, { nearPx: NEAR });
    let rows = census.rows.filter((r) => r.hit || r.chase || r.body.speed > 0);
    if (ONLY) rows = rows.filter((r) => ONLY.includes(r.level));
    for (const spec of arg('also', '') ? arg('also', '').split(',') : []) {
        const [level, x, y] = spec.split(':').map(Number);
        const L = census.landings.find((l) => l.level === level && l.x === x && l.y === y);
        if (!L) throw new Error(`--also ${spec}: not a landing of ${RULES_FILE}`);
        if (!rows.some((r) => r.level === level && r.x === x && r.y === y)) {
            rows.push({ level, x, y, regions: L.regions, arrivedFrom: L.arrivedFrom, body: { id: '(--also)', speed: 0 },
                gap: null, centreDist: null, overlap: false, reach: false, hit: false, awake: false });
        }
    }
    console.log(`INFO: ${census.landings.length} landing(s) in ${RULES_FILE}; ${census.rows.filter((r) => r.hit).length} `
        + `screen hit(s), ${census.rows.filter((r) => r.chase).length} chase-tier row(s); ${rows.length} row(s) to witness `
        + `(screen hits + chase tier + movers with gap < ${NEAR} px)`);
    for (const r of rows) {
        console.log(`SCREEN ${JSON.stringify({ level: r.level, x: r.x, y: r.y, body: r.body.id, speed: r.body.speed,
            homer: r.body.homer, gap: r.gap, centreDist: r.centreDist, overlap: r.overlap, reach: r.reach, hit: r.hit,
            awake: r.awake, chase: r.chase, arrivedFrom: r.arrivedFrom, regions: r.regions })}`);
    }
    if (SCREEN_ONLY) return;

    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) {
        console.log(`SKIP: no wasm artifact ${PAGE}`);
        process.exit(0);
    }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { levelSourceFromAtlas } = await M('atlasSource.js');
    const { createRunForStaging } = await M('tapeRunner.js');
    const { arrivalStaging } = await M('fidelityArrival.js');
    const MODEL_SOURCE = levelSourceFromAtlas(DELIVERED);
    /** The model's first hit (tick + source) and level change for one input — the attacker the game does not name. */
    const modelInput = (boot, key) => {
        try {
            const run = createRunForStaging(JSON.parse(JSON.stringify(arrivalStaging(boot, {}))), MODEL_SOURCE, { scratchPersistence: true });
            for (let t = 0; t < TICKS; t += 1) {
                run.advance(new Set(key ? [key] : []));
                if (run.playerHits.length > 0 || run.level !== boot.level) break;
            }
            const h = run.playerHits[0];
            return h ? `hit@${h.t}(${h.id ?? h.source})` : run.level !== boot.level ? `left->L${run.level}` : 'clear';
        } catch (e) { return `refused(${String(e.message).split('\n')[0].slice(0, 60)})`; }
    };
    // ⛔ the delivery's OWN default (`SEEDLING_SET_PATCHES`), so the game is the room the rules were derived from
    const SET = vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${SET.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-landing-contact.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const tapeOf = (name, boot, key) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-landing-contact', boot,
        noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 1, split: false }, seam: {},
        tick_count: TICKS, inputs: key ? [{ key, from: 0, to: TICKS }] : [],
    });
    const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined
        ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);

    /** A primer boot in ANOTHER level (its first landing in the rules), to reset the game's per-level hit count. */
    const primerFor = (level) => {
        const L = census.landings.find((l) => l.level !== level && l.level <= 1);
        return { level: L.level, x: L.x, y: L.y };
    };
    /** The tapes of one landing on ONE fresh page with the delivered set mounted. */
    async function runLanding(boot) {
        const page = await browser.newPage();
        const logs = [];
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 720 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 720 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
            await assertLogicOnlyChannel(page);
            const answers = [];
            for (const c of planLevelSetChunks(SET).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = JSON.parse(await call(page, 'botLevelSet'))?.active;
            if (mounted !== SET.set_id) throw new Error(`mounted ${mounted}, not ${SET.set_id}`);
            const out = [];
            for (const key of INPUTS) {
                // ⛔ the game's `hits` survives a re-boot into the SAME level (only a level change resets it), so when the
                //    previous input ENDED in this level the page is primed: 2 ticks booted in another level, then the
                //    input's own boot. (After an input that left the level the boot is already a level change; a primer
                //    there stalls the page, measured on L14.)
                if (key !== INPUTS[0] && out.at(-1)?.reads.at(-1)?.level === boot.level) {
                    if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape({ ...tapeOf('primer', primerFor(boot.level), null), tick_count: 2 }))) !== 'ok'
                        || await call(page, 'botStart') !== 'ok') throw new Error('primer');
                    for (const t0 = Date.now(); !JSON.parse(await call(page, 'botStatus')).finished;) {
                        if (Date.now() - t0 > 45 * 1000) throw new Error('primer deadline');
                    }
                }
                const tape = tapeOf(`contact-L${boot.level}-${boot.x}-${boot.y}-${key ?? 'idle'}`, boot, key);
                if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
                if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
                const reads = [];
                for (const t0 = Date.now(); ;) {
                    const st = JSON.parse(await call(page, 'botStatus'));
                    if (st.error) throw new Error(st.error);
                    if (Number.isInteger(st.tick)) {
                        reads.push({ tick: st.tick, level: st.level, x: st.x, y: st.y, hits: st.hits ?? 0,
                            hits_timer: st.hits_timer, dead_frames: st.dead_frames ?? 0 });
                    }
                    if (st.finished) break;
                    if (Date.now() - t0 > 45 * 1000) throw new Error(`deadline (tick ${reads.at(-1)?.tick ?? 'none'})`);
                }
                out.push({ key: key ?? 'idle', reads, ...inputVerdict(reads, boot.level) });
            }
            return out;
        } catch (e) {
            console.log(`PAGE LOGS:\n${logs.slice(-10).join('\n')}`);
            throw e;
        } finally {
            await page.close();
        }
    }

    const results = [];
    const seen = new Map();
    for (const r of rows) {
        const key = `${r.level},${r.x},${r.y}`;
        if (!seen.has(key)) {
            let runs = null;
            for (let attempt = 1; attempt <= 2 && !runs; attempt += 1) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    runs = await runLanding({ level: r.level, x: r.x, y: r.y });
                } catch (e) {
                    console.log(`RETRY: L${r.level} (${r.x},${r.y}) attempt ${attempt}: ${String(e.message).split('\n')[0]}`);
                    if (attempt === 2) check(`L${r.level} (${r.x},${r.y}): the wasm runs`, false, String(e.message).split('\n')[0]);
                }
            }
            seen.set(key, runs);
        }
        const runs = seen.get(key);
        if (!runs) continue;
        const arrivalHit = isArrivalHit(runs);
        const row = { level: r.level, x: r.x, y: r.y, body: r.body.id, gap: r.gap,
            screen: r.hit ? (r.overlap ? 'overlap' : 'reach') : r.chase ? 'chase' : r.body.id === '(--also)' ? 'also' : 'near',
            arrivedFrom: r.arrivedFrom, game: runs.map((v) => `${v.key}:${v.verdict}`), arrivalHit, noCleanInput: hasNoCleanInput(runs),
            model: INPUTS.map((k) => `${k ?? 'idle'}:${modelInput({ level: r.level, x: r.x, y: r.y }, k)}`),
            lastInBoot: runs.map((v) => v.reads.filter((s) => s.level === r.level).at(-1) ?? null)
                .map((s) => s && { t: s.tick, x: +Number(s.x).toFixed(2), y: +Number(s.y).toFixed(2) }) };
        results.push(row);
        console.log(`ROW ${JSON.stringify(row)}`);
        if (r.chase && !r.hit && r.arrivedFrom.length > 0 && row.noCleanInput) {
            console.log(`FINDING: L${r.level} (${r.x},${r.y}) vs ${r.body.id} (chase tier): no input of the door arrival from `
                + `${r.arrivedFrom.join(', ')} stays clear (each is hit, dies or leaves) — ${row.game.join(' ')}`);
        }
        if (r.hit && r.arrivedFrom.length > 0) {
            check(`L${r.level} (${r.x},${r.y}) vs ${r.body.id}: the door arrival from ${r.arrivedFrom.join(', ')} is enterable hit-free`,
                !arrivalHit, row.game.join(' '));
        }
    }
    await browser.close();
    if (OUT) writeFileSync(OUT, `${JSON.stringify({ rules: RULES_FILE, set_id: SET.set_id, ticks: TICKS, near: NEAR, rows: results }, null, 1)}\n`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
