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
    // ⛓ (lab-map-small-set-view) the cursor goes over a ROOM (the dragged one, just off its centre), not the view's
    // centre: once a small set's view is the panel's room, the view's centre can be empty space below the map, and
    // a zoom about that point carries every room off screen.
    const [rcx, rcy] = centre(m1.cells[r]);
    const qx = Math.round(b.left + (rcx + 7) / b.kx);
    const qy = Math.round(b.top + (rcy + 5) / b.ky);
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

/**
 * ⛓⛓ **A SMALL SET GETS THE PANEL'S ROOM ONCE ENGAGED** (slice `lab-map-small-set-view`), on a set whose frame is
 * SMALLER than its panel (the maze demo pack; the small Seedling set). Every claim starts from HOME (the strip and
 * back, which is itself claimed) and drives real mouse and key input:
 *
 *   · TOGGLE — the strip and back returns the map to HOME, after the camera moved.
 *   · THE SWITCH KEEPS EVERY PIXEL — a drag that engages and comes back to its press point: the viewport is now
 *     LARGER than the frame on the short axis, the canvas has not moved on the page, and the frame's own rectangle
 *     of the canvas is byte-identical to the home canvas.
 *   · CTRL+WHEEL FROM HOME — the frame point under the cursor before the switch is under it after the zoom.
 *   · `+` FROM HOME — the frame point at the home window's centre is the new view's centre, at the zoom step.
 *   · FIT — zooms IN (above the home zoom), every room inside the view, the tight axis filled; then a click on a room
 *     as FIT drew it selects THAT room, at a point the unconverted frame gives to another room or to none.
 *   · RESIZE — a narrower page while engaged: the viewport takes the panel's new width and the frame point at the
 *     canvas's top-left stays there.
 */
