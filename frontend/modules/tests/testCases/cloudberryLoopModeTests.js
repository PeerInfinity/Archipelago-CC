/**
 * In-app tests for the Cloudberry substrate in LOOP MODE (P3b): a summary substrate, as runner and
 * noiz2sa (`loopSupport.summaryRecording` + `playClock`, cloudberryLibrary.js).
 *
 * The world is the committed `cloudberry_sphere_worldgen` preset (region_2_2 [coin → Clouds] →exit_S→
 * region_2_3 [coin → Moving Blocks] →exit_E→ region_3_3 [coin → Victory]; every back exit is the next
 * region's start door), loaded with a loop_costs sidecar GENERATED from its sphere log (the
 * runnerBlockModeTests recipe), so loop mode auto-enables and the strict action gate is live. ⚖ Every row
 * sets its own state (it loads the world itself; the items come from the coins it collects).
 *
 * The economy is the page's GAME clock: the page reports `setPlayClock(running, {gameSeconds})` (physics
 * steps / 60 since configure; stopped while the exit menu is open, the page hidden, or a pause is held),
 * and loops charges the region per whole game second played — live play and a Bot block alike.
 *
 * Input: the page's own bot (the computer's recording), driven through the substrate's PlaybackProxy —
 * for a Record block that is "the player's hands" (the page cannot tell), for a Bot block it is the
 * solver loops engages itself.
 *
 * Same refusal as cloudberrySubstrateTests.js: no same-origin site copy → a failed condition by name.
 * Runs only in the test-substrates mode (enabled:false; the full module config), batch `cloudberry`.
 */
import { registerTest } from '../testRegistry.js';
import { restoresSavedQueues } from '../savedQueueIsolation.js';
import { generateLoopCosts } from '../../shared/procgen/loopCostGenerator.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { resolveQueueBlocks } from '../../loops/blockIdentity.js';
import { getActivePanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';

const CATEGORY = 'cloudberrySubstrate';
const SITE = './external/cloudberry/';
const PANEL = 'cloudberryDemoPanel';
const SEED = 'AP_14089154938208861744';
const DIR = `./presets/cloudberry_sphere_worldgen/${SEED}/`;
const RULES = `${DIR}${SEED}_rules.json`;
const SPHERE_LOG = `${DIR}${SEED}_sphere_log.jsonl`;
const CONFIGURE_TIMEOUT_MS = 180000;
const BOT_TIMEOUT_MS = 90000;
/** how long a row sits on a stopped clock — over two drain ticks */
const PAUSE_MS = 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gs = () => getGameStateSingleton();
const currentRegion = () => gs()?.getCurrentRegion?.() ?? null;
const currentMana = () => gs()?.getCurrentMana?.() ?? 0;

async function siteOrRefuse(tc) {
    let info = null;
    try {
        const res = await fetch(`${SITE}build-info.json`, { cache: 'no-store' });
        if (res.ok) info = await res.json();
    } catch { info = null; }
    tc.reportCondition(info
        ? `the same-origin Cloudberry site is present (build ${String(info.build).slice(0, 12)})`
        : 'REFUSED: no same-origin Cloudberry site at frontend/external/cloudberry/ — run '
          + '`node scripts/setup/fetch-cloudberry-site.mjs` (or `--link` a local build)', !!info);
    return info;
}

const gameIframe = () => document.querySelector('iframe[src*="/external/cloudberry/index.html"][src*="loadRegionEvent"]');
const gameWin = () => gameIframe()?.contentWindow ?? null;
const embed = () => gameWin()?.__cloudberryEmbed ?? null;
const app = () => embed()?.app ?? null;
const pageEvents = (kind) => (app()?.events ?? []).filter((e) => e.kind === kind);
const controller = () => substrateRegistry.get('cloudberry')?.getPlaybackController?.() ?? null;

function checkedList(snapshot) {
    const c = snapshot?.checkedLocations;
    if (c instanceof Set) return [...c];
    if (Array.isArray(c)) return c;
    return Object.keys(c ?? {});
}
async function snapshot(tc) {
    await tc.stateManager.pingWorker('cloudberry-loop-row', 3000);
    return tc.stateManager.getSnapshot() ?? {};
}

/** `region` configured and playing in the panel (a configure after `after` configures, when given). */
async function configured(tc, region, { after = null, timeoutMs = CONFIGURE_TIMEOUT_MS, label = '' } = {}) {
    const a = await tc.pollForValue(() => {
        const x = app();
        if (!x || x.config?.regionId !== region || !(x.playResult?.ok || x.refusal)) return null;
        if (after !== null && (x.configures ?? 0) <= after) return null;
        return x;
    }, `${label}${region} configured in the Cloudberry panel`, timeoutMs, 250);
    tc.reportCondition(a ? `${label}${region} configured and playing (${a.refusal ?? `${a.playResult.pieces} pieces`})`
        : `${label}${region} configured in the Cloudberry panel`, !!a && !a.refusal);
    return a && !a.refusal ? a : null;
}

/** The preset + a GENERATED loop_costs sidecar; loop mode on; the panel showing region_2_2. */
async function loadLoopWorld(tc) {
    let rulesJson;
    try {
        rulesJson = await (await fetch(RULES, { cache: 'no-store' })).json();
        const sphereLog = (await (await fetch(SPHERE_LOG, { cache: 'no-store' })).text())
            .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
        rulesJson = { ...rulesJson, loop_costs: { 1: generateLoopCosts({ rulesJson, sphereLog, sourceFileName: 'cloudberryLoopModeTests' }) } };
    } catch (e) {
        tc.reportCondition(`prepared the preset with loop_costs (${e.message})`, false);
        return null;
    }
    const before = app()?.configures ?? 0;
    const hadPage = !!gameIframe();
    const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: 'cloudberryLoopModeTests' });
    await loaded;
    await tc.stateManager.pingWorker('after-rules-load', 3000);
    const loopOn = await tc.pollForCondition(() => gs()?.isLoopModeActive === true, 'loop mode active (loop_costs)', 8000, 100);
    tc.reportCondition('loop mode active (auto-enabled by the generated loop_costs)', !!loopOn);
    if (!loopOn) return null;
    const landed = await tc.pollForCondition(() => currentRegion() === 'region_2_2', 'the player landed in region_2_2', 10000, 100);
    tc.reportCondition('the player landed in region_2_2', !!landed);
    tc.assertEqual('region_2_2 is a SUMMARY region (cloudberry)', 'summary', loopStateSingleton.getRegionCaptureShape?.('region_2_2'));
    tc.assertEqual('…whose solver is the page\'s bot (walkTo)', 'walkTo', loopStateSingleton.regionSolver?.('region_2_2'));
    tc.eventBus.publish('ui:activatePanel', { panelId: PANEL });
    const a = await configured(tc, 'region_2_2', { after: hadPage ? before : null });
    return a ? { rulesJson } : null;
}

