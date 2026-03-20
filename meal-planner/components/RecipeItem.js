function RecipeItem({ recipe, onEdit, onDelete }) {
    const handleDragStart = (e) => {
        e.dataTransfer.setData('text/plain', recipe.id);
    };

    const handleClick = (e) => {
        // Prevent drag when clicking buttons
        if (e.target.tagName === 'BUTTON') {
            e.stopPropagation();
        }
    };

    return React.createElement('li', {
        draggable: true,
        onDragStart: handleDragStart,
        onClick: handleClick,
        className: 'recipe-item'
    },
        React.createElement('span', { className: 'recipe-name' }, recipe.name),
        React.createElement('div', { className: 'recipe-actions' },
            React.createElement('button', {
                onClick: (e) => {
                    e.stopPropagation();
                    onEdit(recipe);
                },
                className: 'edit-btn'
            }, 'Edit'),
            React.createElement('button', {
                onClick: (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Are you sure you want to delete "${recipe.name}"?`)) {
                        onDelete(recipe.id);
                    }
                },
                className: 'delete-btn'
            }, 'Delete')
        )
    );
}
