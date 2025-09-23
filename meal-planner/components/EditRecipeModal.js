function EditRecipeModal({
    show,
    recipe,
    inventory,
    recipes,
    onSave,
    onCancel
}) {
    if (!show || !recipe) return null;

    return React.createElement('div', { className: 'modal-overlay' },
        React.createElement('div', { className: 'modal edit-modal' },
            React.createElement('h2', null, 'Edit Recipe'),
            React.createElement(EditRecipeForm, {
                recipe: recipe,
                inventory,
                recipes,
                onSave: onSave,
                onCancel: onCancel
            })
        )
    );
}
