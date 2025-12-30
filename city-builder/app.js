// React UI Overlay for City Builder Game
const { useState, useEffect } = React;
const { createRoot } = ReactDOM;

// Building Selection Component
function BuildingSelection({ game }) {
    const handleBuildingSelect = (buildingType) => {
        if (game.inputManager) {
            game.inputManager.selectBuildingType(buildingType);
        }
    };

    return React.createElement('div', { id: 'building-selection' },
        React.createElement('h3', null, 'Buildings'),
        React.createElement('div', { className: 'building-buttons' },
            React.createElement('button', {
                className: 'building-btn',
                'data-building': 'residential',
                onClick: () => handleBuildingSelect('residential')
            }, 'Residential'),
            React.createElement('button', {
                className: 'building-btn',
                'data-building': 'commercial',
                onClick: () => handleBuildingSelect('commercial')
            }, 'Commercial'),
            React.createElement('button', {
                className: 'building-btn',
                'data-building': 'industrial',
                onClick: () => handleBuildingSelect('industrial')
            }, 'Industrial'),
            React.createElement('button', {
                className: 'building-btn',
                'data-building': 'power',
                onClick: () => handleBuildingSelect('power')
            }, 'Power Plant'),
            React.createElement('button', {
                className: 'building-btn',
                'data-building': 'water',
                onClick: () => handleBuildingSelect('water')
            }, 'Water Plant')
        )
    );
}

// Game Controls Component
function GameControls({ game }) {
    const [isPaused, setIsPaused] = useState(false);
    const [gameSpeed, setGameSpeed] = useState(1);

    useEffect(() => {
        const updateControls = () => {
            if (game.state) {
                setIsPaused(game.state.isPaused);
                setGameSpeed(game.state.gameSpeed);
            }
        };

        const interval = setInterval(updateControls, 100);
        return () => clearInterval(interval);
    }, [game]);

    const handlePause = () => {
        game.togglePause();
    };

    const handleSpeedChange = () => {
        game.changeGameSpeed(1);
    };

    const handleSave = () => {
        game.saveGame();
    };

    const handleLoad = () => {
        game.loadGame();
    };

    return React.createElement('div', { id: 'game-controls' },
        React.createElement('h3', null, 'Game Controls'),
        React.createElement('button', { id: 'pause-btn', onClick: handlePause },
            isPaused ? 'Resume' : 'Pause'
        ),
        React.createElement('button', { id: 'speed-btn', onClick: handleSpeedChange },
            `Speed: ${gameSpeed}x`
        ),
        React.createElement('button', { id: 'save-btn', onClick: handleSave },
            'Save'
        ),
        React.createElement('button', { id: 'load-btn', onClick: handleLoad },
            'Load'
        )
    );
}

// Resource Display Component
function ResourceDisplay({ game }) {
    const [resources, setResources] = useState({
        money: 10000,
        population: 0,
        power: { available: 0, capacity: 0 },
        water: { available: 0, capacity: 0 },
        happiness: 50
    });

    useEffect(() => {
        const updateResources = () => {
            if (game.resourceManager) {
                const res = game.resourceManager.resources;
                setResources({
                    money: res.money,
                    population: res.population,
                    power: res.power,
                    water: res.water,
                    happiness: res.happiness
                });
            }
        };

        const interval = setInterval(updateResources, 200);
        return () => clearInterval(interval);
    }, [game]);

    return React.createElement('div', { id: 'resource-display' },
        React.createElement('div', { className: 'resource-item' },
            React.createElement('span', { className: 'resource-label' }, 'Money:'),
            React.createElement('span', { id: 'money-value', className: 'resource-value' },
                `$${resources.money.toLocaleString()}`
            )
        ),
        React.createElement('div', { className: 'resource-item' },
            React.createElement('span', { className: 'resource-label' }, 'Population:'),
            React.createElement('span', { id: 'population-value', className: 'resource-value' },
                resources.population
            )
        ),
        React.createElement('div', { className: 'resource-item' },
            React.createElement('span', { className: 'resource-label' }, 'Power:'),
            React.createElement('span', { id: 'power-value', className: 'resource-value' },
                `${resources.power.available} / ${resources.power.capacity}`
            )
        ),
        React.createElement('div', { className: 'resource-item' },
            React.createElement('span', { className: 'resource-label' }, 'Water:'),
            React.createElement('span', { id: 'water-value', className: 'resource-value' },
                `${resources.water.available} / ${resources.water.capacity}`
            )
        ),
        React.createElement('div', { className: 'resource-item' },
            React.createElement('span', { className: 'resource-label' }, 'Happiness:'),
            React.createElement('span', { id: 'happiness-value', className: 'resource-value' },
                `${resources.happiness}%`
            )
        )
    );
}

