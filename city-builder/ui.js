// DOM UI Manager: HUD strip, News Ticker, Categorized Grouped Toolbar,
// Inspector, City Vitals, Minimap, Budget & Ordinances Dialog, and Disaster controls.

const TOOL_GROUPS = [
    {
        id: 'tools',
        name: 'Tools',
        icon: '🛠️',
        tools: [
            { id: TOOLS.SELECT, icon: '🔍', label: 'Inspect', key: 'Q' },
            { id: TOOLS.BULLDOZE, icon: '🚜', label: 'Demolish', key: 'X' }
        ]
    },
    {
        id: 'zoning',
        name: 'Zoning',
        icon: '🏗️',
        tools: [
            { id: TOOLS.ZONE_R, icon: '🏡', label: 'Residential', key: '1', costKey: 'residential', zone: true, border: '#4caf50' },
            { id: TOOLS.ZONE_C, icon: '🏬', label: 'Commercial', key: '2', costKey: 'commercial', zone: true, border: '#42a5f5' },
            { id: TOOLS.ZONE_I, icon: '🏭', label: 'Industrial', key: '3', costKey: 'industrial', zone: true, border: '#ffb300' },
            { id: TOOLS.DEZONE, icon: '🧹', label: 'Unzone', key: '4' }
        ]
    },
    {
        id: 'transport',
        name: 'Transport',
        icon: '🛣️',
        tools: [
            { id: TOOLS.ROAD, icon: '🛣️', label: 'Road / Bridge', key: 'R', costKey: 'road' }
        ]
    },
    {
        id: 'utilities',
        name: 'Utilities',
        icon: '⚡',
        tools: [
            { id: TOOLS.POWER, icon: '⚡', label: 'Coal Plant', key: '6', costKey: 'power' },
            { id: TOOLS.WIND_TURBINE, icon: '🌀', label: 'Wind Turbine', costKey: 'wind_turbine' },
            { id: TOOLS.WATER, icon: '💧', label: 'Water Tower', key: '7', costKey: 'water' },
            { id: TOOLS.WATER_PUMP, icon: '🚰', label: 'Water Pump', costKey: 'water_pump' }
        ]
    },
    {
        id: 'services',
        name: 'Public Safety',
        icon: '🚨',
        tools: [
            { id: TOOLS.FIRE_STATION, icon: '🚒', label: 'Fire Dept', costKey: 'fire_station' },
            { id: TOOLS.POLICE_STATION, icon: '👮', label: 'Police', costKey: 'police_station' },
            { id: TOOLS.HOSPITAL, icon: '🏥', label: 'Hospital', costKey: 'hospital' },
            { id: TOOLS.SCHOOL, icon: '🎓', label: 'School', costKey: 'school' }
        ]
    },
    {
        id: 'civic',
        name: 'Civic & Parks',
        icon: '🏛️',
        tools: [
            { id: TOOLS.PARK, icon: '🌳', label: 'City Park', key: '5', costKey: 'park' },
            { id: TOOLS.CITY_HALL, icon: '🏛️', label: 'City Hall', costKey: 'city_hall' }
        ]
    }
];

class UIManager {
    constructor(game) {
        this.game = game;

        this.moneyEl = document.getElementById('hud-money');
        this.dateEl = document.getElementById('hud-date');
        this.popEl = document.getElementById('hud-pop');
        this.jobsEl = document.getElementById('hud-jobs');
        this.happyEl = document.getElementById('hud-happy');
        this.milestoneEl = document.getElementById('hud-milestone');
        this.demandResEl = document.getElementById('demand-res');
        this.demandComEl = document.getElementById('demand-com');
        this.demandIndEl = document.getElementById('demand-ind');

        this.toolbarEl = document.getElementById('toolbar');
        this.infoEl = document.getElementById('info-content');
        this.vitalsEl = document.getElementById('city-vitals');
        this.notificationsEl = document.getElementById('notifications');
        this.tickerTextEl = document.getElementById('ticker-text');
        this.minimapCanvas = document.getElementById('minimap-canvas');

        this.activeCategory = 'all';

        this._setupNewsTicker();
        this._setupModals();
        this._buildToolbar();
        this.refreshToolbar();
        this._setupMinimap();
    }

