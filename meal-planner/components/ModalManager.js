function ModalManager({
    showCookModal,
    cookingRecipe,
    showEditModal,
    editingRecipe,
    showPasteModal,
    pastedResult,
    showRecipeSelectModal,
    selectingDay,
    showDataModal,
    inventory,
    recipes,
    ingredientsData,
    calendar,
    shoppingList,
    confirmCook,
    cancelCook,
    updateRecipe,
    addRecipe,
    selectRecipeForDay,
    clearRecipeForDay,
    loadSampleData,
    resetToSampleData,
    setShowCookModal,
    setShowEditModal,
    setShowPasteModal,
    setPastedResult,
    setShowRecipeSelectModal,
    setShowDataModal,
    setRecipes,
    setInventory,
    setIngredientsData,
    setCalendar,
    setShoppingList
}) {
    return React.createElement(React.Fragment, null,
        // Cook Modal
        showCookModal && cookingRecipe && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal cook-modal' },
                React.createElement('h2', null, 'Cook Recipe'),
                React.createElement('p', null, `Cook ${cookingRecipe.name}?`),
                React.createElement('div', { className: 'ingredients-list' },
                    React.createElement('h3', null, 'Ingredients needed:'),
                    React.createElement('ul', null,
                        cookingRecipe.ingredients.map((ing, index) => {
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
                    React.createElement('button', { onClick: confirmCook }, 'Cook'),
                    React.createElement('button', { onClick: cancelCook }, 'Cancel')
                )
            )
        ),

        // Edit Recipe Modal
        showEditModal && editingRecipe && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal edit-modal' },
                React.createElement('h2', null, 'Edit Recipe'),
                React.createElement(EditRecipeForm, {
                    recipe: editingRecipe,
                    inventory,
                    recipes,
                    onSave: (recipeData) => {
                        updateRecipe(editingRecipe.id, recipeData);
                        setShowEditModal(false);
                    },
                    onCancel: () => setShowEditModal(false)
                })
            )
        ),

        // Paste Result Modal
        showPasteModal && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal paste-modal' },
                React.createElement('h2', null, 'Paste LLM Result'),
                React.createElement('p', null, 'Paste the JSON response from your preferred LLM (ChatGPT, Claude, etc.)'),
                React.createElement('textarea', {
                    value: pastedResult,
                    onChange: (e) => setPastedResult(e.target.value),
                    placeholder: 'Paste the JSON response here...',
                    rows: 15,
                    className: 'paste-textarea'
                }),
                React.createElement('div', { className: 'modal-buttons' },
                    React.createElement('button', {
                        onClick: () => {
                            if (pastedResult.trim()) {
                                try {
                                    const recipeData = JSON.parse(pastedResult.trim());
                                    if (!recipeData.name || !Array.isArray(recipeData.ingredients)) {
                                        throw new Error('Invalid recipe format. Please ensure the JSON has name and ingredients array.');
                                    }
                                    if (recipeData.method && !Array.isArray(recipeData.method)) {
                                        recipeData.method = [];
                                    }
                                    addRecipe(recipeData);
                                    setPastedResult('');
                                    setShowPasteModal(false);
                                    alert('Recipe imported successfully!');
                                } catch (error) {
                                    alert(`Failed to parse recipe: ${error.message}`);
                                }
                            }
                        }
                    }, 'Import Recipe'),
                    React.createElement('button', {
                        onClick: () => {
                            setShowPasteModal(false);
                            setPastedResult('');
                        }
                    }, 'Cancel')
                )
            )
        ),

        // Recipe Select Modal
        showRecipeSelectModal && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal recipe-select-modal' },
                React.createElement('h2', null, `Select Recipe for ${selectingDay}`),
                React.createElement('div', { className: 'recipe-options' },
                    React.createElement('button', {
                        className: 'recipe-option clear-option',
                        onClick: clearRecipeForDay
                    }, 'Clear Selection'),
                    recipes.map(recipe =>
                        React.createElement('button', {
                            key: recipe.id,
                            className: 'recipe-option',
                            onClick: () => selectRecipeForDay(recipe.id)
                        }, recipe.name)
                    )
                ),
                React.createElement('div', { className: 'modal-buttons' },
                    React.createElement('button', {
                        onClick: () => setShowRecipeSelectModal(false)
                    }, 'Close')
                )
            )
        ),

        // Data Management Modal
        showDataModal && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal data-modal' },
                React.createElement('h2', null, 'Data Management'),
                React.createElement('div', { className: 'data-status' },
                    React.createElement('h3', null, 'Current Data Status'),
                    React.createElement('p', null, `Recipes: ${recipes.length}`),
                    React.createElement('p', null, `Inventory items: ${Object.keys(inventory).length}`),
                    React.createElement('p', null, `Calendar entries: ${Object.values(calendar).filter(v => v).length}`)
                ),
                React.createElement('div', { className: 'data-actions' },
                    React.createElement('div', { className: 'data-section' },
                        React.createElement('h3', null, 'Get Started'),
                        React.createElement('div', { className: 'action-buttons' },
                            React.createElement('button', {
                                className: 'data-btn load-common',
                                onClick: () => {
                                    loadSampleData();
                                    alert('Sample data loaded! The new recipes and ingredients are now available.');
                                    setShowDataModal(false);
                                }
                            },
                                React.createElement('div', null,
                                    React.createElement('strong', null, 'Add Sample Data'),
                                    React.createElement('div', { className: 'btn-description' }, 'Add built-in recipes and ingredients to your existing data')
                                )
                            ),
                            React.createElement('button', {
                                className: 'data-btn reset-sample',
                                onClick: () => {
                                    if (confirm('This will clear all your current data and load only sample data. Continue?')) {
                                        resetToSampleData();
                                        alert('Reset to sample data complete! The app has been reset with fresh sample data.');
                                        setShowDataModal(false);
                                    }
                                }
                            },
                                React.createElement('div', null,
                                    React.createElement('strong', null, 'Reset to Sample Data'),
                                    React.createElement('div', { className: 'btn-description' }, 'Clear everything and start fresh with sample data')
                                )
                            )
                        )
                    ),
                    React.createElement('div', { className: 'data-section' },
                        React.createElement('h3', null, 'Backup & Restore'),
                        React.createElement('div', { className: 'action-buttons' },
                            React.createElement('button', {
                                className: 'data-btn export',
                                onClick: () => {
                                    const data = {
                                        recipes,
                                        inventory,
                                        ingredientsData,
                                        calendar,
                                        shoppingList,
                                        exportDate: new Date().toISOString()
                                    };
                                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'meal-planner-data.json';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }
                            },
                                React.createElement('div', null,
                                    React.createElement('strong', null, 'Export Data'),
                                    React.createElement('div', { className: 'btn-description' }, 'Download all your data as a backup file')
                                )
                            ),
                            React.createElement('label', { className: 'data-btn import' },
                                React.createElement('div', null,
                                    React.createElement('strong', null, 'Import Data'),
                                    React.createElement('div', { className: 'btn-description' }, 'Restore from a previously exported backup')
                                ),
                                React.createElement('input', {
                                    type: 'file',
                                    accept: '.json',
                                    style: { display: 'none' },
                                    onChange: (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                try {
                                                    const data = JSON.parse(event.target.result);
                                                    if (data.recipes) setRecipes(data.recipes);
                                                    if (data.inventory) setInventory(data.inventory);
                                                    if (data.ingredientsData) setIngredientsData(data.ingredientsData);
                                                    if (data.calendar) setCalendar(data.calendar);
                                                    if (data.shoppingList) setShoppingList(data.shoppingList);
                                                    alert('Data imported successfully!');
                                                    setShowDataModal(false);
                                                } catch (error) {
                                                    alert(`Failed to import data: ${error.message}`);
                                                }
                                            };
                                            reader.readAsText(file);
                                        }
                                    }
                                })
                            )
                        )
                    ),
                    React.createElement('div', { className: 'data-section' },
                        React.createElement('h3', null, 'Danger Zone'),
                        React.createElement('button', {
                            className: 'data-btn cleanup',
                            onClick: () => {
                                if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                                    setRecipes([]);
                                    setInventory({});
                                    setIngredientsData({});
                                    setCalendar({
                                        Monday: null, Tuesday: null, Wednesday: null, Thursday: null,
                                        Friday: null, Saturday: null, Sunday: null
                                    });
                                    setShoppingList({});
                                    alert('All data cleared!');
                                    setShowDataModal(false);
                                }
                            }
                        },
                            React.createElement('div', null,
                                React.createElement('strong', null, 'Clear All Data'),
                                React.createElement('div', { className: 'btn-description' }, 'Permanently delete everything - use with caution!')
                            )
                        )
                    )
                ),
                React.createElement('div', { className: 'modal-buttons' },
                    React.createElement('button', {
                        onClick: () => setShowDataModal(false)
                    }, 'Close')
                )
            )
        )
    );
}
