/**
 * setMapCameraClaims — **THE SET MAP'S CAMERA, CLAIMED IN A REAL BROWSER** (slice `lab-map-camera`), shared by both
 * labs' map checks (`check-seedling-editor-e3.mjs` on `watch.html?source=edit`, `check-maze-world-map.mjs` on
 * `lab.html?source=set`). Both pages mount the SAME set view (`procgenCore/setEditorView.js`), so one set of claims,
 * run against each page's own readout (`window.__editorEdit.set.map` / `window.__mazeLab.set.map`).
 *
 * Every claim SETS ITS OWN STATE: it starts from the map's HOME view (it asserts it is there) and drives real mouse
 * and key input. The value claims are against node's own answers:
 *
 *   · HOME — the opening view is the pre-camera picture: not engaged, the canvas the frame's size, and every cell
 *     where node's `frameOf(positions, sizes, 1)` puts it (the frame `set-map-frame-dump` dumps).
 *   · DRAG — the camera moves by exactly the drag (÷ zoom), the room under a FIXED screen point changes, and the drag
 *     is not read as a click (the selection does not move).
 *   · CTRL+WHEEL — the world point under the cursor stays under the cursor, and the zoom steps.
 *   · CLICK AFTER PAN — a click on a room as drawn selects THAT room, at a point where the unconverted frame would
 *     have answered something else (so a picker that skips the camera reds).
 *   · FIT (`0`) — every room inside the view on BOTH axes, and the tighter axis binds (a width-only fit reds).
 *   · CENTRE ON START — the start room's centre is the view's centre.
 */

const json = (v) => JSON.stringify(v);
const centre = ([x, y, w, h]) => [x + w / 2, y + h / 2];
const roomUnder = (cells, px, py) => cells.findIndex(([x, y, w, h]) => px >= x && px < x + w && py >= y && py < y + h);
const worldOf = (cam, vp, sx, sy) => ({ x: (sx - vp.w / 2) / cam.zoom + cam.x, y: (sy - vp.h / 2) / cam.zoom + cam.y });

/**
 * @param {object} o
 * @param {import('@playwright/test').Page} o.page
 * @param {Function} o.check    `(ok, what, detail)`
 * @param {Function} o.mapOf    `() => Promise<map readout>`
 * @param {number[][]} o.homeCells  node's `frameOf(positions, sizes, 1)` cells, `[x, y, w, h]`
 * @param {string} o.tag        the claim prefix (the section number)
 * @param {Function} [o.shot]   `(name) => Promise` — a screenshot of the map panel
 */
