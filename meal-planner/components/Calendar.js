function Calendar({ calendar, handleDrop, handleDragOver, getRecipeById, handleCook, onSelectRecipe, inventory, onGenerateRandom, onGenerateAI }) {
    const days = Object.keys(calendar);

    return React.createElement('div', { className: 'calendar' },
        React.createElement('h2', null, 'Weekly Calendar'),
        React.createElement('div', { className: 'calendar-controls' },
            React.createElement('button', {
                className: 'generate-btn',
                onClick: onGenerateRandom
            }, 'Generate Random Plan'),
            React.createElement('button', {
                className: 'generate-btn ai-btn',
                onClick: onGenerateAI
            }, 'Generate AI Plan')
        ),
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
