#!/usr/bin/env node
/**
 * check-seedling-editor-boot — THE EDITOR ARC SLICE 5 ACCEPTANCE ROW.
 *
 * Does the PAGE, in a browser, boot at the TRUE GAME START, does the boot
 * FORM really drive the block the SOLVE button reads, and does the declared
 * DESPAWN get checked against the model's own removal?
 *
 * ── WHAT THIS ADDS OVER THE VITEST ROWS ───────────────────────────────
 *
 * `watchSolve.test.js` and `watchManual.test.js` prove the DERIVATIONS in
 * CI: the true-start constant against the chain, `itemFlagsOf`/
 * `withItemFlag` over parsed blocks, `checkSolveDespawns` on a driven run.
 * This proves the PAGE'S PATH to them — the fetch that replaces the old
 * frozen literal, the checkboxes as DOM, the textarea round trip through
 * real `input` events, and (the reason this row exists at all) that the
 * button reads the box.
 *
 * ⛔⛔ THE ROW THIS FILE WAS WRITTEN FOR. Until slice 5, `runSolve` fetched
 * a staging block, printed it into the "starting conditions" textarea, and
 * then solved its own CLOSURE COPY — so every edit anyone made to that
 * editor since slice 1 shipped was silently discarded. A form writing into
 * a box nobody reads is a control that does nothing and reports success,
 * which is why the checkbox rows below all end at the SOLVED RUN rather
 * than at the textarea's bytes.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * its three siblings — the arc's non-skipping gate is the CLI export
 * (kickoff §8.9), and `--strict` is how the skip became addressable.
 *
 * Run: node scripts/procgen/check-seedling-editor-boot.mjs
 *      node scripts/procgen/check-seedling-editor-boot.mjs --host=http://localhost:8003
 */

import { chromium } from '@playwright/test';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';
const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

const alive = await fetch(`${HOST}/${TAPES}/r7-act2-1.json`).then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}

const browser = await chromium.launch();

async function open(url) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return { page, errors };
}

const bootBlock = async (page) => JSON.parse(await page.inputValue('#bootBox'));

/**
 * ⚠ The RAW editor lives behind a `<details>` on purpose — the form is the
 * quick path and the JSON is the spine (⚖ kickoff §1.7). A row that types
 * into the textarea has to open it, exactly as a user would.
 */
const openRawEditor = (page) =>
    page.$eval('#bootPanel details', (d) => { d.open = true; });

// ── ROW 1: the DEFAULT boot is the true game start ───────────────────────

console.log('\n## the default boot — no ?boot=, nothing typed');
{
    const { page, errors } = await open(`${PAGE}?source=solve`);
    await page.waitForFunction(() => document.querySelector('#bootBox')?.value?.length > 0);
    const block = await bootBlock(page);

    /**
     * ⛔ THE NUMBERS ARE THE ROW. The literal this replaced was
     * `{level: 0, x: 16, y: 16}` with `pins: []` and `rng: null` — honest
     * (nothing pre-cleared) and still a state the game never has. L0's real
     * spawn is (80,128); every honest walk in the tree pins `dead_frames`.
     */
    check(JSON.stringify(block.boot) === JSON.stringify({ level: 0, x: 80, y: 128 }),
        '⛓ the page boots at THE TRUE GAME START, not the atlas door convention',
        JSON.stringify(block.boot));
    check(JSON.stringify(block.pins) === JSON.stringify(['dead_frames']) && block.rng !== null,
        '⛓ …with the fields a hand-typed default could not know — pins and rng',
        `pins ${JSON.stringify(block.pins)}, rng.seed ${block.rng?.seed}`);
    check(block.noclip === false && block.noDamage === false
        && JSON.stringify(block.persistence) === '[]',
        'an HONEST start: collision on, damage on, nothing cleared');

    const title = await page.textContent('#title');
    check(/TRUE GAME START/.test(title) && /r7-act2-1/.test(title),
        '⛓ …and it SAYS where the block came from — a derived default names its source',
        title);
    check(errors.length === 0, 'no page errors — clean', errors.slice(0, 2).join(' | '));
    await page.close();
}

