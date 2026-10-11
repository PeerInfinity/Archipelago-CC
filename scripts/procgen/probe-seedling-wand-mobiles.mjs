#!/usr/bin/env node
/**
 * probe-seedling-wand-mobiles — ⛓⛓⛓ seedling-fidelity-wand D1: A WAND SHOT AND WHAT IT OPENS, ASKED OF THE GAME TICK
 * BY SAMPLED TICK (`probe-seedling-darktrap-mobiles.mjs`'s shape, one class over).
 *
 * `Player.wand()` adds a `WandShot` at the end of the wand animation; the shot is a `Mobile`, so the game's
 * `botMobiles()` reports it (`x`, `y`, `anim`, presence). `WandShot.checkEntity` opens ONLY a `MagicalLock`
 * (`MagicalLock.hit(shotType)` → `Game.setPersistence(tag, false)` the same tick); every other blocker — a
 * `WandLock` included, which is a `Lock` and so a plain `"Solid"` — only plays "die". This compares, at the SAME
 * tick and in the boot level, the model's live shots (`run.wandShotsLive`) against the game's rows, and the flags
 * the run CLEARED (`run.earnedClears`) against the game's `persistence_cleared` (its delta from the first sample):
 *   · SHOTS — the same count, each at the same (x, y) with the same anim ("flare" / "die");
 *   · FLAGS — the boot level's cleared set, restricted to its MagicalLock and WandLock tags (`wandSubjectTags`), is
 *     the model's at every sampled tick (a MagicalLock's open is a CLEAR; a WandLock that stays shut is the ABSENCE
 *     of one, which is why the negative witness is a set, not a row). Other flags are printed as INFO;
 *   · the PLAYER — the sample clock is calibrated on the player's x/y, which also witnesses the wall: a lock the
 *     model opens and the game keeps (or the reverse) moves the player differently on the walk into it.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-wand-mobiles.mjs --file=<tape.json>   a tape on disk
 *   … --tape=<fixture name>   a committed tape
 *   … --witness=<name>        re-witness a recorded `fixtures/wand-witness/<name>.json` (its embedded tape)
 *   … --out=<file.json>       write every sample with both readings
 *   … --record --name=<name>  write the TAPE and the GAME's samples to `fixtures/wand-witness/<name>.json`, which
 *                             `fidelityWand.test.js` replays against the model in node — only on a PASS.
 *                             ⚠ EMBEDDED, not added to `fixtures/tapes` (the roster is not moved by this slice).
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const TAPE = arg('tape');
    const WITNESS = arg('witness');
    const FILE = arg('file') ?? (WITNESS ? join(MODULE, 'fixtures', 'wand-witness', `${WITNESS}.json`) : null);
    if (!TAPE === !FILE) {
        console.error('probe-seedling-wand-mobiles: exactly one of --tape=<fixture name>, --file=<path> or '
            + '--witness=<name> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name') ?? TAPE;
    if (RECORD && !NAME) {
        console.error('probe-seedling-wand-mobiles: --record needs --name=<witness name> (or --tape=<fixture name>)');
        process.exit(2);
    }

    takeBoxLockOrExit({ name: 'probe-seedling-wand-mobiles.mjs', kind: 'browser' });

    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { modelWandSamples, wandSubjectTags } = await import(join(MODULE, 'wandWitness.js'));

    const embedded = WITNESS ? JSON.parse(readFileSync(FILE, 'utf8')).tape : null;
    const tape = TAPE ? loadTape(TAPE)
        : parseTape(embedded ? JSON.stringify(embedded) : readFileSync(FILE, 'utf8'));
    const LABEL = TAPE ?? FILE;

    const col = modelWandSamples(tape, atlasLevelSource());

    // ── the GAME ────────────────────────────────────────────────────────────
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    let status = null;
    try {
        const page = await browser.newPage();
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
            await page.waitForTimeout(250);
        }
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
            await page.waitForTimeout(250);
        }
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[name]() : g[name](x));
        }, [n, a]);
        const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = await bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const deadline = Date.now() + 600000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            frames.push({
                status: { tick: s.tick, level: s.level, finished: s.finished, hits: s.hits ?? null,
                    cleared: (s.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`) },
                mobiles: m,
            });
            if (s.finished) { status = s; break; }
        }
    } finally {
        await browser.close();
    }
    if (!status) {
        console.log('FAIL: the tape never finished inside the deadline');
        process.exit(1);
    }

    // ── the JOIN ────────────────────────────────────────────────────────────
    const rowsOf = (f) => f.mobiles.mobiles ?? [];
    const tickOf = (f) => f.mobiles.tick ?? f.status.tick;
    const playerOf = (f) => rowsOf(f).find((r) => /Player$/.test(r.cls));
    const shotsOf = (f) => rowsOf(f).filter((r) => /WandShot$/.test(r.cls));
    const inTape = frames.filter((f) => {
        const t = tickOf(f);
        return Number.isInteger(t) && t >= 0 && t <= tape.tick_count && col[t] && playerOf(f);
    });
    const byTick = new Map();
    for (const f of inTape) if (!byTick.has(tickOf(f))) byTick.set(tickOf(f), f);
    const samples = [...byTick.values()].sort((a, b) => tickOf(a) - tickOf(b));

    const fits = [];
    for (let shift = -3; shift <= 3; shift += 1) {
        const ok = samples.every((f) => {
            const m = col[tickOf(f) + shift];
            const p = playerOf(f);
            return m && Math.abs(m.px - p.x) < 1e-9 && Math.abs(m.py - p.y) < 1e-9;
        });
        if (ok) fits.push(shift);
    }
    const calibrated = fits.length === 1 && fits[0] === 0;
    const firstOff = samples.find((f) => {
        const m = col[tickOf(f)];
        const p = playerOf(f);
        return Math.abs(m.px - p.x) >= 1e-9 || Math.abs(m.py - p.y) >= 1e-9;
    });
    if (firstOff) {
        const p = playerOf(firstOff);
        const m = col[tickOf(firstOff)];
        console.log(`      the player first differs at sampled t ${tickOf(firstOff)}: game (${p.x}, ${p.y}) model `
            + `(${m.px}, ${m.py})`);
    }
    console.log(`${calibrated ? 'PASS' : 'FAIL'}: the sample clock is the model's — `
        + `${samples.length} sampled tick(s) inside the tape of ${tape.tick_count}; shifts that fit every player x: `
        + `[${fits.join(', ')}] (must be exactly [0])`);

    const bootLevel = tape.boot.level;
    // ⛔ THE FLAG CLAIM IS SCOPED TO THE SUBJECT: the boot level's MagicalLock and WandLock tags (what a wand shot
    // could clear). Any OTHER flag the two sides time differently is printed as INFO — another verb's ledger, measured
    // here in passing and handed to its owner, never folded into this witness's verdict.
    const subject = wandSubjectTags(tape.boot.level, atlasLevelSource());
    const inSubject = (c) => subject.has(c);
    const info = [];
    const inBoot = (f) => col[tickOf(f)].level === bootLevel && f.status.level === bootLevel;
    const baseline = new Set(samples.find(inBoot)?.status.cleared ?? []);
    const disagreements = [];
    let shotCompares = 0;
    let shotSamples = 0;
    const rows = [];
    for (const f of samples) {
        if (!inBoot(f)) continue;
        const t = tickOf(f);
        const gs = shotsOf(f).map((g) => ({ x: g.x, y: g.y, anim: g.anim, anim_index: g.anim_index }));
        const ms = col[t].shots;
        if (gs.length > 0) shotSamples += 1;
        if (gs.length !== ms.length) {
            disagreements.push(`t ${t}: game has ${gs.length} WandShot row(s), the model ${ms.length}`);
        }
        for (const g of gs) {
            const m = ms.find((s) => Math.abs(s.x - g.x) < 1e-9 && Math.abs(s.y - g.y) < 1e-9);
            if (!m) {
                disagreements.push(`t ${t}: the game's WandShot at (${g.x}, ${g.y}) "${g.anim}" has no model shot `
                    + `there (model: ${JSON.stringify(ms.map((s) => [s.x, s.y, s.anim]))})`);
                continue;
            }
            shotCompares += 1;
            if (m.anim !== g.anim) disagreements.push(`t ${t}: shot at (${g.x}, ${g.y}) game "${g.anim}" model "${m.anim}"`);
        }
        const gameNew = (f.status.cleared ?? []).filter((c) => !baseline.has(c) && c.startsWith(`${bootLevel}:`)).sort();
        const modelNew = col[t].cleared.filter((c) => c.startsWith(`${bootLevel}:`)).sort();
        const g1 = gameNew.filter(inSubject);
        const m1 = modelNew.filter(inSubject);
        if (g1.join() !== m1.join()) {
            disagreements.push(`t ${t}: wand-subject flags cleared in L${bootLevel} — game [${g1}] model [${m1}]`);
        }
        const g2 = gameNew.filter((c) => !inSubject(c));
        const m2 = modelNew.filter((c) => !inSubject(c));
        if (g2.join() !== m2.join()) info.push(`t ${t}: OTHER flags cleared in L${bootLevel} — game [${g2}] model [${m2}]`);
        rows.push({ t, player: { x: playerOf(f).x, y: playerOf(f).y }, shots: gs, cleared: gameNew });
    }
    const agree = rows.length > 0 && disagreements.length === 0;
    console.log(`${agree ? 'PASS' : 'FAIL'}: every WandShot's position, anim and presence, and the boot level's cleared `
        + `flags, are the model's at every sampled tick in L${bootLevel} — ${shotCompares} shot comparison(s) over `
        + `${shotSamples} sample(s) with a shot in flight, ${rows.length} sample(s) in all`);
    for (const d of disagreements.slice(0, 16)) console.log(`      ${d}`);
    if (disagreements.length > 16) console.log(`      … ${disagreements.length - 16} more`);
    console.log(`      subject flags: [${[...subject].join(', ')}]`);
    for (const d of info.slice(0, 8)) console.log(`      INFO ${d}`);
    const lastRow = rows.at(-1);
    console.log(`      game at the end: player (${lastRow?.player.x}, ${lastRow?.player.y}), cleared in L${bootLevel} `
        + `[${lastRow?.cleared ?? ''}], hits ${status.hits ?? '?'}, level ${status.level}, tick ${status.tick}`);
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ tape: LABEL, page: PAGE_NAME, calibrated, fits, disagreements, info, rows },
            null, 1)}\n`);
        console.log(`wrote ${OUT}`);
    }
    if (RECORD) {
        if (!(calibrated && agree)) {
            console.log('NOT RECORDED: the run did not pass — a witness the model disagrees with is not a fixture');
        } else {
            const dir = join(MODULE, 'fixtures', 'wand-witness');
            mkdirSync(dir, { recursive: true });
            const out = {
                name: NAME,
                source: TAPE ? LABEL : (LABEL.startsWith(`${REPO}/`) ? LABEL.slice(REPO.length + 1) : basename(LABEL)),
                page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-wand-mobiles.mjs --record',
                note: 'the GAME\'s WandShot rows (`botMobiles()`) and the boot level\'s newly cleared flags '
                    + '(`botStatus().persistence_cleared` less the first sample\'s) at each sampled tick of the boot level',
                samples: rows,
                tape: TAPE ? null : (embedded ?? JSON.parse(readFileSync(FILE, 'utf8'))),
            };
            const path = join(dir, `${NAME}.json`);
            writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${out.samples.length} sampled tick(s)`);
        }
    }
    process.exit(calibrated && agree ? 0 : 1);
}
