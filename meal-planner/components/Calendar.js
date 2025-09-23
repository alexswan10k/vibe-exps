function Calendar({ calendar, handleDrop, handleDragOver, getRecipeById, handleCook, onSelectRecipe, inventory }) {
    const days = Object.keys(calendar);

    return React.createElement('div', { className: 'calendar' },
        React.createElement('h2', null, 'Weekly Calendar'),
        React.createElement('div', { className: 'calendar-grid' },
            days.map(day =>
                React.createElement(DaySlot, {
                    key: day,
                    day,
                    recipeId: calendar[day],
                    getRecipeById,
                    handleDrop,
                    handleDragOver,
                    handleCook,
                    onSelectRecipe,
                    inventory
                })
            )
        )
    );
}