// ── ROW 2: the FORM, both directions, ending in the RUN ──────────────────

console.log('\n## the boot form — two checkboxes over ONE parsed block');
{
    const { page, errors } = await open(`${PAGE}?source=solve`);
    await page.waitForFunction(() => document.querySelector('#bootBox')?.value?.length > 0);

    check(await page.isVisible('#bootForm-sword') && await page.isVisible('#bootForm-shield'),
        'the two checkboxes are mounted, generated from ITEM_FORM_FIELDS');
    /**
     * ⚠ THE THIRD STATE IS ON SCREEN. `r7-act2-1` declares `seam: null`, so
     * neither flag is DECLARED — and "undeclared" and "declared false" are
     * different segments (`seamToBlock`'s law). An unticked box would say
     * the wrong one.
     */
    check(await page.$eval('#bootForm-sword', (el) => el.indeterminate === true),
        '⚠ an UNDECLARED flag renders indeterminate, not unticked',
        'the default block declares no seam at all');

    // ── direction 1: the box writes the block ──
    await page.check('#bootForm-sword');
    const afterTick = await bootBlock(page);
    check(afterTick.seam?.items?.hasSword === true,
        '⛓ ticking the box WROTE seam.items.hasSword into the textarea',
        JSON.stringify(afterTick.seam));
    check(Object.keys(afterTick.seam?.items ?? {}).length === 1,
        '⚠ …and ONLY that flag — a partial seam stays partial',
        JSON.stringify(Object.keys(afterTick.seam?.items ?? {})));

    // ── direction 2: the block writes the boxes ──
    const edited = { ...afterTick, seam: { items: { hasSword: false, hasShield: true } } };
    await openRawEditor(page);
    await page.fill('#bootBox', JSON.stringify(edited, null, 4));
    await page.waitForFunction(() => document.querySelector('#bootForm-shield').checked === true);
    check(await page.$eval('#bootForm-sword', (el) => !el.checked && !el.indeterminate)
        && await page.$eval('#bootForm-shield', (el) => el.checked),
        '⛓⛓ …and TYPING in the box re-derives the boxes — one source of truth, both ways');

    // ── the refusal: a box that cannot parse disables the controls ──
    await page.fill('#bootBox', '{ not json');
    await page.waitForFunction(() => document.querySelector('#bootForm-sword').disabled === true);
    const why = await page.textContent('#bootForm');
    check(/will not parse/.test(why),
        '⛔ a textarea that will not parse DISABLES the boxes, with the parser\'s message',
        why.replace(/\s+/g, ' ').trim().slice(0, 110));
    check(errors.length === 0, 'no page errors — clean', errors.slice(0, 2).join(' | '));
    await page.close();
}

// ── ROW 3: ⛔ THE BUTTON READS THE BOX ───────────────────────────────────

