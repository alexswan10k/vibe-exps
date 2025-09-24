// Shared Event Log Component
// Displays event log entries with proper formatting

const EventLogEntry = ({ entry }) => {
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const formatEventDetails = (entry) => {
        switch (entry.action) {
            case 'cook':
                return React.createElement('div', null,
                    React.createElement('strong', null, `Cooked: ${entry.details.recipeName}`),
                    React.createElement('ul', null,
                        entry.details.ingredientsConsumed.map((ing, idx) =>
                            React.createElement('li', { key: idx },
                                `${ing.name}: ${ing.quantity} ${ing.unit}`
                            )
                        )
                    )
                );
            case 'buy':
                return React.createElement('div', null,
                    React.createElement('strong', null, `Purchased items (Total: $${entry.details.totalCost.toFixed(2)})`),
                    React.createElement('ul', null,
                        entry.details.items.map((item, idx) =>
                            React.createElement('li', { key: idx },
                                `${item.name}: ${item.quantity} units @ $${item.unitCost.toFixed(2)} each`
                            )
                        )
                    )
                );
            case 'inventory_change':
                const change = entry.details.changeType === 'add' ? '+' : '-';
                return React.createElement('div', null,
                    React.createElement('strong', null,
                        `${entry.details.changeType === 'add' ? 'Added to' : 'Removed from'} inventory: ${entry.details.item}`
                    ),
                    React.createElement('p', null,
                        `Quantity: ${entry.details.oldQuantity} → ${entry.details.newQuantity} (${change}${Math.abs(entry.details.newQuantity - entry.details.oldQuantity)})`
                    )
                );
            default:
                return React.createElement('div', null, JSON.stringify(entry.details, null, 2));
        }
    };

    return React.createElement('div', { className: 'log-entry' },
        React.createElement('div', { className: 'log-entry-header' },
            React.createElement('span', { className: `log-entry-type ${entry.action}` }, entry.action.replace('_', ' ')),
            React.createElement('span', { className: 'log-entry-time' }, formatTimestamp(entry.timestamp))
        ),
        React.createElement('div', { className: 'log-entry-details' },
            formatEventDetails(entry)
        )
    );
};

const EventLog = ({ logEntries }) => {
    return React.createElement('div', { className: 'log-entries' },
        React.createElement('h3', null, `Log Entries (${logEntries.length})`),
        logEntries.length === 0
            ? React.createElement('div', { className: 'no-entries' }, 'No events logged yet. Start cooking, shopping, or managing inventory to see activity here.')
            : logEntries.map((entry, index) =>
                React.createElement(EventLogEntry, { key: index, entry })
            )
    );
};

window.EventLogComponents = { EventLog, EventLogEntry };