function resolveBlockFor(region) {
    const { visits } = resolveQueueBlocks(loopStateSingleton.getActionQueue?.() ?? []);
    return [...visits].reverse().find((v) => v.name === region) ?? null;
}

/** Queue `check` (a location in `region`) and/or the move `exit` → `target`; set the block's mode. */
function queueBlock(tc, { region, check = null, exit = null, target = null, mode }) {
    if (check) gs().addLocationCheck(check, region);
    if (exit) gs().updatePath(target, exit, region);
    const block = resolveBlockFor(region);
    tc.assertEqual(`resolved the queue block for ${region}`, true, !!block);
    if (!block) return null;
    loopStateSingleton.setBlockMode(region, block.instance, mode);
    return block;
}

/** The page's bot, as the player's hands: resolves with the page's bot result. */
async function botWalk(tc, target, label) {
    const c = controller();
    if (!c) { tc.reportCondition('the cloudberry PlaybackController exists', false); return null; }
    const n = pageEvents('bot').length;
    c.walkTo(target);
    return tc.pollForValue(() => {
        const r = pageEvents('bot');
        return r.length > n ? r[r.length - 1] : null;
    }, label, BOT_TIMEOUT_MS, 200);
}

const clock = () => loopStateSingleton._playClock;

/** The game page hidden or shown, through ITS OWN visibilitychange handler (as a background tab does). */
function setPageHidden(hidden) {
    const doc = gameWin()?.document;
    if (!doc) return;
    if (hidden) Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true });
    else delete doc.hidden;
    const W = gameWin();
    doc.dispatchEvent(new W.Event('visibilitychange'));
}

/** Record any thrown error as a failed condition; always restore the loop state. */
async function guarded(tc, body) {
    const g = gs();
    const saved = { noReset: g.noManaDepletionReset, autoRestart: loopStateSingleton.autoRestartQueue };
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        await body();
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
        tc.log(e.stack ?? '', 'error');
    } finally {
        try { if (gameWin()?.document && Object.hasOwn(gameWin().document, 'hidden')) setPageHidden(false); } catch { /* none */ }
        loopStateSingleton.stopProcessing?.();
        loopStateSingleton.setAutoRestartQueue?.(saved.autoRestart);
        g.noManaDepletionReset = saved.noReset;
        g.setLoopModeActive?.(false);
    }
    return tc.getOverallResult();
}

