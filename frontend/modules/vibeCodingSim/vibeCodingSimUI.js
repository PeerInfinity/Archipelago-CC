/**
 * Vibe Coding Simulator — Panel UI (v2)
 *
 * Two-column layout: Features | Tasks
 * Features show hidden-state indicators, test results, and workflow actions.
 * Tasks show running/completed Claw instances with reported outcomes.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import { TaskStatus, TaskType } from './simEngine.js';

const STATUS_COLORS = {
    pass: '#2d8a4e',
    partial: '#b8860b',
    fail: '#c0392b',
    unknown: '#555',
    none: '#333',
};

function testColor(pct) {
    if (pct === null || pct === undefined) return STATUS_COLORS.none;
    if (pct >= 95) return STATUS_COLORS.pass;
    if (pct >= 50) return STATUS_COLORS.partial;
    return STATUS_COLORS.fail;
}

function manualResultLabel(result) {
    if (!result) return '';
    const labels = {
        incomplete: '⚠ Incomplete',
        doc: '⚠ Doc needs work',
        code: '⚠ Code needs work',
        tests: '⚠ Tests need work',
        pass: '✓ Passed',
    };
    return labels[result] || result;
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
        this.featureSearch = '';
        this.visibleColumns = { features: true, tasks: true };

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

    // --- Main Render ---

    render() {
        const gs = this.gameState;
        if (!this.rootElement) return;
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

    // --- Toolbar ---

    _renderToolbar(gs) {
        const bar = document.createElement('div');
        bar.className = 'vcs-toolbar';

        const items = [
            gs.timeStr,
            `Credits: ${gs.creditHours.toFixed(1)}h`,
            `Progress: ${Math.round(gs.overallProgress * 100)}%`,
        ];
        for (const text of items) {
            const span = document.createElement('span');
            span.className = 'vcs-toolbar-item';
            span.textContent = text;
            bar.appendChild(span);
        }

        if (gs.isManualTestActive) {
            const span = document.createElement('span');
            span.className = 'vcs-toolbar-item vcs-manual-test-active';
            span.textContent = `🔍 Manual testing: ${gs.manualTestFeatureId} (${Math.round((gs.manualTestProgress ?? 0) * 100)}%)`;
            bar.appendChild(span);
        }

        // Speed buttons
        const speeds = [
            { label: '⏸', mult: 0 },
            { label: '1×', mult: 1 },
            { label: '2×', mult: 2 },
            { label: '5×', mult: 5 },
            { label: '10×', mult: 10 },
        ];
        for (const sp of speeds) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-speed';
            if ((sp.mult === 0 && gs.paused) || (!gs.paused && gs.speedMultiplier === sp.mult)) {
                btn.classList.add('vcs-btn-active');
            }
            btn.textContent = sp.label;
            btn.addEventListener('click', () => {
                gs.paused = sp.mult === 0;
                if (sp.mult > 0) gs.speedMultiplier = sp.mult;
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
                gs.paused = false;
                const oldMult = gs.speedMultiplier;
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

    _renderColumnToggles() {
        const row = document.createElement('div');
        row.className = 'vcs-column-toggles';
        for (const [key, label] of [['features', 'Features'], ['tasks', 'Tasks']]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-toggle';
            if (this.visibleColumns[key]) btn.classList.add('vcs-btn-active');
            btn.textContent = label;
            btn.addEventListener('click', () => {
                this.visibleColumns[key] = !this.visibleColumns[key];
                this.render();
            });
            row.appendChild(btn);
        }
        return row;
    }

    // --- Feature Column ---

    _renderFeatureColumn(gs) {
        const col = document.createElement('div');
        col.className = 'vcs-column';

        // Header
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

        // Card list
        const list = document.createElement('div');
        list.className = 'vcs-card-list';
        const features = [...gs.features.values()].sort((a, b) => a.upstreamIds.size - b.upstreamIds.size || a.name.localeCompare(b.name));
        for (const feat of features) {
            if (this.featureSearch && !feat.name.toLowerCase().includes(this.featureSearch.toLowerCase())) continue;
            list.appendChild(this._renderFeatureCard(gs, feat));
        }
        col.appendChild(list);

        // Action area
        col.appendChild(this._renderFeatureActions(gs));
        return col;
    }

    _renderFeatureCard(gs, feat) {
        const isSelected = this.selectedFeatureId === feat.id;
        const isExpanded = this.expandedFeatures.has(feat.id);

        const card = document.createElement('div');
        card.className = `vcs-card ${isSelected ? 'vcs-card-selected' : ''}`;
        card.style.borderLeftColor = testColor(feat.testResultPercent);

        // Summary (always visible)
        const summary = document.createElement('div');
        summary.className = 'vcs-card-summary';
        summary.addEventListener('click', () => {
            this.selectedFeatureId = feat.id;
            if (this.expandedFeatures.has(feat.id)) this.expandedFeatures.delete(feat.id);
            else this.expandedFeatures.add(feat.id);
            this.render();
        });

        // Name with deps-met indicator
        const name = document.createElement('span');
        name.className = 'vcs-card-name';
        const depsIcon = feat.depsAreMet ? '' : '⏳ ';
        name.textContent = `${depsIcon}${feat.name}`;
        summary.appendChild(name);

        // Status badges
        const badges = document.createElement('span');
        badges.className = 'vcs-badges';
        if (feat.hasDoc) badges.appendChild(this._badge('D', '#4a7a5a'));
        if (feat.hasCode) badges.appendChild(this._badge('C', '#4a5a7a'));
        if (feat.hasTests) badges.appendChild(this._badge('T', '#7a5a4a'));
        summary.appendChild(badges);

        // Test result
        if (feat.testResultPercent !== null) {
            const pct = document.createElement('span');
            pct.className = 'vcs-card-pct';
            pct.style.color = testColor(feat.testResultPercent);
            pct.textContent = `${feat.testResultPercent}%`;
            summary.appendChild(pct);
        }

        // Manual test result
        if (feat.manualTestResult) {
            const mt = document.createElement('span');
            mt.className = `vcs-manual-result vcs-manual-${feat.manualTestResult}`;
            mt.textContent = manualResultLabel(feat.manualTestResult);
            summary.appendChild(mt);
        }

        card.appendChild(summary);

        // Expanded details
        if (isExpanded) {
            card.appendChild(this._renderFeatureDetails(gs, feat));
        }

        return card;
    }

    _renderFeatureDetails(gs, feat) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details';

        // Dependencies
        if (feat.upstreamIds.size > 0) {
            details.appendChild(this._renderDepLinks(gs, 'Depends on', feat.upstreamIds));
        }
        if (feat.downstreamIds.size > 0) {
            details.appendChild(this._renderDepLinks(gs, 'Unlocks', feat.downstreamIds));
        }

        // Deps-not-met warning
        if (!feat.depsAreMet) {
            const warn = document.createElement('div');
            warn.className = 'vcs-warning';
            warn.textContent = '⏳ Upstream deps not verified — tasks take 2× longer';
            details.appendChild(warn);
        }

        // Active tasks
        const active = gs.getRunningTasks().filter(t => t.targetFeatureId === feat.id);
        if (active.length > 0) {
            const section = document.createElement('div');
            section.innerHTML = '<div class="vcs-detail-label">Active</div>';
            for (const task of active) {
                const row = document.createElement('div');
                row.className = 'vcs-task-inline';
                row.appendChild(this._progressBar(task.progress));
                const lbl = document.createElement('span');
                lbl.textContent = ` ${task.subtaskLabel}`;
                row.appendChild(lbl);
                section.appendChild(row);
            }
            details.appendChild(section);
        }

        // Recent task history for this feature
        const history = gs.getCompletedTasks().filter(t => t.targetFeatureId === feat.id).slice(-5);
        if (history.length > 0) {
            const section = document.createElement('div');
            section.innerHTML = '<div class="vcs-detail-label">Recent</div>';
            for (const task of history) {
                const row = document.createElement('div');
                row.className = 'vcs-history-row';
                const icon = task.reportedSuccess ? '✓' : '⚠';
                const typeLabel = task.label.split(':')[0];
                row.textContent = `${icon} ${typeLabel} — ${task.reportedSuccess ? 'success' : 'issues found'}`;
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

    _renderFeatureActions(gs) {
        const area = document.createElement('div');
        area.className = 'vcs-action-area';
        if (!this.selectedFeatureId || !gs) return area;

        const actions = gs.getFeatureActions(this.selectedFeatureId);
        if (actions.length === 0) {
            const msg = document.createElement('span');
            msg.className = 'vcs-action-msg';
            msg.textContent = 'No actions available';
            area.appendChild(msg);
            return area;
        }

        const blocked = gs.isManualTestActive;
        for (const action of actions) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-action';
            btn.textContent = action.label;
            if (blocked && action.type !== TaskType.MANUAL_TEST) {
                // During manual test, only show manual test is in progress
            }
            if (blocked) {
                btn.disabled = true;
                btn.classList.add('vcs-btn-disabled');
            }
            btn.addEventListener('click', () => {
                gs.assignTask(this.selectedFeatureId, action.type);
                this.render();
            });
            area.appendChild(btn);
        }

        return area;
    }

    // --- Task Column ---

    _renderTaskColumn(gs) {
        const col = document.createElement('div');
        col.className = 'vcs-column';

        const header = document.createElement('div');
        header.className = 'vcs-column-header';
        header.innerHTML = '<strong>Tasks</strong>';
        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';

        // Manual test (if active)
        if (gs.isManualTestActive) {
            list.appendChild(this._renderManualTestCard(gs));
        }

        // Test workflow
        list.appendChild(this._renderTestWorkflowCard(gs));

        // Running tasks
        for (const task of gs.getRunningTasks()) {
            list.appendChild(this._renderTaskCard(gs, task));
        }

        // Merge conflicts
        for (const task of gs.getMergeConflicts()) {
            list.appendChild(this._renderTaskCard(gs, task));
        }

        // Completed
        const completed = gs.getCompletedTasks();
        for (let i = completed.length - 1; i >= 0; i--) {
            list.appendChild(this._renderTaskCard(gs, completed[i]));
        }

        col.appendChild(list);
        col.appendChild(this._renderTaskActions(gs));
        return col;
    }

    _renderManualTestCard(gs) {
        const card = document.createElement('div');
        card.className = 'vcs-card vcs-card-manual-test';
        card.innerHTML = `<div class="vcs-card-name">🔍 Manual Test: ${gs.manualTestFeatureId}</div>`;
        card.appendChild(this._progressBar(gs.manualTestProgress ?? 0));
        const meta = document.createElement('div');
        meta.className = 'vcs-card-meta';
        meta.textContent = 'Player is busy testing — no new actions can be started';
        card.appendChild(meta);
        return card;
    }

    _renderTestWorkflowCard(gs) {
        const card = document.createElement('div');
        card.className = 'vcs-card vcs-card-workflow';
        card.innerHTML = '<div class="vcs-card-name">🧪 Test Workflow</div>';

        if (gs.testWorkflow && !gs.testWorkflow.complete) {
            card.appendChild(this._progressBar(gs.testWorkflowProgress ?? 0));
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = 'Running...';
            card.appendChild(meta);
        } else {
            if (gs.testWorkflow?.complete) {
                const passing = [...gs.features.values()].filter(f => f.testResultPercent !== null && f.testResultPercent >= 95).length;
                const tested = [...gs.features.values()].filter(f => f.testResultPercent !== null).length;
                const meta = document.createElement('div');
                meta.className = 'vcs-card-meta';
                meta.textContent = `Last run: ${passing}/${tested} passing`;
                card.appendChild(meta);
            }
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-action';
            btn.textContent = 'Run Tests';
            btn.addEventListener('click', () => { gs.startTestWorkflow(); this.render(); });
            card.appendChild(btn);
        }
        return card;
    }

    _renderTaskCard(gs, task) {
        const isSelected = this.selectedTaskId === task.id;
        const card = document.createElement('div');
        card.className = `vcs-card ${isSelected ? 'vcs-card-selected' : ''}`;

        const borderColors = {
            [TaskStatus.RUNNING]: '#3498db',
            [TaskStatus.COMPLETED]: '#2d8a4e',
            [TaskStatus.MERGE_CONFLICT]: '#e67e22',
            [TaskStatus.CANCELLED]: '#666',
            [TaskStatus.FAILED]: '#666',
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
        const name = document.createElement('div');
        name.className = 'vcs-card-name';
        name.textContent = `${icons[task.status] || ''} ${task.label}`;
        card.appendChild(name);

        if (task.status === TaskStatus.RUNNING) {
            card.appendChild(this._progressBar(task.progress));
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.subtaskLabel;
            card.appendChild(meta);
        } else if (task.status === TaskStatus.MERGE_CONFLICT) {
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta vcs-merge-conflict';
            meta.textContent = 'Merge conflict — needs resolution';
            card.appendChild(meta);
        } else if (task.status === TaskStatus.COMPLETED) {
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.reportedSuccess ? 'Reported: success' : 'Reported: issues found';
            card.appendChild(meta);
        } else {
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.status;
            card.appendChild(meta);
        }

        return card;
    }

    _renderTaskActions(gs) {
        const area = document.createElement('div');
        area.className = 'vcs-action-area';
        if (!this.selectedTaskId) return area;

        const task = gs.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) return area;

        if (task.status === TaskStatus.RUNNING) {
            this._addActionBtn(area, 'Cancel', 'vcs-btn-danger', () => { gs.cancelTask(task.id); this.render(); });
            this._addActionBtn(area, 'Skip Testing', '', () => { gs.skipTesting(task.id); this.render(); });
        }

        if (task.status === TaskStatus.MERGE_CONFLICT) {
            this._addActionBtn(area, 'Resolve', '', () => { gs.resolveMergeConflict(task.id); this.render(); });
            this._addActionBtn(area, 'Discard', 'vcs-btn-danger', () => { gs.discardMergeConflict(task.id); this.render(); });
        }

        return area;
    }

    // --- Helpers ---

    _addActionBtn(parent, label, extraClass, onClick) {
        const btn = document.createElement('button');
        btn.className = `vcs-btn vcs-btn-action ${extraClass}`;
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        parent.appendChild(btn);
    }

    _progressBar(pct) {
        const bar = document.createElement('div');
        bar.className = 'vcs-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'vcs-progress-fill';
        fill.style.width = `${Math.round(pct * 100)}%`;
        bar.appendChild(fill);
        return bar;
    }

    _badge(letter, color) {
        const b = document.createElement('span');
        b.className = 'vcs-badge';
        b.style.background = color;
        b.textContent = letter;
        return b;
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
}
