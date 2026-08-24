/**
 * UIManager: DOM panels — time HUD, colonist cards, job list, messages,
 * resource summary, tile inspector chip and the priorities modal.
 * DOM writes are throttled; bars update cheaply via style widths.
 */
class UIManager {
    constructor(game) {
        this.game = game;
        this.refreshSoon = true;
        this._lastDomUpdate = 0;
        this._pawnCardEls = new Map();

        this.el = {
            clock: document.getElementById('hud-clock'),
            day: document.getElementById('hud-day'),
            speedBtns: document.querySelectorAll('[id^="speed-"]'),
            pawnList: document.getElementById('pawn-list'),
            resList: document.getElementById('resource-list'),
            jobsList: document.getElementById('job-list'),
            msgList: document.getElementById('message-list'),
            inspector: document.getElementById('tile-inspector'),
            modeName: document.getElementById('mode-name'),
            modeHint: document.getElementById('mode-hint'),
            popCount: document.getElementById('stat-pop'),
            gameOver: document.getElementById('game-over')
        };

        document.getElementById('close-game-over').addEventListener('click', () => {
            window.location.reload();
        });
        this.buildPriorityModal();
        this.bindPriorityButton();
    }

    // ---- main entry, called every frame ------------------------------------

    frame(now) {
        this.updateHUD();
        const interval = 250;
        if (this.refreshSoon || now - this._lastDomUpdate > interval) {
            this.refreshSoon = false;
            this._lastDomUpdate = now;
            this.updatePawnCards();
            this.updateResources();
            this.updateJobs();
            this.updateMessages();
            this.updateInspector();
            this.updateModeIndicator();
            if (this.priorityModalOpen) this.renderPriorityTable();
        }
    }

    // ---- HUD -----------------------------------------------------------------

    updateHUD() {
        const g = this.game;
        if (this.el.day) this.el.day.textContent = 'Day ' + (g.day + 1);
        if (this.el.clock) this.el.clock.textContent = formatClock(g.timeOfDay());
        if (this.el.speedBtns) {
            for (const b of this.el.speedBtns) {
                const val = b.id === 'speed-pause' ? 0 : parseInt(b.id.split('-')[1], 10);
                b.classList.toggle('active', g.paused ? val === 0 : (!g.paused && val === g.speed));
            }
        }
        if (this.el.popCount) this.el.popCount.textContent = String(g.pawns.length);
    }

    // ---- pawn cards ------------------------------------------------------------

    updatePawnCards() {
        const list = this.el.pawnList;
        if (!list) return;
        const g = this.game;

        // Remove stale cards
        for (const [pawn, el] of this._pawnCardEls) {
            if (!g.pawns.includes(pawn)) {
                el.remove();
                this._pawnCardEls.delete(pawn);
            }
        }

        for (const pawn of g.pawns) {
            let card = this._pawnCardEls.get(pawn);
            if (!card) {
                card = document.createElement('div');
                card.className = 'pawn-card';
                card.innerHTML = `
                    <div class="pawn-head">
                        <span class="pawn-dot"></span>
                        <span class="pawn-name"></span>
                        <span class="pawn-status"></span>
                    </div>
                    <div class="bar"><div class="bar-fill hunger"></div></div>
                    <div class="bar"><div class="bar-fill sleep"></div></div>
                    <div class="bar"><div class="bar-fill health"></div></div>`;
                card.addEventListener('click', () => {
                    g.centerOn(pawn.x, pawn.y);
                    g.selectedPawn = pawn;
                });
                list.appendChild(card);
                this._pawnCardEls.set(pawn, card);
            }

            const selected = g.selectedPawn === pawn;
            card.classList.toggle('selected', selected);
            card.querySelector('.pawn-dot').style.background = pawn.color;
            card.querySelector('.pawn-name').textContent = pawn.name;
            card.querySelector('.pawn-status').textContent = pawn.statusText();

            const h = card.querySelector('.hunger');
            const s = card.querySelector('.sleep');
            const hp = card.querySelector('.health');
            setBar(h, pawn.hunger, '#e67e22');
            setBar(s, pawn.sleep, '#8e44ad');
            setBar(hp, pawn.health, pawn.health < 40 ? '#e74c3c' : '#2ecc71');
        }
    }

    // ---- resources & jobs ---------------------------------------------------------

    updateResources() {
        const g = this.game;
        if (!this.el.resList) return;
        const totals = {};
        for (const s of g.world.stackList) totals[s.type] = (totals[s.type] || 0) + s.qty;
        let html = '';
        for (const type of Object.keys(CONFIG.items)) {
            const n = totals[type] || 0;
            html += `<div class="res-row"><span class="res-swatch" style="background:${CONFIG.items[type].color}"></span>${CONFIG.items[type].name}<b>${n}</b></div>`;
        }
        this.el.resList.innerHTML = html;
    }

    updateJobs() {
        const g = this.game;
        if (!this.el.jobsList) return;
        const active = g.jobs.jobs.filter(j => j.claimedBy);
        const queued = g.jobs.jobs.length - active.length;
        let html = `<div class="jobs-summary">${active.length} in progress · ${queued} queued</div>`;
        for (const j of active.slice(0, 6)) {
            html += `<div class="res-row dim"><span>${j.claimedBy.name}</span><b>${j.type.replace(/_/g, ' ')}</b></div>`;
        }
        this.el.jobsList.innerHTML = html;
    }

