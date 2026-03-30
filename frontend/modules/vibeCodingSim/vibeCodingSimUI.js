/**
 * Vibe Coding Simulator — Panel UI (v4)
 *
 * Two-column layout: Features | Tasks
 * Expandable task cards with review/supervision mechanic.
 * Accept/reject for completed tasks. Event log and markers.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import { TaskStatus, TaskType } from './simEngine.js';

function testColor(pct) {
    if (pct === null || pct === undefined) return '#555';
    if (pct >= 95) return '#2d8a4e';
    if (pct >= 50) return '#b8860b';
    return '#c0392b';
}

function manualResultLabel(result) {
    return { incomplete: '⚠ Incomplete', doc: '⚠ Doc', code: '⚠ Code',
             tests: '⚠ Tests', pass: '✓ Passed' }[result] || '';
}

export class VibeCodingSimUI {
    static moduleApis = null;
    static setModuleApis(apis) { VibeCodingSimUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.apis = VibeCodingSimUI.moduleApis || getModuleApis();
        this.selectedFeatureId = null;
        this.expandedFeatures = new Set();
        this.expandedTaskId = null; // only one task expanded at a time
        this.expandedTestWorkflow = false;
        this.featureSearch = '';
        this.visibleColumns = { features: true, tasks: true };
        this.autoSkipTesting = false;
        this._dyn = {};
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'vcs-panel';
        this.rootElement.innerHTML = '<div class="vcs-empty">Waiting for game data...</div>';
        setPanelInstance(this);
    }

    getRootElement() { return this.rootElement; }
    destroy() { setPanelInstance(null); }
    onPanelShow() { this.render(); }
    onPanelResize() {}
    get gameState() { return this.apis?.getGameState?.(); }

    render() {
        const gs = this.gameState;
        if (!this.rootElement) return;
        const scrollPositions = {};
        for (const list of this.rootElement.querySelectorAll('.vcs-card-list')) {
            const col = list.closest('.vcs-column');
            if (col) scrollPositions[[...col.parentElement.children].indexOf(col)] = list.scrollTop;
        }
        this._dyn = {};
        this.rootElement.innerHTML = '';
        this.rootElement.className = 'vcs-panel';
        if (!gs) {
            this.rootElement.innerHTML = '<div class="vcs-empty">Waiting for game data...</div>';
            return;
        }
        this.rootElement.appendChild(this._renderToolbar(gs));
        this.rootElement.appendChild(this._renderColumnToggles());
        const cols = document.createElement('div');
        cols.className = 'vcs-columns';
        if (this.visibleColumns.features) cols.appendChild(this._renderFeatureColumn(gs));
        if (this.visibleColumns.tasks) cols.appendChild(this._renderTaskColumn(gs));
        this.rootElement.appendChild(cols);
        for (const list of this.rootElement.querySelectorAll('.vcs-card-list')) {
            const col = list.closest('.vcs-column');
            if (col) {
                const idx = [...col.parentElement.children].indexOf(col);
                if (scrollPositions[idx] !== undefined) list.scrollTop = scrollPositions[idx];
            }
        }
    }

    updateTick() {
        const gs = this.gameState;
        if (!gs || !this._dyn) return;
        const d = this._dyn;

        // Toolbar
        if (d.timeLabel) {
            const weekElapsed = gs.simulatedTime - gs.weekStart;
            d.timeLabel.textContent = gs.timeStr;
            if (d.timeBar) d.timeBar.style.width = `${Math.round(Math.min(weekElapsed / gs.config.weekDuration, 1) * 100)}%`;
        }
        if (d.creditLabel) {
            d.creditLabel.textContent = `Credits: ${gs.creditHours.toFixed(1)}h`;
            if (d.creditBar) d.creditBar.style.width = `${Math.round(gs.creditsRemaining / gs.config.weeklyCredits * 100)}%`;
        }
        if (d.reviewLabel) {
            const remainH = gs.reviewBudgetRemaining / 60;
            d.reviewLabel.textContent = `Review: ${remainH.toFixed(1)}h`;
            if (d.reviewBar) d.reviewBar.style.width = `${Math.round(gs.reviewBudgetRemaining / gs.config.dailyReviewBudget * 100)}%`;
        }
        if (d.progressLabel) {
            d.progressLabel.textContent = `Progress: ${Math.round(gs.overallProgress * 100)}%`;
            if (d.progressBar) d.progressBar.style.width = `${Math.round(gs.overallProgress * 100)}%`;
        }
        if (d.manualTestToolbar) {
            if (gs.isManualTestActive) {
                d.manualTestToolbar.textContent = `🔍 Testing: ${gs.manualTestFeatureId} (${Math.round((gs.manualTestProgress ?? 0) * 100)}%)`;
                d.manualTestToolbar.style.display = '';
            } else {
                d.manualTestToolbar.style.display = 'none';
            }
        }

        // Task progress bars and labels
        for (const task of gs.getRunningTasks()) {
            const fill = d[`task-bar-${task.id}`];
            if (fill) fill.style.width = `${Math.round(task.overallProgress * 100)}%`;
            const label = d[`task-label-${task.id}`];
            if (label) label.textContent = task.currentSubtaskLabel;

            // Review bar
            const reviewFill = d[`task-review-bar-${task.id}`];
            if (reviewFill) {
                const total = task.totalDuration;
                const pct = total > 0 ? Math.min(task.reviewMinute / total, 1) : 0;
                reviewFill.style.width = `${Math.round(pct * 100)}%`;
            }
        }

        // Pending review tasks too
        for (const task of gs.getPendingReviewTasks()) {
            const reviewFill = d[`task-review-bar-${task.id}`];
            if (reviewFill) {
                const total = task.totalDuration;
                const pct = total > 0 ? Math.min(task.reviewMinute / total, 1) : 0;
                reviewFill.style.width = `${Math.round(pct * 100)}%`;
            }
        }

        // Feature inline task bars
        for (const task of gs.getRunningTasks()) {
            const fill = d[`feat-task-bar-${task.id}`];
            if (fill) fill.style.width = `${Math.round(task.overallProgress * 100)}%`;
            const label = d[`feat-task-label-${task.id}`];
            if (label) label.textContent = ` ${task.currentSubtaskLabel}`;
        }

        // Manual test & workflow
        if (d.manualTestBar && gs.isManualTestActive)
            d.manualTestBar.style.width = `${Math.round((gs.manualTestProgress ?? 0) * 100)}%`;
        if (d.workflowBar && gs.testWorkflow && !gs.testWorkflow.complete)
            d.workflowBar.style.width = `${Math.round((gs.testWorkflowProgress ?? 0) * 100)}%`;
    }

    // ========== Toolbar ==========

    _renderToolbar(gs) {
        const bar = document.createElement('div');
        bar.className = 'vcs-toolbar';

        const weekElapsed = gs.simulatedTime - gs.weekStart;
        const [timeEl, timeBar, timeLabel] = this._toolbarBar(gs.timeStr, Math.min(weekElapsed / gs.config.weekDuration, 1), '#3a5070');
        this._dyn.timeBar = timeBar; this._dyn.timeLabel = timeLabel;
        bar.appendChild(timeEl);

        const [creditEl, creditBar, creditLabel] = this._toolbarBar(`Credits: ${gs.creditHours.toFixed(1)}h`, gs.creditsRemaining / gs.config.weeklyCredits, '#4a6a3a');
        this._dyn.creditBar = creditBar; this._dyn.creditLabel = creditLabel;
        bar.appendChild(creditEl);

        const remainH = gs.reviewBudgetRemaining / 60;
        const [reviewEl, reviewBar, reviewLabel] = this._toolbarBar(`Review: ${remainH.toFixed(1)}h`, gs.reviewBudgetRemaining / gs.config.dailyReviewBudget, '#5a4a6a');
        this._dyn.reviewBar = reviewBar; this._dyn.reviewLabel = reviewLabel;
        bar.appendChild(reviewEl);

        const [progressEl, pBar, pLabel] = this._toolbarBar(`Progress: ${Math.round(gs.overallProgress * 100)}%`, gs.overallProgress, '#6a5a2a');
        this._dyn.progressBar = pBar; this._dyn.progressLabel = pLabel;
        bar.appendChild(progressEl);

        const mtSpan = document.createElement('span');
        mtSpan.className = 'vcs-toolbar-item vcs-manual-test-active';
        if (gs.isManualTestActive) mtSpan.textContent = `🔍 Testing: ${gs.manualTestFeatureId}`;
        else mtSpan.style.display = 'none';
        this._dyn.manualTestToolbar = mtSpan;
        bar.appendChild(mtSpan);

        for (const [label, mult] of [['⏸', 0], ['1×', 1], ['2×', 2], ['5×', 5], ['10×', 10]]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-speed';
            if ((mult === 0 && gs.paused) || (!gs.paused && gs.speedMultiplier === mult)) btn.classList.add('vcs-btn-active');
            btn.textContent = label;
            btn.addEventListener('click', () => { gs.paused = mult === 0; if (mult > 0) gs.speedMultiplier = mult; this.render(); });
            bar.appendChild(btn);
        }

        for (const hours of [1, 8]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn';
            btn.textContent = `Wait ${hours}h`;
            btn.addEventListener('click', () => {
                const minutes = hours * 60, steps = Math.max(1, minutes * 2);
                const dtPerStep = minutes / steps / (gs.config.timeScale / 60);
                const wasPaused = gs.paused, oldMult = gs.speedMultiplier;
                gs.paused = false; gs.speedMultiplier = 1;
                for (let i = 0; i < steps; i++) gs.tick(dtPerStep);
                gs.paused = wasPaused; gs.speedMultiplier = oldMult;
                this.render();
            });
            bar.appendChild(btn);
        }
        return bar;
    }

    _toolbarBar(text, pct, color) {
        const w = document.createElement('span');
        w.className = 'vcs-toolbar-item vcs-toolbar-bar-item';
        const bg = document.createElement('div');
        bg.className = 'vcs-toolbar-bar-bg';
        bg.style.width = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
        bg.style.background = color;
        w.appendChild(bg);
        const lbl = document.createElement('span');
        lbl.className = 'vcs-toolbar-bar-label';
        lbl.textContent = text;
        w.appendChild(lbl);
        return [w, bg, lbl];
    }

    _renderColumnToggles() {
        const row = document.createElement('div');
        row.className = 'vcs-column-toggles';
        for (const [key, label] of [['features', 'Features'], ['tasks', 'Tasks']]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-toggle';
            if (this.visibleColumns[key]) btn.classList.add('vcs-btn-active');
            btn.textContent = label;
            btn.addEventListener('click', () => { this.visibleColumns[key] = !this.visibleColumns[key]; this.render(); });
            row.appendChild(btn);
        }
        return row;
    }

    // ========== Feature Column ==========

    _renderFeatureColumn(gs) {
        const col = document.createElement('div');
        col.className = 'vcs-column';
        const header = document.createElement('div');
        header.className = 'vcs-column-header';
        header.innerHTML = '<strong>Features</strong>';
        const search = document.createElement('input');
        search.type = 'text'; search.className = 'vcs-search'; search.placeholder = 'Search...';
        search.value = this.featureSearch;
        search.addEventListener('input', (e) => { this.featureSearch = e.target.value; this.render(); });
        header.appendChild(search);
        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';
        const features = [...gs.features.values()].sort((a, b) => a.upstreamIds.size - b.upstreamIds.size || a.name.localeCompare(b.name));
        for (const feat of features) {
            if (this.featureSearch && !feat.name.toLowerCase().includes(this.featureSearch.toLowerCase())) continue;
            list.appendChild(this._renderFeatureCard(gs, feat));
        }
        col.appendChild(list);
        return col;
    }

    _renderFeatureCard(gs, feat) {
        const isSelected = this.selectedFeatureId === feat.id;
        const isExpanded = this.expandedFeatures.has(feat.id);
        const card = document.createElement('div');
        card.className = `vcs-card ${isSelected ? 'vcs-card-selected' : ''}`;
        card.style.borderLeftColor = testColor(feat.testResultPercent);

        const summary = document.createElement('div');
        summary.className = 'vcs-card-summary';
        const left = document.createElement('div');
        left.className = 'vcs-card-left';
        left.addEventListener('click', () => {
            this.selectedFeatureId = feat.id;
            if (this.expandedFeatures.has(feat.id)) this.expandedFeatures.delete(feat.id);
            else this.expandedFeatures.add(feat.id);
            this.render();
        });

        const name = document.createElement('div');
        name.className = 'vcs-card-name';
        name.textContent = `${feat.depsAreMet ? '' : '⏳ '}${feat.name}`;
        left.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'vcs-card-meta-row';
        if (feat.testResultPercent !== null) {
            const pct = document.createElement('span');
            pct.className = 'vcs-card-pct'; pct.style.color = testColor(feat.testResultPercent);
            pct.textContent = `${feat.testResultPercent}%`;
            meta.appendChild(pct);
        }
        if (feat.manualTestResult) {
            const mt = document.createElement('span');
            mt.className = `vcs-manual-result vcs-manual-${feat.manualTestResult}`;
            mt.textContent = manualResultLabel(feat.manualTestResult);
            meta.appendChild(mt);
        }
        if (feat._locationChecked) {
            const lc = document.createElement('span');
            lc.className = 'vcs-location-checked';
            lc.textContent = '⭐';
            meta.appendChild(lc);
        }
        if (meta.childNodes.length > 0) left.appendChild(meta);
        summary.appendChild(left);

        const badges = document.createElement('div');
        badges.className = 'vcs-badge-row';
        badges.appendChild(this._featureBadge(gs, feat, 'D', feat.hasDoc, TaskType.WRITE_DOC, TaskType.EVALUATE_DOC));
        badges.appendChild(this._featureBadge(gs, feat, 'C', feat.hasCode, TaskType.IMPLEMENT, TaskType.IMPLEMENT));
        badges.appendChild(this._featureBadge(gs, feat, 'T', feat.hasTests, TaskType.WRITE_TESTS, TaskType.WRITE_TESTS));
        badges.appendChild(this._manualBadge(gs, feat));
        summary.appendChild(badges);
        card.appendChild(summary);

        if (isExpanded) card.appendChild(this._renderFeatureDetails(gs, feat));
        return card;
    }

    _featureBadge(gs, feat, letter, exists, createType, improveType) {
        const btn = document.createElement('button');
        const taskType = exists ? improveType : createType;
        const canAct = taskType === TaskType.WRITE_DOC ? !feat.hasDoc : taskType === TaskType.EVALUATE_DOC ? feat.hasDoc : feat.hasDoc;
        const actionTaskTypes = letter === 'D' ? [TaskType.WRITE_DOC, TaskType.EVALUATE_DOC] : letter === 'C' ? [TaskType.IMPLEMENT] : [TaskType.WRITE_TESTS];
        const inProgress = gs.getRunningTasks().some(t => t.targetFeatureId === feat.id && actionTaskTypes.includes(t.type));
        const colors = { D: '#4a7a5a', C: '#4a5a7a', T: '#7a5a4a' };
        const actionLabel = exists ? (letter === 'D' ? 'Evaluate Doc' : letter === 'C' ? 'Debug Code' : 'Debug Tests')
            : (letter === 'D' ? 'Write Planning Doc' : letter === 'C' ? 'Implement' : 'Write Tests');

        btn.className = 'vcs-badge vcs-badge-btn';
        if (inProgress) { btn.classList.add('vcs-badge-in-progress'); btn.style.background = colors[letter]; }
        else if (exists) { btn.classList.add('vcs-badge-active'); btn.style.background = colors[letter]; }
        else btn.classList.add('vcs-badge-empty');
        btn.textContent = letter;
        btn.title = inProgress ? `${actionLabel} (in progress)` : actionLabel;

        if (canAct) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const task = gs.assignTask(feat.id, taskType);
                if (task && this.autoSkipTesting) gs.skipTesting(task.id);
                this.render();
            });
        } else { btn.disabled = true; btn.classList.add('vcs-badge-disabled'); }
        return btn;
    }

    _manualBadge(gs, feat) {
        const btn = document.createElement('button');
        const canTest = feat.hasCode && feat.hasTests && !gs.isManualTestActive;
        const isActive = gs.isManualTestActive && gs.manualTestFeatureId === feat.id;
        let bgColor = null, title = 'Manual Test';
        if (isActive) { bgColor = '#5a5a2a'; title = `Manual Test in progress`; }
        else if (feat.manualTestResult === 'pass') { bgColor = '#2d8a4e'; title = 'Passed'; }
        else if (feat.manualTestResult === 'incomplete') { bgColor = '#b8860b'; title = 'Run again to identify issue'; }
        else if (feat.manualTestResult) { bgColor = '#c04030'; title = `${feat.manualTestResult} needs work`; }

        btn.className = 'vcs-badge vcs-badge-btn';
        if (isActive) btn.classList.add('vcs-badge-in-progress');
        else if (bgColor) btn.classList.add('vcs-badge-active');
        else btn.classList.add('vcs-badge-empty');
        if (bgColor) btn.style.background = bgColor;
        btn.textContent = 'M'; btn.title = title;

        if (canTest) {
            btn.addEventListener('click', (e) => { e.stopPropagation(); gs.assignTask(feat.id, TaskType.MANUAL_TEST); this.render(); });
        } else { btn.disabled = true; btn.classList.add('vcs-badge-disabled'); }
        return btn;
    }

    _renderFeatureDetails(gs, feat) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details';
        if (!feat.depsAreMet) {
            const warn = document.createElement('div');
            warn.className = 'vcs-warning';
            warn.textContent = '⏳ Upstream deps not verified — tasks take 2× longer';
            details.appendChild(warn);
        }
        if (feat.upstreamIds.size > 0) details.appendChild(this._depLinks(gs, 'Depends on', feat.upstreamIds));
        if (feat.downstreamIds.size > 0) details.appendChild(this._depLinks(gs, 'Unlocks', feat.downstreamIds));

        const active = gs.getRunningTasks().filter(t => t.targetFeatureId === feat.id);
        if (active.length > 0) {
            const section = document.createElement('div');
            section.innerHTML = '<div class="vcs-detail-label">Active</div>';
            for (const task of active) {
                const row = document.createElement('div');
                row.className = 'vcs-task-inline';
                const [bar, fill] = this._progressBar(task.overallProgress, task.subtaskBoundaries);
                this._dyn[`feat-task-bar-${task.id}`] = fill;
                row.appendChild(bar);
                const lbl = document.createElement('span');
                lbl.textContent = ` ${task.currentSubtaskLabel}`;
                this._dyn[`feat-task-label-${task.id}`] = lbl;
                row.appendChild(lbl);
                section.appendChild(row);
            }
            details.appendChild(section);
        }
        return details;
    }

    _depLinks(gs, label, ids) {
        const div = document.createElement('div');
        div.innerHTML = `<div class="vcs-detail-label">${label}</div>`;
        for (const id of ids) {
            const link = document.createElement('a');
            link.className = 'vcs-dep-link'; link.href = '#';
            link.textContent = gs.features.get(id)?.name || id;
            link.addEventListener('click', (e) => { e.preventDefault(); this.selectFeature(id); });
            div.appendChild(link);
        }
        return div;
    }

    // ========== Task Column ==========

    _renderTaskColumn(gs) {
        const col = document.createElement('div');
        col.className = 'vcs-column';

        const header = document.createElement('div');
        header.className = 'vcs-column-header';
        header.innerHTML = '<strong>Tasks</strong>';

        // Auto-accept checkbox
        const autoAcceptLabel = document.createElement('label');
        autoAcceptLabel.className = 'vcs-auto-skip';
        autoAcceptLabel.title = 'Automatically accept completed tasks';
        const autoAcceptCb = document.createElement('input');
        autoAcceptCb.type = 'checkbox'; autoAcceptCb.checked = gs.autoAccept;
        autoAcceptCb.addEventListener('change', () => { gs.autoAccept = autoAcceptCb.checked; });
        autoAcceptLabel.appendChild(autoAcceptCb);
        autoAcceptLabel.appendChild(document.createTextNode(' Auto-accept'));
        header.appendChild(autoAcceptLabel);

        // Auto-skip checkbox
        const autoSkipLabel = document.createElement('label');
        autoSkipLabel.className = 'vcs-auto-skip';
        autoSkipLabel.title = 'Automatically skip regression testing';
        const autoSkipCb = document.createElement('input');
        autoSkipCb.type = 'checkbox'; autoSkipCb.checked = this.autoSkipTesting;
        autoSkipCb.addEventListener('change', () => {
            this.autoSkipTesting = autoSkipCb.checked;
            if (this.autoSkipTesting) for (const t of gs.getRunningTasks()) gs.skipTesting(t.id);
        });
        autoSkipLabel.appendChild(autoSkipCb);
        autoSkipLabel.appendChild(document.createTextNode(' Auto-skip'));
        header.appendChild(autoSkipLabel);

        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';

        if (gs.isManualTestActive) list.appendChild(this._renderManualTestCard(gs));
        list.appendChild(this._renderTestWorkflowCard(gs));

        // Stable ordering: all tasks in creation order
        const ordered = gs.getOrderedTasks();
        for (const task of ordered) {
            if (task.type === TaskType.TEST_WORKFLOW || task.type === TaskType.MANUAL_TEST) continue;
            list.appendChild(this._renderTaskCard(gs, task));
        }

        col.appendChild(list);
        return col;
    }

    _renderManualTestCard(gs) {
        const card = document.createElement('div');
        card.className = 'vcs-card vcs-card-manual-test';
        const feat = gs.features.get(gs.manualTestFeatureId);
        const phase = feat?.manualTestResult === 'incomplete' ? 'Phase 2' : 'Phase 1';
        card.innerHTML = `<div class="vcs-card-name">🔍 Manual Test: ${feat?.name || gs.manualTestFeatureId}</div>`;
        const [mtBar, mtFill] = this._progressBar(gs.manualTestProgress ?? 0);
        this._dyn.manualTestBar = mtFill;
        card.appendChild(mtBar);
        const meta = document.createElement('div');
        meta.className = 'vcs-card-meta';
        meta.textContent = `${phase} — player is busy`;
        card.appendChild(meta);
        return card;
    }

    _renderTestWorkflowCard(gs) {
        const card = document.createElement('div');
        card.className = 'vcs-card vcs-card-workflow';
        const headerRow = document.createElement('div');
        headerRow.className = 'vcs-card-summary';

        if (gs.testWorkflow?.complete) {
            const toggle = document.createElement('span');
            toggle.className = 'vcs-expand-toggle';
            toggle.textContent = this.expandedTestWorkflow ? '▼' : '▶';
            headerRow.appendChild(toggle);
            headerRow.style.cursor = 'pointer';
            headerRow.addEventListener('click', () => { this.expandedTestWorkflow = !this.expandedTestWorkflow; this.render(); });
        }

        const name = document.createElement('span');
        name.className = 'vcs-card-name'; name.textContent = 'Test Workflow';
        headerRow.appendChild(name);

        const right = document.createElement('div');
        right.className = 'vcs-card-right';
        if (!(gs.testWorkflow && !gs.testWorkflow.complete)) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-action vcs-btn-small';
            btn.textContent = 'Run Tests';
            btn.addEventListener('click', (e) => { e.stopPropagation(); gs.startTestWorkflow(); this.render(); });
            right.appendChild(btn);
        }
        headerRow.appendChild(right);
        card.appendChild(headerRow);

        if (gs.testWorkflow && !gs.testWorkflow.complete) {
            const [wfBar, wfFill] = this._progressBar(gs.testWorkflowProgress ?? 0);
            this._dyn.workflowBar = wfFill;
            card.appendChild(wfBar);
        } else if (gs.testWorkflow?.complete) {
            const passing = [...gs.features.values()].filter(f => f.testResultPercent !== null && f.testResultPercent >= 95).length;
            const tested = [...gs.features.values()].filter(f => f.testResultPercent !== null).length;
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta'; meta.textContent = `Last run: ${passing}/${tested} passing`;
            card.appendChild(meta);
            if (this.expandedTestWorkflow) card.appendChild(this._renderTestResultList(gs));
        }
        return card;
    }

    _renderTestResultList(gs) {
        const div = document.createElement('div');
        div.className = 'vcs-test-result-list';
        const features = [...gs.features.values()].filter(f => f.testResultPercent !== null)
            .sort((a, b) => a.testResultPercent - b.testResultPercent);
        for (const feat of features) {
            const row = document.createElement('div');
            row.className = 'vcs-test-result-row';
            const color = testColor(feat.testResultPercent);
            const icon = feat.testResultPercent >= 95 ? '✓' : '✗';
            row.innerHTML = `<span style="color:${color}">${icon} ${feat.testResultPercent}%</span> <span class="vcs-test-result-name">${feat.name}</span>`;
            div.appendChild(row);
        }
        return div;
    }

    _renderTaskCard(gs, task) {
        const isExpanded = this.expandedTaskId === task.id;
        const card = document.createElement('div');
        card.className = `vcs-card ${isExpanded ? 'vcs-card-selected' : ''}`;

        const borderColors = {
            [TaskStatus.RUNNING]: '#3498db',
            [TaskStatus.PENDING_REVIEW]: '#8e44ad',
            [TaskStatus.COMPLETED]: '#2d8a4e',
            [TaskStatus.MERGE_CONFLICT]: '#e67e22',
        };
        card.style.borderLeftColor = borderColors[task.status] || '#666';

        const feat = gs.features.get(task.targetFeatureId);
        const featName = feat?.name || task.targetFeatureId;
        const typeLabels = {
            [TaskType.WRITE_DOC]: 'Write Doc',
            [TaskType.EVALUATE_DOC]: 'Evaluate Doc',
            [TaskType.IMPLEMENT]: feat?.hasCode ? 'Debug Code' : 'Implement',
            [TaskType.WRITE_TESTS]: feat?.hasTests ? 'Debug Tests' : 'Write Tests',
            [TaskType.MERGE_CONFLICT]: 'Merge Resolve',
        };
        const typeLabel = typeLabels[task.type] || task.type;

        const icons = {
            [TaskStatus.RUNNING]: '⚡',
            [TaskStatus.PENDING_REVIEW]: '📋',
            [TaskStatus.COMPLETED]: task.reportedSuccess ? '✓' : '⚠',
            [TaskStatus.MERGE_CONFLICT]: '🔀',
            [TaskStatus.CANCELLED]: '✗',
            [TaskStatus.FAILED]: '✗',
        };

        // Header row
        const headerRow = document.createElement('div');
        headerRow.className = 'vcs-card-summary';
        headerRow.addEventListener('click', () => {
            if (this.expandedTaskId === task.id) {
                this.expandedTaskId = null;
                gs.stopReview();
            } else {
                this.expandedTaskId = task.id;
                gs.startReview(task.id);
            }
            this.render();
        });

        const nameEl = document.createElement('span');
        nameEl.className = 'vcs-card-name';
        nameEl.textContent = `${icons[task.status] || ''} ${typeLabel}: ${featName}`;
        headerRow.appendChild(nameEl);

        const rightBtns = document.createElement('div');
        rightBtns.className = 'vcs-card-right';

        if (task.status === TaskStatus.RUNNING && task.type === TaskType.IMPLEMENT) {
            const skipBtn = document.createElement('button');
            skipBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
            skipBtn.style.background = '#5a5a2a'; skipBtn.textContent = '⏭'; skipBtn.title = 'Skip Testing';
            skipBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.skipTesting(task.id); this.render(); });
            rightBtns.appendChild(skipBtn);
        }

        if (task.status === TaskStatus.RUNNING) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
            cancelBtn.style.background = '#5a2a2a'; cancelBtn.textContent = '✗'; cancelBtn.title = 'Cancel';
            cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.cancelTask(task.id); this.render(); });
            rightBtns.appendChild(cancelBtn);
        }

        if (task.status === TaskStatus.PENDING_REVIEW) {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
            acceptBtn.style.background = '#2a5a3a'; acceptBtn.textContent = '✓'; acceptBtn.title = 'Accept changes';
            acceptBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.acceptTask(task.id); this.render(); });
            rightBtns.appendChild(acceptBtn);

            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
            rejectBtn.style.background = '#5a2a2a'; rejectBtn.textContent = '✗'; rejectBtn.title = 'Reject changes';
            rejectBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.rejectTask(task.id); this.render(); });
            rightBtns.appendChild(rejectBtn);
        }

        headerRow.appendChild(rightBtns);
        card.appendChild(headerRow);

        // Progress bar with event markers
        if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING_REVIEW) {
            const barContainer = document.createElement('div');
            barContainer.className = 'vcs-task-bar-container';

            // Review bar (on top)
            if (isExpanded) {
                const [reviewBar, reviewFill] = this._progressBar(
                    task.totalDuration > 0 ? task.reviewMinute / task.totalDuration : 0);
                reviewBar.classList.add('vcs-review-bar');
                this._dyn[`task-review-bar-${task.id}`] = reviewFill;
                barContainer.appendChild(reviewBar);
            }

            // Main bar with markers
            const revealedMinute = isExpanded ? task.reviewMinute : task.totalDuration; // show all if not reviewing
            const markers = task.eventMarkers.filter(m => m.position <= (revealedMinute / task.totalDuration));
            const [bar, fill] = this._progressBar(task.overallProgress, task.subtaskBoundaries, null, markers);
            this._dyn[`task-bar-${task.id}`] = fill;
            barContainer.appendChild(bar);

            card.appendChild(barContainer);

            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.currentSubtaskLabel;
            this._dyn[`task-label-${task.id}`] = meta;
            card.appendChild(meta);
        }

        // Merge conflict
        if (task.status === TaskStatus.MERGE_CONFLICT) {
            const mcRow = document.createElement('div');
            mcRow.className = 'vcs-card-meta vcs-merge-conflict';
            if (task._pendingMerge) {
                mcRow.textContent = 'Merge conflict pending — waiting for tasks to finish';
            } else {
                mcRow.textContent = 'Merge conflict — ';
                const resolveBtn = document.createElement('button');
                resolveBtn.className = 'vcs-btn vcs-btn-action vcs-btn-small';
                resolveBtn.textContent = 'Resolve';
                resolveBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.resolveMergeConflict(task.id); this.render(); });
                mcRow.appendChild(resolveBtn);
            }
            card.appendChild(mcRow);
        }

        // Completed/cancelled status
        if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED || task.status === TaskStatus.FAILED) {
            const metaRow = document.createElement('div');
            metaRow.className = 'vcs-card-summary';
            const meta = document.createElement('span');
            meta.className = 'vcs-card-meta';
            if (task.status === TaskStatus.COMPLETED) {
                meta.textContent = task.reportedSuccess ? 'Accepted: success' : 'Accepted: issues found';
            } else {
                meta.textContent = task.status;
            }
            metaRow.appendChild(meta);

            const btnRight = document.createElement('div');
            btnRight.className = 'vcs-card-right';

            // Discard button for merge sources
            const pendingMerge = gs.tasks.find(t => t.status === TaskStatus.MERGE_CONFLICT && t._sourceTaskIds?.includes(task.id));
            if (pendingMerge) {
                const discardBtn = document.createElement('button');
                discardBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
                discardBtn.style.background = '#5a2a2a'; discardBtn.textContent = '✗';
                discardBtn.title = 'Discard this branch';
                discardBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.discardTask(task.id); this.render(); });
                btnRight.appendChild(discardBtn);
            } else if (!task.reportedSuccess && !task._retried && task.status === TaskStatus.COMPLETED) {
                const retryBtn = document.createElement('button');
                retryBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
                retryBtn.style.background = '#3a5a3a'; retryBtn.textContent = '↻';
                retryBtn.title = `Retry: ${typeLabel}`;
                retryBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); task._retried = true;
                    if (task.type === TaskType.MERGE_CONFLICT) gs.retryMergeResolve(task.id);
                    else { const t = gs.assignTask(task.targetFeatureId, task.type); if (t && this.autoSkipTesting) gs.skipTesting(t.id); }
                    this.render();
                });
                btnRight.appendChild(retryBtn);
            }
            if (btnRight.childNodes.length > 0) metaRow.appendChild(btnRight);
            card.appendChild(metaRow);
        }

        // Expanded: event log and rewind controls
        if (isExpanded) {
            card.appendChild(this._renderTaskEventLog(gs, task));
        }

        return card;
    }

    _renderTaskEventLog(gs, task) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details vcs-event-log';

        // Rewind buttons
        if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING_REVIEW) {
            const controls = document.createElement('div');
            controls.className = 'vcs-rewind-controls';

            const hasNeg = task.events.some(e => e.type === 'quality' && !e.positive && e.minute < task.reviewMinute);

            const rwNeg = document.createElement('button');
            rwNeg.className = 'vcs-btn vcs-btn-small';
            rwNeg.textContent = '⏪ First issue';
            rwNeg.title = 'Rewind to first negative event';
            rwNeg.disabled = !hasNeg;
            rwNeg.addEventListener('click', (e) => { e.stopPropagation(); gs.rewindToFirstNegative(task.id); this.render(); });
            controls.appendChild(rwNeg);

            const rwStep = document.createElement('button');
            rwStep.className = 'vcs-btn vcs-btn-small';
            rwStep.textContent = '⏪ Step';
            rwStep.title = 'Rewind one step';
            rwStep.addEventListener('click', (e) => { e.stopPropagation(); gs.rewindOneStep(task.id); this.render(); });
            controls.appendChild(rwStep);

            const rwStart = document.createElement('button');
            rwStart.className = 'vcs-btn vcs-btn-small';
            rwStart.textContent = '⏪ Start';
            rwStart.title = 'Return to start';
            rwStart.addEventListener('click', (e) => { e.stopPropagation(); gs.rewindToStart(task.id); this.render(); });
            controls.appendChild(rwStart);

            details.appendChild(controls);
        }

        // Event log entries (only those revealed by review)
        const revealedMinute = task.reviewMinute;
        const visibleEvents = task.events.filter(e => e.minute <= revealedMinute);

        const logDiv = document.createElement('div');
        logDiv.className = 'vcs-event-entries';
        for (const evt of visibleEvents) {
            const entry = document.createElement('div');
            entry.className = 'vcs-event-entry';
            if (evt.type === 'quality') {
                entry.classList.add(evt.positive ? 'vcs-event-positive' : 'vcs-event-negative');
            }
            entry.textContent = `[${evt.minute}m] ${evt.description}`;
            logDiv.appendChild(entry);
        }
        if (visibleEvents.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'vcs-event-entry vcs-card-meta';
            empty.textContent = 'Reviewing...';
            logDiv.appendChild(empty);
        }
        details.appendChild(logDiv);

        return details;
    }

    // ========== Helpers ==========

    _progressBar(pct, boundaries = null, skipMarkerAt = null, eventMarkers = null) {
        const bar = document.createElement('div');
        bar.className = 'vcs-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'vcs-progress-fill';
        fill.style.width = `${Math.round(pct * 100)}%`;
        bar.appendChild(fill);
        if (boundaries) {
            for (const pos of boundaries) {
                const m = document.createElement('div');
                m.className = 'vcs-progress-marker';
                m.style.left = `${Math.round(pos * 100)}%`;
                bar.appendChild(m);
            }
        }
        if (eventMarkers) {
            for (const em of eventMarkers) {
                const m = document.createElement('div');
                m.className = `vcs-progress-event-marker ${em.positive ? 'vcs-event-marker-pos' : 'vcs-event-marker-neg'}`;
                m.style.left = `${Math.round(em.position * 100)}%`;
                bar.appendChild(m);
            }
        }
        if (skipMarkerAt !== null) {
            const m = document.createElement('div');
            m.className = 'vcs-progress-skip-marker';
            m.style.left = `${Math.round(skipMarkerAt * 100)}%`;
            bar.appendChild(m);
        }
        return [bar, fill];
    }

    selectFeature(featureId, collapseOthers = false) {
        if (collapseOthers && this.selectedFeatureId && this.selectedFeatureId !== featureId)
            this.expandedFeatures.delete(this.selectedFeatureId);
        this.selectedFeatureId = featureId;
        this.expandedFeatures.add(featureId);
        this.render();
        requestAnimationFrame(() => {
            const card = this.rootElement?.querySelector('.vcs-card-selected');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        if (this.apis?.eventBus) this.apis.eventBus.publish('vibeCodingSim:featureSelected', { featureId });
    }

    selectFeatureByRegion(regionNodeId) {
        const gs = this.gameState;
        if (!gs) return;
        const match = regionNodeId.match(/(\d+)/);
        if (match) {
            const featureId = gs.indexToFeatureId[parseInt(match[1])];
            if (featureId) { this.selectFeature(featureId, true); return; }
        }
        if (gs.features.has(regionNodeId)) this.selectFeature(regionNodeId, true);
    }
}
