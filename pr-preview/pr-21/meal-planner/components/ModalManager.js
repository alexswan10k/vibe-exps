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
    setShoppingList,
    llmProvider,
    setLlmProvider,
    lmStudioEndpoint,
    setLmStudioEndpoint,
    lmStudioModel,
    setLmStudioModel,
    openRouterApiKey,
    setOpenRouterApiKey,
    openRouterModel,
    setOpenRouterModel,
    showScanner,
    onScan,
    onCloseScanner
}) {
    const handleImportRecipe = () => {
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
    };

    const handleImportData = (data) => {
        if (data.recipes) setRecipes(data.recipes);
        if (data.inventory) setInventory(data.inventory);
        if (data.ingredientsData) setIngredientsData(data.ingredientsData);
        if (data.calendar) setCalendar(data.calendar);
        if (data.shoppingList) setShoppingList(data.shoppingList);
    };

    const handleClearAllData = () => {
        setRecipes([]);
        setInventory({});
        setIngredientsData({});
        setCalendar({
            Monday: null, Tuesday: null, Wednesday: null, Thursday: null,
            Friday: null, Saturday: null, Sunday: null
        });
        setShoppingList({});
    };

    return React.createElement(React.Fragment, null,
        React.createElement(CookModal, {
            show: showCookModal && cookingRecipe,
            recipe: cookingRecipe,
            inventory: inventory,
            onConfirm: confirmCook,
            onCancel: cancelCook
        }),

        React.createElement(EditRecipeModal, {
            show: showEditModal,
            recipe: editingRecipe,
            inventory: inventory,
            recipes: recipes,
            onSave: (recipeData) => {
                updateRecipe(editingRecipe.id, recipeData);
                setShowEditModal(false);
            },
            onCancel: () => setShowEditModal(false)
        }),

        React.createElement(PasteResultModal, {
            show: showPasteModal,
            pastedResult: pastedResult,
            onPastedResultChange: (e) => setPastedResult(e.target.value),
            onImport: handleImportRecipe,
            onCancel: () => {
                setShowPasteModal(false);
                setPastedResult('');
            }
        }),

        React.createElement(RecipeSelectModal, {
            show: showRecipeSelectModal,
            selectingDay: selectingDay,
            recipes: recipes,
            onSelectRecipe: selectRecipeForDay,
            onClearSelection: clearRecipeForDay,
            onClose: () => setShowRecipeSelectModal(false)
        }),

        React.createElement(DataManagementModal, {
            show: showDataModal,
            recipes: recipes,
            inventory: inventory,
            ingredientsData: ingredientsData,
            calendar: calendar,
            shoppingList: shoppingList,
            onLoadSampleData: loadSampleData,
            onResetToSampleData: resetToSampleData,
            onExportData: () => {
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
            },
            onImportData: handleImportData,
            onClearAllData: handleClearAllData,
            onClose: () => setShowDataModal(false),
            llmProvider,
            setLlmProvider,
            lmStudioEndpoint,
            setLmStudioEndpoint,
            lmStudioModel,
            setLmStudioModel,
            openRouterApiKey,
            setOpenRouterApiKey,
            openRouterModel,
            setOpenRouterModel
        }),

        showScanner && React.createElement('div', { className: 'modal-overlay' },
            React.createElement('div', { className: 'modal' },
                React.createElement(BarcodeScanner, {
                    onScanSuccess: onScan,
                    onClose: onCloseScanner,
                    onError: (err) => console.error(err)
                })
            )
        )
    );
}
