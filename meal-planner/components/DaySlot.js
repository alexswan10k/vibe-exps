function DaySlot({ day, recipeId, getRecipeById, handleDrop, handleDragOver, handleCook, onSelectRecipe, inventory }) {
    const recipe = recipeId ? getRecipeById(recipeId) : null;
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isCurrentDay = day === currentDay;

    // Check if recipe can be cooked (all ingredients available)
    const canCook = recipe && recipe.ingredients.every(ing => {
        const available = inventory[ing.name] || 0;
        return available >= ing.quantity;
    });

    return React.createElement('div', {
        className: `day-slot ${isCurrentDay ? 'current-day' : ''}`,
        onDrop: (e) => handleDrop(e, day),
        onDragOver: handleDragOver
    },
        React.createElement('h3', null, day),
        recipe ? React.createElement('p', { className: canCook ? '' : 'insufficient-recipe' }, recipe.name) : React.createElement('p', null, 'Drop recipe here'),
        React.createElement('button', {
            onClick: () => onSelectRecipe(day),
            className: 'select-recipe-btn',
            style: { marginTop: '10px', width: '100%', marginBottom: '5px' }
        }, recipe ? 'Change Recipe' : 'Select Recipe'),
        recipe && React.createElement('button', {
            onClick: () => handleCook(recipe),
            className: canCook ? 'cook-btn' : 'cook-btn insufficient',
            style: { marginTop: '5px', width: '100%' }
        }, 'Cook')
    );
}
