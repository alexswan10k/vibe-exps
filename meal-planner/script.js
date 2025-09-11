const { useState, useEffect } = React;

function App() {
    const [recipes, setRecipes] = useState([]);
    const [inventory, setInventory] = useState({});
    const [shoppingList, setShoppingList] = useState({});
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
            React.createElement(Calendar, { calendar, handleDrop, handleDragOver, getRecipeById }),
            React.createElement(RecipeList, {
                recipes,
                inventory,
                addRecipe,
                updateRecipe,
                deleteRecipe
            })
        ),
        activeTab === 'inventory' && React.createElement(Inventory, {
            inventory,
            updateInventory
        }),
        activeTab === 'shopping' && React.createElement(ShoppingList, {
            shoppingList
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

function RecipeList({ recipes, inventory, addRecipe, updateRecipe, deleteRecipe }) {
    const [newRecipe, setNewRecipe] = useState('');
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [recipeForm, setRecipeForm] = useState({
        name: '',
        ingredients: []
    });

    // Get all known ingredients from recipes and inventory
    const getAllIngredients = () => {
        const recipeIngredients = new Set();
        recipes.forEach(recipe => {
            if (recipe.ingredients) {
                recipe.ingredients.forEach(ing => {
                    if (ing.name) recipeIngredients.add(ing.name);
                });
            }
        });
        return Array.from(recipeIngredients).concat(Object.keys(inventory)).filter((item, index, arr) => arr.indexOf(item) === index);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newRecipe.trim()) {
            addRecipe({ name: newRecipe, ingredients: [] });
            setNewRecipe('');
        }
    };

    const handleEditRecipe = (recipe) => {
        setEditingRecipe(recipe.id);
        setRecipeForm({
            name: recipe.name,
            ingredients: recipe.ingredients || []
        });
    };

    const handleSaveRecipe = () => {
        updateRecipe(editingRecipe, recipeForm);
        setEditingRecipe(null);
        setRecipeForm({ name: '', ingredients: [] });
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
                    onEdit: handleEditRecipe,
                    onDelete: deleteRecipe
                })
            )
        ),
        editingRecipe && React.createElement('div', { className: 'recipe-editor' },
            React.createElement('h3', null, 'Edit Recipe'),
            React.createElement('input', {
                type: 'text',
                value: recipeForm.name,
                onChange: (e) => setRecipeForm({ ...recipeForm, name: e.target.value }),
                onKeyDown: (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveRecipe();
                    }
                },
                placeholder: 'Recipe name'
            }),
            React.createElement('h4', null, 'Ingredients'),
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
                        placeholder: 'Quantity',
                        onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveRecipe();
                            }
                        }
                    }),
                    React.createElement('input', {
                        type: 'text',
                        value: ing.unit,
                        onChange: (e) => updateIngredient(index, 'unit', e.target.value),
                        placeholder: 'Unit',
                        onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveRecipe();
                            }
                        }
                    }),
                    React.createElement('button', {
                        onClick: () => removeIngredient(index)
                    }, 'Remove')
                )
            ),
            React.createElement('button', { onClick: addIngredient }, 'Add Ingredient'),
            React.createElement('div', null,
                React.createElement('button', { onClick: handleSaveRecipe }, 'Save'),
                React.createElement('button', {
                    onClick: () => setEditingRecipe(null)
                }, 'Cancel')
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

function Calendar({ calendar, handleDrop, handleDragOver, getRecipeById }) {
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
                    handleDragOver
                })
            )
        )
    );
}

function DaySlot({ day, recipeId, getRecipeById, handleDrop, handleDragOver }) {
    const recipe = recipeId ? getRecipeById(recipeId) : null;
    return React.createElement('div', {
        className: 'day-slot',
        onDrop: (e) => handleDrop(e, day),
        onDragOver: handleDragOver
    },
        React.createElement('h3', null, day),
        recipe ? React.createElement('p', null, recipe.name) : React.createElement('p', null, 'Drop recipe here')
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

function ShoppingList({ shoppingList }) {
    return React.createElement('div', { className: 'shopping-list' },
        React.createElement('h2', null, 'Shopping List'),
        React.createElement('ul', null,
            Object.entries(shoppingList).map(([item, quantity]) =>
                React.createElement('li', { key: item, className: 'shopping-item' },
                    React.createElement('span', null, `${item}: ${quantity}`)
                )
            )
        ),
        Object.keys(shoppingList).length === 0 && React.createElement('p', null, 'No items needed. Your shopping list updates automatically based on your meal plan and inventory.')
    );
}

ReactDOM.render(React.createElement(App), document.getElementById('root'));
