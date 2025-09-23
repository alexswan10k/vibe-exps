function Inventory({ inventory, updateInventory, recipes, calendar, ingredientsData, updateIngredientsData }) {
    const [newItem, setNewItem] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);
    const [expandedItems, setExpandedItems] = useState({});

    const getAllIngredients = () => {
        const ingredients = new Set();
        recipes.forEach(recipe => {
            if (recipe.ingredients) {
                recipe.ingredients.forEach(ing => ingredients.add(ing.name));
            }
        });
        return Array.from(ingredients);
    };

    const getRecipesUsingIngredient = (ingredient) => {
        const allUsing = recipes.filter(recipe => recipe.ingredients && recipe.ingredients.some(ing => ing.name === ingredient));
        const allocatedRecipeIds = new Set(Object.values(calendar).filter(id => id));
        const allocated = allUsing.filter(recipe => allocatedRecipeIds.has(recipe.id));
        const other = allUsing.filter(recipe => !allocatedRecipeIds.has(recipe.id));
        return { allocated, other };
    };

    const allIngredients = getAllIngredients();
    const neededIngredients = new Set();
    Object.values(calendar).forEach(recipeId => {
        if (recipeId) {
            const recipe = recipes.find(r => r.id == recipeId);
            if (recipe && recipe.ingredients) {
                recipe.ingredients.forEach(ing => neededIngredients.add(ing.name));
            }
        }
    });
    const inventoryItemsWithStock = Object.keys(inventory).filter(item => (inventory[item] || 0) > 0);
    const missingNeededItems = Array.from(neededIngredients).filter(item => (inventory[item] || 0) === 0);
    const allItems = [...new Set([...inventoryItemsWithStock, ...missingNeededItems])].sort();

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
        updateInventory(item, 0);
    };

    const defaultNutritional = {
        vitamins: {
            vitaminA: false,
            vitaminC: false,
            vitaminD: false,
            vitaminE: false,
            vitaminK1: false,
            vitaminK2: false,
            vitaminB12: false,
            folate: false
        },
        minerals: {
            calcium: false,
            iron: false,
            magnesium: false,
            potassium: false,
            zinc: false
        }
    };

    const updateNutrient = (item, type, nutrient, checked) => {
        const newData = { ...ingredientsData };
        if (!newData[item]) newData[item] = { vitamins: {}, minerals: {} };
        if (!newData[item][type]) newData[item][type] = {};
        newData[item][type][nutrient] = checked;
        updateIngredientsData(newData);
    };

    const toggleExpanded = (item) => {
        setExpandedItems(prev => ({
            ...prev,
            [item]: !prev[item]
        }));
    };

    const getNutrientSummary = (item) => {
        const data = ingredientsData[item];
        if (!data) return 'No nutrients';

        const selectedVitamins = Object.keys(data.vitamins || {}).filter(v => data.vitamins[v]);
        const selectedMinerals = Object.keys(data.minerals || {}).filter(m => data.minerals[m]);

        const allSelected = [...selectedVitamins, ...selectedMinerals];
        return allSelected.length > 0 ? allSelected.join(', ') : 'No nutrients';
    };

    const getSelectedNutrients = (item) => {
        const data = ingredientsData[item];
        if (!data) return [];
        const selected = [];
        if (data.vitamins) {
            Object.keys(data.vitamins).forEach(vit => {
                if (data.vitamins[vit]) selected.push({ type: 'vitamins', name: vit });
            });
        }
        if (data.minerals) {
            Object.keys(data.minerals).forEach(min => {
                if (data.minerals[min]) selected.push({ type: 'minerals', name: min });
            });
        }
        return selected;
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
            allItems.map(item => {
                const quantity = inventory[item] || 0;
                const { allocated, other } = getRecipesUsingIngredient(item);
                const isMissing = quantity === 0;
                let recipeText = '';
                if (allocated.length > 0) {
                    recipeText += `This week: ${allocated.map(r => r.name).join(', ')}`;
                }
                if (other.length > 0) {
                    if (recipeText) recipeText += ' | ';
                    recipeText += `Other recipes: ${other.map(r => r.name).join(', ')}`;
                }
                if (!recipeText) {
                    recipeText = 'Not used in any recipes';
                }
                const selectedNutrients = getSelectedNutrients(item);
                const nutrientSummary = selectedNutrients.length > 0 ? selectedNutrients.map(n => n.name).join(', ') : 'No nutrients';
                return React.createElement('li', { key: item, className: `inventory-item ${isMissing ? 'missing-ingredient' : ''}` },
                    React.createElement('span', null, item),
                    React.createElement('div', { className: 'recipe-usage' }, recipeText),
                    React.createElement('div', { className: 'item-row' },
                        React.createElement('div', { className: 'quantity-section' },
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
                                onClick: () => handleRemoveItem(item),
                                className: 'remove-btn'
                            }, 'Remove')
                        ),
                        React.createElement('div', { className: 'nutrient-section' },
                            React.createElement('div', { className: 'nutrient-tags' },
                                React.createElement('span', { className: 'nutrient-summary-text' }, nutrientSummary),
                                React.createElement('button', {
                                    className: 'add-nutrient-btn',
                                    onClick: () => toggleExpanded(item)
                                }, '+')
                            )
                        )
                    ),
                    expandedItems[item] ? React.createElement('div', { className: 'nutrient-details' },
                        React.createElement('h5', null, 'Vitamins:'),
                        React.createElement('div', { className: 'checkbox-group' },
                            Object.keys(defaultNutritional.vitamins).map(vit =>
                                React.createElement('label', { key: vit },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: ingredientsData[item]?.vitamins?.[vit] || false,
                                        onChange: (e) => updateNutrient(item, 'vitamins', vit, e.target.checked)
                                    }),
                                    vit
                                )
                            )
                        ),
                        React.createElement('h5', null, 'Minerals:'),
                        React.createElement('div', { className: 'checkbox-group' },
                            Object.keys(defaultNutritional.minerals).map(min =>
                                React.createElement('label', { key: min },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: ingredientsData[item]?.minerals?.[min] || false,
                                        onChange: (e) => updateNutrient(item, 'minerals', min, e.target.checked)
                                    }),
                                    min
                                )
                            )
                        )
                    ) : null

                );
            })
        )
    );
}