/** Every `loops:manaSpent` and play-clock report while `fn` runs (the cost model's evidence). */
function ledger(tc) {
    const spent = [], clocks = [];
    const onSpent = (d) => spent.push({ region: d?.region, mana: d?.mana });
    const onClock = (d) => clocks.push({ region: d?.region, running: d?.running, gameSeconds: d?.stats?.gameSeconds });
    tc.eventBus.subscribe('loops:manaSpent', onSpent);
    tc.eventBus.subscribe('substrate:playClock', onClock);
    return {
        spentIn: (region) => spent.filter((s) => s.region === region).reduce((t, s) => t + (s.mana ?? 0), 0),
        lastSeconds: (region) => clocks.filter((c) => c.region === region && Number.isFinite(c.gameSeconds)).at(-1)?.gameSeconds ?? null,
        clear: () => { spent.length = 0; clocks.length = 0; },
        stop: () => {
            tc.eventBus.unsubscribe?.('loops:manaSpent', onSpent);
            tc.eventBus.unsubscribe?.('substrate:playClock', onClock);
        },
    };
}

function queueDiag() {
    const q = loopStateSingleton.getActionQueue?.() ?? [];
    return JSON.stringify({
        index: loopStateSingleton.currentActionIndex, region: currentRegion(), processing: loopStateSingleton.isProcessing,
        paused: loopStateSingleton.isPaused, bot: loopStateSingleton._botExecutedAction?.type ?? null,
        live: loopStateSingleton.livePlayRegion(), mana: currentMana(), queueLength: q.length,
        page: { region: app()?.config?.regionId, configures: app()?.configures, checked: [...(app()?.checked ?? [])] },
    });
}

/** The page's own status (piece, bob position) — where the player stands in the level. */
function pageStatus() {
    try { return embed()?.status?.() ?? null; } catch { return null; }
}

// ── 1. Record a region (a reset before it completes), the drain follows the clock, Playback at once ───

