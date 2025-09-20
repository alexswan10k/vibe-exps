const { useState, useEffect } = React;

function App() {
    const [recipes, setRecipes] = useState([]);
    const [inventory, setInventory] = useState({});
    const [shoppingList, setShoppingList] = useState({});
    const [selectedShoppingItems, setSelectedShoppingItems] = useState([]);
    const [showCookModal, setShowCookModal] = useState(false);
    const [cookingRecipe, setCookingRecipe] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [activeTab, setActiveTab] = useState('calendar');
    const [calendar, setCalendar] = useState({
        Monday: null,
        Tuesday: null,
        Wednesday: null,
        Thursday: null,
        Friday: null,
        Saturday: null,
        Sunday: null
    });

    // Helper function to get current recipe by ID
    const getRecipeById = (id) => {
        return recipes.find(recipe => recipe.id == id);
    };

    useEffect(() => {
        const storedRecipes = localStorage.getItem('recipes');
        if (storedRecipes) {
            setRecipes(JSON.parse(storedRecipes));
        }
        const storedCalendar = localStorage.getItem('calendar');
        if (storedCalendar) {
            setCalendar(JSON.parse(storedCalendar));
        }
        const storedInventory = localStorage.getItem('inventory');
        if (storedInventory) {
            setInventory(JSON.parse(storedInventory));
        }
        const storedShoppingList = localStorage.getItem('shoppingList');
        if (storedShoppingList) {
            setShoppingList(JSON.parse(storedShoppingList));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('recipes', JSON.stringify(recipes));
    }, [recipes]);

    useEffect(() => {
        localStorage.setItem('calendar', JSON.stringify(calendar));
    }, [calendar]);

    useEffect(() => {
        localStorage.setItem('inventory', JSON.stringify(inventory));
    }, [inventory]);

    useEffect(() => {
        localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
    }, [shoppingList]);

    // Auto-generate shopping list when inventory or calendar changes
    useEffect(() => {
        const needed = {};
        Object.values(calendar).forEach(recipeId => {
            if (recipeId) {
                const recipe = getRecipeById(recipeId);
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        const current = inventory[ing.name] || 0;
                        const required = needed[ing.name] || 0;
                        needed[ing.name] = required + ing.quantity;
                    });
                }
            }
        });

        const shopping = {};
        Object.entries(needed).forEach(([item, neededQty]) => {
            const available = inventory[item] || 0;
            if (neededQty > available) {
                shopping[item] = neededQty - available;
            }
        });
        setShoppingList(shopping);
    }, [inventory, calendar, recipes]);

    const addRecipe = (recipeData) => {
        const newRecipe = {
            id: Date.now(),
            name: recipeData.name,
            ingredients: recipeData.ingredients || []
        };
        setRecipes([...recipes, newRecipe]);
    };

    const updateRecipe = (id, recipeData) => {
        setRecipes(recipes.map(recipe =>
            recipe.id === id ? { ...recipe, ...recipeData } : recipe
        ));
    };

    const deleteRecipe = (id) => {
        setRecipes(recipes.filter(recipe => recipe.id !== id));
    };

    const updateInventory = (item, quantity) => {
        setInventory({ ...inventory, [item]: quantity });
    };

    const toggleSelectShoppingItem = (item) => {
        setSelectedShoppingItems(prev =>
            prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
        );
    };



    const transferSelectedToInventory = () => {
        const newInventory = { ...inventory };
        selectedShoppingItems.forEach(item => {
            newInventory[item] = (newInventory[item] || 0) + shoppingList[item];
        });
        setInventory(newInventory);
        const newList = { ...shoppingList };
        selectedShoppingItems.forEach(item => delete newList[item]);
        setShoppingList(newList);
        setSelectedShoppingItems([]);
    };

    const handleCook = (recipe) => {
        setCookingRecipe(recipe);
        setShowCookModal(true);
    };

    const confirmCook = () => {
        if (cookingRecipe && cookingRecipe.ingredients) {
            const newInventory = { ...inventory };
            cookingRecipe.ingredients.forEach(ing => {
                const current = newInventory[ing.name] || 0;
                newInventory[ing.name] = Math.max(0, current - ing.quantity);
            });
            setInventory(newInventory);
        }
        setShowCookModal(false);
        setCookingRecipe(null);
    };

    const cancelCook = () => {
        setShowCookModal(false);
        setCookingRecipe(null);
    };

    const handleDrop = (e, day) => {
        e.preventDefault();
        const recipeId = e.dataTransfer.getData('text/plain');
        if (recipeId) {
            setCalendar({ ...calendar, [day]: recipeId });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    return React.createElement('div', { className: 'app' },
        React.createElement('h1', null, 'Meal Planner'),
        showCookModal && cookingRecipe && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal' },
                React.createElement('h2', null, `Cook ${cookingRecipe.name}?`),
                React.createElement('p', null, 'This will consume the following ingredients from your inventory:'),
                React.createElement('ul', null,
                    cookingRecipe.ingredients.map((ing, index) => {
                        const available = inventory[ing.name] || 0;
                        const required = ing.quantity;
                        const isInsufficient = available < required;
                        const isMissing = available === 0;
                        return React.createElement('li', {
                            key: index,
                            className: isInsufficient ? 'insufficient-ingredient' : ''
                        },
                            React.createElement('span', null, `${ing.name}: ${required} ${ing.unit || ''}`),
                            React.createElement('span', { className: 'inventory-status' },
                                ` (Available: ${available}${isMissing ? ' - MISSING' : isInsufficient ? ' - INSUFFICIENT' : ''})`
                            )
                        );
                    })
                ),
                React.createElement('div', { className: 'modal-buttons' },
                    React.createElement('button', { onClick: confirmCook }, 'Confirm'),
                    React.createElement('button', { onClick: cancelCook }, 'Cancel')
                )
            )
        ),
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
                        setEditingRecipe(null);
                    },
                    onCancel: () => {
                        setShowEditModal(false);
                        setEditingRecipe(null);
                    }
                })
            )
        ),
        React.createElement('div', { className: 'tabs' },
            React.createElement('button', {
                className: (activeTab === 'calendar' || activeTab === 'recipes') ? 'tab active' : 'tab',
                onClick: () => setActiveTab('calendar')
            }, 'Meal Planner'),
            React.createElement('button', {
                className: activeTab === 'inventory' ? 'tab active' : 'tab',
                onClick: () => setActiveTab('inventory')
            }, 'Inventory'),
            React.createElement('button', {
                className: activeTab === 'shopping' ? 'tab active' : 'tab',
                onClick: () => setActiveTab('shopping')
            }, 'Shopping List')
        ),
        (activeTab === 'calendar' || activeTab === 'recipes') && React.createElement('div', { className: 'main-content' },
            React.createElement(Calendar, { calendar, handleDrop, handleDragOver, getRecipeById, handleCook }),
            React.createElement(RecipeList, {
                recipes,
                inventory,
                addRecipe,
                updateRecipe,
                deleteRecipe,
                onEditRecipe: (recipe) => {
                    setEditingRecipe(recipe);
                    setShowEditModal(true);
                }
            })
        ),
        activeTab === 'inventory' && React.createElement(Inventory, {
            inventory,
            updateInventory
        }),
        activeTab === 'shopping' && React.createElement(ShoppingList, {
            shoppingList,
            selectedShoppingItems,
            toggleSelectShoppingItem,
            transferSelectedToInventory
        })
    );
}