    _buildToolbar() {
        if (!this.toolbarEl) return;
        this.toolbarEl.innerHTML = '';

        // Category filter chips
        const catWrap = document.createElement('div');
        catWrap.className = 'tool-categories';

        const allCats = [{ id: 'all', icon: '🌐', name: 'All Groups' }, ...TOOL_GROUPS];

        allCats.forEach(c => {
            const btn = document.createElement('button');
            btn.className = `cat-btn ${this.activeCategory === c.id ? 'active' : ''}`;
            btn.innerHTML = `<span class="cat-icon">${c.icon}</span> ${c.name}`;
            btn.addEventListener('click', () => {
                this.activeCategory = c.id;
                this._buildToolbar();
                this.refreshToolbar();
            });
            catWrap.appendChild(btn);
        });
        this.toolbarEl.appendChild(catWrap);

        // Grouped cards container
        const groupsContainer = document.createElement('div');
        groupsContainer.className = 'tool-groups-container';

        const visibleGroups = this.activeCategory === 'all'
            ? TOOL_GROUPS
            : TOOL_GROUPS.filter(g => g.id === this.activeCategory);

        for (const group of visibleGroups) {
            const card = document.createElement('div');
            card.className = `tool-group-card group-${group.id}`;

            const header = document.createElement('div');
            header.className = 'tool-group-header';
            header.innerHTML = `<span>${group.icon} ${group.name}</span>`;
            card.appendChild(header);

            const btnRow = document.createElement('div');
            btnRow.className = 'tool-group-buttons';

            for (const t of group.tools) {
                const btn = document.createElement('button');
                btn.className = 'tool-btn';
                btn.dataset.tool = t.id;
                if (t.border) {
                    btn.style.borderLeft = `3px solid ${t.border}`;
                }

                let cost = '';
                if (t.costKey) {
                    const amount = t.zone ? CONFIG.COSTS.zone[t.costKey] : CONFIG.COSTS[t.costKey];
                    cost = `<span class="cost">$${amount.toLocaleString()}</span>`;
                }

                btn.innerHTML = `
                    <span class="t-icon">${t.icon}</span>
                    <span class="t-name">${t.label}</span>
                    ${t.key ? `<span class="hotkey">${t.key}</span>` : ''}
                    ${cost}
                `;
                btn.title = t.key ? `Shortcut: ${t.key}` : '';
                btn.addEventListener('click', () => this.game.setTool(t.id));
                btnRow.appendChild(btn);
            }

            card.appendChild(btnRow);
            groupsContainer.appendChild(card);
        }

        this.toolbarEl.appendChild(groupsContainer);
    }

    refreshToolbar() {
        if (!this.toolbarEl) return;
        for (const btn of this.toolbarEl.querySelectorAll('.tool-btn')) {
            btn.classList.toggle('active', btn.dataset.tool === this.game.input.tool);
        }
    }

