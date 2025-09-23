function ShoppingList({ shoppingList, selectedShoppingItems, toggleSelectShoppingItem, transferSelectedToInventory }) {
    const handleRowClick = (item, e) => {
        // Prevent toggling if clicking directly on the checkbox
        if (e.target.type !== 'checkbox') {
            toggleSelectShoppingItem(item);
        }
    };

    return React.createElement('div', { className: 'shopping-list' },
        React.createElement('h2', null, 'Shopping List'),
        React.createElement('ul', null,
            Object.entries(shoppingList).map(([item, quantity]) =>
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
                    React.createElement('span', null, `${item}: ${quantity}`)
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
