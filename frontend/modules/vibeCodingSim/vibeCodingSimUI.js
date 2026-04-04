/**
 * Vibe Coding Simulator — Panel UI (v4)
 *
 * Two-column layout: Features | Tasks
 * Expandable task cards with review/supervision mechanic.
 * Accept/reject for completed tasks. Event log and markers.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import { TaskStatus, TaskType, SimulationConfig, CONFIG_SCHEMA } from './simEngine.js';

function testColor(pct) {
    if (pct === null || pct === undefined) return '#555';
    if (pct >= 95) return '#2d8a4e';
    if (pct >= 50) return '#b8860b';
    return '#c0392b';
}

function manualResultLabel(feat) {
    if (feat.manualTestResult === 'pass') return '✓ Passed';
    if (!feat.manualReviewIssues) return '';
    const { doc, code, tests } = feat.manualReviewIssues;
    const parts = [];
    if (doc > 0) parts.push(`Doc: ${doc}`);
    if (code > 0) parts.push(`Code: ${code}`);
    if (tests > 0) parts.push(`Tests: ${tests}`);
    if (parts.length === 0) return '✓ No issues';
    return `⚠ ${parts.join(', ')}`;
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
        this.columnView = 'both'; // 'features' | 'both' | 'tasks'
        this.autoSkipTesting = false;
        this.autoTest = false;
        this.autoRewind = false;
        this._prevColumnView = 'both';
        this._pendingConfig = null;
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
        if (this.columnView === 'settings') {
            this.rootElement.appendChild(this._renderSettingsPanel(gs));
        } else {
            const cols = document.createElement('div');
            cols.className = 'vcs-columns';
            if (this.columnView === 'features' || this.columnView === 'both') cols.appendChild(this._renderFeatureColumn(gs));
            if (this.columnView === 'tasks' || this.columnView === 'both') cols.appendChild(this._renderTaskColumn(gs));
            this.rootElement.appendChild(cols);
        }
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
            const dayElapsed = gs.simulatedTime - gs.creditDayStart;
            d.timeLabel.textContent = gs.timeStr;
            if (d.timeBar) d.timeBar.style.width = `${Math.min(dayElapsed / gs.config.dayDuration, 1) * 100}%`;
        }
        if (d.creditLabel) {
            d.creditLabel.textContent = `Credits: ${gs.creditHours.toFixed(1)}h`;
            if (d.creditBar) d.creditBar.style.width = `${gs.creditsRemaining / gs.config.dailyCredits * 100}%`;
        }
        if (d.reviewLabel) {
            const remainH = gs.reviewBudgetRemaining / 60;
            d.reviewLabel.textContent = `Review: ${remainH.toFixed(1)}h`;
            if (d.reviewBar) d.reviewBar.style.width = `${gs.reviewBudgetRemaining / gs.config.dailyReviewBudget * 100}%`;
        }
        if (d.progressLabel) {
            d.progressLabel.textContent = `Progress: ${Math.round(gs.overallProgress * 100)}%`;
            if (d.progressBar) d.progressBar.style.width = `${gs.overallProgress * 100}%`;
        }
        if (d.manualTestToolbar) {
            const mt = gs.activeManualTestTask;
            if (mt) {
                d.manualTestToolbar.textContent = `🔍 Reviewing: ${mt.targetFeatureId} (${Math.round(mt.overallProgress * 100)}%)`;
                d.manualTestToolbar.style.display = '';
            } else {
                d.manualTestToolbar.style.display = 'none';
            }
        }

        // Task progress bars, labels, and event marker reveal
        const updateTaskDyn = (task) => {
            const fill = d[`task-bar-${task.id}`];
            if (fill) fill.style.width = `${task.overallProgress * 100}%`;
            const label = d[`task-label-${task.id}`];
            if (label && task.status === TaskStatus.RUNNING && task.type !== TaskType.MANUAL_TEST) {
                label.textContent = task.currentSubtaskLabel;
            }

            // Review bar
            const reviewFill = d[`task-review-bar-${task.id}`];
            if (reviewFill) {
                reviewFill.style.width = `${task.reviewProgress * 100}%`;
            }

            // Reveal event markers as review progresses
            const markerEls = d[`task-markers-${task.id}`];
            if (markerEls) {
                const revealedFrac = task.reviewProgress;
                for (const m of markerEls) {
                    m.style.display = parseFloat(m.dataset.position) <= revealedFrac ? '' : 'none';
                }
            }

            // Re-render if new events were added since last render (e.g., from _rollMinuteEvent)
            const logEntries = d[`task-log-entries-${task.id}`];
            const storedCount = d[`task-event-count-${task.id}`];
            if (logEntries && storedCount !== undefined && task.events.length !== storedCount) {
                this.render();
                return;
            }

            // Update rewind button disabled state
            const rwNeg = d[`task-rwneg-${task.id}`];
            if (rwNeg) {
                const hasNeg = task.events.some(e =>
                    (e.type === 'quality' || e.type === 'outcome') && !e.positive && e.minute <= task.reviewMinute);
                rwNeg.disabled = !hasNeg;
            }

            // Reveal event log entries as review progresses
            if (logEntries) {
                let anyRevealed = false;
                for (const el of logEntries) {
                    const visible = parseFloat(el.dataset.minute) <= task.reviewMinute;
                    el.style.display = visible ? '' : 'none';
                    if (visible) anyRevealed = true;
                }
                const emptyMsg = d[`task-log-empty-${task.id}`];
                if (emptyMsg) emptyMsg.style.display = anyRevealed ? 'none' : '';
                const summaryEl = d[`task-log-summary-${task.id}`];
                if (summaryEl) {
                    const reviewDone = task.totalDuration > 0 && task.reviewMinute >= task.totalDuration;
                    summaryEl.style.display = reviewDone ? '' : 'none';
                }
            }
        };
        for (const task of gs.getRunningTasks()) updateTaskDyn(task);
        for (const task of gs.getPendingReviewTasks()) updateTaskDyn(task);
        // Also update completed tasks (for review bar and rewind button state)
        for (const task of gs.getCompletedTasks()) updateTaskDyn(task);

        // Feature inline task bars
        for (const task of gs.getRunningTasks()) {
            const fill = d[`feat-task-bar-${task.id}`];
            if (fill) fill.style.width = `${task.overallProgress * 100}%`;
            const label = d[`feat-task-label-${task.id}`];
            if (label) label.textContent = ` ${task.currentSubtaskLabel}`;
        }

        // Manual review event reveal
        for (const task of gs.getRunningTasks()) {
            const manualEntries = d[`manual-log-entries-${task.id}`];
            if (manualEntries && task.type === TaskType.MANUAL_TEST) {
                let anyRevealed = false;
                for (const el of manualEntries) {
                    const visible = parseFloat(el.dataset.minute) <= task.reviewMinute;
                    el.style.display = visible ? '' : 'none';
                    if (visible) anyRevealed = true;
                }
                const emptyMsg = d[`manual-log-empty-${task.id}`];
                if (emptyMsg) emptyMsg.style.display = anyRevealed ? 'none' : '';
            }
        }

        // Workflow bar
        if (d.workflowBar && gs.testWorkflow && !gs.testWorkflow.complete)
            d.workflowBar.style.width = `${(gs.testWorkflowProgress ?? 0) * 100}%`;
    }

    // ========== Toolbar ==========

    _renderToolbar(gs) {
        const bar = document.createElement('div');
        bar.className = 'vcs-toolbar';

        const dayElapsed = gs.simulatedTime - gs.creditDayStart;
        const [timeEl, timeBar, timeLabel] = this._toolbarBar(gs.timeStr, Math.min(dayElapsed / gs.config.dayDuration, 1), '#3a5070');
        this._dyn.timeBar = timeBar; this._dyn.timeLabel = timeLabel;
        bar.appendChild(timeEl);

        const [creditEl, creditBar, creditLabel] = this._toolbarBar(`Credits: ${gs.creditHours.toFixed(1)}h`, gs.creditsRemaining / gs.config.dailyCredits, '#4a6a3a');
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
        const mtTask = gs.activeManualTestTask;
        if (mtTask) mtSpan.textContent = `🔍 Reviewing: ${mtTask.targetFeatureId} (${Math.round(mtTask.overallProgress * 100)}%)`;
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

        const wait1h = document.createElement('button');
        wait1h.className = 'vcs-btn';
        wait1h.textContent = 'Wait 1h';
        wait1h.addEventListener('click', () => {
            this._advanceTime(gs, 60);
        });
        bar.appendChild(wait1h);

        const waitDay = document.createElement('button');
        waitDay.className = 'vcs-btn';
        waitDay.textContent = 'Next day';
        waitDay.addEventListener('click', () => {
            const nextDayStart = gs.creditDayStart + gs.config.dayDuration;
            const remaining = Math.max(1, nextDayStart - gs.simulatedTime);
            this._advanceTime(gs, remaining);
        });
        bar.appendChild(waitDay);
        return bar;
    }

    _toolbarBar(text, pct, color) {
        const w = document.createElement('span');
        w.className = 'vcs-toolbar-item vcs-toolbar-bar-item';
        const bg = document.createElement('div');
        bg.className = 'vcs-toolbar-bar-bg';
        bg.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
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
        for (const [key, label] of [['features', 'Features'], ['both', 'Both'], ['tasks', 'Tasks']]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-toggle';
            if (this.columnView === key) btn.classList.add('vcs-btn-active');
            btn.textContent = label;
            btn.addEventListener('click', () => { this.columnView = key; this.render(); });
            row.appendChild(btn);
        }

        const gear = document.createElement('button');
        gear.className = 'vcs-btn vcs-settings-gear';
        if (this.columnView === 'settings') gear.classList.add('vcs-btn-active');
        gear.textContent = '\u2699';
        gear.title = 'Settings';
        gear.addEventListener('click', () => {
            if (this.columnView === 'settings') {
                this.columnView = this._prevColumnView;
            } else {
                this._prevColumnView = this.columnView;
                this.columnView = 'settings';
                this._pendingConfig = { ...this.gameState.config };
            }
            this.render();
        });
        row.appendChild(gear);

        return row;
    }

    // ========== Settings Panel ==========

    _renderSettingsPanel(gs) {
        const panel = document.createElement('div');
        panel.className = 'vcs-settings-panel';

        const header = document.createElement('div');
        header.className = 'vcs-settings-header';
        header.innerHTML = '<strong>Settings</strong>';
        const backBtn = document.createElement('button');
        backBtn.className = 'vcs-btn vcs-btn-small';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => { this.columnView = this._prevColumnView; this.render(); });
        header.appendChild(backBtn);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.className = 'vcs-settings-body';

        const inputs = {};
        for (const group of CONFIG_SCHEMA) {
            const heading = document.createElement('div');
            heading.className = 'vcs-settings-group';
            heading.textContent = group.group;
            body.appendChild(heading);

            for (const field of group.fields) {
                const row = document.createElement('div');
                row.className = 'vcs-settings-row';
                const label = document.createElement('label');
                label.textContent = field.label;
                row.appendChild(label);
                const input = document.createElement('input');
                input.type = 'number';
                input.step = field.step;
                input.value = this._pendingConfig[field.key];
                input.addEventListener('change', () => {
                    this._pendingConfig[field.key] = parseFloat(input.value) || 0;
                });
                row.appendChild(input);
                inputs[field.key] = input;
                body.appendChild(row);
            }
        }
        panel.appendChild(body);

        const footer = document.createElement('div');
        footer.className = 'vcs-settings-footer';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'vcs-btn vcs-btn-action';
        applyBtn.textContent = 'Apply';
        applyBtn.addEventListener('click', () => {
            Object.assign(gs.config, this._pendingConfig);
            this.render();
        });
        footer.appendChild(applyBtn);

        const resetBtn = document.createElement('button');
        resetBtn.className = 'vcs-btn';
        resetBtn.textContent = 'Reset to Defaults';
        resetBtn.addEventListener('click', () => {
            const defaults = new SimulationConfig();
            this._pendingConfig = { ...defaults };
            for (const group of CONFIG_SCHEMA) {
                for (const field of group.fields) {
                    inputs[field.key].value = defaults[field.key];
                }
            }
        });
        footer.appendChild(resetBtn);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'vcs-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => {
            try {
                localStorage.setItem('vcs-config', JSON.stringify(this._pendingConfig));
                saveBtn.textContent = 'Saved!';
                setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
            } catch (e) { /* localStorage may be unavailable */ }
        });
        footer.appendChild(saveBtn);

        const loadBtn = document.createElement('button');
        loadBtn.className = 'vcs-btn';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => {
            try {
                const raw = localStorage.getItem('vcs-config');
                if (!raw) return;
                const loaded = JSON.parse(raw);
                for (const group of CONFIG_SCHEMA) {
                    for (const field of group.fields) {
                        if (typeof loaded[field.key] === 'number') {
                            this._pendingConfig[field.key] = loaded[field.key];
                            inputs[field.key].value = loaded[field.key];
                        }
                    }
                }
            } catch (e) { /* invalid JSON or localStorage unavailable */ }
        });
        footer.appendChild(loadBtn);

        panel.appendChild(footer);
        return panel;
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
        name.textContent = `${feat.unmetDepLayers > 0 ? `⏳${feat.unmetDepLayers} ` : ''}${feat.name}`;
        left.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'vcs-card-meta-row';
        if (feat.testResultPercent !== null) {
            const pct = document.createElement('span');
            pct.className = 'vcs-card-pct'; pct.style.color = testColor(feat.testResultPercent);
            pct.textContent = `${feat.testResultPercent}%`;
            meta.appendChild(pct);
        }
        const mtLabel = manualResultLabel(feat);
        if (mtLabel) {
            const mt = document.createElement('span');
            mt.className = 'vcs-manual-result';
            if (feat.manualTestResult === 'pass') mt.classList.add('vcs-manual-pass');
            else if (feat.manualReviewIssues) mt.classList.add('vcs-manual-issues');
            mt.textContent = mtLabel;
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

        // Red border if manual review found issues for this category
        const issueKey = { D: 'doc', C: 'code', T: 'tests' }[letter];
        if (feat.manualReviewIssues && feat.manualReviewIssues[issueKey] > 0) {
            btn.classList.add('vcs-badge-issue');
        }

        btn.textContent = letter;
        btn.title = inProgress ? `${actionLabel} (in progress)` : actionLabel;

        if (canAct) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const task = gs.assignTask(feat.id, taskType);
                if (task && this.autoSkipTesting) gs.skipTesting(task.id);
                if (task) this._autoExpandTask(gs, task);
                this.render();
            });
        } else { btn.disabled = true; btn.classList.add('vcs-badge-disabled'); }
        return btn;
    }

    _manualBadge(gs, feat) {
        const btn = document.createElement('button');
        const canTest = feat.hasCode && feat.hasTests && !gs.isManualTestActive;
        const activeTask = gs.activeManualTestTask;
        const isActive = activeTask && activeTask.targetFeatureId === feat.id;
        let bgColor = null, title = 'Manual Review';
        if (isActive) { bgColor = '#5a5a2a'; title = 'Manual Review in progress'; }
        else if (feat.manualTestResult === 'pass') { bgColor = '#2d8a4e'; title = 'Passed'; }
        else if (feat.manualReviewIssues) {
            const total = feat.manualReviewIssues.doc + feat.manualReviewIssues.code + feat.manualReviewIssues.tests;
            if (total > 0) { bgColor = '#c04030'; title = `${total} issue(s) found`; }
            else { bgColor = '#2d8a4e'; title = 'No issues found'; }
        }

        btn.className = 'vcs-badge vcs-badge-btn';
        if (isActive) btn.classList.add('vcs-badge-in-progress');
        else if (bgColor) btn.classList.add('vcs-badge-active');
        else btn.classList.add('vcs-badge-empty');
        if (bgColor) btn.style.background = bgColor;

        // Highlight border when feature needs review (has work but not passing)
        const hasWork = feat.hasDoc || feat.hasCode || feat.hasTests;
        if (hasWork && feat.manualTestResult !== 'pass') {
            btn.classList.add('vcs-badge-needs-review');
        }

        btn.textContent = 'M'; btn.title = title;

        if (canTest) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const task = gs.assignTask(feat.id, TaskType.MANUAL_TEST);
                if (task) this._autoExpandTask(gs, task);
                this.render();
            });
        } else { btn.disabled = true; btn.classList.add('vcs-badge-disabled'); }
        return btn;
    }

    _renderFeatureDetails(gs, feat) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details';
        if (!feat.depsAreMet) {
            const warn = document.createElement('div');
            warn.className = 'vcs-warning';
            const layers = feat.unmetDepLayers;
            const mult = Math.pow(2, layers);
            warn.textContent = `⏳${layers} Upstream deps not verified — tasks take ${mult}× longer`;
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

        // Auto-test checkbox
        const autoTestLabel = document.createElement('label');
        autoTestLabel.className = 'vcs-auto-skip';
        autoTestLabel.title = 'Automatically run test workflow after code/test changes';
        const autoTestCb = document.createElement('input');
        autoTestCb.type = 'checkbox'; autoTestCb.checked = gs.autoTest;
        autoTestCb.addEventListener('change', () => { gs.autoTest = autoTestCb.checked; });
        autoTestLabel.appendChild(autoTestCb);
        autoTestLabel.appendChild(document.createTextNode(' Auto-test'));
        header.appendChild(autoTestLabel);

        // Auto-rewind checkbox
        const autoRewindLabel = document.createElement('label');
        autoRewindLabel.className = 'vcs-auto-skip';
        autoRewindLabel.title = 'Automatically rewind when first issue is discovered during review';
        const autoRewindCb = document.createElement('input');
        autoRewindCb.type = 'checkbox'; autoRewindCb.checked = gs.autoRewind;
        autoRewindCb.addEventListener('change', () => { gs.autoRewind = autoRewindCb.checked; });
        autoRewindLabel.appendChild(autoRewindCb);
        autoRewindLabel.appendChild(document.createTextNode(' Auto-rewind'));
        header.appendChild(autoRewindLabel);

        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';

        list.appendChild(this._renderTestWorkflowCard(gs));

        // Stable ordering: all tasks in creation order, skip FAILED merge markers
        const ordered = gs.getOrderedTasks();
        for (const task of ordered) {
            if (task.type === TaskType.TEST_WORKFLOW) continue;
            if (task.status === TaskStatus.FAILED) continue;
            list.appendChild(this._renderTaskCard(gs, task));
        }

        if (gs.clearedTaskCount > 0) {
            const cleared = document.createElement('div');
            cleared.className = 'vcs-card vcs-card-cleared';
            cleared.innerHTML = `<div class="vcs-card-meta">${gs.clearedTaskCount} older task${gs.clearedTaskCount === 1 ? '' : 's'} cleared</div>`;
            list.appendChild(cleared);
        }

        col.appendChild(list);
        return col;
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
        if (task.type === TaskType.MANUAL_TEST) card.classList.add('vcs-card-manual-test');

        const feat = gs.features.get(task.targetFeatureId);
        const featName = feat?.name || task.targetFeatureId;
        const typeLabels = {
            [TaskType.WRITE_DOC]: 'Write Doc',
            [TaskType.EVALUATE_DOC]: 'Evaluate Doc',
            [TaskType.IMPLEMENT]: feat?.hasCode ? 'Debug Code' : 'Implement',
            [TaskType.WRITE_TESTS]: feat?.hasTests ? 'Debug Tests' : 'Write Tests',
            [TaskType.MERGE_CONFLICT]: 'Merge Resolve',
            [TaskType.MANUAL_TEST]: 'Manual Review',
        };
        const typeLabel = typeLabels[task.type] || task.type;

        const icons = {
            [TaskStatus.RUNNING]: task.type === TaskType.MANUAL_TEST ? '🔍' : '⚡',
            [TaskStatus.PENDING_REVIEW]: '📋',
            [TaskStatus.COMPLETED]: task.reportedSuccess ? '✓' : (task.type === TaskType.MANUAL_TEST ? '🔍' : '⚠'),
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
                if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING_REVIEW) {
                    gs.startReview(task.id);
                }
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

            // Review bar (on top) — show when expanded, or when collapsed with review progress
            // Skip for manual test tasks (main bar IS the progress)
            if (task.type !== TaskType.MANUAL_TEST && (isExpanded || task.reviewMinute > 0)) {
                const [reviewBar, reviewFill] = this._progressBar(task.reviewProgress);
                reviewBar.classList.add('vcs-review-bar');
                this._dyn[`task-review-bar-${task.id}`] = reviewFill;
                barContainer.appendChild(reviewBar);
            }

            // Main bar with markers — create all markers, hide unrevealed ones
            const allMarkers = task.type === TaskType.MANUAL_TEST
                ? task._manualReviewEvents.map(e => ({ position: e.minute / task.totalDuration, positive: false, isOutcome: false }))
                : task.eventMarkers;
            const revealedFrac = task.reviewProgress;
            const [bar, fill, markerEls] = this._progressBar(task.overallProgress, task.subtaskBoundaries, null, allMarkers, revealedFrac);
            this._dyn[`task-bar-${task.id}`] = fill;
            this._dyn[`task-markers-${task.id}`] = markerEls;
            barContainer.appendChild(bar);

            card.appendChild(barContainer);

            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            if (task.type === TaskType.MANUAL_TEST) {
                meta.textContent = isExpanded ? 'Reviewing...' : 'Expand to review';
            } else if (task.status === TaskStatus.PENDING_REVIEW) {
                meta.textContent = task.reportedSuccess ? 'Agent reports: success' : 'Agent reports: issues found';
                if (!task.reportedSuccess) meta.classList.add('vcs-event-negative');
            } else {
                meta.textContent = task.currentSubtaskLabel;
            }
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
                    let newTask;
                    if (task.type === TaskType.MERGE_CONFLICT) newTask = gs.retryMergeResolve(task.id);
                    else { newTask = gs.assignTask(task.targetFeatureId, task.type); if (newTask && this.autoSkipTesting) gs.skipTesting(newTask.id); }
                    if (newTask) this._autoExpandTask(gs, newTask);
                    this.render();
                });
                btnRight.appendChild(retryBtn);
            }
            if (btnRight.childNodes.length > 0) metaRow.appendChild(btnRight);
            card.appendChild(metaRow);
        }

        // Expanded: event log and rewind controls
        if (isExpanded) {
            if (task.type === TaskType.MANUAL_TEST) {
                card.appendChild(this._renderManualReviewLog(gs, task));
            } else {
                card.appendChild(this._renderTaskEventLog(gs, task));
            }
        }

        return card;
    }

    _renderManualReviewLog(gs, task) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details vcs-event-log';

        const logDiv = document.createElement('div');
        logDiv.className = 'vcs-event-entries';
        const catLabels = { doc: 'Doc', code: 'Code', tests: 'Tests' };

        const entryEls = [];
        for (const evt of task._manualReviewEvents) {
            const entry = document.createElement('div');
            entry.className = 'vcs-event-entry vcs-event-negative';
            entry.textContent = `[${evt.minute}m] [${catLabels[evt.category]}] ${evt.description}`;
            entry.dataset.minute = evt.minute;
            if (!evt.revealed) entry.style.display = 'none';
            logDiv.appendChild(entry);
            entryEls.push(entry);
        }

        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'vcs-event-entry vcs-card-meta';
        const anyRevealed = task._manualReviewEvents.some(e => e.revealed);
        emptyMsg.textContent = task._manualReviewEvents.length > 0 ? 'Reviewing...' : 'No issues to discover';
        if (anyRevealed) emptyMsg.style.display = 'none';
        logDiv.appendChild(emptyMsg);

        if (task.status === TaskStatus.COMPLETED) {
            const feat = gs.features.get(task.targetFeatureId);
            const issues = feat?.manualReviewIssues || { doc: 0, code: 0, tests: 0 };
            const total = issues.doc + issues.code + issues.tests;
            const summary = document.createElement('div');
            summary.className = `vcs-event-entry vcs-review-summary ${total === 0 ? 'vcs-event-positive' : 'vcs-event-negative'}`;
            summary.textContent = total === 0
                ? 'Review complete — no issues found'
                : `Review complete — ${total} issue(s): Doc ${issues.doc}, Code ${issues.code}, Tests ${issues.tests}`;
            logDiv.appendChild(summary);
        }

        this._dyn[`manual-log-entries-${task.id}`] = entryEls;
        this._dyn[`manual-log-empty-${task.id}`] = emptyMsg;

        details.appendChild(logDiv);
        return details;
    }

    _renderTaskEventLog(gs, task) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details vcs-event-log';

        // Rewind buttons — shown for running, pending review, and completed tasks (not yet accepted/rejected)
        const canRewind = (task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING_REVIEW || task.status === TaskStatus.COMPLETED)
            && !task.accepted && !task.rejected;
        if (canRewind) {
            const controls = document.createElement('div');
            controls.className = 'vcs-rewind-controls';

            const hasNeg = task.events.some(e =>
                (e.type === 'quality' || e.type === 'outcome') && !e.positive && e.minute <= task.reviewMinute);

            const rwNeg = document.createElement('button');
            rwNeg.className = 'vcs-btn vcs-btn-small';
            rwNeg.textContent = '⏪ First issue';
            rwNeg.title = 'Rewind to first negative event';
            rwNeg.disabled = !hasNeg;
            this._dyn[`task-rwneg-${task.id}`] = rwNeg;
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

        // Event log entries — create ALL entries, hide unrevealed ones
        // Sorted by minute for correct display order
        const allEvents = [...task.events].sort((a, b) => a.minute - b.minute);
        const revealedMinute = task.reviewMinute;

        const logDiv = document.createElement('div');
        logDiv.className = 'vcs-event-entries';

        const entryEls = [];
        for (const evt of allEvents) {
            const entry = document.createElement('div');
            entry.className = 'vcs-event-entry';
            if (evt.type === 'quality' || evt.type === 'outcome') {
                entry.classList.add(evt.positive ? 'vcs-event-positive' : 'vcs-event-negative');
                if (evt.type === 'outcome') entry.classList.add('vcs-event-outcome');
            }
            entry.textContent = `[${evt.minute}m] ${evt.description}`;
            entry.dataset.minute = evt.minute;
            if (evt.minute > revealedMinute) entry.style.display = 'none';
            logDiv.appendChild(entry);
            entryEls.push(entry);
        }

        // "Reviewing..." placeholder shown when events exist but none revealed yet
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'vcs-event-entry vcs-card-meta';
        emptyMsg.textContent = allEvents.length > 0 ? 'Reviewing...' : 'No events';
        const anyRevealed = allEvents.some(e => e.minute <= revealedMinute);
        if (anyRevealed) emptyMsg.style.display = 'none';
        logDiv.appendChild(emptyMsg);

        // Review summary shown when review reaches 100%
        const summary = document.createElement('div');
        summary.className = `vcs-event-entry vcs-review-summary ${task.pendingQuality >= 0 ? 'vcs-event-positive' : 'vcs-event-negative'}`;
        summary.textContent = `Review complete — ${this._describeTaskQuality(task.pendingQuality)}`;
        const reviewComplete = task.totalDuration > 0 && revealedMinute >= task.totalDuration;
        if (!reviewComplete) summary.style.display = 'none';
        logDiv.appendChild(summary);

        // Store refs for updateTick to reveal progressively
        this._dyn[`task-log-entries-${task.id}`] = entryEls;
        this._dyn[`task-log-empty-${task.id}`] = emptyMsg;
        this._dyn[`task-log-summary-${task.id}`] = summary;
        this._dyn[`task-event-count-${task.id}`] = task.events.length;

        details.appendChild(logDiv);

        return details;
    }

    _describeTaskQuality(pendingQuality) {
        if (pendingQuality >= 0.12) return 'Work looks excellent — significant improvement expected';
        if (pendingQuality >= 0.05) return 'Work looks good — solid improvement expected';
        if (pendingQuality >= -0.02) return 'Work looks adequate — modest progress expected';
        if (pendingQuality >= -0.08) return 'Work looks rough — marginal improvement at best';
        return 'Work looks problematic — may introduce regressions';
    }

    // ========== Helpers ==========

    _autoExpandTask(gs, task) {
        if (!task) return;
        // Don't steal focus from a task that has review in progress
        if (this.expandedTaskId && gs.activeReviewTaskId === this.expandedTaskId) return;
        this.expandedTaskId = task.id;
        if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING_REVIEW) {
            gs.startReview(task.id);
        }
    }

    _advanceTime(gs, minutes) {
        const steps = Math.max(1, minutes * 2);
        const dtPerStep = minutes / steps / (gs.config.timeScale / 60);
        const wasPaused = gs.paused, oldMult = gs.speedMultiplier;
        gs.paused = false; gs.speedMultiplier = 1;
        for (let i = 0; i < steps; i++) gs.tick(dtPerStep);
        gs.paused = wasPaused; gs.speedMultiplier = oldMult;
        this.render();
    }

    _progressBar(pct, boundaries = null, skipMarkerAt = null, eventMarkers = null, revealedFrac = null) {
        const bar = document.createElement('div');
        bar.className = 'vcs-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'vcs-progress-fill';
        fill.style.width = `${pct * 100}%`;
        bar.appendChild(fill);
        if (boundaries) {
            for (const pos of boundaries) {
                const m = document.createElement('div');
                m.className = 'vcs-progress-marker';
                m.style.left = `${Math.round(pos * 100)}%`;
                bar.appendChild(m);
            }
        }
        const markerEls = [];
        if (eventMarkers) {
            for (const em of eventMarkers) {
                const m = document.createElement('div');
                m.className = `vcs-progress-event-marker ${em.positive ? 'vcs-event-marker-pos' : 'vcs-event-marker-neg'}`;
                m.style.left = `${Math.min(Math.round(em.position * 100), 97)}%`;
                // Hide markers not yet revealed by review
                if (revealedFrac !== null && em.position > revealedFrac) {
                    m.style.display = 'none';
                }
                m.dataset.position = em.position;
                bar.appendChild(m);
                markerEls.push(m);
            }
        }
        if (skipMarkerAt !== null) {
            const m = document.createElement('div');
            m.className = 'vcs-progress-skip-marker';
            m.style.left = `${Math.round(skipMarkerAt * 100)}%`;
            bar.appendChild(m);
        }
        return [bar, fill, markerEls];
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

// --- Graph Node Overlay ---

export function createFeatureOverlay(nodeId, gs) {
    if (!gs) return null;
    // Map region node ID to feature ID
    const match = nodeId.match(/(\d+)/);
    let featureId = null;
    if (match) featureId = gs.indexToFeatureId[parseInt(match[1])];
    if (!featureId && gs.features.has(nodeId)) featureId = nodeId;
    if (!featureId) return null;

    const feat = gs.features.get(featureId);
    if (!feat) return null;

    const card = document.createElement('div');
    card.className = 'vcs-node-overlay';
    card.style.borderLeftColor = testColor(feat.testResultPercent);

    // Row 1: name
    const nameRow = document.createElement('div');
    nameRow.className = 'vcs-node-overlay-name';
    nameRow.textContent = `${feat.unmetDepLayers > 0 ? `\u23f3${feat.unmetDepLayers} ` : ''}${feat.name}`;
    card.appendChild(nameRow);

    // Row 2: meta (test %, review issues)
    const metaRow = document.createElement('div');
    metaRow.className = 'vcs-node-overlay-meta';
    if (feat.testResultPercent !== null) {
        const pct = document.createElement('span');
        pct.style.color = testColor(feat.testResultPercent);
        pct.textContent = `${feat.testResultPercent}%`;
        metaRow.appendChild(pct);
    }
    const mtLabel = manualResultLabel(feat);
    if (mtLabel) {
        const mt = document.createElement('span');
        mt.className = feat.manualTestResult === 'pass' ? 'vcs-manual-pass' : 'vcs-manual-issues';
        mt.textContent = mtLabel;
        metaRow.appendChild(mt);
    }
    if (metaRow.childNodes.length > 0) card.appendChild(metaRow);

    // Row 3: badges
    const badgeRow = document.createElement('div');
    badgeRow.className = 'vcs-node-overlay-badges';
    badgeRow.appendChild(_overlayBadge(gs, feat, 'D', feat.hasDoc, TaskType.WRITE_DOC, TaskType.EVALUATE_DOC));
    badgeRow.appendChild(_overlayBadge(gs, feat, 'C', feat.hasCode, TaskType.IMPLEMENT, TaskType.IMPLEMENT));
    badgeRow.appendChild(_overlayBadge(gs, feat, 'T', feat.hasTests, TaskType.WRITE_TESTS, TaskType.WRITE_TESTS));
    badgeRow.appendChild(_overlayManualBadge(gs, feat));
    card.appendChild(badgeRow);

    return card;
}

function _overlayBadge(gs, feat, letter, exists, createType, improveType) {
    const btn = document.createElement('button');
    const taskType = exists ? improveType : createType;
    const canAct = taskType === TaskType.WRITE_DOC ? !feat.hasDoc : taskType === TaskType.EVALUATE_DOC ? feat.hasDoc : feat.hasDoc;
    const actionTaskTypes = letter === 'D' ? [TaskType.WRITE_DOC, TaskType.EVALUATE_DOC] : letter === 'C' ? [TaskType.IMPLEMENT] : [TaskType.WRITE_TESTS];
    const inProgress = gs.getRunningTasks().some(t => t.targetFeatureId === feat.id && actionTaskTypes.includes(t.type));
    const colors = { D: '#4a7a5a', C: '#4a5a7a', T: '#7a5a4a' };

    btn.className = 'vcs-badge vcs-badge-btn';
    if (inProgress) { btn.classList.add('vcs-badge-in-progress'); btn.style.background = colors[letter]; }
    else if (exists) { btn.classList.add('vcs-badge-active'); btn.style.background = colors[letter]; }
    else btn.classList.add('vcs-badge-empty');

    const issueKey = { D: 'doc', C: 'code', T: 'tests' }[letter];
    if (feat.manualReviewIssues && feat.manualReviewIssues[issueKey] > 0) btn.classList.add('vcs-badge-issue');

    btn.textContent = letter;
    if (canAct) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            gs.assignTask(feat.id, taskType);
        });
    } else { btn.disabled = true; btn.classList.add('vcs-badge-disabled'); }
    return btn;
}

function _overlayManualBadge(gs, feat) {
    const btn = document.createElement('button');
    const canTest = feat.hasCode && feat.hasTests && !gs.isManualTestActive;
    let bgColor = null;
    if (feat.manualTestResult === 'pass') bgColor = '#2d8a4e';
    else if (feat.manualReviewIssues) {
        const total = feat.manualReviewIssues.doc + feat.manualReviewIssues.code + feat.manualReviewIssues.tests;
        bgColor = total > 0 ? '#c04030' : '#2d8a4e';
    }

    btn.className = 'vcs-badge vcs-badge-btn';
    if (bgColor) { btn.classList.add('vcs-badge-active'); btn.style.background = bgColor; }
    else btn.classList.add('vcs-badge-empty');

    const hasWork = feat.hasDoc || feat.hasCode || feat.hasTests;
    if (hasWork && feat.manualTestResult !== 'pass') btn.classList.add('vcs-badge-needs-review');

    btn.textContent = 'M';
    if (canTest) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            gs.assignTask(feat.id, TaskType.MANUAL_TEST);
        });
    } else { btn.disabled = true; btn.classList.add('vcs-badge-disabled'); }
    return btn;
}