async function recordThenPlayback(tc) {
    const book = ledger(tc);
    try {
        return await guarded(tc, async () => {
            if (!(await loadLoopWorld(tc))) return;
            const g = gs();
            g.noManaDepletionReset = false;
            loopStateSingleton.setAutoRestartQueue(true);   // the mana-out reset resumes the queue

            const block = queueBlock(tc, { region: 'region_2_2', check: 'region_2_2__loc_0', exit: 'exit_S', target: 'region_2_3', mode: 'record' });
            if (!block) return;
            g.refillMana();
            loopStateSingleton.startProcessing();
            const parked = await tc.pollForCondition(() => loopStateSingleton.livePlayRegion() === 'region_2_2',
                'the Record block parked for live play', 15000, 100);
            tc.reportCondition('the Record block parked for live play on region_2_2', !!parked);
            if (!parked) return;

            // ── the drain follows the page's clock ──
            // (the park's arrival configures the page again: wait for a game second played on THAT configure)
            const running = await tc.pollForValue(() => (clock()?.region === 'region_2_2' && clock().running === true
                && clock().gameSeconds >= 1 ? { ...clock() } : null), 'the page reports its game clock running', 30000, 100);
            tc.reportCondition(`the page reports a running GAME clock for region_2_2 (${JSON.stringify(running)})`, !!running);
            const mr = currentMana();
            await sleep(PAUSE_MS);
            tc.reportCondition(`running: ${PAUSE_MS} ms of play drained mana (${mr} → ${currentMana()})`, currentMana() < mr);
            setPageHidden(true);   // the page's own visibilitychange handler: a hidden tab pauses the game
            const stopped = await tc.pollForCondition(() => clock()?.region === 'region_2_2' && clock().running === false,
                'a hidden page reports the clock stopped', 3000, 50);
            tc.reportCondition('the page hidden (another tab) → the game pauses and reports its clock stopped', !!stopped);
            const m0 = currentMana(), s0 = loopStateSingleton._summaryDrainSeconds, p0 = embed().physicsCount();
            await sleep(PAUSE_MS);
            tc.assertEqual(`hidden: ${PAUSE_MS} ms drained no mana, recorded no second, stepped no physics`, true,
                currentMana() === m0 && loopStateSingleton._summaryDrainSeconds === s0 && embed().physicsCount() === p0);
            setPageHidden(false);
            const resumed = await tc.pollForCondition(() => clock()?.running === true, 'the clock runs again', 3000, 50);
            tc.reportCondition('the page visible again → its clock runs again', !!resumed);

            // ── a reset BEFORE the Record completes (mana out, on the region itself) ──
            // The player runs deep into the level (the end door's walk without Clouds ends short of it: nothing sent).
            const deep = await botWalk(tc, { kind: 'exit', name: 'exit_S' }, 'a run toward the end door (no Clouds)');
            tc.reportCondition(`the player ran toward the end door and stopped short (${deep?.result})`,
                deep?.result === 'timeout' || deep?.result === 'died');
            const statusBefore = pageStatus();
            const confBefore = app()?.configures ?? 0;
            const resetSeen = tc.waitForEvent('loopState:loopReset', 10000);
            g.deductMana(currentMana());
            tc.reportCondition('mana out mid-Record → a loop reset', !!(await resetSeen));
            const back = await configured(tc, 'region_2_2', { after: confBefore, timeoutMs: 30000, label: 'after the reset: ' });
            const statusAfter = pageStatus();
            tc.log(`after the reset: ${queueDiag()}; bob before ${JSON.stringify(statusBefore?.bob?.pos)} piece ${statusBefore?.piece}, `
                + `after ${JSON.stringify(statusAfter?.bob?.pos)} piece ${statusAfter?.piece}; start door ${JSON.stringify(statusAfter?.startDoor)}`);
            if (!back) return;
            const startX = statusAfter?.startDoor?.[0];
            tc.reportCondition(`the reset put the region back: configured again, the player at the start door `
                + `(x ${statusBefore?.bob?.pos?.[0]?.toFixed(0)} → ${statusAfter?.bob?.pos?.[0]?.toFixed(0)}; door x ${startX})`,
                statusAfter?.piece === 0 && Math.abs(statusAfter.bob.pos[0] - startX) < 50 && statusBefore?.bob?.pos?.[0] > startX + 500);
            tc.reportCondition('the in-flight capture was discarded (no summary bound)', !loopStateSingleton._lookupBoundSummary('region_2_2', block.instance));
            const reparked = await tc.pollForCondition(() => loopStateSingleton.livePlayRegion() === 'region_2_2',
                'the Record block parked again', 15000, 100);
            tc.reportCondition('the queue re-parked the Record block on region_2_2', !!reparked);
            if (!reparked) return;

            // ── the Record visit: the coin (→ Clouds), then the end door ──
            book.clear();
            const manaAtPark = currentMana();
            const wall0 = performance.now();
            const got = await botWalk(tc, { kind: 'location', name: 'region_2_2__loc_0' }, 'the coin');
            tc.reportCondition(`the player's hands took the coin (${got?.result})`, got?.result === 'reached');
            const clouds = await tc.pollForValue(async () => {
                const sn = await snapshot(tc);
                return checkedList(sn).includes('region_2_2__loc_0') && Number(sn.inventory?.Clouds ?? 0) > 0 ? true : null;
            }, 'region_2_2__loc_0 checked → Clouds', 20000, 250);
            tc.reportCondition('live play checked region_2_2__loc_0 through the action gate → Clouds received', !!clouds);
            await tc.pollForValue(() => ((app()?.itemsState?.platforms ?? []).includes('Cloud') ? true : null), 'Cloud held in the page', 20000, 200);
            const left = await botWalk(tc, { kind: 'exit', name: 'exit_S' }, 'the end door');
            tc.reportCondition(`left by the end door (${left?.result})`, left?.result === 'reached');
            const crossed = await tc.pollForCondition(() => currentRegion() === 'region_2_3', 'the visit ended: region_2_3', 15000, 100);
            tc.reportCondition('the Record visit ended through its queued exit (region_2_3)', !!crossed);
            if (!crossed) return;
            const saved = loopStateSingleton._lookupBoundSummary('region_2_2', block.instance);
            tc.reportCondition('a summary recording is bound to the block', !!saved);
            if (!saved) return;
            tc.log(`COST Record visit: summary ${JSON.stringify(saved.summary)} departure=${saved.departureExitId}; drained ${manaAtPark - currentMana()}; `
                + `wall clock parked ${((performance.now() - wall0) / 1000).toFixed(2)} s`);
            tc.assertEqual('the summary keeps the checked coin', JSON.stringify(['region_2_2__loc_0']),
                JSON.stringify((saved.summary.checks ?? []).map((c) => c?.locationName ?? c)));
            tc.assertEqual('…and the exit taken', 'exit_S', saved.departureExitId);
            const ps = saved.summary.playStats;
            // A page that settles its clock at the door reports the visit's game seconds up to it, so the duration is
            // their floor — plus at most the one wall second loops' fail-safe may charge between the park and the
            // freshly configured page's first report. Without the settle (the live page before Cloudberry
            // p3b-exit-clock) `playStats` is the last periodic report, up to 1 s before the door: ± 1.
            const settles = Number.isFinite(app()?.exitClockSettles);
            const want = Math.floor(ps?.gameSeconds ?? -9);
            tc.reportCondition(`the recorded duration ${saved.summary.durationSeconds} s = floor(the page's game seconds ${ps?.gameSeconds?.toFixed(2)})`
                + (settles ? ' (+ ≤ 1 fail-safe second; the page settles its clock at the door)' : ' ± 1 (no settle at the door on this page)'),
                settles ? saved.summary.durationSeconds - want >= 0 && saved.summary.durationSeconds - want <= 1
                    : Math.abs(saved.summary.durationSeconds - want) <= 1);
            const rate = loopStateSingleton.costDataManager?.getTimeDrainPerSecond?.('region_2_2') ?? 1;
            const drained = manaAtPark - currentMana();
            tc.reportCondition(`live play drained the visit's game seconds × the rate (${drained} for ${saved.summary.durationSeconds} s at ${rate}/s, ± one tick)`,
                Math.abs(drained - saved.summary.durationSeconds * rate) <= rate + 0.001);
            tc.assertEqual('the block auto-switched to Playback', 'playback', loopStateSingleton.getBlockMode('region_2_2', block.instance));
            await configured(tc, 'region_2_3', { label: 'Record: ' });

            // ── a reset AFTER the Record (the Loops panel's Restart): the queue re-drives, Playback applies at once ──
            const expected = loopStateSingleton._priceSummaryReplay('region_2_2', saved.summary);
            const applied = tc.waitForEvent('loops:summaryApplied', 15000);
            book.clear();
            const t0 = performance.now();
            loopStateSingleton.restartFromStart();
            const ap = await applied;
            const again = await tc.pollForCondition(() => currentRegion() === 'region_2_3', 'Playback crossed into region_2_3', 15000, 20);
            const ms = Math.round(performance.now() - t0);
            tc.reportCondition(`after the Restart, Playback applied the summary and crossed exit_S at once (${ms} ms)`, !!ap && !!again);
            tc.log(`Playback: ${ms} ms; price ${expected}; ${queueDiag()}`);
            const spent = book.spentIn('region_2_2');
            tc.reportCondition(`Playback spent exactly the repriced summary in region_2_2 (${expected}; spent ${spent})`,
                Math.abs(spent - expected) < 0.001);
        });
    } finally {
        book.stop();
    }
}