function IngredientDropdown({ value, suggestions, onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);

    const handleInputChange = (e) => {
        const inputValue = e.target.value;
        onChange(inputValue);

        if (inputValue.trim()) {
            const filtered = suggestions.filter(item =>
                item.toLowerCase().includes(inputValue.toLowerCase())
            );
            setFilteredSuggestions(filtered);
            setIsOpen(filtered.length > 0);
        } else {
            setIsOpen(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        onChange(suggestion);
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setIsOpen(false);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return React.createElement('div', { className: 'dropdown-container' },
        React.createElement('input', {
            type: 'text',
            value: value,
            onChange: handleInputChange,
            onKeyDown: handleKeyDown,
            onFocus: () => {
                if (value.trim() && filteredSuggestions.length > 0) {
                    setIsOpen(true);
                }
            },
            onBlur: () => {
                // Delay closing to allow click on suggestions
                setTimeout(() => setIsOpen(false), 150);
            },
            placeholder: placeholder,
            className: 'dropdown-input'
        }),
        isOpen && React.createElement('ul', { className: 'dropdown-list' },
            filteredSuggestions.slice(0, 5).map((suggestion, index) =>
                React.createElement('li', {
                    key: index,
                    onClick: () => handleSuggestionClick(suggestion),
                    className: 'dropdown-item'
                }, suggestion)
            )
        )
    );
}

function RecipeList({ recipes, inventory, addRecipe, updateRecipe, deleteRecipe, onEditRecipe }) {
    const [newRecipe, setNewRecipe] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newRecipe.trim()) {
            addRecipe({ name: newRecipe, ingredients: [] });
            setNewRecipe('');
        }
    };

    return React.createElement('div', { className: 'recipe-list' },
        React.createElement('h2', null, 'Recipes'),
        React.createElement('form', { onSubmit: handleSubmit },
            React.createElement('input', {
                type: 'text',
                value: newRecipe,
                onChange: (e) => setNewRecipe(e.target.value),
                placeholder: 'Add new recipe'
            }),
            React.createElement('button', { type: 'submit' }, 'Add')
        ),
        React.createElement('ul', null,
            recipes.map(recipe =>
                React.createElement(RecipeItem, {
                    key: recipe.id,
                    recipe,
                    onEdit: onEditRecipe,
                    onDelete: deleteRecipe
                })
            )
        )
    );
}

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
                    onDelete(recipe.id);
                },
                className: 'delete-btn'
            }, 'Delete')
        )
    );
}