// Selected Building Info Component
function SelectedBuildingInfo({ game }) {
    const [selectedBuilding, setSelectedBuilding] = useState(null);

    useEffect(() => {
        const updateSelectedBuilding = () => {
            if (game.state) {
                setSelectedBuilding(game.state.selectedBuilding);
            }
        };

        const interval = setInterval(updateSelectedBuilding, 100);
        return () => clearInterval(interval);
    }, [game]);

    if (!selectedBuilding) {
        return React.createElement('div', { id: 'selected-building-info' },
            React.createElement('h3', null, 'Selected Building'),
            React.createElement('div', { id: 'building-details' },
                React.createElement('p', null, 'No building selected')
            )
        );
    }

    return React.createElement('div', { id: 'selected-building-info' },
        React.createElement('h3', null, 'Selected Building'),
        React.createElement('div', { id: 'building-details' },
            React.createElement('p', null, React.createElement('strong', null, 'Type:'), ` ${selectedBuilding.type.name}`),
            React.createElement('p', null, React.createElement('strong', null, 'Position:'), ` (${selectedBuilding.x}, ${selectedBuilding.y})`),
            selectedBuilding.type.populationCapacity > 0 && React.createElement('p', null,
                React.createElement('strong', null, 'Population:'), ` ${selectedBuilding.population} / ${selectedBuilding.type.populationCapacity}`
            ),
            selectedBuilding.type.jobCapacity > 0 && React.createElement('p', null,
                React.createElement('strong', null, 'Jobs:'), ` ${selectedBuilding.jobs} / ${selectedBuilding.type.jobCapacity}`
            ),
            React.createElement('p', null, React.createElement('strong', null, 'Cost:'), ` $${selectedBuilding.type.cost.toLocaleString()}`)
        )
    );
}

// Notifications Component
function Notifications({ game }) {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const updateNotifications = () => {
            if (game.state) {
                setNotifications([...game.state.notifications]);
            }
        };

        const interval = setInterval(updateNotifications, 500);
        return () => clearInterval(interval);
    }, [game]);

    return React.createElement('div', { id: 'notifications' },
        React.createElement('h3', null, 'Notifications'),
        React.createElement('div', { id: 'notification-list' },
            notifications.map((notification, index) =>
                React.createElement('div', {
                    key: index,
                    className: `notification ${notification.type}`
                }, notification.message)
            )
        )
    );
}

// Main Game UI Component
function GameUI({ game }) {
    return React.createElement('div', { id: 'game-ui' },
        React.createElement('div', { id: 'control-panel' },
            React.createElement('h2', null, 'Controls'),
            React.createElement(BuildingSelection, { game }),
            React.createElement(GameControls, { game })
        ),
        React.createElement('div', { id: 'info-panel' },
            React.createElement('h2', null, 'City Information'),
            React.createElement(ResourceDisplay, { game }),
            React.createElement(SelectedBuildingInfo, { game }),
            React.createElement(Notifications, { game })
        )
    );
}

// Note: React UI is no longer used - simplified UIManager handles all UI updates
// This file is kept for compatibility but doesn't initialize React UI

// Make it globally available (empty function for compatibility)
window.initReactUI = function(game) {
    console.log('React UI initialization skipped - using simplified UIManager');
};