registerTest({
    id: 'cloudberry-loop-record-then-instant-playback',
    name: 'Cloudberry loop mode: the drain follows the page\'s clock; a reset mid-Record puts the region back; Record keeps the visit; Playback applies it at once after a Restart',
    description: 'The committed preset with a generated loop_costs sidecar (loop mode on). A Record block on region_2_2 '
               + 'parks for live play; the page reports a running game clock and play drains; the page hidden stops the '
               + 'clock and drains nothing. The player runs deep into the level, then mana runs out: the loop reset '
               + 'discards the capture and the page is configured again (the player back at the start door). Re-parked, '
               + 'the coin (→ Clouds) and the end door: the summary keeps the check, exit_S and floor(game seconds), and '
               + 'the drain equals it. The Loops Restart re-drives the queue and Playback crosses exit_S at once for the '
               + 'repriced summary.',
    testFunction: restoresSavedQueues(recordThenPlayback),
    category: CATEGORY,
    enabled: false,
});

// ── 2. Bot blocks: the next region and back by the start door, a reset mid-Bot, Victory ─────────────

async function botBlocksResetVictory(tc) {
    const book = ledger(tc);
    try {
        return await guarded(tc, async () => {
            if (!(await loadLoopWorld(tc))) return;
            const g = gs();
            g.noManaDepletionReset = false;
            loopStateSingleton.setAutoRestartQueue(true);
            const blocks = [
                queueBlock(tc, { region: 'region_2_2', check: 'region_2_2__loc_0', exit: 'exit_S', target: 'region_2_3', mode: 'bot' }),
                queueBlock(tc, { region: 'region_2_3', check: 'region_2_3__loc_0', exit: 'region_2_2', target: 'region_2_2', mode: 'bot' }),
                queueBlock(tc, { region: 'region_2_2', exit: 'exit_S', target: 'region_2_3', mode: 'bot' }),
                queueBlock(tc, { region: 'region_2_3', exit: 'exit_E', target: 'region_3_3', mode: 'bot' }),
                queueBlock(tc, { region: 'region_3_3', check: 'region_3_3__loc_0', mode: 'bot' }),
            ];
            if (blocks.some((b) => !b)) return;
            g.refillMana();
            book.clear();
            let before = app()?.configures ?? 0;
            let bots = pageEvents('bot').length;
            loopStateSingleton.startProcessing();

            // ── B1: region_2_2's coin and its end door, priced by the page's game seconds ──
            if (!(await arriveIn(tc, 'region_2_3', before, 'Bot block 1'))) return;
            const b1 = pageEvents('bot').slice(bots);
            tc.reportCondition(`Bot block 1: coin and end door reached (${b1.map((e) => `${e.goal?.kind}:${e.result}:${e.steps}`).join(', ')})`,
                b1.length === 2 && b1.every((e) => e.result === 'reached') && b1[1].goal?.kind === 'portal');
            const s1 = await snapshot(tc);
            tc.reportCondition('region_2_2__loc_0 checked → Clouds', checkedList(s1).includes('region_2_2__loc_0') && Number(s1.inventory?.Clouds ?? 0) > 0);
            const gs1 = book.lastSeconds('region_2_2'), cost1 = book.spentIn('region_2_2');
            tc.log(`COST Bot block 1: ${cost1} mana for ${gs1} game seconds (bot steps ${b1.map((e) => e.steps).join('+')})`);
            // A page that settles its clock at the door (Cloudberry p3b-exit-clock: a stopped report just before
            // sendExit) is charged floor(the visit's game seconds) exactly; an older page's last report can be up to
            // one report period (1 s) before the door, and that tail goes unbilled.
            const settles = Number.isFinite(app()?.exitClockSettles);
            tc.reportCondition(settles
                ? `Bot block 1 cost floor(the game seconds it played): ${cost1} mana for ${gs1?.toFixed(2)} s (the page settles its clock at the door)`
                : `Bot block 1 cost the game seconds it played, less the unreported tail: ${cost1} mana, last report ${gs1?.toFixed(2)} s (no settle at the door on this page)`,
                Number.isFinite(gs1) && (settles ? cost1 === Math.floor(gs1) : cost1 >= Math.floor(gs1) - 1 && cost1 <= Math.ceil(gs1)));

            // ── B2: mid-walk to region_2_3's coin, the pool runs out → a loops-owned reset ──
            const walking = await tc.pollForCondition(() => loopStateSingleton._botExecutedAction?.type === 'locationCheck'
                && currentRegion() === 'region_2_3', 'Bot block 2 walking to its coin', 20000, 50);
            tc.reportCondition('Bot block 2: the bot walks to region_2_3\'s coin', !!walking);
            before = app()?.configures ?? 0;
            bots = pageEvents('bot').length;
            const resetSeen = tc.waitForEvent('loopState:loopReset', 20000);
            g.deductMana(currentMana() - 0.5);   // the next game second empties the pool
            tc.reportCondition('mana out mid-Bot → a loop reset', !!(await resetSeen));
            loopStateSingleton.setAutoRestartQueue(false);   // this reset resumes (already decided); the queue then ends at Victory
            const stoppedWalk = await tc.pollForValue(() => pageEvents('bot').slice(bots)[0] ?? null, 'the page\'s bot walk ended', 10000, 100);
            tc.reportCondition(`the reset stopped the bot's walk (${JSON.stringify(stoppedWalk)})`, stoppedWalk?.result === 'stopped');
            const s2 = await snapshot(tc);
            tc.reportCondition('region_2_3__loc_0 NOT checked (the walk was cut short)', !checkedList(s2).includes('region_2_3__loc_0'));
            // The queue re-drives from its first move: the player back in region_2_2, the page configured again.
            const re = await arriveIn(tc, 'region_2_2', before, 'after the reset');
            if (!re) return;
            tc.reportCondition(`the reset put region_2_2 back with its coin checked (${JSON.stringify(re.config?.checkedLocations)})`,
                JSON.stringify(re.config?.checkedLocations) === '["loc_0"]');
            const drawn = await tc.pollForValue(() => (app()?.checked?.has?.('loc_0') ? true : null), 'the coin drawn checked', 10000, 200);
            tc.reportCondition('…and the page draws it checked', !!drawn);

            // ── then the queue plays on to Victory: B1 again (its check is done: the move only), B2 the coin and the
            // way back by the START door, B3 out of region_2_2 (by its start door: the side the player arrived by is
            // offered there too, P2b), B4 exit_E (Moving Blocks), B5 the Victory coin ──
            bots = pageEvents('bot').length;
            const exits = pageEvents('sendExit').length;
            const victory = await tc.pollForValue(async () => {
                const s = await snapshot(tc);
                return Number(s.inventory?.Victory ?? 0) > 0 ? s : null;
            }, 'Victory', 240000, 250);
            loopStateSingleton.stopProcessing?.();
            tc.reportCondition(`Victory (region_3_3__loc_0 checked by the Bot block) — ${queueDiag()}`,
                !!victory && checkedList(victory).includes('region_3_3__loc_0') && checkedList(victory).includes('region_2_3__loc_0'));
            // (the Victory coin's location can reach the host a frame before the page records its bot result)
            await tc.pollForValue(() => (pageEvents('bot').length >= bots + 6 ? true : null), 'the page recorded the sixth bot result', 5000, 50);
            const goals = pageEvents('bot').slice(bots).slice(0, 6).map((e) => `${e.goal?.kind}:${e.goal?.id}:${e.result}`);
            const sent = pageEvents('sendExit').slice(exits).slice(0, 4).map((e) => `${e.side}:${e.door}`);
            tc.log(`after the reset, the page's bot goals ${JSON.stringify(goals)}, exits ${JSON.stringify(sent)}`);
            tc.assertEqual('after the reset the bot played B1 (end door), B2 (coin, START door back), B3 (start door), B4 (end door), B5 (coin)',
                JSON.stringify(['portal:south:reached', 'pickup:loc_0:reached', 'startdoor:north:reached', 'startdoor:south:reached', 'portal:east:reached', 'pickup:loc_0:reached']),
                JSON.stringify(goals));
            tc.assertEqual('…leaving by south (end door), north (START door: the way back), south (start door), east (end door)',
                JSON.stringify(['south:end', 'north:start', 'south:start', 'east:end']), JSON.stringify(sent));
            tc.log(`COST per region (mana spent since the load, all blocks): ${JSON.stringify(Object.fromEntries(
                ['region_2_2', 'region_2_3', 'region_3_3'].map((r) => [r, book.spentIn(r)])))}`);
        });
    } finally {
        book.stop();
    }
}

