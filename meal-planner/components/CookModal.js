function CookModal({
    show,
    recipe,
    inventory,
    onConfirm,
    onCancel
}) {
    if (!show || !recipe) return null;

    return React.createElement('div', {
        className: 'modal-overlay',
        onClick: onCancel
    },
        React.createElement('div', {
            className: 'modal cook-modal',
            onClick: (e) => e.stopPropagation()
        },
            React.createElement('h2', null, 'Cook Recipe'),
            React.createElement('p', null, `Cook ${recipe.name}?`),
            React.createElement('div', { className: 'ingredients-list' },
                React.createElement('h3', null, 'Ingredients needed:'),
                React.createElement('ul', null,
                    recipe.ingredients.map((ing, index) => {
                        const available = inventory[ing.name] || 0;
                        const sufficient = available >= ing.quantity;
                        return React.createElement('li', {
                            key: index,
                            className: sufficient ? 'sufficient' : 'insufficient'
                        },
                            `${ing.quantity} ${ing.unit} ${ing.name} (You have: ${available})`
                        );
                    })
                )
            ),
            React.createElement('div', { className: 'modal-buttons' },
                React.createElement('button', { onClick: onConfirm }, 'Cook'),
                React.createElement('button', { onClick: onCancel }, 'Cancel')
            )
        )
    );
}
