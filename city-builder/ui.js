// DOM UI: HUD strip, bottom toolbar, side panel with selection details
// and notifications. Updated at a modest cadence rather than every frame.

class UIManager {
    constructor(game) {
        this.game = game;

        this.moneyEl = document.getElementById('hud-money');
        this.dateEl = document.getElementById('hud-date');
        this.popEl = document.getElementById('hud-pop');
        this.jobsEl = document.getElementById('hud-jobs');
        this.happyEl = document.getElementById('hud-happy');
        this.demandResEl = document.getElementById('demand-res');
        this.demandComEl = document.getElementById('demand-com');
        this.demandIndEl = document.getElementById('demand-ind');

        this.toolbarEl = document.getElementById('toolbar');
        this.infoEl = document.getElementById('info-content');
        this.notificationsEl = document.getElementById('notifications');

        this._buildToolbar();
        this.refreshToolbar();
    }

    _buildToolbar() {
        if (!this.toolbarEl) return;
        const tools = [
            { id: TOOLS.SELECT, label: 'Inspect', key: 'Q', title: 'Inspect buildings (Q)' },
            { id: TOOLS.ROAD, label: 'Road', key: 'R', costKey: 'road' },
            { id: TOOLS.ZONE_R, label: 'Homes', key: '1', costKey: 'residential', zone: true },
            { id: TOOLS.ZONE_C, label: 'Shops', key: '2', costKey: 'commercial', zone: true },
            { id: TOOLS.ZONE_I, label: 'Industry', key: '3', costKey: 'industrial', zone: true },
            { id: TOOLS.DEZONE, label: 'Unzone', key: '4' },
            { id: TOOLS.BULLDOZE, label: 'Demolish', key: 'X' },
            { id: TOOLS.PARK, label: 'Park', key: '5', costKey: 'park' },
            { id: TOOLS.POWER, label: 'Power', key: '6', costKey: 'power' },
            { id: TOOLS.WATER, label: 'Water', key: '7', costKey: 'water' }
        ];

        this.toolbarEl.innerHTML = '';
        for (const t of tools) {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.dataset.tool = t.id;
            let cost = '';
            if (t.costKey) {
                const amount = t.zone ? CONFIG.COSTS.zone[t.costKey] : CONFIG.COSTS[t.costKey];
                cost = `<span class="cost">$${amount}</span>`;
            }
            btn.innerHTML = `${t.label}${t.key ? `<span class="hotkey">${t.key}</span>` : ''}${cost}`;
            btn.title = t.title || (t.key ? `Shortcut: ${t.key}` : '');
            btn.addEventListener('click', () => this.game.setTool(t.id));
            this.toolbarEl.appendChild(btn);
        }
    }

    refreshToolbar() {
        if (!this.toolbarEl) return;
        for (const btn of this.toolbarEl.querySelectorAll('.tool-btn')) {
            btn.classList.toggle('active', btn.dataset.tool === this.game.input.tool);
        }
    }

    // Called ~4x per second by the game
    updateHUD() {
        const game = this.game;
        const econ = game.economy;

        if (this.moneyEl) {
            const money = Math.floor(econ.money);
            this.moneyEl.textContent = `$${money.toLocaleString()}`;
            this.moneyEl.classList.toggle('negative', money < 0);
            const net = econ.lastMonthNet;
            const netEl = document.getElementById('hud-net');
            if (netEl) {
                netEl.textContent = `${net >= 0 ? '+' : ''}$${Math.round(net).toLocaleString()}/mo`;
                netEl.className = net >= 0 ? 'net positive' : 'net negative';
            }
        }
        if (this.dateEl) this.dateEl.textContent = econ.dateLabel;
        if (this.popEl) this.popEl.textContent = Math.floor(econ.population).toLocaleString();
        if (this.jobsEl) {
            const workforceTarget = Math.floor(econ.housedPopulation * 0.62);
            this.jobsEl.textContent = `${Math.floor(econ.employed)} / ${workforceTarget}`;
        }
        if (this.happyEl) {
            this.happyEl.textContent = `${econ.happiness}%`;
            this.happyEl.className =
                econ.happiness >= 60 ? 'good' : econ.happiness >= 35 ? 'mid' : 'bad';
        }

        // Demand bars
        if (this.demandResEl) {
            const setBar = (el, value) => {
                const pct = clamp(value, 0, 1) * 100;
                el.style.height = `${Math.max(4, pct)}%`;
                el.classList.toggle('dim', value <= 0);
            };
            setBar(this.demandResEl, econ.demand.residential);
            setBar(this.demandComEl, econ.demand.commercial);
            setBar(this.demandIndEl, econ.demand.industrial);
        }

        this.updateSelectionInfo();
    }