/** Wait until the player is in `region` with the page configured there (after `after` configures). */
async function arriveIn(tc, region, after, label) {
    const ok = await tc.pollForCondition(() => currentRegion() === region, `${label}: the player in ${region}`, BOT_TIMEOUT_MS, 100);
    tc.reportCondition(`${label}: the player is in ${region}`, !!ok);
    if (!ok) { tc.log(`DIAG ${queueDiag()}`, 'error'); return null; }
    return configured(tc, region, { after, label: `${label}: ` });
}

registerTest({
    id: 'cloudberry-loop-bot-blocks-reset-victory',
    name: 'Cloudberry loop mode: Bot blocks walk to the next region and back by the start door; a reset mid-Bot puts the region back; Victory',
    description: 'The committed preset with a generated loop_costs sidecar. Five Bot blocks: region_2_2 (coin, exit_S), '
               + 'region_2_3 (coin, back), region_2_2 (exit_S), region_2_3 (exit_E), region_3_3 (coin). Block 1 costs the '
               + 'game seconds the page played. Mid-walk in block 2 the pool runs out: the reset stops the walk, the queue '
               + 're-drives from its first move and region_2_2 is configured again with its coin drawn checked. Then block '
               + '2 takes its coin and leaves by the START door (the way back), and the rest reaches Victory.',
    testFunction: restoresSavedQueues(botBlocksResetVictory),
    category: CATEGORY,
    enabled: false,
});

