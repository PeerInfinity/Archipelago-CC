#!/usr/bin/env node
/**
 * Concept library T4: THE JOINED WORLD, PLAYED — the first committed world that
 * names concepts, played end to end in a headless page. The world is the
 * committed `concept_trial` preset (`make-seedling-spiral-room-preset.mjs
 * --state=concept-trial`, from `CONCEPT_TRIAL_STATE`): a TEXT-ADVENTURE START
 * holding `Progressive Sword`, whose exit on to a maze is gated on it and
 * realised as a GUARDIAN (the room's payload `prose`); the maze holds
 * `Progressive Swim`, and its exit on to a second maze (victory) is gated on it
 * and realised as WATER (`water_gate_0`, painted). Every expectation — the
 * rooms, the gates, the items, the prose, the colours, the victory — is read
 * off that preset, never typed here.
 *
 *   Phase A — boot: the player starts in the text-adventure START, the wrapper
 *     renders its guarded exit INACCESSIBLE.
 *   Phase T — THE GUARDIAN BARS THE WAY: a real click on the guarded exit; the
 *     engine's message log shows the guardian's BLOCKED prose (templated with the
 *     target region), not the generic line, and the player stays put.
 *   Phase K — THE SWORD: a real click on the room's location; the engine shows
 *     the sword's check prose and the state manager holds the sword.
 *   Phase O — THE GUARDIAN FALLS: the exit is now accessible; a real click moves
 *     the player into the maze and the log shows the PASSED-WITH prose.
 *   Phase P — THE MAZE'S WORLD: the maze panel holds the region, its world's item
 *     library carries the concept items with the table's colours, and its gate's
 *     obstacle definition carries `concept: 'water'` with the realisation's colour
 *     and symbol.
 *   Phase B — THE WATER BARS THE WAY: before the swim, the renderer's own
 *     clearance read paints the gate CLOSED, and the engine's `whyBlocked` for the
 *     step onto the gate names it (`water_gate_0 is shut`). ⛔ READ, NOT WALKED
 *     (measured, not skipped): the only floor path from the maze's entrance to the
 *     gate crosses the swim's cell, which the maze collects on step (a static row
 *     below reads it off the sidecar), so no player meets the gate without it.
 *   Phase K2 — THE SWIM: real keys walk the maze to the swim; the state manager
 *     holds it.
 *   Phase O2 — THE WATER CROSSED: the same clearance read now paints the gate
 *     cleared (dimmed), `whyBlocked` for the same step is null, and real keys
 *     cross the gate's exit into the victory maze.
 *   Phase V — THE VICTORY: real keys onto the victory's cell; the state manager
 *     holds it.
 *   Phase C — WORLD COMPLETE: the rules' `completion_condition` (off the page's
 *     static data, against the live snapshot) HOLDS, and did not before V.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default
 * http://localhost:8000) and the `frontend/modules/textAdventureEngine`
 * submodule (the text adventure's engine).
 *
 * Run: node scripts/procgen/check-concept-trial-play.mjs [--host=http://localhost:8000] [--game=concept_trial]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { createRoomPlay } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door): the box
 * lock, the preset read and the browser all live in `main()`.
 */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'check-concept-trial-play.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const GAME = arg('game', 'concept_trial');

    // ── What the preset says ────────────────────────────────────────────────
    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { processMessageTemplate } = await M('textAdventureSubstrateWrapper/templating.js');
    const { CONCEPTS, conceptOfItem } = await M('procgenCore/concepts.js');
    const PRESET = JSON.parse(readFileSync(join(REPO, `frontend/presets/${GAME}/AP_1/AP_1_rules.json`), 'utf8'));
    const SIDECARS = PRESET.preset_sidecars['1'];
    const REGIONS = PRESET.regions['1'];
    const START = REGIONS.Menu.exits[0].connected_region;
    const TA = SIDECARS[START]?.playable_payload ?? null;
    /** The START's gated exit: its payload record, its document rule, its prose, where it goes. */
    const GUARDED = TA ? Object.keys(TA.prose?.exits ?? {})[0] ?? null : null;
    const GUARDED_EXIT = TA?.exits?.find((e) => e.exit_id === GUARDED) ?? null;
    const MAZE_ID = GUARDED_EXIT?.targetRegion ?? null;
    const TA_RULE = (REGIONS[START]?.exits ?? []).find((e) => e.connected_region === MAZE_ID)?.access_rule ?? null;
    const SWORD = TA_RULE?.rule === 'Has' ? TA_RULE.args.item_name : null;
    const PROSE = TA?.prose?.exits?.[GUARDED] ?? null;
    const SWORD_LOC = TA?.locations?.find((l) => l.item === SWORD) ?? null;
    const CHECK_PROSE = SWORD_LOC ? TA.prose?.locations?.[SWORD_LOC.name]?.checkMessage ?? null : null;
    const MAZE = SIDECARS[MAZE_ID]?.playable_payload ?? null;
    const [GATE_ID, GATE] = Object.entries(MAZE?.obstacleLib ?? {}).find(([, d]) => typeof d.concept === 'string') ?? [];
    const GATE_AT = MAZE?.obstacles?.find((o) => o.id === GATE_ID) ?? null;
    const GATE_EXIT = MAZE?.exits?.find((e) => GATE_AT && e.x === GATE_AT.x && e.y === GATE_AT.y) ?? null;
    const VICTORY_MAZE = GATE_EXIT?.targetRegion ?? null;
    const SWIM = GATE?.clear_rule?.rule === 'Has' ? GATE.clear_rule.args.item_name : null;
    const SWIM_AT = MAZE?.items?.find((i) => i.id === SWIM) ?? null;
    const COMPLETION = PRESET.game_info?.['1']?.completion_condition ?? null;
    const VICTORY = COMPLETION?.item ?? null;
    const VICTORY_AT = SIDECARS[VICTORY_MAZE]?.playable_payload?.items?.find((i) => i.id === VICTORY) ?? null;
    const wantBlocked = PROSE ? processMessageTemplate(PROSE.inaccessibleMessage, { exitName: GUARDED, destinationRegion: MAZE_ID }) : null;
    const wantPassed = PROSE ? processMessageTemplate(PROSE.moveMessage, { exitName: GUARDED, destinationRegion: MAZE_ID }) : null;
    /** The table's colours for the world's item concepts (`CONCEPTS[id].presentation`, via its item rows). */
    const TABLE_COLOURS = Object.fromEntries((PRESET.procgen_metadata?.['1']?.concepts ?? [])
        .filter((cid) => CONCEPTS[cid]?.item).map((cid) => [CONCEPTS[cid].item.id, MAZE?.itemLib?.[CONCEPTS[cid].item.id]?.color]));

    const URL = `${HOST}/frontend/?game=${GAME}&seed=1`;
    // ⛓ No wasm on this page (a maze and a text adventure), so no wasm channel:
    // the default launch, as the other non-wasm gates use. The wasm gates' arg
    // sets belong to gates that drive the recompiled game, and importing one
    // here made H2's roster (`headlessChromium.test.js`) count this gate as one
    // — a zero-pageerror claim on the logic-only channel is a claim that
    // channel's device-lost signature refutes for a WASM page, not for this one.
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const {
        check, failures, waitFor, currentRegion, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys,
    } = createRoomPlay({ page, wasmPage: '(none)', logs, name: 'check-concept-trial-play' });

    const held = (item) => page.evaluate((it) =>
        window.stateManagerProxy?.getLatestStateSnapshot?.()?.inventory?.[it] ?? 0, item);
    const completion = () => page.evaluate(() => {
        const sd = window.stateManagerProxy?.getStaticData?.();
        const snap = window.stateManagerProxy?.getLatestStateSnapshot?.();
        const cc = sd?.game_info?.[Object.keys(sd?.game_info ?? {})[0]]?.completion_condition ?? null;
        const holds = cc?.type === 'item_check' ? Number(snap?.inventory?.[cc.item] ?? 0) >= 1 : null;
        return { cc, holds };
    });
    /** The text adventure's iframe, as a player sees it: its message log and its links. */
    const ta = () => page.evaluate(() => {
        const d = document.querySelector('iframe.tasw-iframe')?.contentDocument ?? null;
        return {
            messages: [...(d?.querySelectorAll('.tae-msg') ?? [])].map((m) => m.textContent),
            exits: Object.fromEntries([...(d?.querySelectorAll('[data-exit-id]') ?? [])]
                .map((l) => [l.getAttribute('data-exit-id'), l.className])),
            items: Object.fromEntries([...(d?.querySelectorAll('[data-item-id]') ?? [])]
                .map((l) => [l.getAttribute('data-item-id'), l.className])),
        };
    });
    const taFrame = () => page.frameLocator('iframe.tasw-iframe');
    /**
     * EVERY line the engine displays, recorded as it is added (a MutationObserver
     * in the iframe): the log is re-rendered on each state change and emptied on a
     * room change, so a count-based slice of `.tae-msg` loses the very lines asked
     * about (measured on this gate's first runs: the check and passed-with lines).
     */
    const watchMessages = () => page.evaluate(() => {
        const d = document.querySelector('iframe.tasw-iframe')?.contentDocument;
        if (!d?.body) return false;
        const w = d.defaultView;
        w.__taeSeen = [];
        const take = (n) => {
            if (n.nodeType !== 1) return;
            if (n.matches?.('.tae-msg')) w.__taeSeen.push(n.textContent);
            for (const m of n.querySelectorAll?.('.tae-msg') ?? []) w.__taeSeen.push(m.textContent);
        };
        new w.MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach(take)))
            .observe(d.body, { childList: true, subtree: true });
        return true;
    });
    const seen = () => page.evaluate(() =>
        document.querySelector('iframe.tasw-iframe')?.contentDocument?.defaultView?.__taeSeen ?? null);
    const stays = async (region, ms) => {
        const until = Date.now() + ms;
        while (Date.now() < until) {
            // eslint-disable-next-line no-await-in-loop
            if ((await currentRegion()) !== region) return false;
            // eslint-disable-next-line no-await-in-loop
            await page.waitForTimeout(100);
        }
        return (await currentRegion()) === region;
    };
    /**
     * The maze panel's own reads for the concept gate: the clearance the renderer
     * paints with (`isObstacleCleared` + the panel's rule evaluator — what
     * `drawWorld` hands `paintConceptGate` as `cleared`) and the engine's
     * `whyBlocked` for the step onto the gate from its floor neighbour.
     */
    const gateReads = () => page.evaluate(async ({ id }) => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        const eng = await import('./modules/mazeRoom/mazeRoomEngine.js');
        const { isObstacleCleared } = await import('./modules/shared/procgen/library.js');
        const w = p?.world;
        if (!w) return null;
        const at = [...w.obstacles].find(([, oid]) => oid === id)?.[0];
        if (!at) return { region: p.currentRegionId, error: `no ${id} in the panel's world` };
        const [gx, gy] = at.split(',').map(Number);
        const evaluateRule = p._currentRuleEvaluator();
        const opts = evaluateRule ? { evaluateRule } : undefined;
        const cleared = isObstacleCleared(id, p.state.inventory, w.obstacleLib, opts);
        const moves = [[0, 1, eng.INPUT_N], [0, -1, eng.INPUT_S], [1, 0, eng.INPUT_W], [-1, 0, eng.INPUT_E]];
        const from = moves.map(([dx, dy, input]) => ({ x: gx + dx, y: gy + dy, input }))
            .find((c) => c.x >= 0 && c.y >= 0 && c.x < w.width && c.y < w.height && w.tiles[c.y * w.width + c.x] === 0
                && !w.obstacles.has(`${c.x},${c.y}`));
        const why = from ? eng.whyBlocked(w, { ...p.state, player_pos: { x: from.x, y: from.y } }, from.input, undefined, opts) : 'no floor neighbour';
        const def = w.obstacleLib[id];
        return {
            region: p.currentRegionId, gate: `${gx},${gy}`, from, cleared, why,
            def: { concept: def?.concept, color: def?.color, symbol: def?.symbol, placement: def?.placement },
            itemColours: Object.fromEntries(Object.entries(w.itemLib ?? {}).filter(([, r]) => r?.concept).map(([k, r]) => [k, r.color])),
        };
    }, { id: GATE_ID });

    try {
        // ── Static: what the preset says ────────────────────────────────────
        check('the preset\'s START is a text-adventure room whose one gated exit carries prose, read off its own rules',
            SIDECARS[START]?.substrate === 'text_adventure' && !!GUARDED && !!PROSE?.inaccessibleMessage && !!PROSE?.moveMessage,
            `start ${START}; ${GUARDED} -> ${MAZE_ID}, rule ${JSON.stringify(TA_RULE)}`);
        check(`the START's gate is the sword concept's item (${SWORD}) and the sword lies in the START (${SWORD_LOC?.name})`,
            conceptOfItem(SWORD, CONCEPTS) === 'sword' && !!SWORD_LOC && TA.exitGates?.[GUARDED]?.args?.item_name === SWORD,
            JSON.stringify(TA?.exitGates));
        check(`the maze ${MAZE_ID}'s concept gate ${GATE_ID} stands on its exit into ${VICTORY_MAZE} and needs ${SWIM} (the swim concept's item)`,
            SIDECARS[MAZE_ID]?.substrate === 'maze' && GATE?.concept === 'water' && !!GATE_EXIT && conceptOfItem(SWIM, CONCEPTS) === 'swim',
            JSON.stringify(GATE));
        const mazeReachesGateAvoiding = (avoid) => {
            const k = (x, y) => `${x},${y}`;
            const seen = new Set([k(MAZE.entrance.x, MAZE.entrance.y)]);
            const q = [MAZE.entrance];
            for (let i = 0; i < q.length; i += 1) {
                for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
                    const x = q[i].x + dx; const y = q[i].y + dy;
                    if (x === GATE_AT.x && y === GATE_AT.y) return true;
                    if (x < 0 || y < 0 || x >= MAZE.width || y >= MAZE.height || seen.has(k(x, y))
                        || MAZE.tiles[y * MAZE.width + x] !== 0 || avoid.has(k(x, y))) continue;
                    seen.add(k(x, y));
                    q.push({ x, y });
                }
            }
            return false;
        };
        check(`no player meets ${GATE_ID} WITHOUT ${SWIM}: the maze reaches it from its entrance, and every such path crosses `
            + `the swim's cell (collected on step) — so Phase B READS the refusal, measured`,
            !!SWIM_AT && mazeReachesGateAvoiding(new Set()) === true
            && mazeReachesGateAvoiding(new Set([`${SWIM_AT.x},${SWIM_AT.y}`])) === false,
            `entrance ${JSON.stringify(MAZE?.entrance)}, swim ${SWIM_AT?.x},${SWIM_AT?.y}, gate ${GATE_AT?.x},${GATE_AT?.y}`);
        check(`the completion condition names ${VICTORY}, in the maze ${VICTORY_MAZE}`,
            COMPLETION?.type === 'item_check' && !!VICTORY_AT, JSON.stringify(COMPLETION));

        // ── Phase A — boot, in the text adventure ───────────────────────────
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await waitFor('rules loaded', () => page.evaluate(
            () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        check(`Phase A: the player starts in the text-adventure START ${START}`, (await currentRegion()) === START,
            String(await currentRegion()));
        const boot = await waitFor(`the wrapper renders ${START}'s exit ${GUARDED} and its location`, async () => {
            const v = await ta();
            return v.exits[GUARDED] && v.items[SWORD_LOC.name] ? v : null;
        }, 20000);
        check('Phase A: the message watcher is installed in the text adventure\'s iframe', await watchMessages());
        check(`Phase A: ${GUARDED} renders tae-link-inaccessible, and no ${SWORD} is held`,
            boot.exits[GUARDED].includes('tae-link-inaccessible') && (await held(SWORD)) === 0,
            `${boot.exits[GUARDED]}; holds ${await held(SWORD)}`);

        // ── Phase T — the guardian bars the way ─────────────────────────────
        const beforeT = (await seen()).length;
        await taFrame().locator(`[data-exit-id="${GUARDED}"]`).click();
        const saidBlocked = await waitFor('the guardian\'s blocked prose', async () =>
            ((await seen()).slice(beforeT).includes(wantBlocked) ? true : null), 5000).catch(() => false);
        const afterT = (await seen()).slice(beforeT);
        check(`Phase T: a click on ${GUARDED} shows the GUARDIAN's blocked prose in the engine's log, not the generic line`,
            saidBlocked === true && !afterT.some((m) => m.startsWith("You can't go that way")), JSON.stringify(afterT));
        check(`Phase T: …and the player stays in ${START} for 2000 ms`, await stays(START, 2000), String(await currentRegion()));

        // ── Phase K — the sword ─────────────────────────────────────────────
        const beforeK = (await seen()).length;
        await taFrame().locator(`[data-item-id="${SWORD_LOC.name}"]`).click();
        const gotSword = await waitFor(`${SWORD} arrives`, async () => ((await held(SWORD)) >= 1) || null, 10000).catch(() => null);
        const [head, tail] = CHECK_PROSE ? CHECK_PROSE.split('{item}') : ['', ''];
        const saidCheck = (await seen()).slice(beforeK).some((m) => m.startsWith(head) && m.includes(SWORD) && m.endsWith(tail));
        check(`Phase K: a click on ${SWORD_LOC.name} checks it — the state manager holds ${SWORD}, and the log shows the sword's check prose`,
            !!gotSword && saidCheck, `holds ${await held(SWORD)}; ${JSON.stringify((await seen()).slice(beforeK))}`);

        // ── Phase O — the guardian falls ────────────────────────────────────
        const open = await waitFor(`${GUARDED} becomes accessible`, async () =>
            ((await ta()).exits[GUARDED]?.includes('tae-link-accessible') ? true : null), 8000).catch(() => false);
        check(`Phase O: with ${SWORD} held, ${GUARDED} renders tae-link-accessible`, open === true, (await ta()).exits[GUARDED]);
        const beforeO = (await seen()).length;
        await taFrame().locator(`[data-exit-id="${GUARDED}"]`).click();
        const moved = await waitFor(`the player moves to ${MAZE_ID}`, async () =>
            ((await currentRegion()) === MAZE_ID ? true : null), 10000).catch(() => false);
        const afterO = (await seen())?.slice(beforeO) ?? [];
        check(`Phase O: a click on ${GUARDED} moves the player into the maze ${MAZE_ID}, and the log showed the PASSED-WITH prose`,
            moved === true && afterO.includes(wantPassed), `region ${await currentRegion()}; ${JSON.stringify(afterO)}`);

        // ── Phase P — the maze's world ──────────────────────────────────────
        await waitFor(`the maze panel holds ${MAZE_ID}`, async () => ((await mazePlayer())?.region === MAZE_ID ? true : null), 20000);
        const P = await gateReads();
        check(`Phase P: the maze world's item library carries the concept items in the table's colours (${JSON.stringify(TABLE_COLOURS)})`,
            JSON.stringify(P?.itemColours) === JSON.stringify(TABLE_COLOURS)
            && TABLE_COLOURS['Progressive Sword'] === '#c0a040' && TABLE_COLOURS['Progressive Swim'] === '#40b0c0',
            JSON.stringify(P?.itemColours));
        check(`Phase P: the maze world's ${GATE_ID} is a concept gate — concept water, the realisation's colour and symbol`,
            P?.def?.concept === 'water' && P.def.color === GATE.color && P.def.symbol === GATE.symbol && P.def.placement === 'gate',
            JSON.stringify(P?.def));

        // ── Phase B — the water bars the way (read) ─────────────────────────
        check(`Phase B: before the swim (holds ${await held(SWIM)}), the renderer's clearance paints ${GATE_ID} CLOSED`,
            (await held(SWIM)) === 0 && P?.cleared === false, JSON.stringify(P));
        check(`Phase B: the engine's whyBlocked for the step onto ${GATE_ID} names it`,
            typeof P?.why === 'string' && P.why.startsWith(`${GATE_ID} is shut`), JSON.stringify(P?.why));

        // ── Phase K2 — the swim ─────────────────────────────────────────────
        // ⛔ MEASURED on this gate's first runs: a key pressed the moment the maze
        //   panel holds the region can land before the panel owns the keyboard, and
        //   is lost. Wait for the keyboard, as a player waits to see the maze.
        const mazeKeys = await waitFor('the maze panel has the keyboard', mazeHasKeys, 10000).catch(() => null);
        check('Phase K2: after the text adventure\'s move the MAZE panel has the page\'s keyboard (no click)',
            typeof mazeKeys === 'string' && mazeKeys.startsWith('maze-room-panel'), String(mazeKeys));
        const toSwim = await mazeKeyPlan({ tile: { x: SWIM_AT.x, y: SWIM_AT.y } });
        await pressKeys(toSwim.keys ?? []);
        const gotSwim = await waitFor(`${SWIM} arrives`, async () => ((await held(SWIM)) >= 1) || null, 10000).catch(() => null);
        check(`Phase K2: real keys walked the maze to ${SWIM_AT.locationName} and collected ${SWIM}`,
            !!gotSwim, `${toSwim.keys?.length ?? toSwim.error} key(s); holds ${await held(SWIM)}`);

        // ── Phase O2 — the water crossed ────────────────────────────────────
        const O2 = await waitFor(`${GATE_ID} reads cleared`, async () => {
            const r = await gateReads();
            return r?.cleared === true ? r : null;
        }, 8000).catch(async () => gateReads());
        check(`Phase O2: with ${SWIM} held the same clearance read paints ${GATE_ID} cleared (dimmed), and whyBlocked is null`,
            O2?.cleared === true && O2.why === null, JSON.stringify(O2));
        const toExit = await mazeKeyPlan({ exitTo: VICTORY_MAZE });
        await pressKeys(toExit.keys ?? []);
        const crossed = await waitFor(`the player moves to ${VICTORY_MAZE}`, async () =>
            ((await currentRegion()) === VICTORY_MAZE ? true : null), 15000).catch(() => false);
        check(`Phase O2: real keys cross ${GATE_ID}'s exit into ${VICTORY_MAZE}`, crossed === true,
            `${toExit.keys?.length ?? toExit.error} key(s); region ${await currentRegion()}`);

        // ── Phase V — the victory ───────────────────────────────────────────
        const beforeV = await completion();
        check('Phase V: before the victory the completion condition does NOT hold (the probe can say no)',
            beforeV.holds === false, JSON.stringify(beforeV));
        await waitFor(`the maze panel holds ${VICTORY_MAZE}`, async () => ((await mazePlayer())?.region === VICTORY_MAZE ? true : null), 20000);
        const toVictory = await mazeKeyPlan({ tile: { x: VICTORY_AT.x, y: VICTORY_AT.y } });
        await pressKeys(toVictory.keys ?? []);
        const gotV = await waitFor(`${VICTORY} arrives`, async () => ((await held(VICTORY)) >= 1) || null, 10000).catch(() => null);
        check(`Phase V: real keys walked onto ${VICTORY_AT.locationName} and the state manager holds ${VICTORY}`,
            !!gotV, `${toVictory.keys?.length ?? toVictory.error} key(s); holds ${await held(VICTORY)}`);

        // ── Phase C — world complete ────────────────────────────────────────
        const after = await completion();
        check('Phase C: WORLD COMPLETE — the rules\' completion_condition (off the page\'s static data) HOLDS on the live snapshot',
            after.holds === true && JSON.stringify(after.cc) === JSON.stringify(COMPLETION), JSON.stringify(after));
        check('no page error on the way', pageErrors.length === 0, pageErrors.join(' | '));
    } catch (err) {
        check(`fatal: ${err.message}`, false);
        console.log(`PAGE LOGS (last 60):\n${logs.slice(-60).join('\n')}`);
    } finally {
        await browser.close();
    }

    const failed = failures();
    console.log(failed === 0
        ? '\nOK: the concept trial plays — the guardian barred the text adventure\'s exit and fell to the sword, the '
            + 'maze\'s water gate stood closed until the swim, and the victory completed the world'
        : `\nFAILED: ${failed} check(s)`);
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