console.log('\n## ⛔ the SOLVE button solves what is IN THE BOX (the slice\'s own defect)');
{
    /**
     * ⛓ L11 IS CHOSEN, AND THE CHOOSING IS THE ROW. `r7-act2-11`'s boot
     * declares the sword TRUE; unticking it must reach the solved RUN, not
     * merely the textarea. Asserted through `window.__editorSolve`, which is
     * written from the solve's own output — so a page that kept its closure
     * copy would report the tape's flag whatever the box said.
     */
    const boot = `${TAPES}/r7-act2-11.json`;
    const { page, errors } = await open(`${PAGE}?source=solve&boot=${boot}`);
    await page.waitForFunction(() => document.querySelector('#bootBox')?.value?.length > 0);

    check(await page.$eval('#bootForm-sword', (el) => el.checked),
        'the form reads r7-act2-11\'s DECLARED sword as ticked');
    await page.uncheck('#bootForm-sword');
    const block = await bootBlock(page);
    check(block.seam.items.hasSword === false,
        '…and unticking wrote a real `false` into the block');

    /**
     * ⛔⛔ THE DECISIVE ROW, and it is a REFUSAL on purpose. A page that kept
     * its closure copy would solve happily whatever the box contained, so
     * the sharpest evidence that the box is read is a box that cannot be
     * read: the parser's own message must come back out of the SOLVE button.
     */
    await openRawEditor(page);
    await page.fill('#bootBox', '{ "boot": { "level": 4 } }');
    await page.click('#solveGo');
    await page.waitForFunction(() => window.__editorSolve?.status === 'refused',
        null, { timeout: 30000 });
    const refusal = await page.evaluate(() => window.__editorSolve.message);
    check(/noclip must be a boolean/.test(refusal),
        '⛔⛔ SOLVE reads the BOX — a block it cannot parse refuses with the PARSER\'s message',
        refusal.slice(0, 110));

    /**
     * ⛓ AND THE SECOND HALF: a block it CAN parse is the one it solves. The
     * box is retyped to level 4, whose census has TWO live exits — so the
     * no-goals default refuses BY NAMING LEVEL 4's exits. A page solving
     * r7-act2-11's own L11 block would have named something else entirely.
     */
    const l4 = { ...block, boot: { level: 4, x: 16, y: 16 } };
    await page.fill('#bootBox', JSON.stringify(l4, null, 4));
    await page.click('#solveGo');
    await page.waitForFunction(
        () => /live exit/.test(window.__editorSolve?.message ?? ''), null, { timeout: 30000 });
    const named = await page.evaluate(() => window.__editorSolve.message);
    check(/level 4 has 2 live exit\(s\)/.test(named) && /exit:64,16/.test(named),
        '⛓⛓ …and the block it SOLVED is the box\'s — the refusal names LEVEL 4\'s own exits',
        named.replace(/\s+/g, ' ').slice(0, 130));
    check(errors.length === 0, 'no page errors — clean', errors.slice(0, 2).join(' | '));
    await page.close();
}

// ── ROW 4: ⛓⛓⛓ THE DESPAWN CHECK, IN THE PAGE ───────────────────────────

console.log('\n## ⛓⛓⛓ the despawn check — r7-act2-6\'s declared bob, on screen');
{
    /**
     * ⛔ THE DRIVEN CASE. `r7-act2-6` declares `bob@112,48` removed in L6
     * with `at: 120` — the WITNESSING phases block's own END TICK, not the
     * removal's. The solve drops the declaration (it belongs to the hand
     * walk) and the model computes the drowning ITSELF at tick 55, inside
     * the band the witness closed. Both numbers are printed, because they
     * answer different questions and a row showing only one would invite
     * the reader to think they should match.
     */
    const boot = `${TAPES}/r7-act2-6.json`;
    const { page, errors } = await open(
        `${PAGE}?source=solve&boot=${boot}&goals=exit:224,32&solve=1`);
    await page.waitForFunction(() => window.__editorSolve?.status !== undefined,
        null, { timeout: 120000 });
    const readout = await page.evaluate(() => window.__editorSolve);
    check(readout.status === 'ok', 'the L6 solve ran', `status ${readout.status}`);
    const row = readout.despawns?.[0];
    check(row?.id === 'bob@112,48' && row?.at === 120,
        '⛓ the DECLARED row is carried into the check by id and witness tick',
        JSON.stringify(row));
    check(row?.reproduced === true && row?.t === 55 && row?.cause === 'water',
        '⛓⛓⛓ THE MODEL COMPUTES THE REMOVAL ITSELF — tick 55, by water',
        `computed t=${row?.t}, declared by ${row?.at}`);
    check(row.t <= row.at,
        '⛔ …INSIDE the band the witness closed — `at` is the phases block\'s end tick',
        `${row.t} <= ${row.at}`);
    const detail = await page.textContent('#detail');
    check(/DESPAWN CHECK/.test(detail) && /55/.test(detail) && /120/.test(detail),
        '⛓ …and BOTH numbers are on the page — a check nobody can see did not run',
        /DESPAWN CHECK[^·]*/.exec(detail)?.[0]?.trim());
    check(errors.length === 0, 'no page errors — clean', errors.slice(0, 2).join(' | '));
    await page.close();
}

