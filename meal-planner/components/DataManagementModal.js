function DataManagementModal({
    show,
    recipes,
    inventory,
    ingredientsData,
    calendar,
    shoppingList,
    onLoadSampleData,
    onResetToSampleData,
    onExportData,
    onImportData,
    onClearAllData,
    onClose,
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
}) {
    if (!show) return null;

    return React.createElement('div', {
        className: 'modal-overlay',
        onClick: onClose
    },
        React.createElement('div', {
            className: 'modal data-modal',
            onClick: (e) => e.stopPropagation()
        },
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
                                onLoadSampleData();
                                alert('Sample data loaded! The new recipes and ingredients are now available.');
                                onClose();
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
                                    onResetToSampleData();
                                    alert('Reset to sample data complete! The app has been reset with fresh sample data.');
                                    onClose();
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
                                                onImportData(data);
                                                alert('Data imported successfully!');
                                                onClose();
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
                    React.createElement('h3', null, 'LLM Configuration'),
                    React.createElement('div', { className: 'llm-config' },
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('label', null, 'Provider:'),
                            React.createElement('select', {
                                value: llmProvider,
                                onChange: (e) => setLlmProvider(e.target.value)
                            },
                                React.createElement('option', { value: 'lmStudio' }, 'LMStudio'),
                                React.createElement('option', { value: 'openRouter' }, 'OpenRouter')
                            )
                        ),
                        llmProvider === 'lmStudio' && React.createElement(React.Fragment, null,
                            React.createElement('div', { className: 'setting-row' },
                                React.createElement('label', null, 'LMStudio Endpoint:'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: lmStudioEndpoint,
                                    onChange: (e) => setLmStudioEndpoint(e.target.value),
                                    placeholder: 'http://localhost:1234'
                                })
                            ),
                            React.createElement('div', { className: 'setting-row' },
                                React.createElement('label', null, 'Model:'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: lmStudioModel,
                                    onChange: (e) => setLmStudioModel(e.target.value),
                                    placeholder: 'qwen/qwen3-4b-thinking-2507'
                                })
                            )
                        ),
                        llmProvider === 'openRouter' && React.createElement(React.Fragment, null,
                            React.createElement('div', { className: 'setting-row' },
                                React.createElement('label', null, 'API Key:'),
                                React.createElement('input', {
                                    type: 'password',
                                    value: openRouterApiKey,
                                    onChange: (e) => setOpenRouterApiKey(e.target.value),
                                    placeholder: 'sk-or-v1-...'
                                })
                            ),
                            React.createElement('div', { className: 'setting-row' },
                                React.createElement('label', null, 'Model:'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: openRouterModel,
                                    onChange: (e) => setOpenRouterModel(e.target.value),
                                    placeholder: 'openai/gpt-4o'
                                })
                            )
                        )
                    )
                ),
                React.createElement('div', { className: 'data-section' },
                    React.createElement('h3', null, 'Danger Zone'),
                    React.createElement('button', {
                        className: 'data-btn cleanup',
                        onClick: () => {
                            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                                onClearAllData();
                                alert('All data cleared!');
                                onClose();
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
                React.createElement('button', { onClick: onClose }, 'Close')
            )
        )
    );
}