    updateSelectionInfo() {
        if (!this.infoEl) return;
        const b = this.game.selected;
        if (!b) {
            this.infoEl.innerHTML = '<p class="hint">Select a building to inspect it.<br>Zone land near roads and keep it powered — development happens on its own.</p>';
            return;
        }

        const def = INFRASTRUCTURE[b.type];
        if (def) {
            this.infoEl.innerHTML = `
                <h3>${def.name}</h3>
                ${b.type === 'road' ? '<p>Utilities and travellers flow along roads.</p>' : ''}
                ${b.type === 'park' ? '<p>Raises nearby land value.</p>' : ''}
                ${def.powerProduction ? `<p><strong>Output:</strong> ${def.powerProduction} MW</p>` : ''}
                ${def.waterProduction ? `<p><strong>Output:</strong> ${def.waterProduction} units</p>` : ''}
                ${def.powerConsumption ? `<p><strong>Uses:</strong> ${def.powerConsumption} MW</p>` : ''}
                ${def.waterConsumption ? `<p><strong>Uses:</strong> ${def.waterConsumption} water</p>` : ''}
                ${!b.connected && b.type !== 'road' ? '<p class="warn">Not connected to a road!</p>' : ''}
            `;
            return;
        }

        const zone = ZONES[b.type];
        const lvl = levelDef(b.type, b.level);
        const cap = lvl.capacity > 0 ? lvl.capacity : lvl.jobCapacity;
        const used = lvl.capacity > 0 ? b.pop : b.jobs;
        const lv = this.game.economy.landValue(b.x, b.y);

        let status;
        if (b.state === 'construction') status = '<p class="pending">Under construction…</p>';
        else if (b.state === 'abandoned') status = '<p class="warn">Abandoned — restore services to repopulate</p>';
        else if (!b.connected) status = '<p class="warn">No road connection!</p>';
        else if (!b.powered) status = '<p class="warn">No power!</p>';
        else if (!b.watered) status = '<p class="warn">No water!</p>';
        else status = '<p class="ok">Operating normally</p>';

        const upgradeHint = b.level < maxLevel(b.type)
            ? `<p class="hint">Upgrades with demand + land value ≥ ${CONFIG.DEV.LAND_VALUE_FOR_LEVEL[b.level]}</p>`
            : '<p class="hint">Fully developed</p>';

        this.infoEl.innerHTML = `
            <h3>${lvl.name}</h3>
            <p><span class="tag" style="background:${zone.color}">${zone.name}</span> Level ${b.level}/${maxLevel(b.type)}</p>
            ${status}
            ${cap > 0 ? `<p><strong>${lvl.capacity > 0 ? 'Residents' : 'Jobs'}:</strong> ${used} / ${cap}</p>` : ''}
            <p><strong>Uses:</strong> ${lvl.power} MW · ${lvl.water} water</p>
            <p><strong>Land value:</strong> ${lv}</p>
            ${upgradeHint}
        `;
    }

    notify(message, type = 'info') {
        if (!this.notificationsEl) return;
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.textContent = message;
        this.notificationsEl.prepend(el);

        while (this.notificationsEl.children.length > 8) {
            this.notificationsEl.removeChild(this.notificationsEl.lastChild);
        }
        setTimeout(() => el.remove(), 6000);
    }
}

window.UIManager = UIManager;