    // --- News Ticker ---
    _setupNewsTicker() {
        this.tickerHeadlines = [
            "Local mayor promises lower taxes and brighter future for all Sims.",
            "Water authority reports high pressure in newly laid pipeline network.",
            "Citizens petition for more parks: 'We love grass and fresh air!'",
            "Fire Department advises: check your smoke alarms regularly.",
            "Traffic flow smooth as commuters enjoy newly paved avenues.",
            "Llama spotted crossing 4th Avenue, commuters amused.",
            "Industrial zone reports booming manufacturing outputs!",
            "Downtown high-rises sparkle under the sunset skyline."
        ];
        this.tickerIndex = 0;

        setInterval(() => {
            if (!this.tickerTextEl) return;
            const headlines = [...this.tickerHeadlines];
            const econ = this.game.economy;
            const serv = this.game.services;

            if (serv && serv.powerProd < serv.powerDemand) {
                headlines.push("⚡ BLACKOUT ALERT: Residents demand immediate power plant construction!");
            }
            if (serv && serv.waterProd < serv.waterDemand) {
                headlines.push("💧 WATER SHORTAGE: Low pressure reported across residential districts!");
            }
            if (serv && serv.fireScore < 50) {
                headlines.push("🔥 Citizens worried about fire hazards — Fire stations needed!");
            }
            if (econ && econ.happiness > 80) {
                headlines.push("🌟 City named top place to live in regional poll!");
            }

            this.tickerIndex = (this.tickerIndex + 1) % headlines.length;
            this.tickerTextEl.textContent = headlines[this.tickerIndex];
        }, 6500);
    }