export async function setMapCameraClaims({ page, check, mapOf, homeCells, tag, shot = async () => {} }) {
    const canvasBox = () => page.evaluate(() => {
        const c = document.getElementById('editSetOverview');
        const b = c.getBoundingClientRect();
        const w = c.parentNode;
        return { left: b.left, top: b.top, kx: c.width / b.width, ky: c.height / b.height,
            cw: c.width, ch: c.height, wrapW: w.clientWidth, wrapH: w.clientHeight };
    });
    const selected = () => page.$eval('#editSetRoom', (e) => e.value);
    const status = () => page.textContent('#status');

    /* ── HOME ── */
    await page.evaluate(() => {
        const w = document.getElementById('editSetOverviewWrap');
        w.scrollIntoView({ block: 'center' });
        w.scrollLeft = 0;
        w.scrollTop = 0;
    });
    const m0 = await mapOf();
    let b = await canvasBox();
    check(m0.camera?.engaged === false && m0.viewport.w === m0.frame.width && m0.viewport.h === m0.frame.height
        && b.cw === m0.frame.width && b.ch === m0.frame.height && m0.zoom === 1,
    `${tag} ⛓⛓ CAMERA: the opening view is HOME — not engaged, the canvas the frame's own size, zoom 1`,
    `frame ${m0.frame.width}×${m0.frame.height} · canvas ${b.cw}×${b.ch} · camera ${json(m0.camera)}`);
    check(json(m0.cells) === json(homeCells),
        `${tag} ⛓⛓ CAMERA: at home every cell is where node's frameOf at zoom 1 puts it (the pre-camera picture)`,
        `${m0.cells.length} cells`);
    await shot('camera-0-opening');

    /* ── DRAG: a room under a fixed screen point; drag it away ── */
    const visW = Math.min(b.cw, b.wrapW);
    const visH = Math.min(b.ch, b.wrapH);
    const r = m0.cells.findIndex(([x, y, w, h]) => x + w / 2 < visW - 4 && y + h / 2 < visH - 4);
    const [sx, sy] = centre(m0.cells[r]).map(Math.round);
    const sel0 = await selected();
    const D = Math.round(m0.cells[r][2] * 1.5);
    // ⛓ drag TOWARD the visible window's centre, so the pointer stays over the map
    const dx = sx < visW / 2 ? D : -D;
    // ⛓ the vertical leg is kept inside a quarter of the window, so a short panel (one row of rooms) keeps its rooms
    const DY = Math.max(1, Math.round(Math.min(D / 2, visH / 4)));
    const dy = sy < visH / 2 ? DY : -DY;
    await page.mouse.move(b.left + sx / b.kx, b.top + sy / b.ky);
    await page.mouse.down();
    await page.mouse.move(b.left + (sx + dx) / b.kx, b.top + (sy + dy) / b.ky, { steps: 6 });
    await page.mouse.up();
    const m1 = await mapOf();
    b = await canvasBox();
    // ⛓ engaging keeps what was on screen where it was: from home (scroll 0) the camera centre is the window's.
    const want = { x: m1.viewport.w / 2 - dx, y: m1.viewport.h / 2 - dy };
    check(m1.camera.engaged === true && Math.abs(m1.camera.x - want.x) < 1e-6 && Math.abs(m1.camera.y - want.y) < 1e-6,
        `${tag} CAMERA: a DRAG pans — the camera moves by exactly the drag`,
        `drag (${dx}, ${dy}) · camera ${json(m1.camera)} · want ${json(want)} · viewport ${json(m1.viewport)}`);
    const r1 = roomUnder(m1.cells, sx, sy);
    check(r1 !== r && json(m1.cells[r]) === json([m0.cells[r][0] + dx, m0.cells[r][1] + dy, m0.cells[r][2], m0.cells[r][3]]),
        `${tag} CAMERA: after the drag the room under the same screen point is a different one, and the dragged room `
        + 'moved with the pointer', `room ${r} → ${r1} under (${sx}, ${sy})`);
    const st1 = await status();
    check((await selected()) === sel0 && !/^selected room/.test(st1),
        `${tag} CAMERA: a drag is NOT a click — the selection stays`, `selected ${sel0}; status "${st1.slice(0, 50)}"`);
    await shot('camera-1-after-drag');

    /* ── CTRL+WHEEL at a point: that world point stays put ── */
    const qx = Math.round(b.left + (m1.viewport.w / 2 + 37) / b.kx);
    const qy = Math.round(b.top + (m1.viewport.h / 2 + 23) / b.ky);
    const qsx = (qx - b.left) * b.kx;
    const qsy = (qy - b.top) * b.ky;
    await page.mouse.move(qx, qy);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    let m2 = await mapOf();
    for (let i = 0; i < 20 && m2.camera.zoom === m1.camera.zoom; i += 1) {
        await page.waitForTimeout(50);
        m2 = await mapOf();
    }
    const w1 = worldOf(m1.camera, m1.viewport, qsx, qsy);
    const w2 = worldOf(m2.camera, m2.viewport, qsx, qsy);
    check(Math.abs(m2.camera.zoom - m1.camera.zoom * 1.25) < 1e-9 && Math.hypot(w2.x - w1.x, w2.y - w1.y) < 1e-6,
        `${tag} CAMERA: Ctrl+wheel ZOOMS AROUND THE CURSOR — the world point under it stays under it`,
        `zoom ${m1.camera.zoom} → ${m2.camera.zoom}; world under the cursor ${json(w1)} → ${json(w2)}`);
    await shot('camera-2-after-wheel');

    /* ── CLICK AFTER PAN: a room as drawn, where the frame unconverted says something else ── */
    const vp = m2.viewport;
    const target = m2.cells.findIndex(([x, y, w, h], i) => {
        const [cx, cy] = [x + w / 2, y + h / 2];
        return String(i) !== (sel0) && cx > 2 && cy > 2 && cx < vp.w - 2 && cy < vp.h - 2
            && roomUnder(homeCells, cx, cy) !== i;
    });
    if (target < 0) {
        check(false, `${tag} CAMERA: a room to click after the pan is on screen`, json(m2.cells.slice(0, 4)));
    } else {
        const [cx, cy] = centre(m2.cells[target]);
        b = await canvasBox();
        await page.mouse.click(b.left + cx / b.kx, b.top + cy / b.ky);
        await page.waitForFunction((i) => document.getElementById('editSetRoom')?.value === String(i), target,
            { timeout: 5000 }).catch(() => {});
        check((await selected()) === String(target),
            `${tag} ⛓⛓ CAMERA: after a pan and a zoom a click on a room SELECTS THAT ROOM (the pickers read the frame `
            + 'through the camera)',
            `clicked room ${target}'s centre (${cx.toFixed(1)}, ${cy.toFixed(1)}); unconverted that point is room `
            + `${roomUnder(homeCells, cx, cy)}; selected ${await selected()}`);
    }

    /* ── FIT, both axes ── */
    await page.focus('#editSetOverview');
    await page.keyboard.press('0');
    const m3 = await mapOf();
    const inside = m3.cells.every(([x, y, w, h]) => x >= -1e-6 && y >= -1e-6
        && x + w <= m3.viewport.w + 1e-6 && y + h <= m3.viewport.h + 1e-6);
    const xs = m3.cells.map(([x, , w]) => [x, x + w]).flat();
    const ys = m3.cells.map(([, y, , h]) => [y, y + h]).flat();
    const spanW = Math.max(...xs) - Math.min(...xs);
    const spanH = Math.max(...ys) - Math.min(...ys);
    const binds = Math.min((m3.viewport.w - spanW), (m3.viewport.h - spanH));
    check(inside && binds < 40,
        `${tag} ⛓⛓ CAMERA: FIT shows EVERY room inside the view on BOTH axes, the tighter axis binding`,
        `zoom ${m3.camera.zoom.toFixed(4)}; rooms span ${spanW.toFixed(1)}×${spanH.toFixed(1)} in a `
        + `${m3.viewport.w}×${m3.viewport.h} view; slack on the tight axis ${binds.toFixed(1)} px`);
    await shot('camera-3-after-fit');

    /* ── CENTRE ON START ── */
    await page.click('#editSetCentreStart');
    const m4 = await mapOf();
    const [scx, scy] = centre(m4.cells[m4.start]);
    check(Number.isInteger(m4.start) && Math.abs(scx - m4.viewport.w / 2) < 1e-6 && Math.abs(scy - m4.viewport.h / 2) < 1e-6
        && Math.abs(m4.camera.zoom - m3.camera.zoom) < 1e-12,
    `${tag} CAMERA: CENTRE ON START puts the start room at the view's centre, the zoom kept`,
    `start room ${m4.start} at (${scx.toFixed(2)}, ${scy.toFixed(2)}); view ${m4.viewport.w}×${m4.viewport.h}`);
    await shot('camera-4-centre-on-start');
}