// ── WHERE THE PLAYER STARTS — the entrances, the picker, the coordinates ─
/**
 * ⚖ THE USER'S ITEM: *"instead of guessing the player's start position in each
 * level, it read[s] the start position from entrances to that level, if
 * possible. There should also be a way to select between entrances when there
 * are more than one, and also a way to select specific coordinates."*
 *
 * ⛔ THE DERIVATION IS PROVED IN VITEST (`watchEntrances.test.js`), including
 * the row that matters most: for all 280 entrances in the atlas, BOOTING at
 * one lands the player exactly where `arriveIn` puts them when they walk
 * through that teleporter. What is proved HERE is the PAGE'S PATH to it — the
 * selector really populated, the fields really write the block, and the
 * attribution really changes when a human types.
 *
 * ⚠ L10 IS THE SUBJECT AND THE REASON IS MEASURED. It has exactly TWO
 * entrances (from L9 and from L11's stairs) plus a committed boot that sits ON
 * the L9 one — so "more than one to select between" is real here, and the
 * ladder's head is checkable against a known answer.
 */
{
    const { page, errors } = await open(`${PAGE}?source=solve&boot=${TAPES}/r7-act2-1.json`);
    console.log('\n## WHERE THE PLAYER STARTS — entrances, the picker, and typed coordinates');
    await page.waitForSelector('#bootStart', { timeout: 60000 });
    // Step to L10 through the page's own control, not by URL: the write path
    // is the subject.
    await page.fill('#bootLevel', '10');
    await page.dispatchEvent('#bootLevel', 'change');
    await page.waitForFunction(
        () => JSON.parse(document.getElementById('bootBox').value).boot.level === 10,
        null, { timeout: 60000 });
    await page.waitForTimeout(300);

    const read = () => page.evaluate(() => ({
        block: JSON.parse(document.getElementById('bootBox').value).boot,
        sel: document.getElementById('bootStart').value,
        options: [...document.getElementById('bootStart').options]
            .map((o) => ({ value: o.value, label: o.textContent })),
        x: document.getElementById('bootX').value,
        y: document.getElementById('bootY').value,
        note: document.getElementById('bootNote').textContent,
    }));

    const at10 = await read();
    const entranceOpts = at10.options.filter((o) => o.value.startsWith('entrance:'));
    check(entranceOpts.length === 2,
        '⛔ L10\'s TWO entrances are both offered — "select between them" needs more than one',
        entranceOpts.map((o) => o.value).join(', '));
    check(entranceOpts.some((o) => /from L9/.test(o.label))
        && entranceOpts.some((o) => /from L11/.test(o.label) && /stairs/.test(o.label)),
    '⛓ …each labelled by the room you came from, with the stairs one marked',
    entranceOpts.map((o) => o.label).join(' | '));
    check(at10.options.some((o) => o.value === 'custom'),
        '⛔ …and CUSTOM is always offered — "a way to select specific coordinates"');
    /**
     * ⛔⛔ THE LADDER'S HEAD. L10 HAS a committed boot, so it wins — Group A's
     * ruling, unchanged, and the entrances are additions rather than a
     * replacement for a position a real tape used.
     */
    check(at10.sel === 'committed' && /COMMITTED BOOT/.test(
        at10.options.find((o) => o.value === at10.sel)?.label ?? ''),
    '⛔⛔ L10 has a committed boot, so THAT is the default — entrances did not displace it',
    `${at10.sel} → ${at10.block.x},${at10.block.y}`);
    check(Number(at10.x) === at10.block.x && Number(at10.y) === at10.block.y,
        '⛓ the x/y fields hold exactly what the block holds', `${at10.x},${at10.y}`);

    // ── PICK THE OTHER ENTRANCE ─────────────────────────────────────
    const stairs = entranceOpts.find((o) => /from L11/.test(o.label));
    await page.selectOption('#bootStart', stairs.value);
    await page.waitForTimeout(300);
    const picked = await read();
    check(picked.block.x !== at10.block.x || picked.block.y !== at10.block.y,
        '⛔⛔⛔ PICKING AN ENTRANCE REWRITES THE BLOCK — the control does the thing',
        `${at10.block.x},${at10.block.y} → ${picked.block.x},${picked.block.y}`);
    check(Number(picked.x) === picked.block.x && Number(picked.y) === picked.block.y
        && picked.sel === stairs.value,
    '⛓ …and the fields and the selector follow it — one writer, no drift',
    `${picked.sel} → ${picked.x},${picked.y}`);
    /**
     * ⛔⛔ BOTH COORDINATE PAIRS, ALWAYS. The block holds `Game`'s ctor args
     * and the player is observed at +8,+8; a note printing one of them makes
     * the other look like a bug. This is the confusion that produced the
     * `chooseSpawn` defect the item uncovered.
     */
    const obs = /observed at \((\d+),(\d+)\)/.exec(picked.note);
    check(Boolean(obs) && Number(obs[1]) === picked.block.x + 8
        && Number(obs[2]) === picked.block.y + 8,
    '⛔⛔ the note prints the ctor args AND the observed player point, a half tile apart',
    /start [-\d]+,[-\d]+ —[^·]*/.exec(picked.note)?.[0]?.trim() ?? picked.note.slice(0, 90));

    /**
     * ⛔⛔⛔ AND A RE-COMMIT OF THE SAME LEVEL MUST NOT CLOBBER THE CHOICE.
     *
     * ⛓ MEASURED — this is a defect the row found. `setLevel` PICKS a start
     * position, which is right when the room changes and destructive when it
     * does not; a number input fires `change` on BLUR as well as on commit, so
     * "type a level, then click the entrance picker" delivered a second
     * `change` and silently reinstated the head of the ladder. The entrance
     * selection reverted from 48,32 to 48,80 between one read and the next.
     */
    await page.dispatchEvent('#bootLevel', 'change');
    await page.waitForTimeout(250);
    const requeried = await read();
    check(requeried.block.x === picked.block.x && requeried.block.y === picked.block.y
        && requeried.sel === picked.sel,
    '⛔⛔⛔ re-committing the SAME level leaves the picked entrance alone — the level field '
        + 'changes ROOMS, the start controls change POSITION',
    `${requeried.sel} → ${requeried.block.x},${requeried.block.y}`);

    // ── TYPE A COORDINATE ───────────────────────────────────────────
    await page.fill('#bootX', String(picked.block.x + 32));
    await page.dispatchEvent('#bootX', 'change');
    await page.waitForTimeout(50);
    await page.waitForTimeout(250);
    const typed = await read();
    check(typed.block.x === picked.block.x + 32 && typed.block.y === picked.block.y,
        '⛔ TYPING A COORDINATE WRITES THE BLOCK — and moves only the axis that was typed',
        `${typed.block.x},${typed.block.y}`);
    /**
     * ⛔⛔⛔ AND THE ATTRIBUTION FOLLOWS THE EDIT. The whole item is about
     * knowing where a start position came from; a selector still reading
     * "ENTRANCE from L11" over numbers somebody had since edited would be the
     * page asserting a provenance that is no longer true.
     */
    check(typed.sel === 'custom' && /CUSTOM/.test(typed.note),
        '⛔⛔⛔ …and the selector STOPS claiming the entrance — a typed number is CUSTOM',
        `${typed.sel} · ${typed.note.slice(0, 70)}`);

    // ⚠ A FRACTION IS REFUSED AND THE FIELD SNAPS BACK, so a rejected edit and
    // an accepted one cannot look the same.
    await page.fill('#bootY', '12.5');
    await page.dispatchEvent('#bootY', 'change');
    await page.waitForTimeout(250);
    const frac = await read();
    check(frac.block.y === typed.block.y && Number(frac.y) === typed.block.y
        && /whole number of pixels/.test(frac.note),
    '⚠ a fractional coordinate is REFUSED by name and the field snaps back to what is '
        + 'in force', `y=${frac.y}, ${frac.note.slice(0, 60)}`);

    // ── THE FOUR ROOMS NOTHING WALKS INTO ───────────────────────────
    /**
     * ⛔⛔ L58 IS ONE OF THE FOUR (58, 69, 81, 84 — measured). It falls through
     * to the page's own chooser, and the row that matters is that the chosen
     * cell is one the player can actually STAND in: `chooseSpawn` validated a
     * tile CENTRE and wrote it into a field the engine offsets by the half
     * tile, so five of a twelve-level sample used to spawn INSIDE A SOLID.
     * L58 was one of them.
     */
    await page.fill('#bootLevel', '58');
    await page.dispatchEvent('#bootLevel', 'change');
    await page.waitForFunction(
        () => JSON.parse(document.getElementById('bootBox').value).boot.level === 58,
        null, { timeout: 60000 });
    await page.waitForTimeout(400);
    const l58 = await read();
    check(l58.options.filter((o) => o.value.startsWith('entrance:')).length === 0
        && /no teleporter anywhere in the atlas leads into level 58/.test(l58.note),
    '⛔ L58 has NO entrance, and the page says so by name rather than showing an empty box',
    l58.note.slice(0, 120));
    check(l58.sel === 'page-chose' && /not a position the game ever used/.test(l58.note),
        '⛔ …so it falls back to the chooser, still labelled as a convenience nothing may '
        + 'rest on', `${l58.sel} → ${l58.block.x},${l58.block.y}`);
    /**
     * ⛔⛔⛔ AND THE CHOSEN CELL IS ONE THE PLAYER FITS IN. The page draws the
     * level from that block, so the witness is the drawn world: the player box
     * at the OBSERVED point must clear every solid the renderer painted.
     */
    const spawn = await page.evaluate(() => window.__editorSpawn);
    /**
     * ⚠ THE READOUT'S EXISTENCE IS ASSERTED FIRST, AND SEPARATELY. A claim
     * written as `probe ? probe.clear === true : true` cannot fail when the
     * probe is missing — it reports a green on exactly the machine where the
     * measurement did not happen, which is this arc's own trap and was the
     * first shape of this row.
     */
    check(Boolean(spawn) && spawn.level === 58,
        'the page publishes where the player actually stands in the room it drew',
        JSON.stringify(spawn && { level: spawn.level, boot: spawn.boot, player: spawn.player }));
    check(spawn.player.x === spawn.boot.x + spawn.offset
        && spawn.player.y === spawn.boot.y + spawn.offset,
    '⛓ …and the player is the boot block plus the half tile the Player ctor adds — the '
        + 'offset that made the old chooser wrong',
    `boot ${spawn.boot.x},${spawn.boot.y} → player ${spawn.player.x},${spawn.player.y}`);
    check(spawn.clear === true,
        '⛔⛔⛔ the chosen cell is one the player BOX fits in AT THE OBSERVED POINT — the '
        + 'half-tile defect this item found (L58 was one of the five that spawned inside '
        + 'a solid)',
        spawn.inside ? `INSIDE ${spawn.inside.tag} ${JSON.stringify(spawn.inside.rect)}`
            : `clear of ${spawn.solids} solid(s)`);
    check(errors.length === 0, 'no page errors — clean', errors.slice(0, 2).join(' | '));
    await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