export async function setMapSmallSetClaims({ page, check, mapOf, homeCells, tag, shot = async () => {} }) {
    const box = () => page.evaluate(() => {
        const c = document.getElementById('editSetOverview');
        const b = c.getBoundingClientRect();
        const w = c.parentNode;
        return { left: b.left + scrollX, top: b.top + scrollY, vl: b.left, vt: b.top, kx: c.width / b.width,
            ky: c.height / b.height, cw: c.width, ch: c.height, wrapW: w.clientWidth,
            maxH: getComputedStyle(w).maxHeight };
    });
    /** A digest of the canvas pixels inside `[0, 0, w, h]`. */
    const pixels = (w, h) => page.evaluate(([ww, hh]) => {
        const d = document.getElementById('editSetOverview').getContext('2d').getImageData(0, 0, ww, hh).data;
        let x = 0x811c9dc5;
        for (let i = 0; i < d.length; i += 1) { x ^= d[i]; x = Math.imul(x, 16777619) >>> 0; }
        return `${ww}x${hh}:${x.toString(16)}`;
    }, [w, h]);
    const selected = () => page.$eval('#editSetRoom', (e) => e.value);
    const home = async () => {
        await page.uncheck('#editSetMapView');
        await page.check('#editSetMapView');
        await page.waitForFunction(() => document.getElementById('editSetMapView').checked, null, { timeout: 5000 });
        await page.evaluate(() => {
            const w = document.getElementById('editSetOverviewWrap');
            w.scrollIntoView({ block: 'center' });
            w.scrollLeft = 0;
            w.scrollTop = 0;
        });
        return mapOf();
    };
    const atHome = (m) => m.camera?.engaged === false && m.viewport.w === m.frame.width
        && m.viewport.h === m.frame.height && m.zoom === 1 && JSON.stringify(m.cells) === JSON.stringify(homeCells);

    /* ── the set is a SMALL one: its frame fits the panel on both axes ── */
    let m0 = await home();
    let b0 = await box();
    const maxH = /^([0-9.]+)px$/.exec(b0.maxH)?.[1];
    check(m0.frame.width <= b0.wrapW && Number(maxH) > m0.frame.height,
        `${tag} SMALL SET: the frame is smaller than its panel (the width, and the panel's CSS max-height)`,
        `frame ${m0.frame.width}×${m0.frame.height} · panel width ${b0.wrapW} · max-height ${b0.maxH}`);
    await shot('small-0-opening');
    const homePixels = await pixels(m0.frame.width, m0.frame.height);

    /* ── THE SWITCH: a drag that engages, then comes back to its press point ── */
    const [px, py] = [Math.round(m0.frame.width / 2), Math.round(m0.frame.height / 2)];
    await page.mouse.move(b0.vl + px / b0.kx, b0.vt + py / b0.ky);
    await page.mouse.down();
    await page.mouse.move(b0.vl + (px + 30) / b0.kx, b0.vt + (py + 7) / b0.ky, { steps: 4 });
    await page.mouse.move(b0.vl + px / b0.kx, b0.vt + py / b0.ky, { steps: 4 });
    await page.mouse.up();
    const m1 = await mapOf();
    const b1 = await box();
    const shortAxisGrew = m1.viewport.h > m0.frame.height && m1.viewport.w >= m0.frame.width;
    check(m1.camera.engaged === true && shortAxisGrew && m1.viewport.h === Math.floor(Number(maxH))
        && m1.viewport.w === b0.wrapW && b1.cw === m1.viewport.w && b1.ch === m1.viewport.h,
    `${tag} ⛓⛓ SMALL SET: once engaged the viewport is the PANEL's room — its width and its CSS max-height — not the `
        + 'frame\'s size', `frame ${m0.frame.width}×${m0.frame.height} → viewport ${m1.viewport.w}×${m1.viewport.h}`);
    const samePlace = Math.abs(b1.left - b0.left) < 0.01 && Math.abs(b1.top - b0.top) < 0.01;
    const afterPixels = await pixels(m0.frame.width, m0.frame.height);
    check(samePlace && afterPixels === homePixels && JSON.stringify(m1.cells) === JSON.stringify(homeCells),
        `${tag} ⛓⛓ SMALL SET: the switch keeps EVERY PIXEL — the canvas has not moved on the page and the frame's `
        + 'rectangle is byte-identical to home', `canvas at (${b0.left}, ${b0.top}) → (${b1.left}, ${b1.top}); `
        + `pixels ${homePixels} → ${afterPixels}`);
    await shot('small-1-engaged');

    /* ── TOGGLE back to HOME ── */
    m0 = await home();
    check(atHome(m0), `${tag} SMALL SET: the strip and back returns the map to HOME after the camera moved`,
        `camera ${JSON.stringify(m0.camera)} · viewport ${JSON.stringify(m0.viewport)}`);

    /* ── CTRL+WHEEL FROM HOME: the frame point under the cursor stays under it ── */
    b0 = await box();
    // a whole-pixel client point; at home the frame point under it is its canvas point (no conversion)
    const cqx = Math.round(b0.vl + (m0.frame.width * 0.7) / b0.kx);
    const cqy = Math.round(b0.vt + (m0.frame.height * 0.4) / b0.ky);
    const [qx, qy] = [(cqx - b0.vl) * b0.kx, (cqy - b0.vt) * b0.ky];
    await page.mouse.move(cqx, cqy);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    let m2 = await mapOf();
    for (let i = 0; i < 20 && !m2.camera.engaged; i += 1) {
        await page.waitForTimeout(50);
        m2 = await mapOf();
    }
    const under = worldOf(m2.camera, m2.viewport, qx, qy);
    check(m2.camera.engaged && m2.camera.zoom === 1.25 && m2.viewport.h > m0.frame.height
        && Math.hypot(under.x - qx, under.y - qy) < 1e-6,
    `${tag} ⛓⛓ SMALL SET: a Ctrl+wheel from HOME engages the bigger view and keeps the frame point under the cursor`,
    `cursor at frame (${qx.toFixed(3)}, ${qy.toFixed(3)}) · after: ${JSON.stringify(under)} · viewport ${JSON.stringify(m2.viewport)}`);

    /* ── `+` FROM HOME: centred ── */
    m0 = await home();
    await page.click('#editSetZoomIn');
    const m3 = await mapOf();
    check(atHome(m0) && m3.camera.zoom === 1.25 && Math.abs(m3.camera.x - m0.frame.width / 2) < 1e-9
        && Math.abs(m3.camera.y - m0.frame.height / 2) < 1e-9 && m3.viewport.h > m0.frame.height,
    `${tag} SMALL SET: \`+\` from HOME zooms about the middle of what was on screen — the home window's centre is `
        + 'the new view\'s centre', `camera ${JSON.stringify(m3.camera)} · viewport ${JSON.stringify(m3.viewport)}`);
    await shot('small-2-after-plus');

    /* ── FIT from HOME: zooms in, fills the tight axis; a click then selects the room drawn there ── */
    m0 = await home();
    await page.click('#editSetZoomFit');
    const m4 = await mapOf();
    const xs = m4.cells.flatMap(([x, , w]) => [x, x + w]);
    const ys = m4.cells.flatMap(([, y, , h]) => [y, y + h]);
    const inside = Math.min(...xs) >= -1e-6 && Math.min(...ys) >= -1e-6
        && Math.max(...xs) <= m4.viewport.w + 1e-6 && Math.max(...ys) <= m4.viewport.h + 1e-6;
    const slack = Math.min(m4.viewport.w - (Math.max(...xs) - Math.min(...xs)),
        m4.viewport.h - (Math.max(...ys) - Math.min(...ys)));
    // ⛓ what FIT would give in a view the frame's own size (the pre-slice engaged view): FIT must zoom in PAST it
    const hx = homeCells.flatMap(([x, , w]) => [x, x + w]);
    const hy = homeCells.flatMap(([, y, , h]) => [y, y + h]);
    const frameFit = Math.min((m0.frame.width - 16) / (Math.max(...hx) - Math.min(...hx)),
        (m0.frame.height - 16) / (Math.max(...hy) - Math.min(...hy)));
    check(atHome(m0) && m4.camera.zoom > 1 && m4.camera.zoom > frameFit * 1.05 && inside && slack < 17,
        `${tag} ⛓⛓ SMALL SET: FIT ZOOMS IN — past what a frame-sized view allows, every room inside the bigger view, `
        + 'the tight axis filled',
        `zoom ${m4.camera.zoom.toFixed(4)} (a frame-sized view: ${frameFit.toFixed(4)}) · view `
        + `${m4.viewport.w}×${m4.viewport.h} · slack on the tight axis ${slack.toFixed(1)} px`);
    await shot('small-3-after-fit');
    const sel0 = await selected();
    const target = m4.cells.findIndex(([x, y, w, h], i) => String(i) !== sel0
        && roomUnder(homeCells, x + w / 2, y + h / 2) !== i);
    if (target < 0) {
        check(false, `${tag} SMALL SET: a room to click after FIT`, JSON.stringify(m4.cells));
    } else {
        const [cx, cy] = centre(m4.cells[target]);
        const b = await box();
        await page.mouse.click(b.vl + cx / b.kx, b.vt + cy / b.ky);
        await page.waitForFunction((i) => document.getElementById('editSetRoom')?.value === String(i), target,
            { timeout: 5000 }).catch(() => {});
        check((await selected()) === String(target),
            `${tag} ⛓⛓ SMALL SET: after FIT a click on a room as drawn SELECTS THAT ROOM`,
            `clicked room ${target}'s centre (${cx.toFixed(1)}, ${cy.toFixed(1)}); unconverted that point is room `
            + `${roomUnder(homeCells, cx, cy)}; selected ${await selected()}`);
    }

    /* ── RESIZE while engaged: the new width, the top-left frame point kept ── */
    const size = page.viewportSize();
    const m5 = await mapOf();
    const tl = worldOf(m5.camera, m5.viewport, 0, 0);
    await page.setViewportSize({ width: Math.round(size.width * 0.75), height: size.height });
    let m6 = await mapOf();
    for (let i = 0; i < 20 && m6.viewport.w === m5.viewport.w; i += 1) {
        await page.waitForTimeout(50);
        m6 = await mapOf();
    }
    const b6 = await box();
    const tl6 = worldOf(m6.camera, m6.viewport, 0, 0);
    check(m6.viewport.w < m5.viewport.w && m6.viewport.w === b6.wrapW && m6.viewport.h === m5.viewport.h
        && Math.hypot(tl6.x - tl.x, tl6.y - tl.y) < 1e-6,
    `${tag} SMALL SET: a narrower page while engaged — the view takes the panel's new width, the top-left kept`,
    `viewport ${m5.viewport.w} → ${m6.viewport.w} (panel ${b6.wrapW}) · top-left ${JSON.stringify(tl)} → `
        + `${JSON.stringify(tl6)}`);
    await page.setViewportSize(size);
    await home();
}