    // --- Modals (Budget & Disasters) ---
    _setupModals() {
        const btnBudget = document.getElementById('btn-budget');
        const budgetModal = document.getElementById('budget-modal');
        const btnCloseBudget = document.getElementById('btn-close-budget');

        if (btnBudget && budgetModal) {
            btnBudget.addEventListener('click', () => {
                this.renderBudgetModal();
                budgetModal.classList.remove('hidden');
                if (this.game.audio) this.game.audio.playClick();
            });
        }
        if (btnCloseBudget && budgetModal) {
            btnCloseBudget.addEventListener('click', () => {
                budgetModal.classList.add('hidden');
                if (this.game.audio) this.game.audio.playClick();
            });
        }

        const btnDisasters = document.getElementById('btn-disasters');
        const disasterModal = document.getElementById('disaster-modal');
        const btnCloseDisaster = document.getElementById('btn-close-disaster');

        if (btnDisasters && disasterModal) {
            btnDisasters.addEventListener('click', () => {
                disasterModal.classList.remove('hidden');
                if (this.game.audio) this.game.audio.playClick();
            });
        }
        if (btnCloseDisaster && disasterModal) {
            btnCloseDisaster.addEventListener('click', () => {
                disasterModal.classList.add('hidden');
                if (this.game.audio) this.game.audio.playClick();
            });
        }

        // Disaster Action Triggers
        const btnMeteor = document.getElementById('disaster-meteor');
        const btnTornado = document.getElementById('disaster-tornado');
        const btnFire = document.getElementById('disaster-fire');

        if (btnMeteor) btnMeteor.addEventListener('click', () => { this.game.triggerDisaster('meteor'); disasterModal.classList.add('hidden'); });
        if (btnTornado) btnTornado.addEventListener('click', () => { this.game.triggerDisaster('tornado'); disasterModal.classList.add('hidden'); });
        if (btnFire) btnFire.addEventListener('click', () => { this.game.triggerDisaster('fire'); disasterModal.classList.add('hidden'); });

        // Day/Night & Mute Buttons
        const btnLighting = document.getElementById('btn-lighting');
        if (btnLighting) {
            btnLighting.addEventListener('click', () => {
                this.game.cycleTimeOfDay();
                btnLighting.textContent = this.game.renderer.timeOfDay === TIME_OF_DAY.DAY ? '☀️ Day' : (this.game.renderer.timeOfDay === TIME_OF_DAY.SUNSET ? '🌇 Sunset' : '🌙 Night');
            });
        }

        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
            btnAudio.addEventListener('click', () => {
                const isMuted = this.game.audio.toggleMute();
                btnAudio.textContent = isMuted ? '🔇 Muted' : '🔊 Audio';
                btnAudio.classList.toggle('active', !isMuted);
            });
        }
    }

    renderBudgetModal() {
        const econ = this.game.economy;
        const body = document.getElementById('budget-body');
        if (!body) return;

        body.innerHTML = `
            <div class="budget-section">
                <h3>📊 Tax Rates</h3>
                <div class="slider-row">
                    <label>🏡 Residential: <strong id="val-tax-res">${econ.taxRates.residential}%</strong></label>
                    <input type="range" min="0" max="20" value="${econ.taxRates.residential}" id="tax-res-slider">
                </div>
                <div class="slider-row">
                    <label>🏬 Commercial: <strong id="val-tax-com">${econ.taxRates.commercial}%</strong></label>
                    <input type="range" min="0" max="20" value="${econ.taxRates.commercial}" id="tax-com-slider">
                </div>
                <div class="slider-row">
                    <label>🏭 Industrial: <strong id="val-tax-ind">${econ.taxRates.industrial}%</strong></label>
                    <input type="range" min="0" max="20" value="${econ.taxRates.industrial}" id="tax-ind-slider">
                </div>
            </div>

            <div class="budget-section">
                <h3>📜 City Ordinances</h3>
                <div class="ordinance-list">
                    ${Object.values(CONFIG.ORDINANCES).map(ord => `
                        <label class="ord-item">
                            <input type="checkbox" data-ord="${ord.id}" ${econ.ordinances.has(ord.id) ? 'checked' : ''}>
                            <span><strong>${ord.name}</strong> ($${ord.costPerMonth}/mo)</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="budget-section">
                <h3>📋 Monthly Statement</h3>
                <table class="statement-table">
                    <tr><td>Tax Revenues (R/C/I)</td><td class="positive">+$${Math.round(econ.breakdown.totalIncome).toLocaleString()}/mo</td></tr>
                    <tr><td>Infrastructure Upkeep</td><td class="negative">-$${Math.round(econ.breakdown.totalExpenses - econ.breakdown.ordinancesCost).toLocaleString()}/mo</td></tr>
                    <tr><td>Ordinances Cost</td><td class="negative">-$${Math.round(econ.breakdown.ordinancesCost).toLocaleString()}/mo</td></tr>
                    <tr class="total-row"><td><strong>Net Monthly Balance</strong></td><td class="${econ.breakdown.net >= 0 ? 'positive' : 'negative'}"><strong>${econ.breakdown.net >= 0 ? '+' : ''}$${Math.round(econ.breakdown.net).toLocaleString()}/mo</strong></td></tr>
                </table>
            </div>
        `;

        const resSlider = document.getElementById('tax-res-slider');
        const comSlider = document.getElementById('tax-com-slider');
        const indSlider = document.getElementById('tax-ind-slider');

        if (resSlider) resSlider.addEventListener('input', (e) => {
            econ.taxRates.residential = parseInt(e.target.value, 10);
            document.getElementById('val-tax-res').textContent = `${econ.taxRates.residential}%`;
        });
        if (comSlider) comSlider.addEventListener('input', (e) => {
            econ.taxRates.commercial = parseInt(e.target.value, 10);
            document.getElementById('val-tax-com').textContent = `${econ.taxRates.commercial}%`;
        });
        if (indSlider) indSlider.addEventListener('input', (e) => {
            econ.taxRates.industrial = parseInt(e.target.value, 10);
            document.getElementById('val-tax-ind').textContent = `${econ.taxRates.industrial}%`;
        });

        for (const chk of body.querySelectorAll('input[data-ord]')) {
            chk.addEventListener('change', (e) => {
                econ.toggleOrdinance(e.target.dataset.ord);
                if (this.game.audio) this.game.audio.playClick();
            });
        }
    }

    // --- Minimap ---
    _setupMinimap() {
        if (!this.minimapCanvas) return;
        this.minimapCanvas.width = 128;
        this.minimapCanvas.height = 128;

        this.minimapCanvas.addEventListener('click', (e) => {
            const rect = this.minimapCanvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / rect.width;
            const my = (e.clientY - rect.top) / rect.height;
            const worldW = CONFIG.GRID_W * CONFIG.CELL;
            const worldH = CONFIG.GRID_H * CONFIG.CELL;

            this.game.renderer.camera.x = mx * worldW;
            this.game.renderer.camera.y = my * worldH;
            this.game.renderer.clampCamera();
            this.game.renderer.updateCamera();
        });
    }

    updateMinimap() {
        if (!this.minimapCanvas || !this.game.city) return;
        const ctx = this.minimapCanvas.getContext('2d');
        const city = this.game.city;
        const w = 128, h = 128;
        const scaleX = w / city.width;
        const scaleY = h / city.height;

        ctx.fillStyle = '#6ca34b';
        ctx.fillRect(0, 0, w, h);

        // Water
        ctx.fillStyle = '#3b82a6';
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                if (city.terrain[y * city.width + x] === TERRAIN.WATER) {
                    ctx.fillRect(x * scaleX, y * scaleY, scaleX, scaleY);
                }
            }
        }

        // Zones & Buildings
        for (const b of city.buildings.values()) {
            if (b.type === 'road' || b.type === 'bridge') ctx.fillStyle = '#cfd8dc';
            else if (b.type === 'residential') ctx.fillStyle = '#4caf50';
            else if (b.type === 'commercial') ctx.fillStyle = '#42a5f5';
            else if (b.type === 'industrial') ctx.fillStyle = '#ffb300';
            else if (b.type === 'park') ctx.fillStyle = '#81c784';
            else ctx.fillStyle = '#e91e63';

            const size = INFRASTRUCTURE[b.type] ? INFRASTRUCTURE[b.type].size : 1;
            ctx.fillRect(b.x * scaleX, b.y * scaleY, size * scaleX, size * scaleY);
        }

        // Camera viewport rectangle
        const rend = this.game.renderer;
        if (rend && rend.app) {
            const vx = (rend.camera.x / (city.width * CONFIG.CELL)) * w;
            const vy = (rend.camera.y / (city.height * CONFIG.CELL)) * h;
            const vw = (rend.app.renderer.width / (rend.camera.zoom * city.width * CONFIG.CELL)) * w;
            const vh = (rend.app.renderer.height / (rend.camera.zoom * city.height * CONFIG.CELL)) * h;

            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(vx - vw / 2, vy - vh / 2, vw, vh);
        }
    }

    // --- HUD Refresh ---
    updateHUD() {
        const game = this.game;
        const econ = game.economy;
        const serv = game.services;

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
        if (this.milestoneEl) this.milestoneEl.textContent = `🏛️ ${econ.milestone.title}`;

        if (this.jobsEl) {
            const workforceTarget = Math.floor(econ.housedPopulation * 0.62);
            this.jobsEl.textContent = `${Math.floor(econ.employed)} / ${workforceTarget}`;
        }
        if (this.happyEl) {
            this.happyEl.textContent = `${econ.happiness}%`;
            this.happyEl.className = econ.happiness >= 65 ? 'good' : (econ.happiness >= 40 ? 'mid' : 'bad');
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

        this.updateCityVitals();
        this.updateSelectionInfo();
        this.updateMinimap();
    }

    updateCityVitals() {
        if (!this.vitalsEl || !this.game.services) return;
        const s = this.game.services;
        this.vitalsEl.innerHTML = `
            <div class="vitals-grid">
                <div class="vital-item"><span class="lbl">⚡ Power</span><span class="val">${s.powerDemand} / ${s.powerProd} MW</span></div>
                <div class="vital-item"><span class="lbl">💧 Water</span><span class="val">${s.waterDemand} / ${s.waterProd} un</span></div>
                <div class="vital-item"><span class="lbl">🚒 Fire Cov</span><span class="val ${s.fireScore >= 70 ? 'ok' : 'warn'}">${s.fireScore}%</span></div>
                <div class="vital-item"><span class="lbl">👮 Police Cov</span><span class="val ${s.policeScore >= 70 ? 'ok' : 'warn'}">${s.policeScore}%</span></div>
                <div class="vital-item"><span class="lbl">🏥 Health</span><span class="val">${s.healthScore}%</span></div>
                <div class="vital-item"><span class="lbl">🎓 Education</span><span class="val">${s.educationScore}%</span></div>
            </div>
        `;
    }

    updateSelectionInfo() {
        if (!this.infoEl) return;
        const b = this.game.selected;
        if (!b) {
            this.infoEl.innerHTML = '<p class="hint">Click any building or road to inspect its status and civic coverage.</p>';
            return;
        }

        const def = INFRASTRUCTURE[b.type];
        if (def) {
            this.infoEl.innerHTML = `
                <h3>${def.name}</h3>
                <p><span class="tag" style="background:#b0bec5">${def.category.toUpperCase()}</span></p>
                ${b.type === 'road' || b.type === 'bridge' ? '<p>Carries vehicles, power cables, and water pipes.</p>' : ''}
                ${def.powerProduction ? `<p><strong>Output:</strong> ${def.powerProduction} MW</p>` : ''}
                ${def.waterProduction ? `<p><strong>Output:</strong> ${def.waterProduction} units</p>` : ''}
                ${def.powerConsumption ? `<p><strong>Uses:</strong> ${def.powerConsumption} MW</p>` : ''}
                ${def.waterConsumption ? `<p><strong>Uses:</strong> ${def.waterConsumption} water</p>` : ''}
                ${def.coverageRadius ? `<p><strong>Coverage Radius:</strong> ${def.coverageRadius} tiles</p>` : ''}
            `;
            return;
        }

        const zone = ZONES[b.type];
        const lvl = levelDef(b.type, b.level);
        const cap = lvl.capacity > 0 ? lvl.capacity : lvl.jobCapacity;
        const used = lvl.capacity > 0 ? b.pop : b.jobs;
        const lv = this.game.economy.landValue(b.x, b.y);

        let status;
        if (b.onFire) status = '<p class="warn">🔥 ON FIRE! Dispatching fire brigade…</p>';
        else if (b.state === 'rubble') status = '<p class="warn">🏚️ Burnt Rubble — clear with Bulldozer</p>';
        else if (b.state === 'construction') status = '<p class="pending">🏗️ Under Construction / Upgrading…</p>';
        else if (b.state === 'abandoned') status = '<p class="warn">⚠️ Abandoned — restore utilities to re-inhabit</p>';
        else if (!b.connected) status = '<p class="warn">No road connection!</p>';
        else if (!b.powered) status = '<p class="warn">⚡ No power!</p>';
        else if (!b.watered) status = '<p class="warn">💧 No water!</p>';
        else status = '<p class="ok">✅ Operating Normally</p>';

        this.infoEl.innerHTML = `
            <h3>${lvl.name}</h3>
            <p><span class="tag" style="background:${zone.color}">${zone.name}</span> Density Tier ${b.level}/4</p>
            ${status}
            ${cap > 0 ? `<p><strong>${lvl.capacity > 0 ? 'Residents' : 'Jobs'}:</strong> ${used} / ${cap}</p>` : ''}
            <p><strong>Land Value:</strong> ${lv} / 100</p>
            <p><strong>Civic Coverage:</strong> ${b.fireCoverage ? '🚒' : '❌'} ${b.policeCoverage ? '👮' : '❌'} ${b.healthCoverage ? '🏥' : '❌'} ${b.educationCoverage ? '🎓' : '❌'}</p>
        `;
    }

    notify(message, type = 'info') {
        if (!this.notificationsEl) return;
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.textContent = message;
        this.notificationsEl.prepend(el);

        while (this.notificationsEl.children.length > 10) {
            this.notificationsEl.removeChild(this.notificationsEl.lastChild);
        }
        setTimeout(() => el.remove(), 7000);
    }
}

window.UIManager = UIManager;
window.TOOL_GROUPS = TOOL_GROUPS;