function Calendar({ calendar, handleDrop, handleDragOver, getRecipeById, handleCook }) {
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
                    handleCook
                })
            )
        )
    );
}

function DaySlot({ day, recipeId, getRecipeById, handleDrop, handleDragOver, handleCook }) {
    const recipe = recipeId ? getRecipeById(recipeId) : null;
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isCurrentDay = day === currentDay;
    return React.createElement('div', {
        className: `day-slot ${isCurrentDay ? 'current-day' : ''}`,
        onDrop: (e) => handleDrop(e, day),
        onDragOver: handleDragOver
    },
        React.createElement('h3', null, day),
        recipe ? React.createElement('p', null, recipe.name) : React.createElement('p', null, 'Drop recipe here'),
        recipe && React.createElement('button', {
            onClick: () => handleCook(recipe),
            style: { marginTop: '10px', width: '100%' }
        }, 'Cook')
    );
}

function Inventory({ inventory, updateInventory }) {
    const [newItem, setNewItem] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);

    const handleAddItem = (e) => {
        e.preventDefault();
        if (newItem.trim()) {
            updateInventory(newItem, newQuantity);
            setNewItem('');
            setNewQuantity(1);
        }
    };

    const handleUpdateQuantity = (item, quantity) => {
        updateInventory(item, parseFloat(quantity) || 0);
    };

    const handleIncrement = (item, currentQuantity) => {
        updateInventory(item, currentQuantity + 1);
    };

    const handleDecrement = (item, currentQuantity) => {
        updateInventory(item, Math.max(0, currentQuantity - 1));
    };

    const handleRemoveItem = (item) => {
        const updated = { ...inventory };
        delete updated[item];
        // Since we can't directly set inventory, we'll need to pass a function
        // For now, setting to 0 will effectively remove it from calculations
        updateInventory(item, 0);
    };

    return React.createElement('div', { className: 'inventory' },
        React.createElement('h2', null, 'Inventory'),
        React.createElement('form', { onSubmit: handleAddItem },
            React.createElement('input', {
                type: 'text',
                value: newItem,
                onChange: (e) => setNewItem(e.target.value),
                placeholder: 'Item name'
            }),
            React.createElement('input', {
                type: 'number',
                value: newQuantity,
                onChange: (e) => setNewQuantity(parseFloat(e.target.value) || 0),
                placeholder: 'Quantity'
            }),
            React.createElement('button', { type: 'submit' }, 'Add Item')
        ),
        React.createElement('ul', null,
            Object.entries(inventory).map(([item, quantity]) =>
                quantity > 0 && React.createElement('li', { key: item, className: 'inventory-item' },
                    React.createElement('span', null, item),
                    React.createElement('div', { className: 'quantity-controls' },
                        React.createElement('button', {
                            onClick: () => handleDecrement(item, quantity),
                            className: 'quantity-btn'
                        }, '-'),
                        React.createElement('input', {
                            type: 'number',
                            value: quantity,
                            onChange: (e) => handleUpdateQuantity(item, e.target.value),
                            min: '0',
                            className: 'quantity-input'
                        }),
                        React.createElement('button', {
                            onClick: () => handleIncrement(item, quantity),
                            className: 'quantity-btn'
                        }, '+')
                    ),
                    React.createElement('button', {
                        onClick: () => handleRemoveItem(item)
                    }, 'Remove')
                )
            )
        )
    );
}