// ── 3. A MIXED world in loop mode: maze rooms and Cloudberry levels, the Playback Bot to the end (P4a) ────────────

const MIX_DIR = `./presets/cloudberry_maze_mix_worldgen/${SEED}/`;
const MIX_RULES = `${MIX_DIR}${SEED}_rules.json`;
const MIX_SPHERE_LOG = `${MIX_DIR}${SEED}_sphere_log.jsonl`;
const MIX_BUDGET_MS = 300000;

/**
 * The committed `cloudberry_maze_mix_worldgen` (check-cloudberry-sphere.mjs --write: two maze rooms, the start among them,
 * and three Cloudberry levels; keys and platform items over four spheres), generated in loop mode (its own loop_costs, every
 * payload manaEnabled), played by the Playback Bot in loop mode: the bot writes the Loops queue loop by loop, each maze block walked by Loops'
 * maze delegation, each Cloudberry block by the page's bot (the region's solver `walkTo`), all on one mana pool. Nothing in
 * loops is per world (`classifyRegion` / the solver per region): this row is the evidence.
 */
async function mixedWorldLoopBot(tc) {
    const book = ledger(tc);
    const trace = [];
    const onRC = (d) => trace.push(`${d?.oldRegion}->${d?.newRegion}${d?.fromReset ? ' (reset)' : ''}`);
    tc.eventBus.subscribe('gameState:regionChanged', onRC, 'tests');
    try {
        return await guarded(tc, async () => {
            let rulesJson, sphereLog;
            try {
                rulesJson = await (await fetch(MIX_RULES, { cache: 'no-store' })).json();
                sphereLog = (await (await fetch(MIX_SPHERE_LOG, { cache: 'no-store' })).text())
                    .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
            } catch (e) {
                tc.reportCondition(`read the mixed preset (${e.message})`, false);
                return;
            }
            const sidecars = rulesJson.preset_sidecars?.['1'] ?? {};
            // Generated in loop mode (check-cloudberry-sphere.mjs MIXED_STATE): its own loop_costs, and every payload manaEnabled
            // (Loops' maze delegation needs it; a Cloudberry block's solver is the page's bot either way).
            tc.reportCondition('⛓ premise: the preset carries its loop_costs and every payload is manaEnabled',
                !!rulesJson.loop_costs?.['1'] && Object.values(sidecars).every((v) => v.playable_payload?.manaEnabled === true));
            const bySub = (sub) => Object.keys(sidecars).filter((r) => sidecars[r].substrate === sub);
            const mazes = bySub('maze'), clouds = bySub('cloudberry');
            tc.reportCondition(`⛓ premise: the preset mixes maze (${mazes.join(',')}) and cloudberry (${clouds.join(',')}) regions`,
                mazes.length > 0 && clouds.length > 0);
            if (!mazes.length || !clouds.length) return;

            const panel = await tc.pollForValue(() => getActivePanel(), 'playback bot panel instance', 5000, 100);
            const bot = panel?.getBot?.();
            tc.reportCondition('the Playback Bot is reachable', !!bot);
            if (!bot) return;
            bot.reset();

            const loaded = tc.waitForEvent('stateManager:rulesLoaded', 8000);
            tc.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: 'cloudberryMixedLoop' });
            await loaded;
            await tc.stateManager.pingWorker('after-rules-load', 3000);
            const sphereState = getSphereStateSingleton();
            await sphereState.loadSphereLog('embedded:cloudberryMixedLoop', sphereLog.map((e) => JSON.stringify(e)).join('\n'));
            const sphereLocations = (sphereState.getSphereData() ?? []).flatMap((e) => e?.locations ?? []);
            tc.reportCondition(`the sphere log has locations (${sphereLocations.length})`, sphereLocations.length > 0);
            const on = await tc.pollForCondition(() => gs()?.isLoopModeActive === true, 'loop mode active (loop_costs)', 8000, 100);
            tc.reportCondition('loop mode active (auto-enabled by the generated loop_costs)', !!on);
            if (!on) return;
            const how = Object.keys(sidecars).map((r) => `${r}:${sidecars[r].substrate}/${loopStateSingleton.getRegionCaptureShape?.(r)}/${loopStateSingleton.regionSolver?.(r)}`);
            tc.log(`regions: ${how.join(', ')}`);
            tc.reportCondition(`maze regions are walked by delegation, Cloudberry levels by the page's bot (${how.join(', ')})`,
                mazes.every((r) => loopStateSingleton.regionSolver?.(r) === 'delegation')
                && clouds.every((r) => loopStateSingleton.regionSolver?.(r) === 'walkTo'
                    && loopStateSingleton.getRegionCaptureShape?.(r) === 'summary'));
            bot.refresh();

            // Real time, no Instant: a Cloudberry Bot block is the page's own play, priced by its game clock.
            try {
                book.clear();
                tc.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
                await bot.play();
                const finished = await tc.pollForCondition(() => (bot.getStatus() || '').startsWith('finished'),
                    'the bot finishes the mixed world in loop mode', MIX_BUDGET_MS, 500);
                const runner = bot.getLoopRunner?.();
                tc.reportCondition(`the bot finished (status: "${bot.getStatus()}", loops: ${runner?.getLoopCount?.() ?? '?'})`, !!finished);
                if (!finished) tc.log(`TRACE ${JSON.stringify(trace.slice(0, 60))}; ${queueDiag()}`);
                const snap = await snapshot(tc);
                const checked = new Set(checkedList(snap));
                const missing = sphereLocations.filter((n) => !checked.has(n));
                tc.reportCondition(`every sphere-log location checked (missing: ${missing.slice(0, 5).join(', ') || 'none'})`, missing.length === 0);
                tc.reportCondition('Victory received', Number(snap.inventory?.Victory ?? 0) > 0);
                const visited = new Set(trace.map((t) => t.split('->')[1]?.split(' ')[0]));
                tc.reportCondition(`the player went through maze rooms AND Cloudberry levels (${[...visited].join(',')})`,
                    mazes.some((r) => visited.has(r)) && clouds.some((r) => visited.has(r)));
                const cbSpent = clouds.reduce((t, r) => t + book.spentIn(r), 0);
                tc.reportCondition(`the Cloudberry levels spent mana from the shared pool (their game seconds: ${cbSpent})`, cbSpent > 0);
                tc.log(`COST per region: ${JSON.stringify(Object.fromEntries(Object.keys(sidecars).map((r) => [r, book.spentIn(r)])))}; `
                    + `loops ${runner?.getLoopCount?.() ?? '?'}; bot log ${JSON.stringify((bot.getLog?.() ?? []).map((e) => e.text ?? e).slice(-20))}`);
            } finally {
                bot.stop();
            }
        });
    } finally {
        tc.eventBus.unsubscribe('gameState:regionChanged', onRC, 'tests');
        book.stop();
    }
}

registerTest({
    id: 'cloudberry-mixed-loop-bot-victory',
    name: 'Cloudberry loop mode, MIXED world: the Playback Bot plays maze rooms and Cloudberry levels on one mana pool to Victory',
    description: 'The committed cloudberry_maze_mix_worldgen (maze start + three Cloudberry levels), generated in loop mode '
               + '(its own loop_costs), and its sphere log. The Playback Bot plays it in loop mode: maze blocks by delegation, Cloudberry '
               + 'blocks by the page\'s bot (priced by the game clock), until every sphere-log location is checked.',
    testFunction: restoresSavedQueues(mixedWorldLoopBot),
    category: CATEGORY,
    enabled: false,
});
