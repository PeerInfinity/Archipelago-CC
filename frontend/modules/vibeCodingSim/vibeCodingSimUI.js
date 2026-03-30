/**
 * Vibe Coding Simulator — Panel UI (v3)
 *
 * Two-column layout: Features | Tasks
 * Features show D/C/T/M badges as clickable action buttons.
 * Test results inline on feature cards.
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
    const labels = {
        incomplete: '⚠ Incomplete',
        doc: '⚠ Doc needs work',
        code: '⚠ Code needs work',
        tests: '⚠ Tests need work',
        pass: '✓ Passed',
    };
    return labels[result] || '';
}

export class VibeCodingSimUI {
    static moduleApis = null;
    static setModuleApis(apis) { VibeCodingSimUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.apis = VibeCodingSimUI.moduleApis || getModuleApis();
        this.selectedFeatureId = null;
        this.selectedTaskId = null;
        this.expandedFeatures = new Set();
        this.expandedTestWorkflow = false;
        this.featureSearch = '';
        this.visibleColumns = { features: true, tasks: true };
        this.autoSkipTesting = false;

        // Dynamic refs: elements that get updated on tick without full rebuild
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

    /** Full structural rebuild — called on user actions and structural state changes. */
    render() {
        const gs = this.gameState;
        if (!this.rootElement) return;
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
    }

    /** Lightweight tick update — updates text and progress bars without rebuilding DOM. */
    updateTick() {
        const gs = this.gameState;
        if (!gs || !this._dyn) return;

        const d = this._dyn;

        // Toolbar
        if (d.timeLabel) {
            const weekElapsed = gs.simulatedTime - gs.weekStart;
            const weekProgress = Math.min(weekElapsed / gs.config.weekDuration, 1);
            d.timeLabel.textContent = gs.timeStr;
            if (d.timeBar) d.timeBar.style.width = `${Math.round(weekProgress * 100)}%`;
        }
        if (d.creditLabel) {
            const creditPct = gs.creditsRemaining / gs.config.weeklyCredits;
            d.creditLabel.textContent = `Credits: ${gs.creditHours.toFixed(1)}h`;
            if (d.creditBar) d.creditBar.style.width = `${Math.round(creditPct * 100)}%`;
        }
        if (d.progressLabel) {
            const progress = gs.overallProgress;
            d.progressLabel.textContent = `Progress: ${Math.round(progress * 100)}%`;
            if (d.progressBar) d.progressBar.style.width = `${Math.round(progress * 100)}%`;
        }
        if (d.manualTestToolbar) {
            if (gs.isManualTestActive) {
                d.manualTestToolbar.textContent = `🔍 Testing: ${gs.manualTestFeatureId} (${Math.round((gs.manualTestProgress ?? 0) * 100)}%)`;
                d.manualTestToolbar.style.display = '';
            } else {
                d.manualTestToolbar.style.display = 'none';
            }
        }

        // Task progress bars, subtask labels, and markers
        for (const task of gs.getRunningTasks()) {
            const barFill = d[`task-bar-${task.id}`];
            if (barFill) barFill.style.width = `${Math.round(task.progress * 100)}%`;
            const label = d[`task-label-${task.id}`];
            if (label) label.textContent = task.subtaskLabel;
            // Update markers if subtask count changed
            const barEl = d[`task-bar-el-${task.id}`];
            const prevCount = d[`task-subtask-count-${task.id}`];
            if (barEl && prevCount !== task.subtaskDurations.length) {
                d[`task-subtask-count-${task.id}`] = task.subtaskDurations.length;
                barEl.querySelectorAll('.vcs-progress-marker').forEach(m => m.remove());
                for (const pos of task.subtaskBoundaries) {
                    const marker = document.createElement('div');
                    marker.className = 'vcs-progress-marker';
                    marker.style.left = `${Math.round(pos * 100)}%`;
                    barEl.appendChild(marker);
                }
            }
        }

        // Feature inline task progress
        for (const task of gs.getRunningTasks()) {
            const barFill = d[`feat-task-bar-${task.id}`];
            if (barFill) barFill.style.width = `${Math.round(task.progress * 100)}%`;
            const label = d[`feat-task-label-${task.id}`];
            if (label) label.textContent = ` ${task.subtaskLabel}`;
        }

        // Manual test progress
        if (d.manualTestBar && gs.isManualTestActive) {
            d.manualTestBar.style.width = `${Math.round((gs.manualTestProgress ?? 0) * 100)}%`;
        }

        // Test workflow progress
        if (d.workflowBar && gs.testWorkflow && !gs.testWorkflow.complete) {
            d.workflowBar.style.width = `${Math.round((gs.testWorkflowProgress ?? 0) * 100)}%`;
        }
    }

    // ========== Toolbar ==========

    _renderToolbar(gs) {
        const bar = document.createElement('div');
        bar.className = 'vcs-toolbar';

        // Time with credit-reset countdown background
        const weekElapsed = gs.simulatedTime - gs.weekStart;
        const weekProgress = Math.min(weekElapsed / gs.config.weekDuration, 1);
        const [timeEl, timeBar, timeLabel] = this._toolbarItemWithBar(gs.timeStr, weekProgress, '#3a5070');
        this._dyn.timeBar = timeBar;
        this._dyn.timeLabel = timeLabel;
        bar.appendChild(timeEl);

        // Credits with remaining bar
        const creditPct = gs.creditsRemaining / gs.config.weeklyCredits;
        const [creditEl, creditBar, creditLabel] = this._toolbarItemWithBar(`Credits: ${gs.creditHours.toFixed(1)}h`, creditPct, '#4a6a3a');
        this._dyn.creditBar = creditBar;
        this._dyn.creditLabel = creditLabel;
        bar.appendChild(creditEl);

        // Progress with completion bar
        const progress = gs.overallProgress;
        const [progressEl, progressBarBg, progressLabel] = this._toolbarItemWithBar(`Progress: ${Math.round(progress * 100)}%`, progress, '#6a5a2a');
        this._dyn.progressBar = progressBarBg;
        this._dyn.progressLabel = progressLabel;
        bar.appendChild(progressEl);

        // Manual test indicator (always present, hidden when inactive)
        const mtSpan = document.createElement('span');
        mtSpan.className = 'vcs-toolbar-item vcs-manual-test-active';
        if (gs.isManualTestActive) {
            mtSpan.textContent = `🔍 Testing: ${gs.manualTestFeatureId} (${Math.round((gs.manualTestProgress ?? 0) * 100)}%)`;
        } else {
            mtSpan.style.display = 'none';
        }
        this._dyn.manualTestToolbar = mtSpan;
        bar.appendChild(mtSpan);

        // Speed buttons
        for (const [label, mult] of [['⏸', 0], ['1×', 1], ['2×', 2], ['5×', 5], ['10×', 10]]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-speed';
            if ((mult === 0 && gs.paused) || (!gs.paused && gs.speedMultiplier === mult)) btn.classList.add('vcs-btn-active');
            btn.textContent = label;
            btn.addEventListener('click', () => {
                gs.paused = mult === 0;
                if (mult > 0) gs.speedMultiplier = mult;
                this.render();
            });
            bar.appendChild(btn);
        }

        // Wait buttons
        for (const hours of [1, 8]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn';
            btn.textContent = `Wait ${hours}h`;
            btn.addEventListener('click', () => {
                const minutes = hours * 60;
                const steps = Math.max(1, minutes * 2);
                const dtPerStep = minutes / steps / (gs.config.timeScale / 60);
                const wasPaused = gs.paused;
                const oldMult = gs.speedMultiplier;
                gs.paused = false;
                gs.speedMultiplier = 1;
                for (let i = 0; i < steps; i++) gs.tick(dtPerStep);
                gs.paused = wasPaused;
                gs.speedMultiplier = oldMult;
                this.render();
            });
            bar.appendChild(btn);
        }

        return bar;
    }

    _toolbarItemWithBar(text, pct, color) {
        const wrapper = document.createElement('span');
        wrapper.className = 'vcs-toolbar-item vcs-toolbar-bar-item';
        const bg = document.createElement('div');
        bg.className = 'vcs-toolbar-bar-bg';
        bg.style.width = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
        bg.style.background = color;
        wrapper.appendChild(bg);
        const label = document.createElement('span');
        label.className = 'vcs-toolbar-bar-label';
        label.textContent = text;
        wrapper.appendChild(label);
        return [wrapper, bg, label];
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
        search.type = 'text';
        search.className = 'vcs-search';
        search.placeholder = 'Search...';
        search.value = this.featureSearch;
        search.addEventListener('input', (e) => { this.featureSearch = e.target.value; this.render(); });
        header.appendChild(search);
        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';
        const features = [...gs.features.values()].sort((a, b) =>
            a.upstreamIds.size - b.upstreamIds.size || a.name.localeCompare(b.name));
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

        // Summary row
        const summary = document.createElement('div');
        summary.className = 'vcs-card-summary';

        // Left side: name + test result + manual result
        const left = document.createElement('div');
        left.className = 'vcs-card-left';
        left.addEventListener('click', () => {
            this.selectedFeatureId = feat.id;
            if (this.expandedFeatures.has(feat.id)) this.expandedFeatures.delete(feat.id);
            else this.expandedFeatures.add(feat.id);
            this.render();
        });

        const depsIcon = feat.depsAreMet ? '' : '⏳ ';
        const name = document.createElement('div');
        name.className = 'vcs-card-name';
        name.textContent = `${depsIcon}${feat.name}`;
        left.appendChild(name);

        // Test result + manual result on second line
        const meta = document.createElement('div');
        meta.className = 'vcs-card-meta-row';
        if (feat.testResultPercent !== null) {
            const pct = document.createElement('span');
            pct.className = 'vcs-card-pct';
            pct.style.color = testColor(feat.testResultPercent);
            pct.textContent = `${feat.testResultPercent}%`;
            meta.appendChild(pct);
        }
        if (feat.manualTestResult) {
            const mt = document.createElement('span');
            mt.className = `vcs-manual-result vcs-manual-${feat.manualTestResult}`;
            mt.textContent = manualResultLabel(feat.manualTestResult);
            meta.appendChild(mt);
        }
        if (meta.childNodes.length > 0) left.appendChild(meta);
        summary.appendChild(left);

        // Right side: D C T M badges
        const badges = document.createElement('div');
        badges.className = 'vcs-badge-row';
        badges.appendChild(this._featureBadge(gs, feat, 'D', feat.hasDoc, TaskType.WRITE_DOC, TaskType.EVALUATE_DOC));
        badges.appendChild(this._featureBadge(gs, feat, 'C', feat.hasCode, TaskType.IMPLEMENT, TaskType.IMPLEMENT));
        badges.appendChild(this._featureBadge(gs, feat, 'T', feat.hasTests, TaskType.WRITE_TESTS, TaskType.WRITE_TESTS));
        badges.appendChild(this._manualBadge(gs, feat));
        summary.appendChild(badges);

        card.appendChild(summary);

        if (isExpanded) {
            card.appendChild(this._renderFeatureDetails(gs, feat));
        }

        return card;
    }

    _featureBadge(gs, feat, letter, exists, createType, improveType) {
        const btn = document.createElement('button');
        const taskType = exists ? improveType : createType;

        const canAct = taskType === TaskType.WRITE_DOC ? !feat.hasDoc
            : taskType === TaskType.EVALUATE_DOC ? feat.hasDoc
            : feat.hasDoc;

        // Check if any running task matches this action
        const actionTaskTypes = letter === 'D' ? [TaskType.WRITE_DOC, TaskType.EVALUATE_DOC]
            : letter === 'C' ? [TaskType.IMPLEMENT] : [TaskType.WRITE_TESTS];
        const inProgress = gs.getRunningTasks().some(
            t => t.targetFeatureId === feat.id && actionTaskTypes.includes(t.type));

        const colors = { D: '#4a7a5a', C: '#4a5a7a', T: '#7a5a4a' };
        const actionLabel = exists
            ? (letter === 'D' ? 'Evaluate Doc' : letter === 'C' ? 'Debug Code' : 'Debug Tests')
            : (letter === 'D' ? 'Write Planning Doc' : letter === 'C' ? 'Implement' : 'Write Tests');

        btn.className = 'vcs-badge vcs-badge-btn';
        if (inProgress) {
            btn.classList.add('vcs-badge-in-progress');
            btn.style.background = colors[letter];
        } else if (exists) {
            btn.classList.add('vcs-badge-active');
            btn.style.background = colors[letter];
        } else {
            btn.classList.add('vcs-badge-empty');
        }
        btn.textContent = letter;
        btn.title = inProgress ? `${actionLabel} (in progress)` : actionLabel;

        if (canAct && !gs.isManualTestActive) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const task = gs.assignTask(feat.id, taskType);
                if (task && this.autoSkipTesting) gs.skipTesting(task.id);
                this.render();
            });
        } else {
            btn.disabled = true;
            btn.classList.add('vcs-badge-disabled');
        }

        return btn;
    }

    _manualBadge(gs, feat) {
        const btn = document.createElement('button');
        const canTest = feat.hasCode && feat.hasTests && !gs.isManualTestActive;
        const isActive = gs.isManualTestActive && gs.manualTestFeatureId === feat.id;

        let bgColor = null;
        let title = 'Manual Test';
        if (isActive) {
            const phase = feat.manualTestResult === 'incomplete' ? 'Phase 2' : 'Phase 1';
            bgColor = '#5a5a2a';
            title = `Manual Test in progress (${phase})`;
        } else if (feat.manualTestResult === 'pass') {
            bgColor = '#2d8a4e';
            title = 'Manual Test: Passed';
        } else if (feat.manualTestResult === 'incomplete') {
            bgColor = '#b8860b';
            title = 'Manual Test: Run again to identify issue (Phase 2)';
        } else if (feat.manualTestResult === 'doc' || feat.manualTestResult === 'code' || feat.manualTestResult === 'tests') {
            bgColor = '#c04030';
            title = `Manual Test: ${feat.manualTestResult} needs work`;
        }

        btn.className = 'vcs-badge vcs-badge-btn';
        if (isActive) {
            btn.classList.add('vcs-badge-in-progress');
        } else if (bgColor) {
            btn.classList.add('vcs-badge-active');
        } else {
            btn.classList.add('vcs-badge-empty');
        }
        if (bgColor) btn.style.background = bgColor;
        btn.textContent = 'M';
        btn.title = title;

        if (canTest) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                gs.assignTask(feat.id, TaskType.MANUAL_TEST);
                this.render();
            });
        } else {
            btn.disabled = true;
            btn.classList.add('vcs-badge-disabled');
        }

        return btn;
    }

    _renderFeatureDetails(gs, feat) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details';

        // Deps-not-met warning
        if (!feat.depsAreMet) {
            const warn = document.createElement('div');
            warn.className = 'vcs-warning';
            warn.textContent = '⏳ Upstream deps not verified — tasks take 2× longer';
            details.appendChild(warn);
        }

        // Dependencies
        if (feat.upstreamIds.size > 0) details.appendChild(this._renderDepLinks(gs, 'Depends on', feat.upstreamIds));
        if (feat.downstreamIds.size > 0) details.appendChild(this._renderDepLinks(gs, 'Unlocks', feat.downstreamIds));

        // Active tasks
        const active = gs.getRunningTasks().filter(t => t.targetFeatureId === feat.id);
        if (active.length > 0) {
            const section = document.createElement('div');
            section.innerHTML = '<div class="vcs-detail-label">Active</div>';
            for (const task of active) {
                const row = document.createElement('div');
                row.className = 'vcs-task-inline';
                const [bar, fill] = this._progressBar(task.progress, task.subtaskBoundaries);
                this._dyn[`feat-task-bar-${task.id}`] = fill;
                row.appendChild(bar);
                const lbl = document.createElement('span');
                lbl.textContent = ` ${task.subtaskLabel}`;
                this._dyn[`feat-task-label-${task.id}`] = lbl;
                row.appendChild(lbl);
                section.appendChild(row);
            }
            details.appendChild(section);
        }

        // Recent task history
        const history = gs.getCompletedTasks().filter(t => t.targetFeatureId === feat.id).slice(-5);
        if (history.length > 0) {
            const section = document.createElement('div');
            section.innerHTML = '<div class="vcs-detail-label">Recent</div>';
            for (const task of history) {
                const row = document.createElement('div');
                row.className = 'vcs-history-row';
                const icon = task.reportedSuccess ? '✓' : '⚠';
                const typeLabels = {
                    [TaskType.WRITE_DOC]: 'Write Doc',
                    [TaskType.EVALUATE_DOC]: 'Evaluate Doc',
                    [TaskType.IMPLEMENT]: 'Implement',
                    [TaskType.WRITE_TESTS]: 'Write Tests',
                    [TaskType.MERGE_CONFLICT]: 'Merge Resolve',
                };
                row.textContent = `${icon} ${typeLabels[task.type] || task.type} — ${task.reportedSuccess ? 'success' : 'issues found'}`;
                section.appendChild(row);
            }
            details.appendChild(section);
        }

        return details;
    }

    _renderDepLinks(gs, label, ids) {
        const div = document.createElement('div');
        div.innerHTML = `<div class="vcs-detail-label">${label}</div>`;
        for (const id of ids) {
            const link = document.createElement('a');
            link.className = 'vcs-dep-link';
            link.href = '#';
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
        const autoSkipLabel = document.createElement('label');
        autoSkipLabel.className = 'vcs-auto-skip';
        autoSkipLabel.title = 'Automatically skip regression testing on all tasks';
        const autoSkipCb = document.createElement('input');
        autoSkipCb.type = 'checkbox';
        autoSkipCb.checked = this.autoSkipTesting;
        autoSkipCb.addEventListener('change', () => {
            this.autoSkipTesting = autoSkipCb.checked;
            if (this.autoSkipTesting) {
                // Skip testing on all currently running tasks
                for (const t of gs.getRunningTasks()) gs.skipTesting(t.id);
            }
        });
        autoSkipLabel.appendChild(autoSkipCb);
        autoSkipLabel.appendChild(document.createTextNode(' Auto-skip testing'));
        header.appendChild(autoSkipLabel);
        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';

        if (gs.isManualTestActive) list.appendChild(this._renderManualTestCard(gs));
        list.appendChild(this._renderTestWorkflowCard(gs));
        for (const task of gs.getRunningTasks()) list.appendChild(this._renderTaskCard(gs, task));
        for (const task of gs.getMergeConflicts()) list.appendChild(this._renderTaskCard(gs, task));
        const completed = gs.getCompletedTasks();
        for (let i = completed.length - 1; i >= 0; i--) list.appendChild(this._renderTaskCard(gs, completed[i]));

        col.appendChild(list);
        return col;
    }

    _renderManualTestCard(gs) {
        const card = document.createElement('div');
        card.className = 'vcs-card vcs-card-manual-test';
        const feat = gs.features.get(gs.manualTestFeatureId);
        const featName = feat?.name || gs.manualTestFeatureId;

        // Determine phase
        const prevResult = feat?.manualTestResult;
        const phase = prevResult === 'incomplete' ? 'Phase 2: Identifying issue' : 'Phase 1: Testing';

        card.innerHTML = `<div class="vcs-card-name">🔍 Manual Test: ${featName}</div>`;
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

        // Header row with Run Tests button in top-right
        const headerRow = document.createElement('div');
        headerRow.className = 'vcs-card-summary';
        const name = document.createElement('span');
        name.className = 'vcs-card-name';
        name.textContent = '🧪 Test Workflow';
        headerRow.appendChild(name);

        const headerRight = document.createElement('div');
        headerRight.className = 'vcs-card-right';

        if (gs.testWorkflow && !gs.testWorkflow.complete) {
            // Running — no button
        } else {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-action vcs-btn-small';
            btn.textContent = 'Run Tests';
            btn.addEventListener('click', (e) => { e.stopPropagation(); gs.startTestWorkflow(); this.render(); });
            headerRight.appendChild(btn);
        }

        if (gs.testWorkflow?.complete) {
            const toggle = document.createElement('span');
            toggle.className = 'vcs-expand-toggle';
            toggle.textContent = this.expandedTestWorkflow ? '▼' : '▶';
            headerRight.appendChild(toggle);
            headerRow.style.cursor = 'pointer';
            headerRow.addEventListener('click', () => {
                this.expandedTestWorkflow = !this.expandedTestWorkflow;
                this.render();
            });
        }

        headerRow.appendChild(headerRight);
        card.appendChild(headerRow);

        if (gs.testWorkflow && !gs.testWorkflow.complete) {
            const [wfBar, wfFill] = this._progressBar(gs.testWorkflowProgress ?? 0);
            this._dyn.workflowBar = wfFill;
            card.appendChild(wfBar);
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = 'Running...';
            card.appendChild(meta);
        } else if (gs.testWorkflow?.complete) {
            const passing = [...gs.features.values()].filter(f => f.testResultPercent !== null && f.testResultPercent >= 95).length;
            const tested = [...gs.features.values()].filter(f => f.testResultPercent !== null).length;
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = `Last run: ${passing}/${tested} passing`;
            card.appendChild(meta);
            if (this.expandedTestWorkflow) {
                card.appendChild(this._renderTestResultList(gs));
            }
        }
        return card;
    }

    _renderTestResultList(gs) {
        const div = document.createElement('div');
        div.className = 'vcs-test-result-list';

        const features = [...gs.features.values()]
            .filter(f => f.testResultPercent !== null)
            .sort((a, b) => a.testResultPercent - b.testResultPercent);

        // Failing first, then passing
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
        const isSelected = this.selectedTaskId === task.id;
        const card = document.createElement('div');
        card.className = `vcs-card ${isSelected ? 'vcs-card-selected' : ''}`;

        const borderColors = {
            [TaskStatus.RUNNING]: '#3498db',
            [TaskStatus.COMPLETED]: '#2d8a4e',
            [TaskStatus.MERGE_CONFLICT]: '#e67e22',
        };
        card.style.borderLeftColor = borderColors[task.status] || '#666';
        card.addEventListener('click', () => { this.selectedTaskId = task.id; this.render(); });

        const icons = {
            [TaskStatus.RUNNING]: '⚡',
            [TaskStatus.COMPLETED]: task.reportedSuccess ? '✓' : '⚠',
            [TaskStatus.MERGE_CONFLICT]: '🔀',
            [TaskStatus.CANCELLED]: '✗',
            [TaskStatus.FAILED]: '✗',
        };

        // Use full feature name
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

        // Header row with name on left, action badges on right
        const headerRow = document.createElement('div');
        headerRow.className = 'vcs-card-summary';

        const name = document.createElement('span');
        name.className = 'vcs-card-name';
        name.textContent = `${icons[task.status] || ''} ${typeLabel}: ${featName}`;
        headerRow.appendChild(name);

        if (task.status === TaskStatus.RUNNING) {
            const badges = document.createElement('div');
            badges.className = 'vcs-card-right';

            const skipBtn = document.createElement('button');
            skipBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
            skipBtn.style.background = '#5a5a2a';
            skipBtn.textContent = '⏭';
            skipBtn.title = 'Skip Testing';
            skipBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.skipTesting(task.id); this.render(); });
            badges.appendChild(skipBtn);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
            cancelBtn.style.background = '#5a2a2a';
            cancelBtn.textContent = '✗';
            cancelBtn.title = 'Cancel';
            cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); gs.cancelTask(task.id); this.render(); });
            badges.appendChild(cancelBtn);

            headerRow.appendChild(badges);
        }

        card.appendChild(headerRow);

        if (task.status === TaskStatus.RUNNING) {
            // Compute skip marker position (where testing starts)
            let skipAt = null;
            if (task._skipTesting) {
                const baseSubtasks = task.subtasks;
                const testIdx = baseSubtasks.indexOf('testing');
                if (testIdx >= 0) skipAt = testIdx / task.subtaskDurations.length;
            }
            const [bar, fill] = this._progressBar(task.progress, task.subtaskBoundaries, skipAt);
            this._dyn[`task-bar-${task.id}`] = fill;
            this._dyn[`task-bar-el-${task.id}`] = bar;
            this._dyn[`task-subtask-count-${task.id}`] = task.subtaskDurations.length;
            card.appendChild(bar);
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.subtaskLabel;
            this._dyn[`task-label-${task.id}`] = meta;
            card.appendChild(meta);
        } else if (task.status === TaskStatus.MERGE_CONFLICT) {
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
        } else if (task.status === TaskStatus.COMPLETED) {
            const metaRow = document.createElement('div');
            metaRow.className = 'vcs-card-summary';
            const meta = document.createElement('span');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.reportedSuccess ? 'Reported: success' : 'Reported: issues found';
            metaRow.appendChild(meta);

            // Check if this task is part of a pending merge — show discard button
            const pendingMerge = gs.tasks.find(
                t => t.status === TaskStatus.MERGE_CONFLICT && t._pendingMerge &&
                     t._sourceTaskIds?.includes(task.id));
            if (pendingMerge) {
                const discardBtn = document.createElement('button');
                discardBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
                discardBtn.style.background = '#5a2a2a';
                discardBtn.textContent = '✗';
                discardBtn.title = 'Discard this branch (cancel merge)';
                discardBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    task.status = TaskStatus.CANCELLED;
                    task.completedAt = gs.simulatedTime;
                    this.render();
                });
                metaRow.appendChild(discardBtn);
            } else if (!task.reportedSuccess && task.type !== TaskType.MERGE_CONFLICT) {
                const retryBtn = document.createElement('button');
                retryBtn.className = 'vcs-badge vcs-badge-btn vcs-badge-task-action';
                retryBtn.style.background = '#3a5a3a';
                retryBtn.textContent = '↻';
                retryBtn.title = `Retry: ${typeLabel}`;
                retryBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newTask = gs.assignTask(task.targetFeatureId, task.type);
                    if (newTask && this.autoSkipTesting) gs.skipTesting(newTask.id);
                    this.render();
                });
                metaRow.appendChild(retryBtn);
            }
            card.appendChild(metaRow);
        } else {
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.status;
            card.appendChild(meta);
        }

        return card;
    }


    // ========== Helpers ==========

    _addBtn(parent, label, extra, onClick) {
        const btn = document.createElement('button');
        btn.className = `vcs-btn vcs-btn-action ${extra}`;
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        parent.appendChild(btn);
    }

    _progressBar(pct, boundaries = null, skipMarkerAt = null) {
        const bar = document.createElement('div');
        bar.className = 'vcs-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'vcs-progress-fill';
        fill.style.width = `${Math.round(pct * 100)}%`;
        bar.appendChild(fill);
        // Add step boundary markers
        if (boundaries) {
            for (const pos of boundaries) {
                const marker = document.createElement('div');
                marker.className = 'vcs-progress-marker';
                marker.style.left = `${Math.round(pos * 100)}%`;
                bar.appendChild(marker);
            }
        }
        // Add skip-testing marker
        if (skipMarkerAt !== null) {
            const skip = document.createElement('div');
            skip.className = 'vcs-progress-skip-marker';
            skip.style.left = `${Math.round(skipMarkerAt * 100)}%`;
            bar.appendChild(skip);
        }
        return [bar, fill];
    }

    selectFeature(featureId) {
        this.selectedFeatureId = featureId;
        this.expandedFeatures.add(featureId);
        this.render();
        requestAnimationFrame(() => {
            const card = this.rootElement?.querySelector('.vcs-card-selected');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        if (this.apis?.eventBus) {
            this.apis.eventBus.publish('vibeCodingSim:featureSelected', { featureId });
        }
    }

    selectFeatureByRegion(regionNodeId) {
        // Region names are like "Complete Node 3" — extract the index
        const gs = this.gameState;
        if (!gs) return;
        const match = regionNodeId.match(/(\d+)/);
        if (match) {
            const idx = parseInt(match[1]);
            const featureId = gs.indexToFeatureId[idx];
            if (featureId) {
                this.selectFeature(featureId);
                return;
            }
        }
        // Fallback: try treating it as a feature ID directly
        if (gs.features.has(regionNodeId)) {
            this.selectFeature(regionNodeId);
        }
    }
}
