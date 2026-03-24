function RecipeSelectModal({
    show,
    selectingDay,
    recipes,
    onSelectRecipe,
    onClearSelection,
    onClose
}) {
    if (!show) return null;

    return React.createElement('div', {
        className: 'modal-overlay',
        onClick: onClose
    },
        React.createElement('div', {
            className: 'modal recipe-select-modal',
            onClick: (e) => e.stopPropagation()
        },
            React.createElement('h2', null, `Select Recipe for ${selectingDay}`),
            React.createElement('div', { className: 'recipe-options' },
                React.createElement('button', {
                    className: 'recipe-option clear-option',
                    onClick: onClearSelection
                }, 'Clear Selection'),
                recipes.map(recipe =>
                    React.createElement('button', {
                        key: recipe.id,
                        className: 'recipe-option',
                        onClick: () => onSelectRecipe(recipe.id)
                    }, recipe.name)
                )
            ),
            React.createElement('div', { className: 'modal-buttons' },
                React.createElement('button', { onClick: onClose }, 'Close')
            )
        )
    );
}