function EditRecipeForm({ recipe, inventory, recipes, onSave, onCancel }) {
    const [recipeForm, setRecipeForm] = useState({
        name: recipe.name,
        ingredients: recipe.ingredients || []
    });

    // Get all known ingredients from recipes and inventory
    const getAllIngredients = () => {
        const recipeIngredients = new Set();
        recipes.forEach(r => {
            if (r.ingredients) {
                r.ingredients.forEach(ing => {
                    if (ing.name) recipeIngredients.add(ing.name);
                });
            }
        });
        return Array.from(recipeIngredients).concat(Object.keys(inventory)).filter((item, index, arr) => arr.indexOf(item) === index);
    };

    const handleSave = () => {
        onSave(recipeForm);
    };

    const addIngredient = () => {
        setRecipeForm({
            ...recipeForm,
            ingredients: [...recipeForm.ingredients, { name: '', quantity: 1, unit: '' }]
        });
    };

    const updateIngredient = (index, field, value) => {
        const updatedIngredients = [...recipeForm.ingredients];
        updatedIngredients[index][field] = value;
        setRecipeForm({ ...recipeForm, ingredients: updatedIngredients });
    };

    const removeIngredient = (index) => {
        setRecipeForm({
            ...recipeForm,
            ingredients: recipeForm.ingredients.filter((_, i) => i !== index)
        });
    };

    return React.createElement('div', { className: 'edit-recipe-form' },
        React.createElement('input', {
            type: 'text',
            value: recipeForm.name,
            onChange: (e) => setRecipeForm({ ...recipeForm, name: e.target.value }),
            placeholder: 'Recipe name',
            className: 'recipe-name-input'
        }),
        React.createElement('h4', null, 'Ingredients'),
        React.createElement('div', { className: 'ingredients-list' },
            recipeForm.ingredients.map((ing, index) =>
                React.createElement('div', { key: index, className: 'ingredient-row' },
                    React.createElement(IngredientDropdown, {
                        value: ing.name,
                        suggestions: getAllIngredients(),
                        onChange: (value) => updateIngredient(index, 'name', value),
                        placeholder: 'Ingredient name'
                    }),
                    React.createElement('input', {
                        type: 'number',
                        value: ing.quantity,
                        onChange: (e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0),
                        placeholder: 'Quantity'
                    }),
                    React.createElement('input', {
                        type: 'text',
                        value: ing.unit,
                        onChange: (e) => updateIngredient(index, 'unit', e.target.value),
                        placeholder: 'Unit'
                    }),
                    React.createElement('button', {
                        onClick: () => removeIngredient(index),
                        className: 'remove-ingredient-btn'
                    }, 'Remove')
                )
            )
        ),
        React.createElement('button', { onClick: addIngredient, className: 'add-ingredient-btn' }, 'Add Ingredient'),
        React.createElement('div', { className: 'modal-buttons' },
            React.createElement('button', { onClick: handleSave }, 'Save'),
            React.createElement('button', { onClick: onCancel }, 'Cancel')
        )
    );
}

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

ReactDOM.render(React.createElement(App), document.getElementById('root'));
