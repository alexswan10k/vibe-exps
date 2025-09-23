function ShoppingList({ shoppingList, selectedShoppingItems, toggleSelectShoppingItem, transferSelectedToInventory, updateShoppingItemCost }) {
    const handleRowClick = (item, e) => {
        // Prevent toggling if clicking directly on the checkbox or cost input
        if (e.target.type !== 'checkbox' && e.target.type !== 'number') {
            toggleSelectShoppingItem(item);
        }
    };

    const handleCostChange = (item, cost) => {
        updateShoppingItemCost(item, parseFloat(cost) || 0);
    };

    const calculateTotalCost = () => {
        return Object.entries(shoppingList).reduce((total, [item, data]) => {
            return total + (data.quantity * (data.unitCost || 0));
        }, 0);
    };

    return React.createElement('div', { className: 'shopping-list' },
        React.createElement('h2', null, 'Shopping List'),
        React.createElement('div', { className: 'shopping-list-header' },
            React.createElement('span', null, `Total Cost: $${calculateTotalCost().toFixed(2)}`)
        ),
        React.createElement('ul', null,
            Object.entries(shoppingList).map(([item, data]) =>
                React.createElement('li', {
                    key: item,
                    className: 'shopping-item',
                    onClick: (e) => handleRowClick(item, e)
                },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: selectedShoppingItems.includes(item),
                        onChange: () => toggleSelectShoppingItem(item),
                        className: 'shopping-checkbox'
                    }),
                    React.createElement('div', { className: 'shopping-item-content' },
                        React.createElement('span', { className: 'item-name' }, `${item}: ${data.quantity}`),
                        React.createElement('div', { className: 'cost-input' },
                            React.createElement('label', null, '$'),
                            React.createElement('input', {
                                type: 'number',
                                min: '0',
                                step: '0.01',
                                value: data.unitCost || '',
                                onChange: (e) => handleCostChange(item, e.target.value),
                                placeholder: '0.00'
                            }),
                            React.createElement('span', { className: 'cost-total' }, `= $${(data.quantity * (data.unitCost || 0)).toFixed(2)}`)
                        )
                    )
                )
            )
        ),
        Object.keys(shoppingList).length === 0 && React.createElement('p', null, 'No items needed. Your shopping list updates automatically based on your meal plan and inventory.'),
        selectedShoppingItems.length > 0 && React.createElement('button', {
            onClick: transferSelectedToInventory,
            style: { marginTop: '20px' }
        }, 'Transfer Selected to Inventory')
    );
}