    updateMessages() {
        const g = this.game;
        if (!this.el.msgList || g.messages.length === this._msgCount) return;
        this._msgCount = g.messages.length;
        let html = '';
        for (const m of g.messages.slice(-30).reverse()) {
            html += `<div class="msg ${m.cls || ''}"><span class="msg-time">D${m.day} ${m.time}</span>${m.text}</div>`;
        }
        this.el.msgList.innerHTML = html;
    }

    updateInspector() {
        const g = this.game;
        const el = this.el.inspector;
        if (!el) return;
        const hover = g.hoveredTile;
        if (!hover || !g.world.inBounds(hover.x, hover.y)) { el.style.display = 'none'; return; }
        const w = g.world;
        const t = w.tileAt(hover.x, hover.y);
        const names = ['Water', 'Sand', 'Grass', 'Dirt', 'Rock'];
        const parts = [`(${hover.x}, ${hover.y}) · ${names[t] || '?'}`];
        const tree = w.trees.get(tileKey(hover.x, hover.y));
        const dep = w.deposits.get(tileKey(hover.x, hover.y));
        const bush = w.bushes.get(tileKey(hover.x, hover.y));
        const crop = w.crops.get(tileKey(hover.x, hover.y));
        const bld = w.buildings.get(tileKey(hover.x, hover.y));
        if (tree) parts.push('Tree');
        if (dep) parts.push(`Iron deposit (yields ${dep.richness})`);
        if (bush) parts.push('Berry bush');
        if (crop) parts.push(crop.mature ? 'Ripe crop' : `Crop ${Math.floor(crop.growth)}%`);
        if (bld) parts.push(bld.blueprint ? `${bld.def.name} blueprint` : bld.def.name);
        const stacks = w.stacksAt(hover.x, hover.y);
        if (stacks) for (const s of stacks) parts.push(`${CONFIG.items[s.type].name} ×${s.qty}`);
        for (const p of g.pawns) {
            if (Math.round(p.x) === hover.x && Math.round(p.y) === hover.y) parts.push(`${p.name} is here`);
        }
        el.textContent = parts.join('  ·  ');
        el.style.display = 'block';
    }

    updateModeIndicator() {
        const g = this.game;
        if (!this.el.modeName) return;
        const tool = TOOLS[g.tool];
        if (!tool || tool.kind === 'select') {
            this.el.modeName.textContent = 'Inspect';
            this.el.modeHint.textContent = 'Pick an order below, or click a colonist';
        } else {
            this.el.modeName.textContent = tool.name;
            this.el.modeHint.textContent = tool.hint + ' — right-click or Esc to cancel';
        }
    }

    // ---- priorities modal ----------------------------------------------------------

    bindPriorityButton() {
        const btn = document.getElementById('btn-priorities');
        if (btn) btn.addEventListener('click', () => this.togglePriorityModal());
    }

    buildPriorityModal() {
        this.priorityModalOpen = false;
        const modal = document.createElement('div');
        modal.id = 'priority-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-box">
              <div class="modal-head">
                <h3>Work priorities</h3>
                <button id="priority-close">×</button>
              </div>
              <div id="priority-content"></div>
              <p class="modal-note">0 = never. Lower numbers are done first.</p>
            </div>`;
        document.body.appendChild(modal);
        this.modalEl = modal;
        modal.querySelector('#priority-close').addEventListener('click', () =>
            this.togglePriorityModal(false));
    }

    togglePriorityModal(force) {
        this.priorityModalOpen = force !== undefined ? force : !this.priorityModalOpen;
        this.modalEl.style.display = this.priorityModalOpen ? 'flex' : 'none';
        if (this.priorityModalOpen) this.renderPriorityTable();
    }

    renderPriorityTable() {
        const content = this.modalEl.querySelector('#priority-content');
        const cats = Object.keys(CONFIG.workCategoryLabels);
        let html = '<table><thead><tr><th></th>';
        for (const c of cats) html += `<th>${CONFIG.workCategoryLabels[c]}</th>`;
        html += '</tr></thead><tbody>';
        this.game.pawns.forEach((pawn, i) => {
            html += `<tr><td><span class="pawn-dot" style="background:${pawn.color}"></span>${pawn.name}</td>`;
            for (const c of cats) {
                html += `<td><input data-pawn="${i}" data-cat="${c}" type="number" min="0" max="4" value="${pawn.priorities[c] ?? 1}"></td>`;
            }
            html += '</tr>';
        });
        html += '</tbody></table>';
        content.innerHTML = html;
        content.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const pawn = this.game.pawns[parseInt(input.dataset.pawn, 10)];
                const cat = input.dataset.cat;
                const v = clamp(parseInt(input.value, 10) || 0, 0, 4);
                if (pawn && cat in pawn.priorities) pawn.priorities[cat] = v;
            });
        });
    }

    showGameOver(daysSurvived) {
        if (!this.el.gameOver) return;
        this.el.gameOver.style.display = 'flex';
        const sub = this.el.gameOver.querySelector('.game-over-sub');
        if (sub) sub.textContent = `Your colonists survived ${daysSurvived} day${daysSurvived === 1 ? '' : 's'}.`;
    }
}

function setBar(el, value, color) {
    if (!el) return;
    el.style.width = clamp(value, 0, 100) + '%';
    el.style.background = color;
}

if (typeof module !== 'undefined') module.exports = { UIManager };
