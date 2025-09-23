function RecipeSelectModal({ showRecipeSelectModal, selectingDay, recipes, onSelectRecipe, onClearRecipe, onClose }) {
    if (!showRecipeSelectModal || !selectingDay) return null;

    return React.createElement('div', { className: 'modal-overlay' },
        React.createElement('div', { className: 'modal recipe-select-modal' },
            React.createElement('h2', null, `Select Recipe for ${selectingDay}`),
            React.createElement('div', { className: 'recipe-select-list' },
                recipes.map(recipe =>
                    React.createElement('button', {
                        key: recipe.id,
                        onClick: () => onSelectRecipe(recipe.id),
                        className: 'recipe-select-item'
                    }, recipe.name)
                ),
                recipes.length === 0 && React.createElement('p', null, 'No recipes available. Add some recipes first.')
            ),
            React.createElement('div', { className: 'modal-buttons' },
                React.createElement('button', { onClick: onClearRecipe }, 'Clear Recipe'),
                React.createElement('button', { onClick: onClose }, 'Cancel')
            )
        )
    );
}
